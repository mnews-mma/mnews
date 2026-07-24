// eventCountdown(残り日数)の固定時刻ユニットテスト。
//
// 背景: 以前は表示箇所ごとに new Date()+setHours(0,0,0,0) で日数を計算しており、
// JST 0:00〜9:00 の帯だけ UTC 解釈で +1 ずれていた(トップのライブ帯=正、詳細
// ページ=+1)。深夜帯にしか出ないため通常の目視では気づけない。固定時刻で
// 回帰を検出する。
import { daysUntilEventJst } from "../src/lib/eventCountdown";

// JST の壁時計時刻(YYYY-MM-DDTHH:mm+09:00)を UTC エポックms に変換。
function jst(iso: string): number {
  const ms = Date.parse(`${iso}+09:00`);
  if (Number.isNaN(ms)) throw new Error(`invalid JST time: ${iso}`);
  return ms;
}

interface Case {
  now: string; // 観測時刻(JST)
  event: string; // 開催日(YYYY-MM-DD)
  expected: number;
  note: string;
}

const cases: Case[] = [
  { now: "2026-07-25T02:30:00", event: "2026-07-26", expected: 1, note: "深夜(JST 0:00〜9:00)でも翌日開催は1(UTC解釈で2にならない)" },
  { now: "2026-07-25T23:59:00", event: "2026-07-26", expected: 1, note: "前日の終わりでも1" },
  { now: "2026-07-26T00:01:00", event: "2026-07-26", expected: 0, note: "当日0:01は本日開催=0" },
  { now: "2026-07-26T13:00:00", event: "2026-07-26", expected: 0, note: "開始後(13:00)でも0のまま。負数にしない" },
  { now: "2026-07-25T08:00:00", event: "2026-07-27", expected: 2, note: "JST 8:00(UTCでは前日)でも2日後は2" },
];

function main() {
  const failures: string[] = [];
  for (const c of cases) {
    const got = daysUntilEventJst(c.event, jst(c.now));
    const ok = got === c.expected;
    console.log(`${ok ? "  OK" : "FAIL"}  now=${c.now} JST  event=${c.event}  → ${got} (expect ${c.expected})  ${c.note}`);
    if (!ok) failures.push(`now=${c.now} event=${c.event}: got ${got}, expected ${c.expected}`);
  }

  if (failures.length) {
    console.error(`\n[eventCountdown テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\n[eventCountdown テスト] OK (${cases.length}件)`);
}

main();
