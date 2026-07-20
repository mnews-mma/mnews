// 567バケット失敗フラグ機構: T2(監査キュー生成)+T4(不整合ディテクタ)の
// dry-run(2026-07-20、トリアージ版)。読み取り専用・本番不変・オフライン完結。
// data/rankings.json等への書き込みは一切行わない。フル再生成
// (update-mnews-rating.ts)・update-fighter-records.tsは呼び出さない
// (Gate2の共有フル再生成ゲートには一切触れない)。
//
// 検出する不整合:
// - モードB(dropped): RIZIN本戦MMA boutでweightClassが欠落しており、
//   階級バケットできない試合。
// - モードA(misbucketed): weightClassは判明しているが、そのbout単位の
//   階級(mapToDivision)が選手の現在の掲載階級(latestRizinDivision+
//   事実オーバーレイ)と食い違う試合。
// - data-conflict(misbucketedのサブ分類): 同一boutについて両選手の
//   history側weightClass表記から求めた階級が、正規化後も食い違う場合。
//   機械では正解が決まらないデータ不整合(元データの訂正が必要。バケット
//   トリアージとは別トラック)。
//
// status区分(トリアージ版で3値に整理):
// - pending: Elo未修正・人間判断待ち(既定)。
// - elo-pending: 表示戦績のみrecordDisplayExclusionsで対応済みだが、
//   Eloは未修正のまま残っている。「解決済み」ではない — Gate2は必ず
//   eloFixed=false(=pending/elo-pendingすべて)を対象にmisbucketedを
//   処理すること。excludedというラベルでスキップしてはならない
//   (display除外済み=Elo是正不要、という誤読を防ぐため名称からexcludedを廃止)。
// - data-conflict: crossViewMismatch=trueのケース。一次ソースでの人的裏取りが
//   必要な元データの不整合(§3参照)。
//
// resolution: mode A(misbucketed)でdata-conflictでないものは、bout単位の
// weightClassから機械的に読み取れる階級をresolutionに「提案: {階級}」として
// 記入する(Gate2のバッチ適用候補)。unclassifiable/dropped/data-conflictは
// 機械提案できないため空欄のまま(§5、人的判断に集中させる対象)。
//
// T3決定的プレパス: kg数値の表記ゆれ(空白・小数点桁数)のみ正規化して
// 比較する。階級ラベルの意味的な同一視・キャッチウェイトの自動階級割り当ては
// 一切行わない(pending据え置き)。
//
// 実行: npx tsx scripts/audit-bucket-flags-dryrun.ts
import fs from "fs";
import path from "path";
import { FighterRecordsInput, isRizinMmaEvent } from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver } from "../src/lib/mnewsRating/nameIndex";
import { MnewsDivision, mapToDivision, latestRizinDivision } from "../src/lib/mnewsRating/divisions";
import { getDivisionOverlay, getRecordDisplayExclusions } from "../src/lib/mnewsRating/fighterDivisions";
import { FIGHTERS } from "../src/lib/fighters";
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import { RankingsFile } from "../src/lib/mnewsRating/rankingsFile";

const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const RIZIN_RECORDS_PATH = path.join(process.cwd(), "data", "rizinRecords.json");
const RANKINGS_PATH = path.join(process.cwd(), "data", "rankings.json");
const OUT_DIR = path.join(process.cwd(), "out");

type Category = "dropped" | "misbucketed" | "unclassifiable";
type Status = "pending" | "elo-pending" | "data-conflict";

interface QueueEntry {
  slug: string;
  opponentSlug: string | null;
  opponentLabel: string;
  date: string;
  event: string;
  weightClassRaw: string | null;
  result: string;
  currentDivision: MnewsDivision;
  boutDivision: MnewsDivision | null;
  category: Category;
  crossViewMismatch: boolean;
  status: Status;
  currentlyRanked: boolean; // 優先順位付け(§4): 掲載中選手のmode Aを最優先
  sourceUrl: string; // 出典URL欄(空)。人手確認後に埋める
  resolution: string; // 機械提案(「提案: XXX」)または人手確定値。空欄はpending
}

