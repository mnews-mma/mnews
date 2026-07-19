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
  // Wikipediaの試合結果テーブル(Fight-cont)にはこの一戦だけ抜け落ちていた。
  // YA-MANも当初(2026-07-12)はinfobox自体がこの一戦を含まない値(2-2)
  // だったためtotalsAlreadyReflected無しで作成したが、その後Wikipedia側の
  // infobox数値だけが3-2に追いついた(結果テーブルの行は追加されないまま)。
  // 「+1固定加算」型のオーバーライドは、作成時点では正しくても上流(Wikipedia)
  // が後追いでinfoboxだけ更新すると静かに二重加算へ転じる、という設計上の
  // 弱点がある(2026-07-16時点で鈴木博昭・YA-MANの2例で実際に発生)。
  // 【設計メモ】3例目が出た場合は、この「+1固定加算」方式自体を見直し、
  // (差分ではなく)絶対値を直接指定する方式への変更を検討すること。
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

// 既存のbout(date+opponentで特定)のdateのみを訂正する。opponent/result/method/
// eventは一切変更しない。Wikipedia側で対戦カード双方の日付表記が1日ずれている
// (例: 本人ページは試合翌日表記、相手ページは当日表記)ケースを、RIZIN公式の
// 開催日に合わせて訂正する。この種のズレはbuildBouts(engine.ts)のDB内対決
// 重複排除がdate完全一致キーのため、放置すると同一試合が両者の視点で二重に
// カウントされる(片方は本人の誤日付のまま試合が「別試合」として残る)。
export interface RecordOverridePatchDate extends RecordOverrideBase {
  type: "patch-date";
  correctedDate: string;
}

// 既存のbout(date+opponentで特定)のresult/method/roundを訂正する。上流
// (Wikipedia戦績表)が勝敗を取り違えて記録していたケース向け。この訂正が
// 1件でも存在する選手は、通算戦績(wins/losses/draws/ko/sub/decision)も
// Wikipedia infobox値をそのまま据え置かず、訂正後のhistory全体から
// re-derive する(applyRecordOverridesToTotals参照。通常は「絶対にhistory
// から都度カウントしない」方針だが、勝敗そのものが誤っていた場合はinfobox側の
// 集計値も連動して誤っている可能性が高く、個別訂正のdelta調整では追いつけない
// ため、この訂正が存在する選手に限り例外的にhistoryを正とする)。
export interface RecordOverridePatchResult extends RecordOverrideBase {
  type: "patch-result";
  correctedResult: "win" | "loss" | "draw" | "nc";
  correctedMethod: string;
  correctedRound?: string;
}

// 既存のbout(date+opponentで特定)のmethod/round/eventの表記のみを補完する。
// resultは一切変更しない(勝敗の取り違え訂正ではなく、決着の詳細情報が
// Wikipedia戦績表に欠落・不正確だった場合の表記補完専用)。patch-resultとは
// 異なりapplyRecordOverridesToTotalsのhasPatchResult判定対象に含めない
// ため、この訂正だけでは集計値のhistoryからの再導出は発生しない
// (patch-weight-class/patch-dateと同じ「安全な」表記補完カテゴリ)。
export interface RecordOverridePatchMethod extends RecordOverrideBase {
  type: "patch-method";
  correctedMethod: string;
  correctedRound?: string;
  correctedEvent?: string;
}

export type RecordOverride =
  | RecordOverrideAdd
  | RecordOverrideRemove
  | RecordOverridePatchWeightClass
  | RecordOverridePatchDate
  | RecordOverridePatchResult
  | RecordOverridePatchMethod;

