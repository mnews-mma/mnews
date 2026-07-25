// formatEventDateJa(監査#7)・shiftDateStr(監査#4)の固定値ユニットテスト。
//
// 背景: EventRail.tsx/EventsFilterList.tsxは new Date("YYYY-MM-DD") を
// ローカルgetter(getFullYear/getMonth/getDate/getDay)で読んでおり、date-only
// 文字列はUTC 0時としてパースされる仕様のため、訪問者のブラウザがJSTより西の
// タイムゾーン(南北アメリカ等)だと日付・曜日が1日ズレていた。
// WeighInTool.tsxは`+09:00`でJST anchorした後にローカルgetter(getDate/setDate)
// で-1日し、最後にtoISOString()(UTC)で出力していたため、anchorの効果が
// 最後のUTC変換で打ち消され、実行環境tzに関わらず常に1日多くズレていた
// (常に大会2日前を返す)。
// いずれもマシン・訪問者のtzに一切依存しないDate.UTC()経由の実装
// (formatEventDateJa/shiftDateStr)に統一したことを検証する。
import { execFileSync } from "child_process";
import path from "path";
import { formatEventDateJa, shiftDateStr } from "../src/lib/eventCountdown";

interface FormatCase {
  date: string;
  expected: string;
  note: string;
}

const formatCases: FormatCase[] = [
  { date: "2026-07-26", expected: "2026年7月26日（日）", note: "通常ケース" },
  { date: "2026-01-01", expected: "2026年1月1日（木）", note: "元日" },
  { date: "2026-12-31", expected: "2026年12月31日（木）", note: "大晦日" },
  { date: "2026-02-28", expected: "2026年2月28日（土）", note: "2月末(非うるう年)" },
];

interface ShiftCase {
  date: string;
  delta: number;
  expected: string;
  note: string;
}

const shiftCases: ShiftCase[] = [
  { date: "2026-07-26", delta: -1, expected: "2026-07-25", note: "通常の前日(計量日のデフォルト)" },
  { date: "2026-01-01", delta: -1, expected: "2025-12-31", note: "年またぎ" },
  { date: "2026-03-01", delta: -1, expected: "2026-02-28", note: "月またぎ(非うるう年2月)" },
  { date: "2024-03-01", delta: -1, expected: "2024-02-29", note: "月またぎ(うるう年2月29日)" },
  { date: "2026-07-25", delta: 1, expected: "2026-07-26", note: "正のdelta(+1日)も動作すること" },
];

function runFormatCases(): string[] {
  const failures: string[] = [];
  for (const c of formatCases) {
    const got = formatEventDateJa(c.date);
    const ok = got === c.expected;
    console.log(`${ok ? "  OK" : "FAIL"}  formatEventDateJa("${c.date}") = "${got}" (expect "${c.expected}")  ${c.note}`);
    if (!ok) failures.push(`formatEventDateJa("${c.date}"): got "${got}", expected "${c.expected}"`);
  }
  return failures;
}

function runShiftCases(): string[] {
  const failures: string[] = [];
  for (const c of shiftCases) {
    const got = shiftDateStr(c.date, c.delta);
    const ok = got === c.expected;
    console.log(
      `${ok ? "  OK" : "FAIL"}  shiftDateStr("${c.date}", ${c.delta}) = "${got}" (expect "${c.expected}")  ${c.note}`
    );
    if (!ok) failures.push(`shiftDateStr("${c.date}", ${c.delta}): got "${got}", expected "${c.expected}"`);
  }
  return failures;
}

// TZ=UTC/Asia/Tokyo/America/New_Yorkの3環境で同じ値になることを確認
// (PR#195/#200と同じ検証方法)。America/New_Yorkは監査#7で実際に日付・曜日が
// 1日ズレることを確認した「危険なtz」の代表。
function runTzIndependenceCheck(): string[] {
  const failures: string[] = [];
  const workerPath = path.join(__dirname, "_tz-worker-event-date-format.ts");
  const tsxBin = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
  const tzList = ["UTC", "Asia/Tokyo", "America/New_York"];

  function runInTz(tz: string, args: string[]): string {
    return execFileSync(tsxBin, [workerPath, ...args], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    }).trim();
  }

  // formatEventDateJa: America/New_Yorkでも "2026-07-26" が正しく「日」になるか
  // (旧実装だとUTC 0時パース+ローカルgetterで「2026年7月25日（土）」になっていた)。
  const formatResults: Record<string, string> = {};
  for (const tz of tzList) {
    formatResults[tz] = runInTz(tz, ["format", "2026-07-26"]);
    console.log(`  TZ=${tz.padEnd(16)} formatEventDateJa("2026-07-26") = "${formatResults[tz]}"`);
  }
  const formatValues = Object.values(formatResults);
  if (!formatValues.every((v) => v === formatValues[0])) {
    failures.push(`formatEventDateJa: TZ間で値が不一致: ${JSON.stringify(formatResults)}`);
  } else if (formatValues[0] !== "2026年7月26日（日）") {
    failures.push(`formatEventDateJa: TZ非依存だが値自体が誤り: "${formatValues[0]}"`);
  }

  // shiftDateStr: 大会日2026-07-26の前日が全tzで"2026-07-25"になるか
  // (旧実装は全tzで"2026-07-24"を返していた=常に1日多くズレるバグ)。
  const shiftResults: Record<string, string> = {};
  for (const tz of tzList) {
    shiftResults[tz] = runInTz(tz, ["shift", "2026-07-26", "-1"]);
    console.log(`  TZ=${tz.padEnd(16)} shiftDateStr("2026-07-26", -1) = "${shiftResults[tz]}"`);
  }
  const shiftValues = Object.values(shiftResults);
  if (!shiftValues.every((v) => v === shiftValues[0])) {
    failures.push(`shiftDateStr: TZ間で値が不一致: ${JSON.stringify(shiftResults)}`);
  } else if (shiftValues[0] !== "2026-07-25") {
    failures.push(`shiftDateStr: TZ非依存だが値自体が誤り: "${shiftValues[0]}"`);
  }

  return failures;
}

function main() {
  console.log("--- formatEventDateJa 固定値 ---");
  const formatFailures = runFormatCases();

  console.log("\n--- shiftDateStr 固定値 ---");
  const shiftFailures = runShiftCases();

  console.log("\n--- TZ非依存確認(UTC / Asia/Tokyo / America/New_York) ---");
  const tzFailures = runTzIndependenceCheck();

  const failures = [...formatFailures, ...shiftFailures, ...tzFailures];
  if (failures.length) {
    console.error(`\n[event-date-format テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(
    `\n[event-date-format テスト] OK (formatEventDateJa ${formatCases.length}件 + shiftDateStr ${shiftCases.length}件 + TZ非依存3環境)`
  );
}

main();
