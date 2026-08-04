// data/pancraseRecords.json の一部イベントだけを公式サイトから再取得し、
// build-pancrase-records.ts の最新パースロジック(<h3>セクション見出しの
// sectionHeadingへの伝播、指示書「ushiku-juntaro 1行目非表示調査」2026-08-05)で
// 再パースして該当イベントのbouts配列だけを差し替える。
// 全大会の再スクレイプ(scripts/build-pancrase-records.ts)は行わない
// (対象イベントのみ・他イベントは一切変更しない)。
//
// 実行: npx tsx scripts/refetch-pancrase-events.ts <sourceUrl1> <sourceUrl2> ...
//       npx tsx scripts/refetch-pancrase-events.ts --dry-run <sourceUrl...>
import fs from "fs";
import path from "path";
import { fetchText, extractEventMeta, buildEventBouts } from "./build-pancrase-records";
import { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import { toJstDateStr } from "../src/lib/eventCountdown";

const PANCRASE_PATH = path.join(__dirname, "..", "data", "pancraseRecords.json");
const DRY_RUN = process.argv.includes("--dry-run");
const urls = process.argv.slice(2).filter((a) => a !== "--dry-run");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (urls.length === 0) {
    console.error("再取得するsourceUrlを1件以上指定してください");
    process.exit(1);
  }

  const events: PancraseRecordsEvent[] = JSON.parse(fs.readFileSync(PANCRASE_PATH, "utf-8"));
  const fetchedDate = toJstDateStr();

  const report: { url: string; before: number; after: number; eventName: string; date: string | null }[] = [];

  for (const url of urls) {
    const idx = events.findIndex((e) => e.sourceUrl === url);
    if (idx === -1) {
      console.error(`data/pancraseRecords.jsonに該当イベントが見つかりません: ${url}`);
      continue;
    }
    const before = events[idx];
    const html = await fetchText(url);
    await sleep(300);
    if (!html) {
      console.error(`取得失敗、スキップ: ${url}`);
      continue;
    }
    const m = url.match(/\/(\d{4})\/([^/]+)$/);
    const year = m ? m[1] : "";
    const file = m ? m[2] : "";
    const meta = extractEventMeta(html, year, file);
    const { bouts, parseFailures } = buildEventBouts(html);

    report.push({ url, before: before.bouts.length, after: bouts.length, eventName: before.eventName, date: before.date });

    events[idx] = {
      ...before,
      // eventName/dateは既存値を保持する(再取得のたびに揺れ得るテキスト抽出結果で
      // 上書きしない。boutsとparseFailures/fetchedDateのみ更新する)。
      bouts,
      parseFailures,
      fetchedDate,
    };
  }

  console.log("=== 再取得結果 ===");
  for (const r of report) {
    console.log(`${r.eventName} (${r.date}): ${r.before} → ${r.after} bouts  [${r.url}]`);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run のためファイルへの書き込みはしていません。");
    return;
  }

  fs.writeFileSync(PANCRASE_PATH, JSON.stringify(events, null, 2) + "\n");
  console.log(`\n書き込み完了: ${PANCRASE_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