// T3: kg数値表記ゆれの正規化(空白除去・小数点桁数の統一)のみ。階級ラベルの
// 意味的な同一視・キャッチウェイトの自動階級割り当てはしない。
function normalizeWeightClassText(w: string | undefined | null): string {
  if (!w) return "";
  return w
    .replace(/\s+/g, "")
    .replace(/(\d+)\.0+kg/g, "$1kg")
    .replace(/(\d+\.\d*?)0+kg/g, "$1kg");
}

function applyRizinRecordsOverride(records: FighterRecordsInput, index: ReturnType<typeof buildRizinRecordsIndex>): FighterRecordsInput {
  const out: FighterRecordsInput = {};
  for (const [slug, entry] of Object.entries(records)) {
    const { history } = applyRizinRecordsToHistory(slug, entry.history ?? [], index);
    out[slug] = { ...entry, history };
  }
  return out;
}

// recordDisplayExclusionsのopponentSlugはDB外の相手を"name:XXX"疑似ノードで
// 指定することがある(扇久保×フアンアーチュレッタ、梅野×昇侍等)。resolveが
// 名前解決できない(null)場合にこの形式でも突合できるようにする。
// 中黒・空白の表記ゆれを吸収する(既存のrecordDisplayExclusions定義側の
// "name:フアンアーチュレッタ"とhistory側の"フアン・アーチュレッタ"のような差異)。
function normalizeNameForMatch(s: string): string {
  return s.replace(/[・\s]/g, "");
}

function matchesExclusion(exclusionOpponentSlug: string, resolvedOpponentSlug: string | null, opponentLabel: string): boolean {
  if (resolvedOpponentSlug && exclusionOpponentSlug === resolvedOpponentSlug) return true;
  if (!resolvedOpponentSlug && exclusionOpponentSlug.startsWith("name:")) {
    return normalizeNameForMatch(exclusionOpponentSlug.slice(5)) === normalizeNameForMatch(opponentLabel);
  }
  return false;
}

