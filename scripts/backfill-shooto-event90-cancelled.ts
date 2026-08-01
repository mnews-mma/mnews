// 指示書Z派生: 修斗イベント単位「中止」欠落バグの専用バックフィル。
//
// 原因: 「【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship」
// (id=90、2020年3月29日に予定されていたがコロナ禍で中止)は、中止の表記が
// イベント名側にのみ付き、各bout単位のheadingText(「第N試合 ○○級 5分2R」等)
// には中止の痕跡が残らない。resolveOutcome()はbout単位のheadingTextしか見て
// いなかったため、該当7bout全件がunknownに落ちていた
// (src/lib/mnewsRating/shootoScraper.ts側は修正済み)。
//
// 全大会を再フェッチするとfetchedDateが総入れ替えされ無関係な差分が生まれる
// ため、影響範囲がこの1大会・7boutのみと判明していることを踏まえ、対象の
// 1大会だけを実スクレイパー関数で再生成し、該当イベントの要素だけを置き換える。
// 他大会の配列要素はバイト単位で無変更。
//
// 実行: npx tsx scripts/backfill-shooto-event90-cancelled.ts
import fs from "fs";
import path from "path";
import { toJstDateStr } from "../src/lib/eventCountdown";
import {
  parseEventMeta,
  splitIntoBoutBoxes,
  parseBoutBox,
  resolveOutcome,
  ShootoRawBout,
  ShootoRecordsBout,
} from "../src/lib/mnewsRating/shootoScraper";
import { findFighterSlugByName } from "../src/lib/fighters";
import { assertAllowedByRobots } from "./lib/robotsGate";

const OUT = path.join(process.cwd(), "data", "shootoRecords.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const TARGET_URL = "https://www.shooto-mma.com/result/?id=90";
const TARGET_SHOOTO_EVENT_ID = 90;

const WEIGH_IN_MISS_KEYWORDS = ["体重超過", "計量失格", "計量オーバー", "計量を行うことが出来なかった", "計量をクリアできず"];

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

function buildEventBouts(html: string, eventName: string): { bouts: ShootoRecordsBout[]; parseFailures: number } {
  const boxes = splitIntoBoutBoxes(html);
  let parseFailures = 0;
  const successful: ShootoRawBout[] = [];
  for (const { boutId, chunk } of boxes) {
    const raw = parseBoutBox(boutId, chunk);
    if (!raw) {
      parseFailures++;
      continue;
    }
    successful.push(raw);
  }
  const total = successful.length;
  const bouts: ShootoRecordsBout[] = successful.map((raw, idx) => {
    const outcome = resolveOutcome(raw, eventName);
    const fighterASlug = findFighterSlugByName(raw.fighterA.name);
    const fighterBSlug = findFighterSlugByName(raw.fighterB.name);
    const winnerName = outcome.winner === "A" ? raw.fighterA.name : outcome.winner === "B" ? raw.fighterB.name : null;
    const winnerSlug = outcome.winner === "A" ? fighterASlug : outcome.winner === "B" ? fighterBSlug : null;
    const methodRaw = [raw.resultTypeText, raw.resultMethodText].filter((s): s is string => !!s).join(" ").trim();
    const isWeighInMiss = !!raw.noteRaw && WEIGH_IN_MISS_KEYWORDS.some((k) => raw.noteRaw!.includes(k));
    return {
      cardPosition: total - idx,
      isOpeningFight: idx === total - 1,
      headingText: raw.headingText,
      fighterAName: raw.fighterA.name,
      fighterBName: raw.fighterB.name,
      fighterASlug,
      fighterBSlug,
      ruleType: "unknown",
      weightKg: null,
      namedDivision: raw.namedDivision,
      resultType: outcome.resultType,
      winnerName,
      winnerSlug,
      round: raw.resultRound,
      time: raw.resultTime,
      methodRaw,
      isWeighInMiss,
      fighterAShootoId: raw.fighterA.shootoId,
      fighterBShootoId: raw.fighterB.shootoId,
      fighterAGym: raw.fighterA.gym,
      fighterBGym: raw.fighterB.gym,
      fighterAWeighInKg: raw.fighterA.weighInKg,
      fighterBWeighInKg: raw.fighterB.weighInKg,
      noteRaw: raw.noteRaw,
      strapTitle: raw.strapTitle,
    };
  });
  return { bouts, parseFailures };
}

async function main() {
  const events = JSON.parse(fs.readFileSync(OUT, "utf-8"));
  const idx = events.findIndex((e: { shootoEventId: number }) => e.shootoEventId === TARGET_SHOOTO_EVENT_ID);
  if (idx === -1) throw new Error(`event not found: shootoEventId=${TARGET_SHOOTO_EVENT_ID}`);
  const before = events[idx];

  const html = await fetchHtml(TARGET_URL);
  if (!html) throw new Error(`fetch failed: ${TARGET_URL}`);
  const meta = parseEventMeta(html);
  if (!meta) throw new Error(`parseEventMeta failed: ${TARGET_URL}`);
  const { bouts, parseFailures } = buildEventBouts(html, meta.eventName);

  const after = {
    eventName: meta.eventName,
    date: meta.date,
    sourceUrl: TARGET_URL,
    fetchedDate: toJstDateStr(),
    bouts,
    parseFailures,
    venue: meta.venue,
    shootoEventId: TARGET_SHOOTO_EVENT_ID,
  };

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
