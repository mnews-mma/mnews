// 上流データ(Wikipedia戦績表)のパース誤り・欠落を、一次ソース(出典URL+取得日)
// 付きで訂正するオーバーライド機構。fighterLinkOverrides.tsと同じ発想:
// fighters.ts・data/fighterRecords.jsonそのものは変更せず、コード側のレイヤーで
// 補正する。粒度はbout単位のみ(集計W-Lだけの上書きは不可。Eloの再計算には
// 個々のboutが必要なため)。推測補完は禁止、必ず出典を伴うこと。
import type { FightRecord } from "../fighters";

interface RecordOverrideBase {
  fighterId: string;
  date: string;
  opponent: string; // history側の表記との突合キー(add時はそのまま採用される値)
  source: string; // 出典URL
  fetchedDate: string; // 取得日 YYYY-MM-DD
  note: string; // 訂正の経緯(捏造ゼロ・透明性のため必須)
}

export interface RecordOverrideAdd extends RecordOverrideBase {
  type: "add";
  result: "win" | "loss" | "draw" | "nc";
  method: string;
  event: string;
  round?: string;
}

export interface RecordOverrideRemove extends RecordOverrideBase {
  type: "remove";
}

export type RecordOverride = RecordOverrideAdd | RecordOverrideRemove;

export const RECORD_OVERRIDES: RecordOverride[] = [
  {
    type: "add",
    fighterId: "ya-man",
    date: "2023-05-06",
    opponent: "三浦孝太",
    result: "win",
    method: "1R 3:13 KO（膝とパンチ）",
    event: "RIZIN.42",
    round: "R1",
    source: "https://data-mma.com/fighter/yaman",
    fetchedDate: "2026-07-12",
    note:
      "YA-MANのMMAデビュー戦がWikipedia戦績表に未掲載で欠落していた(通算2-2表示だが正しくは3-2)。" +
      "DATA MMA準拠で追加。RIZIN公式(https://jp.rizinff.com/_ct/17626739)でも同一結果(RIZIN.42、1RTKO/KO勝ち)を確認済み。",
  },
];

// history配列にオーバーライドを適用する。add/removeとも冪等(同じ入力に何度
// 適用しても結果は同じ)。
export function applyRecordOverrides(fighterId: string, history: FightRecord[]): FightRecord[] {
  let result = history;
  for (const o of RECORD_OVERRIDES) {
    if (o.fighterId !== fighterId) continue;
    if (o.type === "remove") {
      result = result.filter((h) => !(h.date === o.date && h.opponent === o.opponent));
    } else if (!result.some((h) => h.date === o.date && h.opponent === o.opponent)) {
      result = [
        ...result,
        { date: o.date, opponent: o.opponent, result: o.result, method: o.method, event: o.event, round: o.round ?? "—" },
      ];
    }
  }
  return result;
}

export interface RecordTotals {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  decision: number;
}

// Wikipedia infobox由来の集計値(wins/losses/ko/sub/decision)は履歴テーブルとは
// 別管理のため、historyへadd追加しただけでは連動しない。オーバーライドで追加した
// bout分だけ集計にも反映する(removeはWikipedia infobox側の値をそのまま信頼し
// 調整しない=総合格闘技以外の戦績が混ざっている等、集計側の独立した誤りは
// このタスクのスコープ外)。
export function applyRecordOverridesToTotals(fighterId: string, totals: RecordTotals): RecordTotals {
  const t = { ...totals };
  for (const o of RECORD_OVERRIDES) {
    if (o.fighterId !== fighterId || o.type !== "add") continue;
    if (o.result === "win") {
      t.wins++;
      if (/判定/.test(o.method)) t.decision++;
      else if (/KO/i.test(o.method)) t.ko++;
      else t.sub++;
    } else if (o.result === "loss") {
      t.losses++;
    } else if (o.result === "draw") {
      t.draws++;
    }
  }
  return t;
}
