// data/deepRecords.json の大会日付を対象に、同型(年の誤記)の疑いがある
// 大会を機械的に列挙する(読み取り専用・修正はしない)。
//
// 判定:
// 1. 団体設立年(2001年、deep2001.comドメイン由来)より前の日付
// 2. 同一シリーズ(大会名から連番を抽出、例「DEEP JEWELS 43」→シリーズ
//    "DEEP JEWELS"・連番43)内で、連番が大きいのに日付が前の回より古い
//    (=年が逆行している)組
//
// 実行: npx tsx scripts/audit-deep-event-date-anomalies.ts
import fs from "fs";
import path from "path";

interface DeepEvent {
  eventName: string;
  date: string;
  sourceUrl: string;
}

const EARLIEST_PLAUSIBLE_YEAR = 2001;

function extractSeriesAndNumber(eventName: string): { series: string; num: number } | null {
  // 「DEEP JEWELS 43」「DEEP 133 IMPACT」「DEEP TOKYO IMPACT 2022 7th ROUND」等、
  // 末尾または中間に現れる整数を連番として抜き出す。複数マッチする場合は
  // 最初の連番(通常は大会通し番号)を採用する。
  const m = eventName.match(/(\d{1,4})/);
  if (!m) return null;
  const num = Number(m[1]);
  if (num < 1 || num > 999) return null; // 年表記(20xx)や場当たり的な数字を除外
  const series = eventName.replace(m[0], "#").trim();
  return { series, num };
}

function main() {
  const dataPath = path.join(process.cwd(), "data", "deepRecords.json");
  const events: DeepEvent[] = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  const findings: string[] = [];

  // 1. 団体設立年より前
  for (const ev of events) {
    const year = Number(ev.date.slice(0, 4));
    if (year < EARLIEST_PLAUSIBLE_YEAR) {
      findings.push(`[設立年より前] ${ev.eventName} (${ev.date}) — ${ev.sourceUrl}`);
    }
  }

  // 2. 同一シリーズ内での連番と日付の逆行
  const bySeries = new Map<string, { eventName: string; date: string; num: number; sourceUrl: string }[]>();
  for (const ev of events) {
    const parsed = extractSeriesAndNumber(ev.eventName);
    if (!parsed) continue;
    const list = bySeries.get(parsed.series) ?? [];
    list.push({ eventName: ev.eventName, date: ev.date, num: parsed.num, sourceUrl: ev.sourceUrl });
    bySeries.set(parsed.series, list);
  }

  for (const [series, list] of bySeries) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.num - b.num);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (cur.num > prev.num && cur.date < prev.date) {
        findings.push(
          `[連番と日付の逆行] シリーズ"${series}": #${prev.num}(${prev.date}) の後に #${cur.num}(${cur.date}) — ${cur.eventName} (${cur.sourceUrl})`
        );
      }
    }
  }

  console.log(`=== DEEP大会日付 異常疑い監査 ===`);
  console.log(`総大会数: ${events.length}`);
  console.log(`検出件数: ${findings.length}\n`);
  findings.forEach((f) => console.log(f));

  const outDir = path.join(process.cwd(), "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const lines = [
    "# DEEP大会日付 異常疑い監査(読み取り専用)",
    "",
    `総大会数: ${events.length} / 検出件数: ${findings.length}`,
    "",
    ...findings.map((f) => `- ${f}`),
    "",
  ];
  fs.writeFileSync(path.join(outDir, "deep-event-date-anomalies.md"), lines.join("\n"));
  console.log(`\nレポート: out/deep-event-date-anomalies.md`);
}

main();
