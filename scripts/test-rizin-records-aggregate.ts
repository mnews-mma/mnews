// rizinRecordsAggregate.ts(RIZIN公式データからの戦績集計)のユニットテスト。
// 実行: npx tsx scripts/test-rizin-records-aggregate.ts
import { computeFighterMmaRecord } from "../src/lib/mnewsRating/rizinRecordsAggregate";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";

let passes = 0;
let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

function bout(overrides: Partial<import("../src/lib/mnewsRating/rizinScraper").RizinRecordsBout>) {
  return {
    cardPosition: 1,
    isOpeningFight: false,
    headingText: "",
    fighterAName: "A",
    fighterBName: "B",
    fighterASlug: "a-slug",
    fighterBSlug: "b-slug",
    ruleType: "MMA",
    weightKg: 66,
    namedDivision: null,
    resultType: "decisive",
    winnerName: "A",
    winnerSlug: "a-slug",
    round: null,
    time: null,
    methodRaw: "",
    isWeighInMiss: false,
    ...overrides,
  };
}

// ── 1. A-1: ルール種別フィルタ(MMA以外を戦績集計から除外する) ──────────────
{
  const events: RizinRecordsEvent[] = [
    {
      eventName: "Event1",
      date: "2021-01-01",
      sourceUrl: "",
      fetchedDate: "",
      parseFailures: 0,
      bouts: [bout({ fighterAName: "選手A", fighterBName: "選手B", ruleType: "キックボクシング", winnerName: "選手A", winnerSlug: "a-slug" })],
    },
  ];
  const rec = computeFighterMmaRecord(events, "a-slug");
  check(rec.wins === 0 && rec.losses === 0, "A-1: キックボクシングルールの試合は勝敗集計に数えない");
  check(rec.excluded.length === 1, "A-1: 除外した試合を1件記録する(削除ではなく理由つきで残す)");
  check(rec.excluded[0].reason.includes("キックボクシング"), "A-1: 除外理由にルール種別を明記する");
  check(rec.bouts.length === 0, "A-1: MMA以外の試合は集計対象boutsにも含めない");
}

// ── 2. A-1回帰確認: MMAルールの試合は通常どおり数える ────────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ ruleType: "MMA", winnerSlug: "a-slug" })] },
  ];
  const rec = computeFighterMmaRecord(events, "a-slug");
  check(rec.wins === 1 && rec.excluded.length === 0, "A-1回帰: MMAルールの試合は除外されず勝敗に数える");
}

// ── 3. A-2: NCは勝敗どちらにも数えない ───────────────────────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2026-04-12", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ resultType: "nc", winnerName: null, winnerSlug: null, isWeighInMiss: true, methodRaw: "1R 4分50秒 ノーコンテスト 体重超過" })] },
  ];
  const rec = computeFighterMmaRecord(events, "a-slug");
  check(rec.ncs === 1 && rec.wins === 0 && rec.losses === 0, "A-2: NCは勝敗どちらにも数えず、ncsとして別集計する");
}

// ── 4. 敗戦の集計(自分が勝者でなければLOSE) ──────────────────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerName: "B", winnerSlug: "b-slug" })] },
  ];
  const rec = computeFighterMmaRecord(events, "a-slug");
  check(rec.losses === 1 && rec.wins === 0, "敗戦: 勝者が自分でなければ敗戦として数える");
  check(rec.bouts[0].isWin === false, "敗戦: isWinがfalseになる");
}

// ── 5. 複数大会にまたがる集計(実データパターンに近い形) ───────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E1", date: "2020-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerSlug: "a-slug" })] },
    { eventName: "E2", date: "2020-02-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerName: "B", winnerSlug: "b-slug" })] },
    { eventName: "E3", date: "2020-03-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ resultType: "nc", winnerName: null, winnerSlug: null })] },
  ];
  const rec = computeFighterMmaRecord(events, "a-slug");
  check(rec.wins === 1 && rec.losses === 1 && rec.ncs === 1, "複数大会集計: 3大会(1勝1敗1NC)を正しく合算する");
  check(rec.bouts.length === 3, "複数大会集計: MMAルール戦はすべてboutsに含まれる(NCも含む)");
  check(rec.bouts[0].date === "2020-01-01" && rec.bouts[2].date === "2020-03-01", "複数大会集計: 日付昇順にソートされる");
}

// ── 6. 対象外の選手は集計に含まれない ────────────────────────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({})] },
  ];
  const rec = computeFighterMmaRecord(events, "someone-else");
  check(rec.wins === 0 && rec.losses === 0 && rec.bouts.length === 0, "対象外選手: 出場していない試合は集計されない");
}

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);
