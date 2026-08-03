// RIZIN公式サイト(jp.rizinff.com)から試合結果を機械取得し、data/rizinRecords.json
// へ書き出すバッチ(Phase 0: 生成のみ・本番エンジンへは未接続)。
// rizinEventIndex.ts(結果ページIDの静的対応表)を参照してfetchするだけで、
// 実行のたびに検索エンジン等の外部発見手段には依存しない。
//
// 実行: npx tsx scripts/update-rizin-records.ts
import fs from "fs";
import path from "path";
import { RIZIN_EVENT_INDEX } from "../src/lib/mnewsRating/rizinEventIndex";
import {
  RizinRawBoutManual,
  RIZIN_SARABA_BOUTS,
  RIZIN_SARABA_SOURCE,
  RIZIN_IZA_BOUTS,
  RIZIN_IZA_SOURCE,
  RIZIN_1_BOUTS,
  RIZIN_1_SOURCE,
  RIZIN_2_BOUTS,
  RIZIN_2_SOURCE,
  RIZIN_SUPPLEMENTAL_BOUTS_BY_EVENT,
} from "../src/lib/mnewsRating/rizinRecordOverrides";
import {
  splitIntoBoutChunks,
  parseBoutChunk,
  parseRuleInfo,
  parseMethod,
  RizinRecordsBout,
  RizinRecordsEvent,
} from "../src/lib/mnewsRating/rizinScraper";
import { findFighterSlugByName } from "../src/lib/fighters";
import { assertAllowedByRobots } from "./lib/robotsGate";

