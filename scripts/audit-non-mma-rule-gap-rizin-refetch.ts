// 調査専用の一時スクリプト(read-only)。data/rizinRecords.jsonには
// parseRuleInfo()の入力(ruleLineRaw、ルール原文)が保存されていないため、
// PR #367で発覚した「K-1ルール」「SBルール」非MMA判定漏れが、既に自動パースで
// 取り込み済みの78大会(RIZIN.1・RIZIN.2は手動書き起こしのため対象外)にも
// 存在するかを、実際にRIZIN公式サイトを再取得し現行parseRuleInfo()に通して確認する。
// data/rizinRecords.json自体は書き換えない。
import { RIZIN_EVENT_INDEX } from "../src/lib/mnewsRating/rizinEventIndex";
import { splitIntoBoutChunks, parseBoutChunk, parseRuleInfo, NON_MMA_RULE_PATTERNS } from "../src/lib/mnewsRating/rizinScraper";
import { findFighterSlugByName } from "../src/lib/fighters";
import { assertAllowedByRobots } from "./lib/robotsGate";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const FETCH_TIMEOUT_MS = 30_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
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

// K-1・SBルール(シュートボクシングの略記)を検知対象にする。既存NON_MMA_RULE_PATTERNS
// の「シュートボクシング」(全表記)とは別に、略記のみのケースを拾うため独立して判定する。
const K1_OR_SB_RE = /K-?1(?!グ)|SB\s*ルール/i;

interface GapHit {
  event: string;
  date: string;
  cardPosition: number;
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleLineRaw: string;
  currentRuleType: string;
}

async function main() {
  const targets = RIZIN_EVENT_INDEX.filter((e) => !e.manualOverride);
  console.log(`対象: ${targets.length}大会(手動書き起こし=manualOverride除外)`);

  const gapHits: GapHit[] = [];
  const alreadyCaught: GapHit[] = [];
  let fetchErrors = 0;

  for (const entry of targets) {
    const url = `https://jp.rizinff.com/_ct/${entry.resultsPageId}`;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.error(`[skip] ${entry.eventName}: ${String(err)}`);
      fetchErrors++;
      continue;
    }

    const chunks = splitIntoBoutChunks(html);
    let cardCount = 0;
    const raws: { raw: NonNullable<ReturnType<typeof parseBoutChunk>> }[] = [];
    for (const chunk of chunks) {
      const raw = parseBoutChunk(chunk);
      if (raw) raws.push({ raw });
    }
    const total = raws.length;
    raws.forEach(({ raw }, idx) => {
      cardCount++;
      if (!K1_OR_SB_RE.test(raw.ruleLineRaw)) return;
      const ruleInfo = parseRuleInfo(raw.ruleLineRaw);
      const fighterASlug = findFighterSlugByName(raw.fighterAName);
      const fighterBSlug = findFighterSlugByName(raw.fighterBName);
      const hit: GapHit = {
        event: entry.eventName,
        date: entry.date,
        cardPosition: total - idx,
        fighterAName: raw.fighterAName,
        fighterBName: raw.fighterBName,
        fighterASlug,
        fighterBSlug,
        ruleLineRaw: raw.ruleLineRaw,
        currentRuleType: ruleInfo.ruleType,
      };
      if (ruleInfo.ruleType === "MMA") gapHits.push(hit);
      else alreadyCaught.push(hit);
    });
    process.stderr.write(`[done] ${entry.eventName} (${cardCount}試合)\n`);
    await sleep(300);
  }

  console.log("\n=== 結果 ===");
  console.log(`fetch失敗: ${fetchErrors}大会`);
  console.log(`K-1/SBルール等のテキストを含むがruleType=MMAに分類された(ギャップ)件数: ${gapHits.length}`);
  for (const h of gapHits) {
    console.log(`  [${h.event} / ${h.date} / #${h.cardPosition}] ${h.fighterAName}(${h.fighterASlug ?? "未解決"}) vs ${h.fighterBName}(${h.fighterBSlug ?? "未解決"})`);
    console.log(`    ruleLineRaw: ${h.ruleLineRaw}`);
  }
  console.log(`\n既存パターンで正しく非MMAに分類済みだった件数(参考): ${alreadyCaught.length}`);
  for (const h of alreadyCaught) {
    console.log(`  [${h.event} / ${h.date} / #${h.cardPosition}] ${h.fighterAName} vs ${h.fighterBName} -> ${h.currentRuleType}: ${h.ruleLineRaw}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
