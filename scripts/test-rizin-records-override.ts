// rizinRecordsOverride.ts(Phase2: rizinRecords優先・historyフォールバック配線)
// のユニットテスト。実行: npx tsx scripts/test-rizin-records-override.ts
import { buildRizinRecordsIndex, applyRizinRecordsToHistory } from "../src/lib/mnewsRating/rizinRecordsOverride";
import { HistoryEntryLike } from "../src/lib/mnewsRating/engine";
import { RizinRecordsEvent, RizinRecordsBout } from "../src/lib/mnewsRating/rizinScraper";

let passes = 0;
let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

function rizinBout(overrides: Partial<RizinRecordsBout>): RizinRecordsBout {
  return {
    cardPosition: 1,
    isOpeningFight: false,
    headingText: "",
    fighterAName: "選手A",
    fighterBName: "選手B",
    fighterASlug: "a-slug",
    fighterBSlug: "b-slug",
    ruleType: "MMA",
    weightKg: 66,
    namedDivision: null,
    resultType: "decisive",
    winnerName: "選手A",
    winnerSlug: "a-slug",
    round: null,
    time: null,
    methodRaw: "",
    isWeighInMiss: false,
    ...overrides,
  };
}

function historyEntry(overrides: Partial<HistoryEntryLike>): HistoryEntryLike {
  return {
    date: "2021-01-01",
    opponent: "対戦相手",
    result: "win",
    method: "旧データの決着方式",
    event: "RIZIN.99",
    round: "R1",
    ...overrides,
  };
}

// ── 1. マッチする試合があれば優先する(result/method/weightClassを上書き) ──
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({ methodRaw: "1R KO" })] },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({ result: "loss", method: "旧データ" })];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.overriddenCount === 1, "優先: マッチした試合を1件上書きする");
  check(res.history[0].result === "win", "優先: resultをrizinRecords側(WIN)で上書きする(元はloss)");
  check(res.history[0].method === "1R KO", "優先: methodをrizinRecords側で上書きする");
  check(res.history[0].date === "2021-01-01" && res.history[0].opponent === "対戦相手", "優先: date/opponentはhistory側の表記を維持する(上書きしない)");
}

// ── 2. マッチしない試合はhistoryにフォールバックする(そのまま) ─────────────
{
  const index = buildRizinRecordsIndex([]); // 空のrizinRecords
  const history = [historyEntry({ date: "2020-06-01", result: "win", method: "旧データのまま" })];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.overriddenCount === 0, "フォールバック: マッチしなければ上書き件数は0");
  check(res.history[0].method === "旧データのまま", "フォールバック: マッチしない試合はhistoryをそのまま使う");
}

// ── 3. MMA以外のルール種別は除外する(戦績に含めない) ──────────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({ ruleType: "キックボクシング" })] },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({})];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.history.length === 0, "MMA以外除外: キックボクシングルールの試合はhistoryから除外する");
  check(res.excludedCount === 1, "MMA以外除外: excludedCountとして記録する");
}

// ── 4. 試合中止(cancelled)は除外する ────────────────────────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({ resultType: "cancelled" })] },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({})];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.history.length === 0, "試合中止除外: 中止試合はhistoryから除外する");
}

// ── 5. NC(ノーコンテスト)は正しくnc扱いにする ────────────────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2026-04-12", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({ resultType: "nc", winnerName: null, winnerSlug: null, isWeighInMiss: true, methodRaw: "1R 4分50秒 ノーコンテスト 体重超過" })] },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({ date: "2026-04-12", result: "loss" })];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.history[0].result === "nc", "NC: resultTypeがncならresult='nc'に上書きする");
}

// ── 6. 決着種別が判定不能(unknown)なら上書きせず元のまま ───────────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({ resultType: "unknown", methodRaw: "" })] },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({ result: "win", method: "旧データ" })];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.overriddenCount === 0, "判定不能: unknownは上書きしない(補完しない)");
  check(res.history[0].method === "旧データ", "判定不能: 元のhistoryのまま使う");
}

// ── 7. RIZIN MMA以外のイベント(他団体等)はそもそも対象にしない(isRizinMmaEvent) ──
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({})] },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({ event: "DEEP.100", method: "他団体データ" })];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.overriddenCount === 0 && res.history[0].method === "他団体データ", "RIZIN以外除外対象外: isRizinMmaEventがfalseの試合はそもそもマッチングを試みない");
}

