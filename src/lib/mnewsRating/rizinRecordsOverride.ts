// Phase 2: rizinRecords.json(RIZIN公式ソース)を、対応するfighterRecords.json
// history側の試合より優先して使う配線。「rizinRecordsにエントリがあれば優先・
// 無ければ従来historyにフォールバック」という単純な優先順位を、bout単位(1試合
// ごと)で適用する。日付+選手slugで対応するrizinRecordsの試合を特定できた場合
// のみ上書きし、特定できない試合は元のhistoryをそのまま使う(推測での補完はしない)。
//
// 上書きするのはresult/method/weightClassの3フィールドのみ(date/opponent/event
// はhistory側の表記をそのまま維持する。recordOverrides.tsのpatch-weight-classと
// 同じ「必要最小限のフィールドだけ直す」設計)。
// - ルール種別がMMA以外(キックボクシング等)の試合はhistoryから除外する
//   (RIZIN戦績としては数えない。捏造ではなく対象外として扱う)。
// - 試合中止(cancelled)もhistoryから除外する(試合が成立していないため)。
// - 決着種別が判定不能(unknown)の場合は上書きせず元のhistoryのまま使う。
import { HistoryEntryLike, isRizinMmaEvent } from "./engine";
import { RizinRecordsBout, RizinRecordsEvent } from "./rizinScraper";

// rizinRecords.json(自動スクレイピング)がbout単位のruleTypeを誤タグ付けした
// ことが一次ソース(RIZIN公式個別試合結果ページ等)で確認できたケースの、
// ピンポイント訂正。パーサー自体(rizinScraper.ts)の修正はスコープ外とし、
// 個々のbout単位でruleTypeだけを訂正する。1試合=1エントリとし、fighterA/B
// どちらの視点で参照されても同じ訂正済みboutオブジェクトが返る(buildRizinRecordsIndex
// が両者のインデックスに同一オブジェクトを登録するため、両者の側を別々に手入力しない)。
export interface RizinRecordsRuleTypeOverride {
  eventName: string; // rizinRecords.json側のイベント名表記(完全一致)
  date: string;
  fighterAName: string; // rizinRecords.json側のbout表記(順不同判定はしない側で吸収)
  fighterBName: string;
  correctedRuleType: RizinRecordsBout["ruleType"];
  source: string;
  fetchedDate: string;
  note: string;
}

export const RIZIN_RECORDS_RULE_TYPE_OVERRIDES: RizinRecordsRuleTypeOverride[] = [
  {
    // 2026-07-20: パトリッキー・ピットブル×ホベルト・サトシ・ソウザ
    // (超RIZIN.2、2023-07-30)がruleType="その他"のためapplyRizinRecordsToHistoryで
    // 戦績集計から丸ごと除外されていた(パトリッキー ライト級2-3、サトシ・ソウザ
    // ライト級13-3という欠落状態の原因)。イベント表記に含まれる
    // 【Bellatorライト級ワールドグランプリ1回戦】という特殊ラベルがルール種別
    // パーサーを混乱させたと推定されるが、実際は通常のMMAルール一戦(3R0:49TKO)。
    eventName: "のむシリカ presents 超RIZIN.2 powered by U-NEXT",
    date: "2023-07-30",
    fighterAName: "パトリッキー・ピットブル",
    fighterBName: "ホベルト・サトシ・ソウザ",
    correctedRuleType: "MMA",
    source: "https://jp.rizinff.com/_ct/17645070",
    fetchedDate: "2026-07-20",
    note:
      "RIZIN公式個別試合結果ページで実在・MMAルールでの決着(3R0:49TKO、カーフキック→パウンド)を" +
      "確認済み。rizinRecords.json側のruleType「その他」はイベント名内の" +
      "【Bellatorライト級ワールドグランプリ1回戦】ラベルによる自動判定の誤りと推定されるが、" +
      "パーサー自体の修正は本対応のスコープ外(この1試合のみをピンポイントで訂正)。",
  },
];

function applyRuleTypeOverride(ev: RizinRecordsEvent, b: RizinRecordsBout): RizinRecordsBout {
  const o = RIZIN_RECORDS_RULE_TYPE_OVERRIDES.find(
    (o) =>
      o.eventName === ev.eventName &&
      o.date === ev.date &&
      ((o.fighterAName === b.fighterAName && o.fighterBName === b.fighterBName) ||
        (o.fighterAName === b.fighterBName && o.fighterBName === b.fighterAName))
  );
  return o ? { ...b, ruleType: o.correctedRuleType } : b;
}

// slug+日付 → その試合のrizinRecords該当エントリ、の索引を1回だけ構築する。
export function buildRizinRecordsIndex(events: RizinRecordsEvent[]): Map<string, RizinRecordsBout> {
  const index = new Map<string, RizinRecordsBout>();
  for (const ev of events) {
    for (const raw of ev.bouts) {
      const b = applyRuleTypeOverride(ev, raw);
      if (b.fighterASlug) index.set(`${b.fighterASlug}|${ev.date}`, b);
      if (b.fighterBSlug) index.set(`${b.fighterBSlug}|${ev.date}`, b);
    }
  }
  return index;
}

function formatWeightClass(b: RizinRecordsBout): string | undefined {
  if (b.namedDivision) return b.namedDivision;
  if (b.weightKg) return `${b.weightKg}kg契約`;
  return undefined;
}

export interface RizinOverrideResult {
  history: HistoryEntryLike[];
  overriddenCount: number; // result/methodを公式ソースで上書きした試合数
  excludedCount: number; // MMA以外・試合中止で除外した試合数
}

export function applyRizinRecordsToHistory(
  slug: string,
  history: HistoryEntryLike[],
  index: Map<string, RizinRecordsBout>
): RizinOverrideResult {
  let overriddenCount = 0;
  let excludedCount = 0;
  const result: HistoryEntryLike[] = [];

  for (const h of history) {
    if (!isRizinMmaEvent(h.event)) {
      result.push(h);
      continue;
    }
    const match = index.get(`${slug}|${h.date}`);
    if (!match) {
      result.push(h); // 対応するrizinRecordsが無い試合はフォールバック(元のまま)
      continue;
    }
    if (match.ruleType !== "MMA" || match.resultType === "cancelled") {
      excludedCount++;
      continue; // MMA以外・中止試合は戦績集計から除外する
    }
    if (match.resultType === "unknown") {
      result.push(h); // 判定不能は補完せず元のまま
      continue;
    }

    let newResult: HistoryEntryLike["result"];
    if (match.resultType === "nc") newResult = "nc";
    else if (match.resultType === "draw") newResult = "draw";
    else newResult = match.winnerSlug === slug ? "win" : "loss";

    overriddenCount++;
    result.push({
      ...h,
      result: newResult,
      method: match.methodRaw || h.method,
      weightClass: formatWeightClass(match) ?? h.weightClass,
      isOpeningFight: match.isOpeningFight,
    });
  }

  return { history: result, overriddenCount, excludedCount };
}
