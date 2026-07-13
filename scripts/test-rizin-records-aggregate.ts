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

// ── 7. Phase4: 勝ちの内訳(KO/一本/判定)をmethodRawから分類する ────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E1", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerSlug: "a-slug", methodRaw: "1R 0分54秒 KO（スタンドパンチ）" })] },
    { eventName: "E2", date: "2021-02-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ fighterAName: "C", fighterASlug: "c-slug", fighterBName: "A", fighterBSlug: "a-slug", winnerName: "A", winnerSlug: "a-slug", methodRaw: "1R 4分43秒 SUB（テクニカルサブミッション：フロントチョーク）" })] },
    { eventName: "E3", date: "2021-03-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerSlug: "a-slug", methodRaw: "3R 判定 （2-1）" })] },
    { eventName: "E4", date: "2021-04-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerName: "B", winnerSlug: "b-slug", methodRaw: "1R KO" })] }, // 負け試合は内訳に数えない
  ];
  const rec = computeFighterMmaRecord(events, "a-slug");
  check(rec.wins === 3 && rec.losses === 1, "Phase4: 3勝1敗");
  check(rec.ko === 1 && rec.sub === 1 && rec.decision === 1, `Phase4: 勝ちの内訳がKO1/一本1/判定1になる (got ko${rec.ko} sub${rec.sub} decision${rec.decision})`);
}

// ── 8. Phase4: 実データパターンでの確認済み値と一致する(冪等性・全体スキャン用) ──
// YA-MANの実データパターン(RIZIN.42のデビュー戦が公式ソースに独立して収録済み
// のため、Wikipedia側のオーバーライドなしでも3勝2敗が導出できることの確認)。
{
  const events: RizinRecordsEvent[] = [
    { eventName: "RIZIN.33", date: "2021-12-31", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ ruleType: "キックボクシング", winnerSlug: "a-slug", methodRaw: "判定" })] },
    { eventName: "RIZIN.42", date: "2023-05-06", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerSlug: "a-slug", methodRaw: "1R KO" })] },
    { eventName: "RIZIN.45", date: "2023-12-31", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerName: "B", winnerSlug: "b-slug", methodRaw: "判定0-3" })] },
    { eventName: "超RIZIN.3", date: "2024-07-28", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerSlug: "a-slug", methodRaw: "1R KO" })] },
    { eventName: "RIZIN.49", date: "2024-12-31", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerName: "B", winnerSlug: "b-slug", methodRaw: "判定0-3" })] },
    { eventName: "超RIZIN.4", date: "2025-07-27", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [bout({ winnerSlug: "a-slug", methodRaw: "3R TKO" })] },
  ];
  const rec = computeFighterMmaRecord(events, "a-slug");
  check(rec.wins === 3 && rec.losses === 2, `Phase4(YA-MANパターン): キックボクシング除外・RIZIN公式収録のデビュー戦を含めて3勝2敗になる (got ${rec.wins}-${rec.losses})`);
  check(rec.excluded.length === 1, "Phase4(YA-MANパターン): キックボクシング1件が除外される");

  // 冪等性: 同一入力を2回連続で計算しても完全一致する(加算方式ではないため
  // 何度実行しても結果は変わらない)。
  const rec2 = computeFighterMmaRecord(events, "a-slug");
  check(
    rec.wins === rec2.wins && rec.losses === rec2.losses && rec.ko === rec2.ko && rec.sub === rec2.sub && rec.decision === rec2.decision,
    "Phase4: 冪等性(同一入力を2回計算しても完全一致する)"
  );
}

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);
