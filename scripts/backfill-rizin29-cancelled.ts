// 指示書Z: RIZIN.29 中村優作 vs 北方大地(第6試合)のresultType修正専用の
// 一回限りのバックフィル。
//
// 原因: headingTextに「※試合中止」とあるがmethodRawは空文字のため、
// parseMethod()がmethodRaw側しか見ておらず中止判定に掛からずunknownに
// なっていた(src/lib/mnewsRating/rizinScraper.ts側は修正済み)。
//
// 全80大会を再フェッチするとfetchedDateが今日の日付に総入れ替えされ、
// 本件と無関係な大量の差分が生まれてしまうため、影響範囲がこの1大会のみと
// 判明している(指示書Z調査で確認済み)ことを踏まえ、対象の1大会だけを
// 実スクレイパー関数(splitIntoBoutChunks/parseBoutChunk/parseRuleInfo/
// parseMethod/findFighterSlugByName)で再生成し、該当イベントの要素だけを
// 置き換える。他79大会の配列要素はバイト単位で無変更。
//
// 実行: npx tsx scripts/backfill-rizin29-cancelled.ts
import fs from "fs";
import path from "path";
import {
  splitIntoBoutChunks,
  parseBoutChunk,
  parseRuleInfo,
  parseMethod,
  RizinRecordsBout,
} from "../src/lib/mnewsRating/rizinScraper";
import { findFighterSlugByName } from "../src/lib/fighters";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { assertAllowedByRobots } from "./lib/robotsGate";

const OUT = path.join(process.cwd(), "data", "rizinRecords.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const TARGET_EVENT_NAME = "Yogibo presents RIZIN.29";
const TARGET_URL = "https://jp.rizinff.com/_ct/17462946";

function resolveWinnerName(
  fighterAName: string,
  fighterBName: string,
  markerA: "WIN" | "LOSE" | "NC" | null,
  markerB: "WIN" | "LOSE" | "NC" | null
): string | null {
  if (markerA === "WIN") return fighterAName;
  if (markerB === "WIN") return fighterBName;
  return null;
}

async function fetchHtml(url: string, retries = 2): Promise<string | null> {
  await assertAllowedByRobots(url, UA);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.text();
    } catch {
      /* retry */
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

function buildEventBouts(html: string): { bouts: RizinRecordsBout[]; parseFailures: number } {
  const chunks = splitIntoBoutChunks(html);
  let parseFailures = 0;
  const successful: Array<{ raw: NonNullable<ReturnType<typeof parseBoutChunk>> }> = [];
  for (const chunk of chunks) {
    const raw = parseBoutChunk(chunk);
    if (!raw) {
      parseFailures++;
      continue;
    }
    successful.push({ raw });
  }
  const total = successful.length;
  const bouts: RizinRecordsBout[] = successful.map(({ raw }, idx) => {
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
  return { bouts, parseFailures };
}

async function main() {
  const events = JSON.parse(fs.readFileSync(OUT, "utf-8"));
  const idx = events.findIndex((e: { eventName: string }) => e.eventName === TARGET_EVENT_NAME);
  if (idx === -1) throw new Error(`event not found: ${TARGET_EVENT_NAME}`);
  const before = events[idx];

  const html = await fetchHtml(TARGET_URL);
  if (!html) throw new Error(`fetch failed: ${TARGET_URL}`);
  const { bouts, parseFailures } = buildEventBouts(html);

  const after = {
    eventName: before.eventName,
    date: before.date,
    sourceUrl: before.sourceUrl,
    fetchedDate: toJstDateStr(),
    bouts,
    parseFailures,
  };

  // 回帰確認: 対象bout以外は無変更であることをここで確認してから書き込む。
  if (before.bouts.length !== after.bouts.length) {
    throw new Error(`bout数が変わった: before=${before.bouts.length} after=${after.bouts.length}`);
  }
  const diffs: Array<{ i: number; field: string; before: unknown; after: unknown }> = [];
  for (let i = 0; i < before.bouts.length; i++) {
    const b = before.bouts[i] as unknown as Record<string, unknown>;
    const a = after.bouts[i] as unknown as Record<string, unknown>;
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    for (const k of keys) {
      if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
        diffs.push({ i, field: k, before: b[k], after: a[k] });
      }
    }
  }
  console.log("=== 差分一覧 ===");
  console.log(JSON.stringify(diffs, null, 2));

  events[idx] = after;
  fs.writeFileSync(OUT, JSON.stringify(events, null, 2) + "\n");
  console.log("書き込み完了");
}

main();