function main() {
  const rawRecords: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const rizinEvents: RizinRecordsEvent[] = fs.existsSync(RIZIN_RECORDS_PATH)
    ? JSON.parse(fs.readFileSync(RIZIN_RECORDS_PATH, "utf8"))
    : [];
  const index = buildRizinRecordsIndex(rizinEvents);
  const records = applyRizinRecordsOverride(rawRecords, index);

  const rankings: RankingsFile = fs.existsSync(RANKINGS_PATH) ? JSON.parse(fs.readFileSync(RANKINGS_PATH, "utf8")) : {};
  const rankedSlugs = new Set<string>();
  for (const div of Object.values(rankings)) {
    for (const e of div.entries) rankedSlugs.add(e.fighterId);
    if (div.champion?.fighterId) rankedSlugs.add(div.champion.fighterId);
  }

  const nominalWeightClassBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.weightClass]));
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
  const divisionBySlug = new Map<string, MnewsDivision | null>(
    Object.entries(records).map(([slug, entry]) => [
      slug,
      getDivisionOverlay(slug) ?? latestRizinDivision(entry.history ?? [], nominalWeightClassBySlug.get(slug)),
    ])
  );

  const resolve = buildOpponentResolver(records);

  const queue: QueueEntry[] = [];
  const seenBoutSlugPairs = new Set<string>(); // slug|date|opponentSlug の重複排除(選手側history直接走査のため)

  // §0会計用の集計。
  let acctTotalRizinMmaRaw = 0; // isRizinMmaEvent===trueの全エントリ(両視点合算・前座含む・階級不明選手含む)
  let acctOpeningFightExcluded = 0; // 上記のうちisOpeningFight===trueで対象外にした件数
  let acctUnknownDivisionSkipped = 0; // 前座を除いた後、選手の現階級が不明でスキップした件数
  let acctScannedRaw = 0; // 前座除外・階級判明選手のみ(dedupe前、両視点合算)
  let acctDedupedOut = 0; // pairKeyの重複によりスキップ(=両視点二重計上分)
  let acctOk = 0; // 問題なし(現階級一致・両視点一致)としてキュー化しなかった件数

  for (const [slug, entry] of Object.entries(records)) {
    const division = divisionBySlug.get(slug);
    for (const h of entry.history ?? []) {
      if (!isRizinMmaEvent(h.event)) continue;
      acctTotalRizinMmaRaw++;
      if (h.isOpeningFight) {
        acctOpeningFightExcluded++;
        continue;
      }
      if (!division) {
        acctUnknownDivisionSkipped++;
        continue;
      }
      acctScannedRaw++;

      const opponentSlug = resolve(h.opponent);
      const pairKey = `${slug}|${h.date}|${opponentSlug ?? h.opponent}`;
      if (seenBoutSlugPairs.has(pairKey)) {
        acctDedupedOut++;
        continue;
      }
      seenBoutSlugPairs.add(pairKey);

      const weightClassRaw = h.weightClass ?? null;

      // cross-view-mismatch判定: 相手側の同一boutのweightClass表記と突合する(T3正規化後)。
      let crossViewMismatch = false;
      if (opponentSlug && records[opponentSlug]) {
        const counterpart = (records[opponentSlug].history ?? []).find(
          (h2) => h2.date === h.date && resolve(h2.opponent) === slug
        );
        if (counterpart) {
          const a = normalizeWeightClassText(weightClassRaw ?? undefined);
          const b = normalizeWeightClassText(counterpart.weightClass);
          // 片方がweightClass欠落(未補完)なだけのケースは「表記の食い違い」では
          // ない(単に片方が判明していないだけ)ので矛盾とみなさない。真のデータ
          // 不整合(§3)は両者とも値があり、正規化後も一致しない場合のみ。
          if (a && b && a !== b) crossViewMismatch = true;
        }
      }

      const currentlyRanked = rankedSlugs.has(slug);

      if (!weightClassRaw) {
        queue.push({
          slug,
          opponentSlug,
          opponentLabel: h.opponent,
          date: h.date,
          event: h.event,
          weightClassRaw: null,
          result: h.result,
          currentDivision: division,
          boutDivision: null,
          category: "dropped",
          crossViewMismatch,
          status: "pending",
          currentlyRanked,
          sourceUrl: "",
          resolution: "",
        });
        continue;
      }

      const boutDivision = mapToDivision(weightClassRaw);
      if (boutDivision === null) {
        // §4-5トリアージ調査(2026-07-20)で判明: unclassifiableの大半は72〜75kg
        // 契約体重(ウェルター〜ライトヘビー相当、mapByKgが意図的にnullを返す
        // 現5階級システムの対象外域)。人的確認の結果、該当9件はいずれも武田光司・
        // コレスニックと同種の単発excursion(前後の試合は現階級と一致)だったため、
        // ヒントとして機械提案を残す。ただし最終確定はresolution欄への人手記入で
        // 行う(ここではpending・ヒントのみ、自動確定しない)。
        const kgMatch = weightClassRaw.match(/(\d+(?:\.\d+)?)\s*kg/);
        const kg = kgMatch ? Number(kgMatch[1]) : null;
        const hint = kg !== null && kg > 71.5 && kg < 93.0
          ? `ヒント: ${kg}kgはウェルター〜ライトヘビー相当(現5階級システムの対象外域)。前後の試合が現階級(${division})と一致するか要個別確認`
          : "";
        queue.push({
          slug,
          opponentSlug,
          opponentLabel: h.opponent,
          date: h.date,
          event: h.event,
          weightClassRaw,
          result: h.result,
          currentDivision: division,
          boutDivision: null,
          category: "unclassifiable",
          crossViewMismatch,
          status: "pending",
          currentlyRanked,
          sourceUrl: "",
          resolution: hint,
        });
        continue;
      }

      if (boutDivision === division && !crossViewMismatch) {
        acctOk++;
        continue; // 問題なし(現階級と一致・両視点一致)
      }

      // モードA: 現階級と不一致、または両視点不一致。
      const excludedInDisplay = getRecordDisplayExclusions(slug).some((e) => e.date === h.date && matchesExclusion(e.opponentSlug, opponentSlug, h.opponent));
      const status: Status = crossViewMismatch ? "data-conflict" : excludedInDisplay ? "elo-pending" : "pending";
      // §5: data-conflictは機械提案しない(正解が決まらない)。それ以外のmisbucketedは
      // bout単位weightClassから読み取れる階級を提案値として付与する(Gate2のバッチ適用候補)。
      const resolution =
        status === "data-conflict"
          ? ""
          : excludedInDisplay
          ? `提案: ${boutDivision}(表示戦績のみrecordDisplayExclusionsで除外済み・Eloは未修正・Gate2のElo是正対象)`
          : `提案: ${boutDivision}`;
      queue.push({
        slug,
        opponentSlug,
        opponentLabel: h.opponent,
        date: h.date,
        event: h.event,
        weightClassRaw,
        result: h.result,
        currentDivision: division,
        boutDivision,
        category: "misbucketed",
        crossViewMismatch,
        status,
        currentlyRanked,
        sourceUrl: "",
        resolution,
      });
    }
  }

  // §4優先順位: 掲載中選手のmisbucketed/dropped最優先 → 非掲載選手 → unclassifiable/data-conflictは末尾(人手専用)。
  const priorityRank = (q: QueueEntry): number => {
    if (q.status === "data-conflict") return 5;
    if (q.category === "unclassifiable") return 4;
    if (q.currentlyRanked && q.category === "misbucketed") return 0;
    if (q.currentlyRanked && q.category === "dropped") return 1;
    if (q.category === "misbucketed") return 2;
    return 3; // dropped(非掲載選手)
  };
  queue.sort((a, b) => priorityRank(a) - priorityRank(b) || a.slug.localeCompare(b.slug) || a.date.localeCompare(b.date));

  // 集計
  const byCategory = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const q of queue) {
    byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);
    byStatus.set(q.status, (byStatus.get(q.status) ?? 0) + 1);
  }

  // §0会計: pairKeyは選手視点でのユニーク化(A視点・B視点は別カウント)のため、
  // 両者とも現階級と食い違う対戦(両者ともmisbucketed)は189件中に2回計上される。
  // 真の試合単位(選手ペア+日付、順不同)でのユニーク数を別途出し、選手視点count
  // との差分を「二重計上分」として明示する(silent dropの水増し要因の切り分け)。
  const boutKey = (q: QueueEntry): string => {
    const pair = [q.slug, q.opponentSlug ?? q.opponentLabel].sort().join("~");
    return `${pair}|${q.date}`;
  };
  const uniqueBoutKeys = new Set(queue.map(boutKey));
  const flaggedByPerspective = queue.length;
  const flaggedByUniqueBout = uniqueBoutKeys.size;
  const doubleCountedFromBothPerspectives = flaggedByPerspective - flaggedByUniqueBout;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "bucket-audit-queue.json"), JSON.stringify(queue, null, 2) + "\n");

  const csvHeader = [
    "slug",
    "opponentSlug",
    "opponentLabel",
    "date",
    "event",
    "weightClassRaw",
    "result",
    "currentDivision",
    "boutDivision",
    "category",
    "crossViewMismatch",
    "status",
    "currentlyRanked",
    "sourceUrl",
    "resolution",
  ];
  const csvRows = queue.map((q) =>
    [
      q.slug,
      q.opponentSlug ?? "",
      q.opponentLabel,
      q.date,
      q.event,
      q.weightClassRaw ?? "",
      q.result,
      q.currentDivision,
      q.boutDivision ?? "",
      q.category,
      q.crossViewMismatch ? "true" : "false",
      q.status,
      q.currentlyRanked ? "true" : "false",
      q.sourceUrl,
      q.resolution,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  fs.writeFileSync(path.join(OUT_DIR, "bucket-audit-queue.csv"), [csvHeader.join(","), ...csvRows].join("\n") + "\n");

  const mdLines: string[] = [];
  mdLines.push("# 567バケット監査キュー dry-run(T2+T4, トリアージ版・読み取り専用・本番不変)");
  mdLines.push("");
  mdLines.push(`生成日時: ${new Date().toISOString()}`);
  mdLines.push("");
  mdLines.push("## §0 会計(silent dropゼロの担保)");
  mdLines.push(`- isRizinMmaEvent該当エントリ(両視点合算・dedupe前): ${acctTotalRizinMmaRaw}件`);
  mdLines.push(`  - うちオープニングファイト除外: ${acctOpeningFightExcluded}件`);
  mdLines.push(`  - うち選手の現階級が不明でスキップ: ${acctUnknownDivisionSkipped}件`);
  mdLines.push(`  - 残り(走査対象、dedupe前): ${acctScannedRaw}件`);
  mdLines.push(`    - うち両視点の二重計上分(dedupeで除外): ${acctDedupedOut}件`);
  mdLines.push(`    - dedupe後の実数: ${acctScannedRaw - acctDedupedOut}件`);
  mdLines.push(`      - 問題なし(現階級一致・両視点一致): ${acctOk}件`);
  mdLines.push(`      - キュー化(flagged): ${queue.length}件`);
  mdLines.push(
    `  - 恒等式チェック: dedupe後実数(${acctScannedRaw - acctDedupedOut}) = 問題なし(${acctOk}) + flagged(${queue.length}) → ${
      acctScannedRaw - acctDedupedOut === acctOk + queue.length ? "OK(整合)" : "不一致(要調査)"
    }`
  );
  mdLines.push("");
  mdLines.push(
    `- flagged件数の内訳(選手視点count vs 試合単位count): 選手視点=${flaggedByPerspective}件 / 試合単位ユニーク=${flaggedByUniqueBout}件 / 両視点とも該当した二重計上分=${doubleCountedFromBothPerspectives}件`
  );
  mdLines.push(
    `  (両者ともmisbucketed等になる対戦=${doubleCountedFromBothPerspectives}試合が選手視点集計で2回計上されている。567との突合は試合単位カウントで行うのが妥当)`
  );
  mdLines.push("");
  mdLines.push("## カテゴリ内訳");
  for (const [k, v] of byCategory) mdLines.push(`- ${k}: ${v}件`);
  mdLines.push("");
  mdLines.push("## ステータス内訳");
  for (const [k, v] of byStatus) mdLines.push(`- ${k}: ${v}件`);
  mdLines.push("");
  mdLines.push("## 明細(優先順位順: 掲載中選手のmisbucketed/dropped → 非掲載選手 → unclassifiable/data-conflict)");
  mdLines.push("");
  for (const q of queue) {
    const name = nameBySlug.get(q.slug) ?? q.slug;
    mdLines.push(
      `- [${q.category}/${q.status}${q.currentlyRanked ? "/掲載中" : ""}] ${q.slug}(${name}) vs ${q.opponentLabel}(${q.opponentSlug ?? "未解決"}) ${q.date} ${q.event} — weightClass="${q.weightClassRaw ?? "(欠落)"}" boutDivision=${q.boutDivision ?? "?"} currentDivision=${q.currentDivision}${q.crossViewMismatch ? " [両視点不一致]" : ""}${q.resolution ? ` / ${q.resolution}` : ""}`
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "bucket-audit-queue.md"), mdLines.join("\n") + "\n");

  console.log(`=== 567バケット監査キュー dry-run(トリアージ版) ===`);
  console.log(`§0 会計: raw=${acctTotalRizinMmaRaw} openingExcl=${acctOpeningFightExcluded} unknownDivSkip=${acctUnknownDivisionSkipped} scanned(dedupe前)=${acctScannedRaw} dedupedOut=${acctDedupedOut} scanned(dedupe後)=${acctScannedRaw - acctDedupedOut} ok=${acctOk} flagged=${queue.length}`);
  console.log(`恒等式: ${acctScannedRaw - acctDedupedOut} = ${acctOk} + ${queue.length} → ${acctScannedRaw - acctDedupedOut === acctOk + queue.length ? "OK" : "NG"}`);
  console.log(`flagged内訳: 選手視点=${flaggedByPerspective} / 試合単位ユニーク=${flaggedByUniqueBout} / 両視点二重計上分=${doubleCountedFromBothPerspectives}`);
  console.log(`カテゴリ内訳: ${[...byCategory.entries()].map(([k, v]) => `${k}=${v}`).join(" / ")}`);
  console.log(`ステータス内訳: ${[...byStatus.entries()].map(([k, v]) => `${k}=${v}`).join(" / ")}`);
  console.log(`出力: out/bucket-audit-queue.{json,csv,md}`);
}

main();
