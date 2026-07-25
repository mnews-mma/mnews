// calcAgeJst(監査#5)の固定時刻ユニットテスト。
//
// 背景: Wikipedia infoboxから選手の年齢を算出する際、「今日」をUTC暦日
// (new Date().getUTCFullYear/getUTCMonth/getUTCDate)で判定しており、
// 誕生日当日のJST 0:00〜9:00台(UTCではまだ前日)は「まだ誕生日を迎えて
// いない」と誤判定され、年齢が実際より1少なく表示されていた
// (バッチが年1回・その選手の誕生日当日にしか踏まない狭いケースだが、
// eventCountdown.tsの残り日数バグ・ランキング本日更新判定と同じ
// UTC/JST混同パターン)。
import { execFileSync } from "child_process";
import path from "path";
import { calcAgeJst } from "../src/lib/feeds/wikipedia";
import { parseInfobox, parseInfoboxJa } from "../src/lib/feeds/wikipedia";

function jstMs(iso: string): number {
  const ms = Date.parse(`${iso}+09:00`);
  if (Number.isNaN(ms)) throw new Error(`invalid JST time: ${iso}`);
  return ms;
}

interface Case {
  now: string; // 観測時刻(JST壁時計)
  birth: [number, number, number]; // [year, month, day]
  expected: number;
  note: string;
}

const cases: Case[] = [
  {
    now: "2026-07-25T02:30:00", // JST 2:30(危険地帯)= UTCではまだ7/24
    birth: [2000, 7, 25],
    expected: 26,
    note: "誕生日当日・JST危険地帯でも正しく歳を取る(監査#5の核心)",
  },
  { now: "2026-07-24T12:00:00", birth: [2000, 7, 25], expected: 25, note: "誕生日前日" },
  { now: "2026-07-25T12:00:00", birth: [2000, 7, 25], expected: 26, note: "誕生日当日(日中)" },
  { now: "2026-07-26T12:00:00", birth: [2000, 7, 25], expected: 26, note: "誕生日翌日" },
  { now: "2026-02-28T12:00:00", birth: [2000, 2, 29], expected: 25, note: "うるう年生まれ、非うるう年2/28(まだ)" },
  { now: "2026-03-01T12:00:00", birth: [2000, 2, 29], expected: 26, note: "うるう年生まれ、非うるう年3/1(歳を取る)" },
];

function runFixedTimeCases(): string[] {
  const failures: string[] = [];
  for (const c of cases) {
    const [by, bm, bd] = c.birth;
    const got = calcAgeJst(by, bm, bd, jstMs(c.now));
    const ok = got === c.expected;
    console.log(
      `${ok ? "  OK" : "FAIL"}  now=${c.now} JST  birth=${by}-${bm}-${bd}  → age=${got} (expect ${c.expected})  ${c.note}`
    );
    if (!ok) failures.push(`now=${c.now} birth=${by}-${bm}-${bd}: got ${got}, expected ${c.expected}`);
  }
  return failures;
}

// TZ=UTC/Asia/Tokyo/America/New_Yorkの3環境で同じ値になることを確認。
function runTzIndependenceCheck(): string[] {
  const failures: string[] = [];
  const workerPath = path.join(__dirname, "_tz-worker-calc-age.ts");
  const tsxBin = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
  const tzList = ["UTC", "Asia/Tokyo", "America/New_York"];
  const fixedNowMs = jstMs("2026-07-25T02:30:00"); // 誕生日当日・JST危険地帯
  const results: Record<string, string> = {};

  for (const tz of tzList) {
    results[tz] = execFileSync(tsxBin, [workerPath, "2000", "7", "25", String(fixedNowMs)], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    }).trim();
    console.log(`  TZ=${tz.padEnd(16)} calcAgeJst(2000,7,25, 誕生日当日JST危険地帯) = ${results[tz]}`);
  }
  const values = Object.values(results);
  if (!values.every((v) => v === values[0])) {
    failures.push(`TZ間で値が不一致: ${JSON.stringify(results)}`);
  } else if (values[0] !== "26") {
    failures.push(`TZ非依存だが値自体が誤り: "${values[0]}" (expect "26")`);
  }
  return failures;
}

// 生年月日が未設定・不正フォーマットのケースで例外を投げないこと。
function runMalformedInputCases(): string[] {
  const failures: string[] = [];

  function check(label: string, fn: () => unknown, expectNoAge: boolean) {
    try {
      const result = fn();
      const hasAge =
        result !== null && typeof result === "object" && "age" in (result as Record<string, unknown>);
      const ok = expectNoAge ? !hasAge : hasAge;
      console.log(`${ok ? "  OK" : "FAIL"}  ${label} → 例外なし、結果=${JSON.stringify(result)}`);
      if (!ok) failures.push(`${label}: 期待した形と異なる結果 ${JSON.stringify(result)}`);
    } catch (e) {
      console.log(`FAIL  ${label} → 例外が発生: ${e}`);
      failures.push(`${label}: 例外が発生 (${e})`);
    }
  }

  check("parseInfobox(birth_date未設定)", () => parseInfobox("| name = テスト選手\n"), true);
  check(
    "parseInfobox(birth_dateが不正フォーマット)",
    () => parseInfobox("| birth_date = not-a-date\n"),
    true
  );
  check(
    "parseInfobox(birth_dateのテンプレート引数が不足)",
    () => parseInfobox("| birth_date = {{birth date and age|2000|7}}\n"),
    true
  );
  check("parseInfoboxJa(birth未設定)", () => parseInfoboxJa("| name = テスト選手\n"), true);
  check(
    "parseInfoboxJa(birthが不正フォーマット)",
    () => parseInfoboxJa("| birth = 不明\n"),
    true
  );
  check(
    "parseInfobox(正常な生年月日はage有り)",
    () => parseInfobox("| birth_date = {{birth date and age|2000|7|25}}\n"),
    false
  );

  return failures;
}

function main() {
  console.log("--- calcAgeJst 固定時刻(誕生日前後・うるう年) ---");
  const fixedFailures = runFixedTimeCases();

  console.log("\n--- TZ非依存確認(UTC / Asia/Tokyo / America/New_York) ---");
  const tzFailures = runTzIndependenceCheck();

  console.log("\n--- 未設定・不正フォーマットで例外を投げないこと ---");
  const malformedFailures = runMalformedInputCases();

  const failures = [...fixedFailures, ...tzFailures, ...malformedFailures];
  if (failures.length) {
    console.error(`\n[calcAgeJst テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\n[calcAgeJst テスト] OK (固定時刻${cases.length}件 + TZ非依存3環境 + 不正値ケース)`);
}

main();
