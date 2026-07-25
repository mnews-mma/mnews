// scripts/update-fighter-records.ts の「未来日付history除外フィルタ」
// (監査#6)の固定時刻ユニットテスト。
//
// 背景: 以前は `new Date().toISOString().slice(0, 10)`(UTC基準の「今日」)を
// asOfKeyとして使っており、Mレーティング更新バッチのcron実行時刻
// (30 17 * * * = 毎日JST 2:30、JST 0:00〜9:00の危険地帯)により、
// 深夜開催(JST 0:00〜2:30)+即日Wikipedia反映が重なった場合、当日開催の
// 試合結果が「未来日付」と誤判定されhistoryから除外されていた
// (翌日のバッチ実行で自然回復するが、その間ランキング等に反映されない)。
//
// update-fighter-records.tsは本体がfs書き込み・外部fetchを伴うため直接
// importしてテストせず、実装と同一の判定式(toJstDateStr()ベースの
// asOfKey・`h.date <= asOfKey`)をここで再現して検証する。
import { toJstDateStr } from "../src/lib/eventCountdown";

function jstMs(iso: string): number {
  const ms = Date.parse(`${iso}+09:00`);
  if (Number.isNaN(ms)) throw new Error(`invalid JST time: ${iso}`);
  return ms;
}

// update-fighter-records.tsのtoCacheEntry()内と同一の判定式。
function isFutureHistoryEntry(entryDate: string, nowMs: number): boolean {
  const asOfKey = toJstDateStr(nowMs);
  return !(entryDate <= asOfKey);
}

interface Case {
  now: string; // バッチ実行時刻(JST壁時計)
  entryDate: string; // Wikipedia history上の試合日
  expectFiltered: boolean; // true=未来日付として除外されるべき
  note: string;
}

const cases: Case[] = [
  {
    now: "2026-07-25T02:30:00", // 実際のcron実行時刻(JST 2:30、危険地帯)
    entryDate: "2026-07-25", // 同じJST暦日に開催され、即日Wikipedia反映された試合
    expectFiltered: false,
    note: "深夜開催+即日反映が重なっても当日の結果は除外されない(監査#6の核心)",
  },
  {
    now: "2026-07-25T02:30:00",
    entryDate: "2026-07-24",
    expectFiltered: false,
    note: "前日の試合は当然除外されない",
  },
  {
    now: "2026-07-25T02:30:00",
    entryDate: "2026-07-26",
    expectFiltered: true,
    note: "本当に未来の試合(翌日開催)は引き続き正しく除外される",
  },
  {
    now: "2026-07-25T12:00:00", // 危険地帯外(日中)
    entryDate: "2026-07-25",
    expectFiltered: false,
    note: "危険地帯外でも当日の結果は除外されない(回帰確認)",
  },
];

function main() {
  const failures: string[] = [];
  for (const c of cases) {
    const filtered = isFutureHistoryEntry(c.entryDate, jstMs(c.now));
    const ok = filtered === c.expectFiltered;
    console.log(
      `${ok ? "  OK" : "FAIL"}  now=${c.now} JST  entryDate=${c.entryDate}  → 除外=${filtered} (expect ${c.expectFiltered})  ${c.note}`
    );
    if (!ok) failures.push(`now=${c.now} entryDate=${c.entryDate}: got 除外=${filtered}, expected ${c.expectFiltered}`);
  }

  if (failures.length) {
    console.error(`\n[未来日付historyフィルタ テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\n[未来日付historyフィルタ テスト] OK (${cases.length}件)`);
}

main();
