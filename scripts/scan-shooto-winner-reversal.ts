// 指示書F: 野村駿太×宇佐美正パトリック(2021-11-06、VTJ 2021 shootoEventId=122)
// の勝者反転バグと同型(スコアテキスト由来の勝者判定が、ページ側のopacity装飾
// 〈敗者を示す〉と食い違うケース)が修斗全boutで他に何件あるかを走査する。
// read-only(data/は一切書き換えない)。231大会全件を再取得し、
// splitIntoBoutBoxes/parseBoutBox/resolveOutcome(すべて既存exportをそのまま
// 再利用、ロジックの複製はしない)でその場で再判定した結果と、opacity装飾
// から独立に導いた勝者を突き合わせる。
//
// 実行: npx tsx scripts/scan-shooto-winner-reversal.ts
import fs from "fs";
import path from "path";
import { splitIntoBoutBoxes, parseBoutBox, resolveOutcome, ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import { assertAllowedByRobots } from "./lib/robotsGate";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 30_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function main() {
  const shootoRecords: ShootoRecordsEvent[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "shootoRecords.json"), "utf8")
  );

  let fetchedCount = 0;
  const unreachable: { shootoEventId: number; eventName: string; error: string }[] = [];
  const candidates: {
    shootoEventId: number;
    eventName: string;
    date: string;
    boutId: number;
    fighterAName: string;
    fighterBName: string;
    resultTypeText: string | null;
    scoreDerivedWinner: "A" | "B" | null;
    opacityDerivedWinner: "A" | "B";
  }[] = [];
  let decisiveWithOpacitySignal = 0;

  for (const ev of shootoRecords) {
    if (!ev.sourceUrl) continue;
    let html: string;
    try {
      html = await fetchHtml(ev.sourceUrl);
    } catch (err) {
      unreachable.push({ shootoEventId: ev.shootoEventId, eventName: ev.eventName, error: String(err) });
      await sleep(DELAY_MS);
      continue;
    }
    fetchedCount++;
    await sleep(DELAY_MS);

    const boxes = splitIntoBoutBoxes(html);
    for (const { boutId, chunk } of boxes) {
      const raw = parseBoutBox(boutId, chunk);
      if (!raw) continue;
      const outcome = resolveOutcome(raw, ev.eventName);
      if (outcome.resultType !== "decisive") continue;
      if (raw.fighterA.isDimmed === raw.fighterB.isDimmed) continue; // opacity信号なし(引き分け等)

      decisiveWithOpacitySignal++;
      const opacityDerivedWinner: "A" | "B" = raw.fighterA.isDimmed ? "B" : "A";
      if (outcome.winner !== opacityDerivedWinner) {
        candidates.push({
          shootoEventId: ev.shootoEventId,
          eventName: ev.eventName,
          date: ev.date,
          boutId,
          fighterAName: raw.fighterA.name,
          fighterBName: raw.fighterB.name,
          resultTypeText: raw.resultTypeText,
          scoreDerivedWinner: outcome.winner,
          opacityDerivedWinner,
        });
      }
    }
  }

  console.log(`大会総数: ${shootoRecords.length} / fetch成功: ${fetchedCount} / unreachable: ${unreachable.length}`);
  console.log(`decisiveかつopacity信号あり(引き分け以外の判定材料あり): ${decisiveWithOpacitySignal}件`);
  console.log(`\n=== score判定とopacity判定が食い違う候補: ${candidates.length}件 ===`);
  for (const c of candidates) {
    console.log(
      `shootoEventId=${c.shootoEventId} ${c.eventName} ${c.date} bout=${c.boutId} ${c.fighterAName} vs ${c.fighterBName} resultTypeText="${c.resultTypeText}" score判定=${c.scoreDerivedWinner} opacity判定=${c.opacityDerivedWinner}`
    );
  }
  if (unreachable.length > 0) console.log("\n[unreachable]", JSON.stringify(unreachable, null, 2));

  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-winner-reversal-scan.json"),
    JSON.stringify({ eventsTotal: shootoRecords.length, fetchedCount, unreachable, decisiveWithOpacitySignal, candidates }, null, 2) + "\n"
  );
  console.log("\n書き出し: out/shooto-winner-reversal-scan.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