// ── 8. weightClassの再構成(namedDivision優先、無ければ体重kg) ──────────────
{
  const events: RizinRecordsEvent[] = [
    { eventName: "E1", date: "2021-01-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({ namedDivision: "フェザー級", weightKg: 66 })] },
    { eventName: "E2", date: "2021-02-01", sourceUrl: "", fetchedDate: "", parseFailures: 0, bouts: [rizinBout({ namedDivision: null, weightKg: 71 })] },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({ date: "2021-01-01" }), historyEntry({ date: "2021-02-01" })];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.history[0].weightClass === "フェザー級", "weightClass再構成: namedDivisionがあればそれを使う");
  check(res.history[1].weightClass === "71kg契約", "weightClass再構成: namedDivisionが無ければ体重kgから再構成する");
}

// ── 9. 同一選手が同日に複数試合(同一興行内の準決勝→決勝トーナメント等)は
//     対戦相手名で一意特定し、それぞれ正しい試合に対応する結果/method/
//     weightClassだけを上書きする(索引がslug|dateのみだと後勝ちで衝突する
//     バグの再発防止。パトリッキー・ピットブル RIZIN.20 2019-12-31の実例)。
{
  const events: RizinRecordsEvent[] = [
    {
      eventName: "RIZIN.20",
      date: "2019-12-31",
      sourceUrl: "",
      fetchedDate: "",
      parseFailures: 0,
      bouts: [
        rizinBout({
          cardPosition: 2,
          fighterAName: "パトリッキー",
          fighterBName: "グスタボ",
          fighterASlug: "patricky",
          fighterBSlug: "gustavo",
          winnerName: "パトリッキー",
          winnerSlug: "patricky",
          methodRaw: "1R TKO",
        }),
        rizinBout({
          cardPosition: 10,
          fighterAName: "パトリッキー",
          fighterBName: "ムサエフ",
          fighterASlug: "patricky",
          fighterBSlug: "musaev",
          winnerName: "ムサエフ",
          winnerSlug: "musaev",
          methodRaw: "3R 判定",
        }),
      ],
    },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [
    historyEntry({ date: "2019-12-31", opponent: "ムサエフ", result: "loss", method: "旧データ(決勝)" }),
    historyEntry({ date: "2019-12-31", opponent: "グスタボ", result: "win", method: "旧データ(準決勝)" }),
  ];
  const res = applyRizinRecordsToHistory("patricky", history, index);
  check(res.overriddenCount === 2, "同日複数試合: 対戦相手名で2件とも一意特定して上書きする");
  check(res.history[0].opponent === "ムサエフ" && res.history[0].result === "loss", "同日複数試合: 決勝(vsムサエフ)はloss(準決勝の勝ちで上書きされない)");
  check(res.history[0].method === "3R 判定", "同日複数試合: 決勝のmethodは決勝自身のもの");
  check(res.history[1].opponent === "グスタボ" && res.history[1].result === "win", "同日複数試合: 準決勝(vsグスタボ)はwinのまま");
  check(res.history[1].method === "1R TKO", "同日複数試合: 準決勝のmethodは準決勝自身のもの");
}

// ── 10. 同日複数試合で対戦相手名が一致しない(=一意特定できない)場合は
//      推測せず元のhistoryのままにする ──────────────────────────────────
{
  const events: RizinRecordsEvent[] = [
    {
      eventName: "E",
      date: "2021-01-01",
      sourceUrl: "",
      fetchedDate: "",
      parseFailures: 0,
      bouts: [
        rizinBout({ cardPosition: 1, fighterBName: "選手C", fighterBSlug: "c-slug", methodRaw: "1R KO" }),
        rizinBout({ cardPosition: 2, fighterBName: "選手D", fighterBSlug: "d-slug", methodRaw: "2R KO" }),
      ],
    },
  ];
  const index = buildRizinRecordsIndex(events);
  const history = [historyEntry({ date: "2021-01-01", opponent: "名前が一致しない選手", method: "元データ" })];
  const res = applyRizinRecordsToHistory("a-slug", history, index);
  check(res.overriddenCount === 0, "同日複数試合・特定不能: 対戦相手名が一致しなければ上書きしない");
  check(res.history[0].method === "元データ", "同日複数試合・特定不能: 元のhistoryのまま使う(推測補完しない)");
}

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);
