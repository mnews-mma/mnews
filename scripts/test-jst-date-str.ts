// toJstDateStr(監査フェーズ1 #1/#2/#3対応)の固定時刻ユニットテスト。
//
// 背景: ランキングの「本日更新」判定・「最終更新」表示・sitemapのlastModified
// が、いずれも updatedAt(UTC ISO文字列)やnew Date().toISOString()をそのまま
// 使っており、UTC日付とJST日付を暗黙に混同していた。JST 0:00〜9:00台は
// UTCではまだ前日のため、この帯だけ表示・判定が1日ズレる
// (eventCountdown.tsの残り日数バグ・PR#195/#196と同種)。
// toJstDateStr()への統一でこれを解消したことを固定時刻で検証する。
import { execFileSync } from "child_process";
import path from "path";
import { toJstDateStr } from "../src/lib/eventCountdown";

function jstMs(iso: string): number {
  const ms = Date.parse(`${iso}+09:00`);
  if (Number.isNaN(ms)) throw new Error(`invalid JST time: ${iso}`);
  return ms;
}

interface Case {
  now: string; // 観測時刻(JST壁時計)
  expected: string; // 期待するJST暦日(YYYY-MM-DD)
  note: string;
}

// JST 0:00〜9:00台(UTC日付とJST日付がズレる危険地帯)の境界を重点的に検証。
const cases: Case[] = [
  { now: "2026-07-25T00:01:00", expected: "2026-07-25", note: "JST 00:01(UTCはまだ7/24 15:01=前日)" },
  { now: "2026-07-25T08:59:00", expected: "2026-07-25", note: "JST 08:59(UTC切り替わり直前、UTCはまだ7/24 23:59)" },
  { now: "2026-07-25T09:01:00", expected: "2026-07-25", note: "JST 09:01(UTC日付が7/25 00:01に追いついた直後)" },
  { now: "2026-07-25T23:59:00", expected: "2026-07-25", note: "JST 23:59(暦日の終わり)" },
  // 参考: eventCountdownの既存テストと同じ日を昼間の時刻でも確認(回帰の対称性)。
  { now: "2026-07-25T12:00:00", expected: "2026-07-25", note: "JST日中(危険地帯外)" },
];

function runFixedTimeCases(): string[] {
  const failures: string[] = [];
  for (const c of cases) {
    const got = toJstDateStr(jstMs(c.now));
    const ok = got === c.expected;
    console.log(
      `${ok ? "  OK" : "FAIL"}  now=${c.now} JST → toJstDateStr = "${got}" (expect "${c.expected}")  ${c.note}`
    );
    if (!ok) failures.push(`now=${c.now}: got "${got}", expected "${c.expected}"`);
  }
  return failures;
}

// TZ=UTC/Asia/Tokyo/America/New_Yorkの3環境で同じ値になることを確認
// (PR#195と同じ検証方法)。toJstDateStrはDate.UTC/getUTC*のみでマシンtzを
// 一切参照しない実装のはずだが、将来ローカルgetterが混入する回帰を検出できる
// よう、実際にTZを変えた別プロセスで実測する。
function runTzIndependenceCheck(): string[] {
  const failures: string[] = [];
  const fixedNowMs = jstMs("2026-07-25T02:30:00"); // JST深夜帯を含む固定時刻
  const workerPath = path.join(__dirname, "_tz-worker-jst-date-str.ts");
  const tsxBin = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
  const tzList = ["UTC", "Asia/Tokyo", "America/New_York"];
  const results: Record<string, string> = {};

  for (const tz of tzList) {
    const out = execFileSync(tsxBin, [workerPath, String(fixedNowMs)], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    }).trim();
    results[tz] = out;
    console.log(`  TZ=${tz.padEnd(16)} toJstDateStr(固定ms) = "${out}"`);
  }

  const values = Object.values(results);
  const allSame = values.every((v) => v === values[0]);
  if (!allSame) {
    failures.push(`TZ間で値が不一致(マシンtz依存のバグの疑い): ${JSON.stringify(results)}`);
  } else if (values[0] !== "2026-07-25") {
    failures.push(`TZ非依存だが値自体が誤り: "${values[0]}" (expect "2026-07-25")`);
  }
  return failures;
}

function main() {
  console.log("--- 固定時刻(JST 0:00〜9:00帯を含む境界値) ---");
  const fixedFailures = runFixedTimeCases();

  console.log("\n--- TZ非依存確認(UTC / Asia/Tokyo / America/New_York) ---");
  const tzFailures = runTzIndependenceCheck();

  const failures = [...fixedFailures, ...tzFailures];
  if (failures.length) {
    console.error(`\n[toJstDateStr テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\n[toJstDateStr テスト] OK (固定時刻${cases.length}件 + TZ非依存3環境)`);
}

main();
