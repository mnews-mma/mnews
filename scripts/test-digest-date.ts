// admin/x-preview「朝まとめ」の日付(監査#8)の固定時刻ユニットテスト。
//
// 背景: サーバー側(x-preview/page.tsx)はJST日付文字列を`+09:00`で
// anchorした後にローカルgetter(getMonth/getDate)で"M/D"表記へ再展開して
// おり、Vercel(UTC)では常に1日早い日付になっていた。クライアント側
// (DigestPicker.tsx)は別実装(UTCゲッター使用)で正しかったため、SSR初期
// 表示だけが一瞬誤り、マウント後のuseEffectで即座に上書きされていた
// (hydration mismatchは出ないが表示は一瞬誤る)。
//
// 修正後は両者とも同一の式 shiftDateStr(toJstDateStr(nowMs), -1) を使う
// (page.tsx側が算出しdateIso propとして渡す→DigestPickerはpropsをそのまま
// useStateの初期値にし、useEffectで同じ式により再計算する。PR#196の
// EventCountdownBadgeと同じ型)。このテストでは「サーバー側の式」と
// 「クライアント側の式」を別々に評価して一致することを検証する。
import { execFileSync } from "child_process";
import path from "path";
import { toJstDateStr, shiftDateStr } from "../src/lib/eventCountdown";

// DigestPicker.tsx内のjstIsoToMDと同一実装(コンポーネント内部の表示専用
// ヘルパーのためexportせず、テスト側でミラーする。純粋な文字列パースの
// みでDateオブジェクトを経由しないためtz非依存)。
function jstIsoToMD(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function jstMs(iso: string): number {
  const ms = Date.parse(`${iso}+09:00`);
  if (Number.isNaN(ms)) throw new Error(`invalid JST time: ${iso}`);
  return ms;
}

// x-preview/page.tsx側の式を再現。
function serverYesterdayJstIso(nowMs: number): string {
  return shiftDateStr(toJstDateStr(nowMs), -1);
}

// DigestPicker.tsx useEffect内の式を再現(page.tsx側と文字通り同一式)。
function clientYesterdayJstIso(nowMs: number): string {
  return shiftDateStr(toJstDateStr(nowMs), -1);
}

interface Case {
  now: string;
  expectedIso: string;
  expectedLabel: string;
  note: string;
}

const cases: Case[] = [
  { now: "2026-07-25T02:30:00", expectedIso: "2026-07-24", expectedLabel: "7/24", note: "JST 2:30(危険地帯)" },
  { now: "2026-07-25T12:00:00", expectedIso: "2026-07-24", expectedLabel: "7/24", note: "JST日中(危険地帯外)" },
  { now: "2026-01-01T02:30:00", expectedIso: "2025-12-31", expectedLabel: "12/31", note: "年またぎ+危険地帯" },
  { now: "2026-01-02T12:00:00", expectedIso: "2026-01-01", expectedLabel: "1/1", note: "1桁月日のM/D表記" },
];

function runServerClientMatchCases(): string[] {
  const failures: string[] = [];
  for (const c of cases) {
    const nowMs = jstMs(c.now);
    const serverIso = serverYesterdayJstIso(nowMs);
    const clientIso = clientYesterdayJstIso(nowMs);
    const serverLabel = jstIsoToMD(serverIso);
    const isoMatch = serverIso === clientIso && serverIso === c.expectedIso;
    const labelMatch = serverLabel === c.expectedLabel;
    const ok = isoMatch && labelMatch;
    console.log(
      `${ok ? "  OK" : "FAIL"}  now=${c.now} JST  server="${serverIso}"(${serverLabel})  client="${clientIso}"  (expect iso="${c.expectedIso}" label="${c.expectedLabel}")  ${c.note}`
    );
    if (!ok) {
      failures.push(
        `now=${c.now}: server="${serverIso}" client="${clientIso}" label="${serverLabel}" (expect iso="${c.expectedIso}" label="${c.expectedLabel}")`
      );
    }
  }
  return failures;
}

// TZ=UTC/Asia/Tokyo/America/New_Yorkの3環境で同じ値になることを確認。
function runTzIndependenceCheck(): string[] {
  const failures: string[] = [];
  const workerPath = path.join(__dirname, "_tz-worker-digest-date.ts");
  const tsxBin = path.join(__dirname, "..", "node_modules", ".bin", "tsx");
  const tzList = ["UTC", "Asia/Tokyo", "America/New_York"];
  const fixedNowMs = jstMs("2026-07-25T02:30:00");
  const results: Record<string, string> = {};

  for (const tz of tzList) {
    results[tz] = execFileSync(tsxBin, [workerPath, String(fixedNowMs)], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    }).trim();
    console.log(`  TZ=${tz.padEnd(16)} 昨日(JST) = "${results[tz]}"`);
  }
  const values = Object.values(results);
  if (!values.every((v) => v === values[0])) {
    failures.push(`TZ間で値が不一致: ${JSON.stringify(results)}`);
  } else if (values[0] !== "2026-07-24") {
    failures.push(`TZ非依存だが値自体が誤り: "${values[0]}"`);
  }
  return failures;
}

function main() {
  console.log("--- サーバー側/クライアント側の式が一致すること ---");
  const matchFailures = runServerClientMatchCases();

  console.log("\n--- TZ非依存確認(UTC / Asia/Tokyo / America/New_York) ---");
  const tzFailures = runTzIndependenceCheck();

  const failures = [...matchFailures, ...tzFailures];
  if (failures.length) {
    console.error(`\n[digest-date テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\n[digest-date テスト] OK (${cases.length}件 + TZ非依存3環境)`);
}

main();
