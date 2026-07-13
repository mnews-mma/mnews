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
  // Wikipedia infobox(通算戦績の集計値)が既にこの試合を反映済みかどうか。
  // true の場合、historyへの追加(試合結果テーブルへの表示)のみ行い、
  // applyRecordOverridesToTotals による集計値への加算はスキップする
  // (集計値は既に正しいのに追加分をさらに+1すると二重加算になるため)。
  // 例: 鈴木博昭は通算6敗(infobox)が既に平本蓮戦を含んだ数字だったが、
  // Wikipediaの試合結果テーブル(Fight-cont)にはこの一戦だけ抜け落ちていた
  // (YA-MANのように集計自体が古い/欠落しているケースとは異なる)。
  // 未指定(デフォルト)はfalse=従来どおり集計値にも反映する。
  totalsAlreadyReflected?: boolean;
}

export interface RecordOverrideRemove extends RecordOverrideBase {
  type: "remove";
}

// 既存のbout(date+opponentで特定)のweightClassのみを補完する。date/opponent/
// result/method/eventは一切変更しない。EVENT_RESULTS収録期間(概ね直近18ヶ月)
// より古く、自動突合(enrichHistoryWeightClass.ts)では階級が判明しない試合を、
// RIZIN公式の当該試合結果ページからピンポイントで個別取得する場合に使う
// (全面的な公式ソース化ではなく、個々の試合単位の補完)。
export interface RecordOverridePatchWeightClass extends RecordOverrideBase {
  type: "patch-weight-class";
  weightClass: string;
}

export type RecordOverride = RecordOverrideAdd | RecordOverrideRemove | RecordOverridePatchWeightClass;

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
  {
    type: "add",
    fighterId: "hagiwara-kyohei",
    date: "2026-04-12",
    opponent: "アバイジャ・カレオ・メヘウラ",
    // 保存するのはケージ内で実際に起きた結果(TKO負け)。公式記録としてのNC
    // 裁定への変換はWEIGH_IN_MISS_RULINGS+ルール(engine.ts)側で行う
    // (このオーバーライドで直接nceにはしない=ハードコードではなくルール適用)。
    result: "loss",
    method: "1R パウンド",
    event: "RIZIN LANDMARK 13",
    round: "R1",
    source: "https://jp.rizinff.com/_ct/17833706",
    fetchedDate: "2026-07-12",
    note:
      "萩原京平のRIZIN LANDMARK 13(2026-04-12)第9試合がWikipedia戦績表・EVENT_RESULTS両方に未掲載で" +
      "欠落していた。RIZIN公式試合結果ページで追加。この一戦は計量オーバー裁定によりノーコンテスト" +
      "(WEIGH_IN_MISS_RULINGS参照)。",
  },
  {
    type: "add",
    fighterId: "suzuki-hiroaki",
    date: "2022-07-02",
    opponent: "平本蓮",
    result: "loss",
    method: "5分3R終了 判定1-2",
    event: "RIZIN.36",
    round: "R3",
    // Wikipedia infobox(通算6敗)は既にこの一戦を反映済み(記事本文にも
    // 「2022年7月2日、RIZIN.36で平本蓮と対戦し...1-2の判定負け」と明記されている)。
    // しかし試合結果テーブル({{Fight-cont}})にはこの一戦だけ欠落しており、
    // 選手ページの対戦テーブルに表示されていなかった(集計値は既に正しい)。
    totalsAlreadyReflected: true,
    source: "https://jp.rizinff.com/_ct/17552126",
    fetchedDate: "2026-07-13",
    note:
      "鈴木博昭のRIZIN.36(2022-07-02)平本蓮戦がWikipedia記事本文には記載されているものの、" +
      "試合結果テーブル({{Fight-cont}})にだけ欠落しており、選手ページの対戦テーブルに表示されて" +
      "いなかった(通算戦績6敗は既にこの一戦を含んだ正しい値のため、集計値への加算は行わない)。" +
      "RIZIN公式試合結果ページで追加。",
  },
  {
    type: "patch-weight-class",
    fighterId: "nakamura-daisuke",
    date: "2022-03-20",
    opponent: "山本空良",
    weightClass: "68.0kg契約",
    source: "https://jp.rizinff.com/_ct/17525892",
    fetchedDate: "2026-07-13",
    note:
      "中村大介のRIZIN.34(2022-03-20)第14試合はEVENT_RESULTS収録期間(概ね直近18ヶ月)より古く、" +
      "自動突合では階級不明のままだった。RIZIN公式試合結果一覧ページ(第14試合)から契約体重を個別取得。",
  },
  {
    type: "patch-weight-class",
    fighterId: "nakamura-daisuke",
    date: "2021-10-24",
    opponent: "新居すぐる",
    weightClass: "66.0kg契約",
    source: "https://jp.rizinff.com/_ct/17489769",
    fetchedDate: "2026-07-13",
    note:
      "中村大介のRIZIN.31(2021-10-24)第6試合はEVENT_RESULTS収録期間(概ね直近18ヶ月)より古く、" +
      "自動突合では階級不明のままだった。RIZIN公式試合結果一覧ページ(第6試合)から契約体重を個別取得。",
  },
];