const OUT = path.join(process.cwd(), "data", "rizinRecords.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";

type RizinRecordsFile = RizinRecordsEvent[];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 取得タイムアウト・有限リトライ(2026-08-01、指示書「fetchHtml()に取得タイムアウトを
// 入れる」。詳細はbuild-deep-records.tsの同名関数のコメント参照)。
const FETCH_TIMEOUT_MS = 30_000;

async function fetchHtml(url: string, retries = 3): Promise<string> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    process.stderr.write(`[fetch] ${url} (試行${attempt + 1}/${retries + 1})\n`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTPステータス${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`[fetch] 取得に失敗しました(${retries + 1}回試行): ${url} (${String(lastError)})`);
}

function resolveWinnerName(
  fighterAName: string,
  fighterBName: string,
  markerA: "WIN" | "LOSE" | "NC" | null,
  markerB: "WIN" | "LOSE" | "NC" | null
): string | null {
  if (markerA === "WIN") return fighterAName;
  if (markerB === "WIN") return fighterBName;
  return null; // 引き分け・NC・パース不能
}

function buildEventBouts(eventName: string, date: string, html: string): { bouts: RizinRecordsBout[]; parseFailures: number } {
  const chunks = splitIntoBoutChunks(html);
  let parseFailures = 0;

  // まず全チャンクをパースする(この時点ではまだ試合順を振らない)。末尾の
  // h2見出しが必ずしも試合とは限らない(例:「RIZIN.52 大会情報」という
  // 試合外セクションが最後のarticle-headingとして出現することがある)ため、
  // パースに成功した「本物の試合」だけを対象にカード順を振り直す
  // (パース失敗チャンクをカード番号のカウントに含めると、以降の順位が
  // 1つずつずれるバグになる)。
  const successful: Array<{ raw: NonNullable<ReturnType<typeof parseBoutChunk>> }> = [];
  for (const chunk of chunks) {
    const raw = parseBoutChunk(chunk);
    if (!raw) {
      parseFailures++;
      continue;
    }
    successful.push({ raw });
  }

  // ページ内出現順: 先頭がメインイベント、末尾がオープナー
  // (「必ずメインイベントが先頭・オープナーが末尾」という表示順は
  // src/lib/eventResults.tsの既存の規約と同じ)。
  const total = successful.length;
  const parsed: RizinRecordsBout[] = successful.map(({ raw }, idx) => {
    const ruleInfo = parseRuleInfo(raw.ruleLineRaw);
    const method = parseMethod(raw.methodRaw, raw.markerA, raw.headingText);
    const winnerName = resolveWinnerName(raw.fighterAName, raw.fighterBName, raw.markerA, raw.markerB);
    const fighterASlug = findFighterSlugByName(raw.fighterAName);
    const fighterBSlug = findFighterSlugByName(raw.fighterBName);
    const winnerSlug = winnerName === raw.fighterAName ? fighterASlug : winnerName === raw.fighterBName ? fighterBSlug : null;

    return {
      cardPosition: total - idx,
      isOpeningFight: idx === total - 1,
      headingText: raw.headingText,
      fighterAName: raw.fighterAName,
      fighterBName: raw.fighterBName,
      fighterASlug,
      fighterBSlug,
      ruleType: ruleInfo.ruleType,
      weightKg: ruleInfo.weightKg,
      namedDivision: ruleInfo.namedDivision,
      resultType: method.resultType,
      winnerName,
      winnerSlug,
      round: method.round,
      time: method.time,
      methodRaw: raw.methodRaw,
      isWeighInMiss: method.isWeighInMiss,
    };
  });

  return { bouts: parsed, parseFailures };
}

// 旧テンプレート大会(RIZIN_EVENT_INDEXでmanualOverride:trueのエントリ)を
// 手動書き起こし配列からRizinRecordsBout[]へ変換する共通処理。
function buildManualOverrideBouts(manual: RizinRawBoutManual[]): RizinRecordsBout[] {
  return manual.map((b) => {
    const fighterASlug = findFighterSlugByName(b.fighterAName);
    const fighterBSlug = findFighterSlugByName(b.fighterBName);
    const winnerSlug = b.winnerName === b.fighterAName ? fighterASlug : b.winnerName === b.fighterBName ? fighterBSlug : null;
    return {
      cardPosition: b.cardPosition,
      isOpeningFight: b.cardPosition === 1,
      headingText: `第${b.cardPosition}試合`,
      fighterAName: b.fighterAName,
      fighterBName: b.fighterBName,
      fighterASlug,
      fighterBSlug,
      ruleType: b.ruleType,
      weightKg: b.weightKg,
      namedDivision: b.namedDivision,
      resultType: b.resultType,
      winnerName: b.winnerName,
      winnerSlug,
      round: b.round ?? null,
      time: b.time ?? null,
      methodRaw: b.methodRaw,
      isWeighInMiss: false,
    };
  });
}

// 「試合中止」お知らせ記事構造(rizinRecordOverrides.tsのRizinSupplementalBout参照)は
// rizinScraper.tsのどのフォーマットパーサーでもパース不可能なため、bout単位の
// 確定値をイベント名キーで自動抽出結果へマージする。cardPositionは小数値
// (前後の自動採番の間)で登録済みのため、結合後にcardPosition降順で
// 再ソートするだけで正しい表示順になる(自動採番されたbout側のcardPositionは
// 変更しない)。
function mergeSupplementalBouts(eventName: string, bouts: RizinRecordsBout[]): RizinRecordsBout[] {
  const supplemental = RIZIN_SUPPLEMENTAL_BOUTS_BY_EVENT[eventName];
  if (!supplemental || supplemental.length === 0) return bouts;

  const supplementalBouts: RizinRecordsBout[] = supplemental.map((b) => {
    const fighterASlug = findFighterSlugByName(b.fighterAName);
    const fighterBSlug = findFighterSlugByName(b.fighterBName);
    const winnerSlug = b.winnerName === b.fighterAName ? fighterASlug : b.winnerName === b.fighterBName ? fighterBSlug : null;
    return {
      cardPosition: b.cardPosition,
      isOpeningFight: false, // 小数cardPositionは定義上オープナー(=1)になり得ない
      headingText: b.headingText,
      fighterAName: b.fighterAName,
      fighterBName: b.fighterBName,
      fighterASlug,
      fighterBSlug,
      ruleType: b.ruleType,
      weightKg: b.weightKg,
      namedDivision: b.namedDivision,
      resultType: b.resultType,
      winnerName: b.winnerName,
      winnerSlug,
      round: b.round,
      time: b.time,
      methodRaw: b.methodRaw,
      isWeighInMiss: false,
    };
  });

  return [...bouts, ...supplementalBouts].sort((a, b) => b.cardPosition - a.cardPosition);
}

async function main() {
  const out: RizinRecordsFile = [];
  let totalBouts = 0;
  let totalParseFailures = 0;
  let totalUnresolvedNames = 0;
  const unresolvedNameSamples: string[] = [];

  // 旧テンプレート大会(手動書き起こし分)を時系列順(古い順)に先頭へ格納する。
  // RIZIN_EVENT_INDEX内の該当エントリはmanualOverride:trueが立っているため、
  // 後続の自動fetchループではスキップされる(二重計上防止)。
  const manualEvents = [
    { bouts: RIZIN_SARABA_BOUTS, source: RIZIN_SARABA_SOURCE },
    { bouts: RIZIN_IZA_BOUTS, source: RIZIN_IZA_SOURCE },
    { bouts: RIZIN_1_BOUTS, source: RIZIN_1_SOURCE },
    { bouts: RIZIN_2_BOUTS, source: RIZIN_2_SOURCE },
  ];
  for (const { bouts: manualBouts, source } of manualEvents) {
    const bouts = buildManualOverrideBouts(manualBouts);
    out.push({
      eventName: source.eventName,
      date: source.date,
      sourceUrl: source.sourceUrl,
      fetchedDate: source.fetchedDate,
      bouts,
      parseFailures: 0,
    });
    totalBouts += bouts.length;
  }

  for (const entry of RIZIN_EVENT_INDEX) {
    if (entry.manualOverride) {
      // 旧テンプレートで手動書き起こし済み(rizinRecordOverrides.ts)。二重計上防止のため
      // ここではfetchしない。判定はeventNameの文字列一致ではなくこのフラグで行う。
      continue;
    }
    const url = `https://jp.rizinff.com/_ct/${entry.resultsPageId}`;
    const html = await fetchHtml(url);
    const { bouts: autoBouts, parseFailures } = buildEventBouts(entry.eventName, entry.date, html);
    const bouts = mergeSupplementalBouts(entry.eventName, autoBouts);
    out.push({
      eventName: entry.eventName,
      date: entry.date,
      sourceUrl: url,
      fetchedDate: new Date().toISOString().slice(0, 10),
      bouts,
      parseFailures,
    });
    totalBouts += bouts.length;
    totalParseFailures += parseFailures;
    for (const b of bouts) {
      if (!b.fighterASlug) {
        totalUnresolvedNames++;
        if (unresolvedNameSamples.length < 30) unresolvedNameSamples.push(b.fighterAName);
      }
      if (!b.fighterBSlug) {
        totalUnresolvedNames++;
        if (unresolvedNameSamples.length < 30) unresolvedNameSamples.push(b.fighterBName);
      }
    }
    await sleep(300);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`=== rizinRecords.json 生成完了 ===`);
  console.log(`イベント数: ${out.length}`);
  console.log(`試合数: ${totalBouts}`);
  console.log(`bout chunkのパース失敗数: ${totalParseFailures}`);
  console.log(`選手名を自社DBへ解決できなかった延べ件数: ${totalUnresolvedNames}`);
  if (unresolvedNameSamples.length) {
    console.log(`--- 未解決の名前サンプル(先頭30件、重複含む) ---`);
    unresolvedNameSamples.forEach((n) => console.log(`  ${n}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
