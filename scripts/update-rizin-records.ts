// RIZIN公式サイト(jp.rizinff.com)から試合結果を機械取得し、data/rizinRecords.json
// へ書き出すバッチ(Phase 0: 生成のみ・本番エンジンへは未接続)。
// rizinEventIndex.ts(結果ページIDの静的対応表)を参照してfetchするだけで、
// 実行のたびに検索エンジン等の外部発見手段には依存しない。
//
// 実行: npx tsx scripts/update-rizin-records.ts
import fs from "fs";
import path from "path";
import { RIZIN_EVENT_INDEX } from "../src/lib/mnewsRating/rizinEventIndex";
import { RIZIN_1_BOUTS, RIZIN_1_SOURCE } from "../src/lib/mnewsRating/rizinRecordOverrides";
import {
  splitIntoBoutChunks,
  parseBoutChunk,
  parseRuleInfo,
  parseMethod,
  RizinRecordsBout,
  RizinRecordsEvent,
} from "../src/lib/mnewsRating/rizinScraper";
import { findFighterSlugByName } from "../src/lib/fighters";

const OUT = path.join(process.cwd(), "data", "rizinRecords.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";

type RizinRecordsFile = RizinRecordsEvent[];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.text();
    } catch {
      /* fall through to retry */
    }
    if (attempt < retries) await sleep(1500);
  }
  return null;
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
    const method = parseMethod(raw.methodRaw, raw.markerA);
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

async function main() {
  const out: RizinRecordsFile = [];
  let totalBouts = 0;
  let totalParseFailures = 0;
  let totalUnresolvedNames = 0;
  const unresolvedNameSamples: string[] = [];

  // RIZIN.1(旧テンプレート・手動書き起こし分)を先頭に格納する。
  const rizin1Bouts: RizinRecordsBout[] = RIZIN_1_BOUTS.map((b) => {
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
      round: null,
      time: null,
      methodRaw: b.methodRaw,
      isWeighInMiss: false,
    };
  });
  out.push({
    eventName: RIZIN_1_SOURCE.eventName,
    date: RIZIN_1_SOURCE.date,
    sourceUrl: RIZIN_1_SOURCE.sourceUrl,
    fetchedDate: RIZIN_1_SOURCE.fetchedDate,
    bouts: rizin1Bouts,
    parseFailures: 0,
  });
  totalBouts += rizin1Bouts.length;

  for (const entry of RIZIN_EVENT_INDEX) {
    const url = `https://jp.rizinff.com/_ct/${entry.resultsPageId}`;
    const html = await fetchHtml(url);
    if (!html) {
      console.warn(`[WARN] fetch失敗: ${entry.eventName} (${url})`);
      await sleep(400);
      continue;
    }
    const { bouts, parseFailures } = buildEventBouts(entry.eventName, entry.date, html);
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