export interface WeighInMissRuling {
  fighterId: string; // 視点の選手(このエントリのhistory側)のslug
  date: string;
  opponent: string; // history.opponentの表記
  missedBy: "self" | "opponent"; // 計量オーバーしたのがfighterId本人か対戦相手か
  source: string;
  fetchedDate: string;
  note: string;
}

// RIZIN裁定: 計量オーバーした側が勝った試合はノーコンテスト(負けた/引き分けなら
// 通常どおり)。実際にどちらが計量オーバーしたかは一次ソースでしか判明しないため、
// 判明した試合をここに列挙し、engine.tsのルール(applyWeighInMissRuling)が
// 機械的にNC変換する(特定boutの手動書き換えではなく、一般ルール+事実データの
// 分離)。
export const WEIGH_IN_MISS_RULINGS: WeighInMissRuling[] = [
  {
    fighterId: "hagiwara-kyohei",
    date: "2026-04-12",
    opponent: "アバイジャ・カレオ・メヘウラ",
    missedBy: "opponent",
    source: "https://jp.rizinff.com/_ct/17833706",
    fetchedDate: "2026-07-12",
    note:
      "メヘウラが66.00kg契約を1.5kgオーバー。RIZIN裁定によりメヘウラ勝利時はノーコンテストの取り決め。" +
      "実際にメヘウラが1RでTKO相当の勝利をおさめたため公式記録はノーコンテスト" +
      "(参考: https://www.oricon.co.jp/news/2448371/full/ 、https://mmaplanet.jp/225348 )。",
  },
];

export function lookupWeighInMiss(fighterId: string, date: string, opponent: string): "self" | "opponent" | null {
  const r = WEIGH_IN_MISS_RULINGS.find((w) => w.fighterId === fighterId && w.date === date && w.opponent === opponent);
  return r ? r.missedBy : null;
}

// history配列にオーバーライドを適用する。add/removeとも冪等(同じ入力に何度
// 適用しても結果は同じ)。
export function applyRecordOverrides(fighterId: string, history: FightRecord[]): FightRecord[] {
  let result = history;
  for (const o of RECORD_OVERRIDES) {
    if (o.fighterId !== fighterId) continue;
    if (o.type === "remove") {
      result = result.filter((h) => !(h.date === o.date && h.opponent === o.opponent));
    } else if (o.type === "patch-weight-class") {
      result = result.map((h) => (h.date === o.date && h.opponent === o.opponent ? { ...h, weightClass: o.weightClass } : h));
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

// 2026-07-13(mnewsレーティングPhase4): 通算戦績(総合格闘技 戦績。RIZIN外を含む
// 全キャリア)の集計値はWikipedia/DATA MMA/シード値(totals引数)をそのまま
// 据え置くのが原則(historyの都度カウントには絶対に切り替えない。GAMMA戦績の
// ように「試合履歴表には載っているが編集方針上プロ戦績には数えない」試合が
// 混入し、シェイドゥラエフの通算が19-0→22-0に水増しされる事故が発生したため)。
//
// ただしRECORD_OVERRIDES(add型)で追加したbout(=Wikipedia戦績表に丸ごと
// 欠落していたことが判明している試合)は、その欠落が集計値にも及んでいる限り
// 補正が必要。旧実装(廃止済み)は「Wikipedia生値に毎回+1」という固定delta加算
// だったため、Wikipedia側が独自にそのboutを取り込んだ瞬間に二重加算になる
// 非冪等バグの原因だった。この実装は毎回rawHistory(オーバーライド適用前の
// Wikipedia生history)を見て、対象boutが既に含まれているかを判定してから
// 加算するかどうかを決める(同じ入力なら常に同じ結果になる=冪等。Wikipedia側が
// 追いついて生historyに載れば自動的に加算をやめる)。
export function applyRecordOverridesToTotals(fighterId: string, rawHistory: FightRecord[], totals: RecordTotals): RecordTotals {
  const t = { ...totals };
  for (const o of RECORD_OVERRIDES) {
    if (o.fighterId !== fighterId || o.type !== "add") continue;

    // 集計値(infobox)側は既にこの試合を反映済みと判明している場合(鈴木博昭の
    // 平本蓮戦のように、試合結果テーブルにだけ欠落しているケース)は、history
    // への追加のみ行い集計値には加算しない(二重加算防止)。
    if (o.totalsAlreadyReflected) continue;

    // Wikipedia側の生historyに既にこのboutが存在するなら、Wikipedia生値の
    // 集計にも既に反映されている可能性が高いため加算をスキップする(二重加算防止)。
    const alreadyInRawHistory = rawHistory.some((h) => h.date === o.date && h.opponent === o.opponent);
    if (alreadyInRawHistory) continue;

    // 計量オーバー裁定でノーコンテストになる場合、集計(勝敗数)には一切加算しない
    // (公式記録に合わせる。ケージ内の実際の結果=resultはhistoryにそのまま残す)。
    const missedBy = lookupWeighInMiss(o.fighterId, o.date, o.opponent);
    const isNc =
      (missedBy === "opponent" && o.result === "loss") || (missedBy === "self" && o.result === "win");
    if (isNc) continue;

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