export const RECORD_OVERRIDES: RecordOverride[] = [
  {
    // 2026-07-19: wikipedia.tsのNCパーサ修正(ダッシュ系マーカー+methodにNC系
    // キーワードがある場合のみNC採用)を機に、大原樹理(PANCRASE、2017-08-20 vs
    // 横山恭典)が新たにNC行として復活。当初はWikipedia自身の集計との件数
    // 不一致・PANCRASE公式凡例(ダッシュ=「その他」の汎用区分)を理由に一時
    // 除外していたが、パンクラス公式サイトの個別戦績ページで実在・裁定を
    // 直接確認できたため保留解除する。
    // 出典: パンクラス公式(大原樹理プロフィールページ・横山恭典プロフィール
    // ページの双方に同一記載): 2017.08.20 ディファ有明、3x3R:2R2:45、
    // 「ノーコンテスト」、「PANCRASE対DEEP、５VS.５対抗戦　次鋒戦」。
    // round/timeの表記はWikipedia戦績表の記載(2R 2:45 無効試合（ローブロー）)と
    // 完全一致しており、追加のpatch-methodは不要。
    type: "patch-method",
    fighterId: "ohara-juri",
    date: "2017-08-20",
    opponent: "横山恭典",
    correctedMethod: "2R 2:45 無効試合（ローブロー）",
    correctedRound: "R2",
    source: "https://www.pancrase.co.jp/data/prfl2/yokoyama.html",
    fetchedDate: "2026-07-19",
    note:
      "パンクラス公式サイト(大原樹理・横山恭典両プロフィールページ)で実在・裁定を確認済み。" +
      "2017.08.20ディファ有明、PANCRASE対DEEP 5VS5対抗戦・次鋒戦、2R2:45ノーコンテスト" +
      "(ローブローにより続行不能)。Wikipedia戦績表の記載と内容が完全一致するためmethod/round自体は" +
      "変更なし(出典を明記する記録として残す)。",
  },
  {
    // 2026-07-19: 同日中のWikipedia再取得で新たに検出された3件目のNC候補
    // (大原樹理 vs 倉本大悟、DEEP 130 IMPACT 2026-03-20)。DEEP公式サイトの
    // 試合結果記事で実在・裁定を確認できたため保留解除する。
    // Wikipedia戦績表はround/timeが欠落("ノーコンテスト（偶発的なローブロー）"
    // のみ、round"—")、かつイベント名が「暫定タイトルマッチ」表記だったため
    // (実際は大原が王者としての通常防衛戦で暫定ではない)、DEEP公式の表記で補完する。
    type: "patch-method",
    fighterId: "ohara-juri",
    date: "2026-03-20",
    opponent: "倉本大悟",
    correctedMethod: "1R 1:29 ノーコンテスト（大原選手ローブローにより試合続行不可能）",
    correctedRound: "R1",
    correctedEvent: "DEEP 130 IMPACT 【DEEPライト級タイトルマッチ】",
    source:
      "https://www.deep2001.com/deep-130-impact-2026%e5%b9%b43%e6%9c%8820%e6%97%a5%ef%bc%88%e9%87%91%ef%bc%89%e5%be%8c%e6%a5%bd%e5%9c%92%e3%83%9b%e3%83%bc%e3%83%ab-%e8%a9%a6%e5%90%88%e7%b5%90%e6%9e%9c/",
    fetchedDate: "2026-07-19",
    note:
      "DEEP公式サイトの試合結果記事(2026年3月20日後楽園ホール)で実在・裁定を確認済み: " +
      "メインイベント第10試合DEEPライト級タイトルマッチ、王者大原樹理 vs 挑戦者倉本大悟、" +
      "1R1分29秒ノーコンテスト(大原選手ローブローにより試合続行不可能)。Wikipedia戦績表は" +
      "round/timeが欠落・イベント名が「暫定タイトルマッチ」と誤っていたため公式表記で補正。",
  },
  {
    // 上記と同一試合の倉本大悟側(相手視点)。倉本大悟もFIGHTERSに登録されている
    // ため、双方のhistoryにmethod/round/eventの補正を反映する。
    type: "patch-method",
    fighterId: "kuramoto-daigo",
    date: "2026-03-20",
    opponent: "大原樹理",
    correctedMethod: "1R 1:29 ノーコンテスト（大原選手ローブローにより試合続行不可能）",
    correctedRound: "R1",
    correctedEvent: "DEEP 130 IMPACT 【DEEPライト級タイトルマッチ】",
    source:
      "https://www.deep2001.com/deep-130-impact-2026%e5%b9%b43%e6%9c%8820%e6%97%a5%ef%bc%88%e9%87%91%ef%bc%89%e5%be%8c%e6%a5%bd%e5%9c%92%e3%83%9b%e3%83%bc%e3%83%ab-%e8%a9%a6%e5%90%88%e7%b5%90%e6%9e%9c/",
    fetchedDate: "2026-07-19",
    note: "上記大原樹理側と同一試合(相手視点)。DEEP公式試合結果記事の表記でmethod/round/eventを補正。",
  },
  {
    // 2026-07-19: RIZIN.43(2023-06-24)クレベル・コイケ×鈴木千裕戦。
    // Wikipedia戦績表はround/timeが欠落していたため、RIZIN公式個別試合結果
    // ページの表記(1R2分59秒、クレベルの体重超過によるイエローカード提示)で補完。
    type: "patch-method",
    fighterId: "koike-kleber",
    date: "2023-06-24",
    opponent: "鈴木千裕",
    correctedMethod: "1R 2:59 ノーコンテスト（クレベルの体重超過・イエローカード提示）",
    correctedRound: "R1",
    source: "https://jp.rizinff.com/_ct/17637535",
    fetchedDate: "2026-07-19",
    note: "RIZIN公式個別試合結果ページの表記でround/timeを補完。",
  },
  {
    type: "patch-method",
    fighterId: "suzuki-chihiro",
    date: "2023-06-24",
    opponent: "クレベル・コイケ",
    correctedMethod: "1R 2:59 ノーコンテスト（クレベルの体重超過・イエローカード提示）",
    correctedRound: "R1",
    source: "https://jp.rizinff.com/_ct/17637535",
    fetchedDate: "2026-07-19",
    note: "上記クレベル・コイケ側と同一試合(相手視点)。RIZIN公式個別試合結果ページの表記でround/timeを補完。",
  },
  {
    // 2026-07-19: RIZIN師走の超強者祭り(2025-12-31)カルシャガ・ダウトベック×
    // 久保優太戦。Wikipedia戦績表はround/timeが欠落していたため、RIZIN公式
    // 個別試合結果ページの表記(1R3分15秒、久保の指がダウトベックの目に入り
    // 続行不可能)で補完。
    type: "patch-method",
    fighterId: "karshyga-dautbek",
    date: "2025-12-31",
    opponent: "久保優太",
    correctedMethod: "1R 3:15 ノーコンテスト（偶発的なアイポーク）",
    correctedRound: "R1",
    source: "https://jp.rizinff.com/_ct/17813415",
    fetchedDate: "2026-07-19",
    note: "RIZIN公式個別試合結果ページの表記でround/timeを補完。",
  },
  {
    type: "patch-method",
    fighterId: "kubo-yuta",
    date: "2025-12-31",
    opponent: "カルシャガ・ダウトベック",
    correctedMethod: "1R 3:15 ノーコンテスト（偶発的なアイポーク）",
    correctedRound: "R1",
    source: "https://jp.rizinff.com/_ct/17813415",
    fetchedDate: "2026-07-19",
    note: "上記カルシャガ・ダウトベック側と同一試合(相手視点)。RIZIN公式個別試合結果ページの表記でround/timeを補完。",
  },
  {
    // 2026-07-19: RIZIN WORLD SERIES in KOREA(2025-05-31)大原樹理×ジョニー・
    // ケース戦(このPRの発端となった欠落バグ本体)。Wikipedia戦績表はround/timeが
    // 欠落していたため、RIZIN公式個別試合結果ページの表記(1R2分22秒)で補完。
    type: "patch-method",
    fighterId: "ohara-juri",
    date: "2025-05-31",
    opponent: "ジョニー・ケース",
    correctedMethod: "1R 2:22 ノーコンテスト（ケースの体重超過）",
    correctedRound: "R1",
    source: "https://jp.rizinff.com/_ct/17769399",
    fetchedDate: "2026-07-19",
    note: "RIZIN公式個別試合結果ページの表記でround/timeを補完。",
  },
  {
    type: "patch-method",
    fighterId: "case-johnny",
    date: "2025-05-31",
    opponent: "大原樹理",
    correctedMethod: "1R 2:22 ノーコンテスト（ケースの体重超過）",
    correctedRound: "R1",
    source: "https://jp.rizinff.com/_ct/17769399",
    fetchedDate: "2026-07-19",
    note: "上記大原樹理側と同一試合(相手視点)。RIZIN公式個別試合結果ページの表記でround/timeを補完。",
  },
  {
    type: "add",
    fighterId: "ya-man",
    date: "2023-05-06",
    opponent: "三浦孝太",
    result: "win",
    method: "1R 3:13 KO（膝とパンチ）",
    event: "RIZIN.42",
    round: "R1",
    // 2026-07-16緊急修正: Wikipedia infobox側の通算(wins)は現時点で既にこの
    // 一戦を反映済み(3-2)であることが判明(生fetch値で確認: raw wins=3だが
    // raw history行にはこの一戦が無い=行だけ欠落・集計は既に正しい状態に
    // 変わっていた)。totalsAlreadyReflectedが無いままだったため、history
    // への行追加に加えて集計値にも+1してしまい、表示が4-2-0(誤)になっていた
    // (Kaina発見・正は3-2-0)。鈴木博昭(suzuki-hiroaki)の前例と同じ原因。
    totalsAlreadyReflected: true,
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
  {
    type: "patch-date",
    fighterId: "karamov-vugar",
    date: "2023-04-02",
    opponent: "堀江圭功",
    correctedDate: "2023-04-01",
    source: "https://jp.rizinff.com/_ct/17552126",
    fetchedDate: "2026-07-13",
    note:
      "ヴガール・ケラモフのWikipedia戦績表がRIZIN.41の堀江圭功戦を2023-04-02表記していたが、" +
      "RIZIN公式(rizinRecords.json)では開催日2023-04-01(堀江圭功側の自己記録も2023-04-01で一致)。" +
      "本人視点だけ1日ずれていたためbuildBoutsのDB内対決重複排除(date完全一致キー)が効かず、" +
      "同一試合が二重カウントされ、フェザー級ランキングの表示戦績が9-4(正しくは7-4)になっていた。",
  },
  {
    type: "patch-date",
    fighterId: "karamov-vugar",
    date: "2023-07-31",
    opponent: "朝倉未来",
    correctedDate: "2023-07-30",
    source: "https://jp.rizinff.com/_ct/17552126",
    fetchedDate: "2026-07-13",
    note:
      "ヴガール・ケラモフのWikipedia戦績表が超RIZIN.2の朝倉未来戦を2023-07-31表記していたが、" +
      "RIZIN公式(rizinRecords.json)では開催日2023-07-30(朝倉未来側の自己記録も2023-07-30で一致)。" +
      "上記堀江圭功戦と同種の二重カウント原因。",
  },
  {
    type: "patch-result",
    fighterId: "takagi-ryo",
    date: "2023-10-01",
    opponent: "ビクター・コレスニック",
    correctedResult: "loss",
    correctedMethod: "5分3R終了 判定0-3",
    correctedRound: "R3",
    source: "https://jp.rizinff.com/_ct/17658615",
    fetchedDate: "2026-07-14",
    note:
      "Wikipedia戦績表がRIZIN LANDMARK 6(2023-10-01)のコレスニック戦を「高木の勝ち・2R3:35TKO」と" +
      "誤記録していたが、RIZIN公式試合結果ページでは「コレスニック勝利・3R判定(3-0)」" +
      "(rizinRecords.jsonのwinnerSlug=kolesnik-viktorとも一致)。check-fighter-records-integrity.tsが" +
      "決着内訳合計(ko9+sub2+decision3=14)がwins(13)を超過するfatalとして検出(2026-07-14)。",
  },
  {
    type: "patch-result",
    fighterId: "takagi-ryo",
    date: "2022-12-25",
    opponent: "新居すぐる",
    correctedResult: "loss",
    correctedMethod: "1R 1:14 アームロック",
    correctedRound: "R1",
    source: "https://www.pancrase.co.jp/data/result/2022/1225.html",
    fetchedDate: "2026-07-14",
    note:
      "Wikipedia戦績表がPANCRASE 330(2022-12-25)第4試合の新居すぐる戦を「高木の勝ち」と" +
      "誤記録していたが、パンクラス公式結果ページでは「新居すぐる勝利・1R1:14 TO/アームロック」。" +
      "上記コレスニック戦と合わせ2件の勝敗誤りが、決着内訳合計がwinsを超過するfatalの原因だった。",
  },
  {
    // 2026-07-19: NC全DB監査(fix/nc-missing-from-record-table後継)で発見。
    // 和田竜光のWikipedia戦績表には{{Fight-cont}}行としてこの一戦が既に
    // 存在し、厳格化済みパーサ(ダッシュ+method欄の明示語)でも正しくNC判定
    // されるが、当日はWikipedia APIレート制限中でupdate-fighter-records.ts
    // --slug再実行が行えなかったため、直前に取得済みだった生パース結果を
    // 出典としてこのオーバーライドで反映する(resultはnc=勝敗数に非算入のため
    // totalsAlreadyReflectedの区別は不要)。
    type: "add",
    fighterId: "tatsumitsu-wada",
    date: "2009-08-05",
    opponent: "RYOTA",
    result: "nc",
    method: "2R 偶発的なローブローによりRYOTA選手続行不能のためノーコンテスト",
    event: "キングダムエルガイツ 10周年記念興行",
    round: "R2",
    source: "https://ja.wikipedia.org/wiki/和田竜光",
    fetchedDate: "2026-07-19",
    note:
      "和田竜光×RYOTA(キングダムエルガイツ10周年記念興行、2009-08-05)。2R、和田の偶発的な" +
      "ローブローによりRYOTAが続行不能となりノーコンテスト。Wikipedia戦績表(Fight-cont)の記載を" +
      "そのまま反映。",
  },
  {
    // 2026-07-19: 同監査で発見。決着は単純な「偶発的な反則によるNC」ではなく、
    // 肘・首への偶発的な反則で続行不可能となった末の裁定がNC(最終的には
    // 没収試合扱い)で、DREAM.2で再戦が組まれた経緯がある。丸めた「クリーンな
    // NC」表記にせず、この経緯をmethodに明記する。
    type: "add",
    fighterId: "shinya-aoki",
    date: "2008-03-15",
    opponent: "J.Z.カルバン",
    result: "nc",
    method: "1R 3:46 偶発的な反則(肘・首)により続行不能、ノーコンテスト(没収試合扱い)",
    event: "DREAM.1 ライト級グランプリ2008 開幕戦 【ライト級グランプリ 1回戦】",
    round: "R1",
    source: "https://ja.wikipedia.org/wiki/青木真也",
    fetchedDate: "2026-07-19",
    note:
      "青木真也×J.Z.カルバン(DREAM.1 ライト級グランプリ2008開幕戦・1回戦、2008-03-15)。" +
      "1R3分46秒、偶発的な反則(肘・首)によりカルバンが続行不能となった末の裁定がノーコンテスト" +
      "(最終的には没収試合の扱い)。この一戦を受けてDREAM.2で再戦が組まれている。決着の経緯を" +
      "「偶発反則によるクリーンなNC」に丸めず、没収試合の裁定であることを明記して記録する。",
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

export interface OpeningFightOverride {
  fighterId: string;
  date: string; // fighterRecords.json(history)側の表記日付。RIZIN公式ページの
  // 開催日表記と1日ずれることがあるため、突合キーはhistory側の値に合わせる。
  opponent: string;
  source: string;
  fetchedDate: string;
  note: string;
}

// rizinRecords.json由来のisOpeningFight判定(カード最下位=前座)は「そのイベント
// 内で最もカード順位が低い1試合のみ」を機械的に検出する。「喧嘩三番勝負」の
// ような、メインカードとは別に3試合ぶんの前座ミニシリーズが組まれるケースは
// 自動検出の対象外(最下位の1試合しか拾えない)ため、実質的に前座である試合を
// ここに個別列挙し、資格カウント・ランカー勝ち特例の判定から除外する。
// 「喧嘩三番勝負」は超RIZIN.4(2025-07-27開催)の一度きりの使用のため汎用の
// カテゴリ判定は作らず、該当試合を固定指定する。
export const OPENING_FIGHT_OVERRIDES: OpeningFightOverride[] = [
  {
    fighterId: "naoki",
    date: "2025-07-28",
    opponent: "芦田崇宏",
    source: "https://jp.rizinff.com/_ct/17780689",
    fetchedDate: "2026-07-13",
    note:
      "超RIZIN.4「真夏の喧嘩祭り」(RIZIN公式開催日2025-07-27)の「喧嘩三番勝負 第3試合」。" +
      "RIZIN WORLD GP 2025トーナメント本戦とは別枠で組まれた前座ミニシリーズの1試合であり、" +
      "実態はオープニングファイト。この名称の興行はこの一度きりで以後使われていないため、" +
      "汎用のカテゴリ判定は作らず該当試合を個別に指定する。",
  },
];

export function isOpeningFightOverride(fighterId: string, date: string, opponent: string): boolean {
  return OPENING_FIGHT_OVERRIDES.some((o) => o.fighterId === fighterId && o.date === date && o.opponent === opponent);
}

// history配列にオーバーライドを適用する。add/removeとも冪等(同じ入力に何度
// 適用しても結果は同じ)。
export function applyRecordOverrides(fighterId: string, history: FightRecord[]): FightRecord[] {
  let result = history;
  let added = false;
  for (const o of RECORD_OVERRIDES) {
    if (o.fighterId !== fighterId) continue;
    if (o.type === "remove") {
      result = result.filter((h) => !(h.date === o.date && h.opponent === o.opponent));
    } else if (o.type === "patch-weight-class") {
      result = result.map((h) => (h.date === o.date && h.opponent === o.opponent ? { ...h, weightClass: o.weightClass } : h));
    } else if (o.type === "patch-date") {
      result = result.map((h) => (h.date === o.date && h.opponent === o.opponent ? { ...h, date: o.correctedDate } : h));
    } else if (o.type === "patch-result") {
      result = result.map((h) =>
        h.date === o.date && h.opponent === o.opponent
          ? { ...h, result: o.correctedResult, method: o.correctedMethod, round: o.correctedRound ?? h.round }
          : h
      );
    } else if (o.type === "patch-method") {
      result = result.map((h) =>
        h.date === o.date && h.opponent === o.opponent
          ? {
              ...h,
              method: o.correctedMethod,
              round: o.correctedRound ?? h.round,
              event: o.correctedEvent ?? h.event,
            }
          : h
      );
    } else if (!result.some((h) => h.date === o.date && h.opponent === o.opponent)) {
      result = [
        ...result,
        { date: o.date, opponent: o.opponent, result: o.result, method: o.method, event: o.event, round: o.round ?? "—" },
      ];
      added = true;
    }
  }
  // add型は末尾に追加するだけなので、日付の新しい順(既存historyの並びと同じ
  // 基準)へ再ソートする(2026-07-13緊急修正: 鈴木博昭の平本蓮戦(2022年)が
  // 末尾=最古の奥田啓介戦2021年より後ろに表示され、日付順が崩れていたバグの
  // 修正。add以外(remove/patch-weight-class)は既存の並びを変えないので
  // 再ソート不要)。
  return added ? [...result].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) : result;
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
// patch-result(勝敗そのものの誤り訂正)が1件でも存在する選手は、Wikipedia
// infobox値を信頼する上記方針の例外として、訂正後のhistory全体から通算戦績を
// re-deriveする。infobox側の集計値自体が(勝敗を取り違えた記録から作られたため)
// 誤っている可能性が高く、個別boutのdelta調整では追いつけないため
// (2026-07-14、高木凌: Wikipediaが2試合の勝敗を取り違えて記録しており、
// 決着内訳合計がwinsを超過するfatalをcheck-fighter-records-integrity.tsが検出)。
function deriveTotalsFromHistory(history: FightRecord[]): RecordTotals {
  const t: RecordTotals = { wins: 0, losses: 0, draws: 0, ko: 0, sub: 0, decision: 0 };
  for (const h of history) {
    if (h.result === "win") {
      t.wins++;
      if (/判定/.test(h.method)) t.decision++;
      else if (/KO/i.test(h.method)) t.ko++;
      else t.sub++;
    } else if (h.result === "loss") {
      t.losses++;
    } else if (h.result === "draw") {
      t.draws++;
    }
  }
  return t;
}

export function applyRecordOverridesToTotals(fighterId: string, rawHistory: FightRecord[], totals: RecordTotals): RecordTotals {
  const hasPatchResult = RECORD_OVERRIDES.some((o) => o.fighterId === fighterId && o.type === "patch-result");
  if (hasPatchResult) {
    return deriveTotalsFromHistory(applyRecordOverrides(fighterId, rawHistory));
  }
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
