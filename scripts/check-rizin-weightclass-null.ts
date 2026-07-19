// デプロイ前ゲート(PR-2・2026-07-19): RIZIN本戦MMA boutのweightClass欠落を検知する。
//
// 深夜のWikipediaバッチはweightClassを埋めないため、直近のイベントでも
// 「階級null→latestRizinDivisionが階級バケット不能→静かに非掲載」という事故が
// 再発し得る構造(ティレノフのLM15時点の実例で発覚)。data/rizinRecords.json
// (RIZIN公式ソース由来の権威データ)側に該当boutの上書きが既に登録されていれば
// applyRizinRecordsToHistoryが実行時にweightClassを補完するため、そのケースは
// 誤検出しない。
//
// fatal対象は「直近運用での再発防止」に限定する。実データ調査で判明した通り、
// 2015〜2024年頃の過去boutにはrizinRecords.json側のスクレイピングが元々未収録
// (該当イベントがbouts:[]で登録されている等)のケースが57件存在し、これは
// 「今回新規に発生した階級null」ではなく恒常的なカバレッジギャップ。これを
// fatal扱いにするとビルドが常時ブロックされ運用不能になるため、直近
// RECENT_WINDOW_MONTHSヶ月以内のRIZIN本戦MMA boutのみをfatal対象とし、
// それより古いものはwarningに集約して件数のみ報告する(2026-07-19、ユーザー
// 判断により直近方式を採用)。
// - fatal: 直近RECENT_WINDOW_MONTHSヶ月以内のRIZIN本戦MMA boutでweightClass
//   欠落 かつ rizinRecords.json側にも上書きが無い場合。対処法は
//   data/rizinRecords.jsonへの権威的weightKg追加。
// - warning: (a) 上記より古いRIZIN本戦MMA boutのweightClass欠落(既知の
//   カバレッジギャップ)、(b) 他団体・非MMA(キック/エキシビション等)bout
//   のweightClass欠落。いずれも階級バケット判定への影響は個別確認が必要だが
//   デプロイはブロックしない。
//
// 自動修正はしない(検出・停止・ログのみ)。
// 実行: npx tsx scripts/check-rizin-weightclass-null.ts
import fs from "fs";
import path from "path";
import { FighterRecordsInput, isRizinMmaEvent } from "../src/lib/mnewsRating/engine";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import { latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import { getDivisionOverlay } from "../src/lib/mnewsRating/fighterDivisions";
import { FIGHTERS } from "../src/lib/fighters";

const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const RIZIN_RECORDS_PATH = path.join(process.cwd(), "data", "rizinRecords.json");
const RECENT_WINDOW_MONTHS = 12;

function main() {
  if (!fs.existsSync(RECORDS_PATH)) {
    console.log("[階級null検査] data/fighterRecords.json が存在しないためスキップ");
    return;
  }

  let records: FighterRecordsInput;
  try {
    records = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  } catch (e) {
    console.error(`[階級null検査] data/fighterRecords.json のJSON解析に失敗: ${e}`);
    process.exit(1);
  }

  const rizinEvents: RizinRecordsEvent[] = fs.existsSync(RIZIN_RECORDS_PATH)
    ? JSON.parse(fs.readFileSync(RIZIN_RECORDS_PATH, "utf8"))
    : [];
  const index = buildRizinRecordsIndex(rizinEvents);
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
  const nominalWeightClassBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.weightClass]));

  // 直近判定のアンカー: 全選手のRIZIN本戦MMA boutのうち最新日付。
  let latestRizinMmaDate = "";
  for (const entry of Object.values(records)) {
    for (const h of entry.history ?? []) {
      if (isRizinMmaEvent(h.event) && h.date > latestRizinMmaDate) latestRizinMmaDate = h.date;
    }
  }
  const recentCutoff = (() => {
    const base = latestRizinMmaDate || new Date().toISOString().slice(0, 10);
    const d = new Date(base);
    d.setMonth(d.getMonth() - RECENT_WINDOW_MONTHS);
    return d.toISOString().slice(0, 10);
  })();

  const fatals: string[] = [];
  let oldGapCount = 0;
  const oldGapSlugs = new Set<string>();
  let otherOrgWarningCount = 0;
  const otherOrgWarningSlugs = new Set<string>();
  const bucketFailures: string[] = [];

  for (const [slug, entry] of Object.entries(records)) {
    const { history } = applyRizinRecordsToHistory(slug, entry.history ?? [], index);
    const nameJa = nameBySlug.get(slug) ?? slug;

    let hasRizinMma = false;
    for (const h of history) {
      if (isRizinMmaEvent(h.event)) hasRizinMma = true;
      if (h.weightClass) continue;
      if (isRizinMmaEvent(h.event)) {
        if (h.date >= recentCutoff) {
          fatals.push(`${slug}(${nameJa}): ${h.event} ${h.date} vs ${h.opponent} — weightClass欠落・rizinRecords.json未上書き`);
        } else {
          oldGapCount++;
          oldGapSlugs.add(slug);
        }
      } else {
        otherOrgWarningCount++;
        otherOrgWarningSlugs.add(slug);
      }
    }

    if (!hasRizinMma) continue;
    const division = getDivisionOverlay(slug) ?? latestRizinDivision(history, nominalWeightClassBySlug.get(slug));
    if (!division) {
      bucketFailures.push(`${slug}(${nameJa})`);
    }
  }

  console.log(`[階級null検査] 直近判定アンカー: 最新RIZIN本戦MMA bout日=${latestRizinMmaDate || "(データなし)"} / cutoff=${recentCutoff}`);

  if (oldGapCount) {
    console.warn(
      `[階級null検査] cutoff(${recentCutoff})より古いRIZIN本戦MMA boutのweightClass欠落(warning・既知のカバレッジギャップ・デプロイ継続): ${oldGapCount}件 / 対象選手${oldGapSlugs.size}名`
    );
  }

  if (otherOrgWarningCount) {
    console.warn(
      `[階級null検査] 他団体・非MMA boutのweightClass欠落(warning・デプロイ継続): ${otherOrgWarningCount}件 / 対象選手${otherOrgWarningSlugs.size}名`
    );
  }

  if (bucketFailures.length) {
    console.warn(
      `[階級null検査] 階級バケット不能で階級別ランキング非掲載(参考情報・単独ではブロックしない): ${bucketFailures.length}名\n  ${bucketFailures.join("\n  ")}`
    );
  }

  if (fatals.length) {
    console.error(
      `[階級null検査] ★直近${RECENT_WINDOW_MONTHS}ヶ月以内のRIZIN本戦MMA boutでweightClass欠落かつrizinRecords.json未上書き(${fatals.length}件)。デプロイをブロックします:\n` +
        `  対処法: data/rizinRecords.jsonに該当イベント・boutの権威的weightKgを追加して上書き登録してください。\n  ` +
        fatals.join("\n  ")
    );
    process.exit(1);
  }

  console.log(
    `[階級null検査] OK(fatal: 0件 / 古いギャップ: ${oldGapCount}件 / 他団体warning: ${otherOrgWarningCount}件 / 階級バケット不能: ${bucketFailures.length}名)`
  );
}

main();
