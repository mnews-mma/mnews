// 検証専用スクリプト(read-only、data/rizinRecords.jsonは書き換えない)。
// PR #369でnonProBoutFilter.tsに一本化した非MMAルールパターンが、RIZIN既存
// 77大会(自動パース分。RIZIN.1・RIZIN.2は手動書き起こしのため対象外)の
// 判定結果を一切変えていないことを、公式サイトを実際に再取得して確認する。
//
// 統合後のパターンは旧RIZIN専用パターン(NON_MMA_RULE_PATTERNS in rizinScraper.ts、
// PR #250時点)に対して以下を追加しただけで、既存の一致条件を狭めた変更は無い:
//   - キックボクシング: 「K-1」「キック(ルール|戦)」を追加(既存の
//     「キックボクシ|Kickboxing|ISKA」はそのまま)
//   - シュートボクシング: 「SBルール」を追加(既存の「シュートボクシング」は
//     そのまま)
//   - プロレスルール: 新規追加(パンクラス側から統合)
// そのため理論上は差分が出ないはずだが、本番データに影響する変更のため
// 実測でも確認する。
import { RIZIN_EVENT_INDEX } from "../src/lib/mnewsRating/rizinEventIndex";
import { splitIntoBoutChunks, parseBoutChunk, parseRuleInfo } from "../src/lib/mnewsRating/rizinScraper";
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

// PR #250時点のRIZIN専用パターン(移設前の旧実装をそのまま複製。この検証の
// ためだけに残す・本体コードとしては使わない)。
const OLD_NON_MMA_RULE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /キックボクシ|Kickboxing|ISKA/i, label: "キックボクシング" },
  { pattern: /シュートボクシング/, label: "シュートボクシング" },
  { pattern: /グラップリング|柔術/, label: "グラップリング" },
  { pattern: /ベアナックル/, label: "ベアナックル" },
  { pattern: /スタンディングバウト/, label: "スタンディングバウト" },
  { pattern: /エキシビジョン/, label: "エキシビジョン" },
  { pattern: /MIXルール/i, label: "MIXルール" },
  { pattern: /チャレンジ\s*ルール/, label: "チャレンジルール" },
];

function oldParseRuleType(ruleLineRaw: string): string {
  if (ruleLineRaw.trim() === "") return "unknown";
  if (/MMA/i.test(ruleLineRaw)) return "MMA";
  const hit = OLD_NON_MMA_RULE_PATTERNS.find((p) => p.pattern.test(ruleLineRaw));
  return hit ? hit.label : "MMA";
}

async function main() {
  const targets = RIZIN_EVENT_INDEX.filter((e) => !e.manualOverride);
  console.log(`対象: ${targets.length}大会(手動書き起こし=manualOverride除外)`);

  let totalBouts = 0;
  let diffCount = 0;
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
    for (const chunk of chunks) {
      const raw = parseBoutChunk(chunk);
      if (!raw) continue;
      totalBouts++;
      const oldType = oldParseRuleType(raw.ruleLineRaw);
      const newType = parseRuleInfo(raw.ruleLineRaw).ruleType;
      if (oldType !== newType) {
        diffCount++;
        console.log(`[差分] ${entry.eventName} / ${entry.date} ${raw.fighterAName} vs ${raw.fighterBName}`);
        console.log(`  旧: ${oldType} -> 新: ${newType}`);
        console.log(`  ruleLineRaw: ${raw.ruleLineRaw}`);
      }
    }
    process.stderr.write(`[done] ${entry.eventName}\n`);
    await sleep(300);
  }

  console.log(`\n=== 結果 ===`);
  console.log(`fetch失敗: ${fetchErrors}大会 / 総bout数: ${totalBouts} / 差分件数: ${diffCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
