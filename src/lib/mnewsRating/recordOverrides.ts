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
    // 2026-07-29(PR #257で発見): 冨澤大智(tomizawa-daichi)のWikipedia戦績表が
    // RIZIN DECADE 雷神番外地(2024-12-31)第4試合の対戦相手名を「火の鳥」と
    // 誤記録していた。RIZIN公式(rizinRecords.json、2026-07-28取得)では同日
    // 同大会の冨澤大智の相手は「三浦孝太」(1R1:53 KO・スタンドでの膝打撃)で
    // あり、ラウンド・タイム・決着方法(KO)がWikipedia側の記載と完全一致して
    // いるため同一試合の相手名誤記と特定できる。この誤った相手名がfighters.ts
    // 上のhinotori(nameJa:「火の鳥」)の登録名と偶然完全一致したため、名前解決
    // 経由でhinotori本人の対戦明細に一切現れないファントムの敗戦としてElo集計に
    // 混入し、RIZINランキング(フライ級)の表示戦績が2-0のはずの選手を2-1と
    // 誤表示させていた。
    //
    // 【2026-07-28夜間バッチ(6c233fb)で自然解消】このoverride作成の準備中に
    // 定期スクレイプが走り、Wikipedia側の当該行自体が「三浦孝太」へ既に
    // 自己修正されていることを確認した(上流の編集合戦・訂正待ちだったと推定)。
    // rankings.jsonも同バッチで2-0に正しく更新済みのため、このoverride自体は
    // 現時点でno-op(remove対象の「火の鳥」エントリが既に存在しない→removeは
    // 何もしない、addは既存の「三浦孝太」エントリと重複するため追加されない)。
    // 実害が無いため削除はせず、Wikipedia側が将来この行を再度「火の鳥」等の
    // 誤記へ差し戻した場合の回帰防止の保険として残す(rizinRecordsOverride.ts側の
    // PatrickyケースやNC全DB監査と同じ方針)。
    type: "remove",
    fighterId: "tomizawa-daichi",
    date: "2024-12-31",
    opponent: "火の鳥",
    source: "https://jp.rizinff.com/_ct/17741870",
    fetchedDate: "2026-07-28",
    note:
      "RIZIN DECADE 雷神番外地(2024-12-31)第4試合の対戦相手名の誤記(火の鳥→三浦孝太)を訂正するための" +
      "remove(この後のadd型で正しい相手名のエントリを追加する)。2026-07-28夜間バッチでWikipedia側が" +
      "自己修正済みのため現状はno-op(将来の差し戻しに備えた回帰防止用)。",
  },
  {
    type: "add",
    fighterId: "tomizawa-daichi",
    date: "2024-12-31",
    opponent: "三浦孝太",
    result: "win",
    method: "1R 1:53 KO（左膝蹴り）",
    event: "RIZIN DECADE",
    round: "R1",
    totalsAlreadyReflected: true,
    source: "https://jp.rizinff.com/_ct/17741870",
    fetchedDate: "2026-07-28",
    note:
      "上記removeで除去した誤記載エントリ(相手名「火の鳥」)を、正しい相手名「三浦孝太」で再追加する。" +
      "totalsAlreadyReflected: true(元のWikipedia infobox集計値は相手名を問わずこの試合の勝ちを" +
      "既に含んでいるため、集計値への追加加算はしない=相手名の訂正のみ)。2026-07-28夜間バッチで" +
      "Wikipedia側に同一エントリが既に存在するためこちらもno-op(将来の差し戻しに備えた回帰防止用)。",
  },
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
    type: "patch-date",
    fighterId: "naoki",
    date: "2025-07-28",
    opponent: "芦田崇宏",
    correctedDate: "2025-07-27",
    source: "https://jp.rizinff.com/_ct/17780689",
    fetchedDate: "2026-07-19",
    note:
      "直樹(naoki)のWikipedia戦績表が超RIZIN.4 真夏の喧嘩祭りの芦田崇宏戦を2025-07-28表記していたが、" +
      "RIZIN公式(rizinRecords.json)では開催日2025-07-27(同イベントを記録する他26名は全員2025-07-27で" +
      "一致、直樹のみ1日ずれた外れ値)。日付ズレによりrizinRecords.jsonとのマッチングが成立せず" +
      "(1) 権威データによるweightClass補完(68.0kg契約)が効かず階級null検査(check-rizin-weightclass-null.ts)" +
      "でfatal検出、(2) 前座(オープニングファイト)判定が効かず誤って資格カウント対象外になり、" +
      "2025年以降の資格カウント対象試合が1戦のみとなって標準資格を満たさずフェザー級ランキング非掲載に" +
      "なっていた(2026-07-19発覚)。",
  },
  {
    type: "patch-date",
    fighterId: "inoue-seiya",
    date: "2026-06-01",
    opponent: "赤田功輝",
    correctedDate: "2026-06-06",
    source: "https://jp.rizinff.com/_ct/17843850",
    fetchedDate: "2026-07-19",
    note:
      "井上聖矢のWikipedia戦績表がRIZIN LANDMARK 14の赤田功輝戦を2026-06-01表記していたが、" +
      "RIZIN公式(rizinRecords.json)では開催日2026-06-06(同イベントを記録する他11名は全員2026-06-06で" +
      "一致、井上聖矢のみ5日ずれた外れ値)。日付ズレによりrizinRecords.jsonとのマッチングが成立せず、" +
      "権威データによるweightClass補完が効かず階級null検査(check-rizin-weightclass-null.ts)でfatal検出" +
      "(2026-07-19発覚)。",
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
  // 2026-07-19: NC全DB監査(部分完了・106/242人)で発見した8候補。全件、
  // Wikipedia infoboxの"no contests"公式値とパーサ検出件数が完全一致する
  // 件数照合ゲートを通過済み(ドロップ0件)。対戦相手がFIGHTERSに登録済みの
  // 場合は相手側にも同一試合をmirrorする。
  {
    type: "add",
    fighterId: "akazawa-yukinori",
    date: "2017-10-22",
    opponent: "中村勇太",
    result: "nc",
    method: "無効試合（体重超過）",
    event: "PANCRASE札幌大会2017",
    round: "—",
    source: "https://ja.wikipedia.org/wiki/赤沢幸典",
    fetchedDate: "2026-07-19",
    note: "赤沢幸典×中村勇太(PANCRASE札幌大会2017、2017-10-22)。体重超過による無効試合。",
  },
  {
    type: "add",
    fighterId: "ayaka-miura",
    date: "2017-05-28",
    opponent: "タイアニー・ソウザ",
    result: "nc",
    method: "1R 3:25 袈裟固（三浦の計量失格による無効試合）",
    event: "PANCRASE 287",
    round: "R1",
    source: "https://ja.wikipedia.org/wiki/三浦彩佳",
    fetchedDate: "2026-07-19",
    note: "三浦彩佳×タイアニー・ソウザ(PANCRASE 287、2017-05-28)。三浦の計量失格による無効試合。",
  },
  {
    type: "add",
    fighterId: "hamada-takumi",
    date: "2025-07-27",
    opponent: "大塚智貴",
    result: "nc",
    method: "3R 2:25 ノーコンテスト（偶発的なバッティング）",
    event: "PANCRASE 355 【フライ級キング・オブ・パンクラス王者決定戦】",
    round: "R3",
    source: "https://ja.wikipedia.org/wiki/濱田巧",
    fetchedDate: "2026-07-19",
    note: "濱田巧×大塚智貴(PANCRASE 355・フライ級キング・オブ・パンクラス王者決定戦、2025-07-27)。偶発的なバッティングによるノーコンテスト。",
  },
  {
    type: "add",
    fighterId: "otsuka-tomoki",
    date: "2025-07-27",
    opponent: "濱田巧",
    result: "nc",
    method: "3R 2:25 ノーコンテスト（偶発的なバッティング）",
    event: "PANCRASE 355 【フライ級キング・オブ・パンクラス王者決定戦】",
    round: "R3",
    source: "https://ja.wikipedia.org/wiki/濱田巧",
    fetchedDate: "2026-07-19",
    note: "上記濱田巧側と同一試合(相手視点)。",
  },
  {
    type: "add",
    fighterId: "kitakata-daichi",
    date: "2015-10-04",
    opponent: "リトル",
    result: "nc",
    method: "3R 1:26 無効試合（体重超過）",
    event: "PANCRASE 270",
    round: "R3",
    source: "https://ja.wikipedia.org/wiki/北方大地",
    fetchedDate: "2026-07-19",
    note: "北方大地×リトル(PANCRASE 270、2015-10-04)。体重超過による無効試合。",
  },
  {
    type: "add",
    fighterId: "little",
    date: "2015-10-04",
    opponent: "北方大地",
    result: "nc",
    method: "3R 1:26 無効試合（体重超過）",
    event: "PANCRASE 270",
    round: "R3",
    source: "https://ja.wikipedia.org/wiki/北方大地",
    fetchedDate: "2026-07-19",
    note: "上記北方大地側と同一試合(相手視点)。リトルはhidden選手だがデータ整合性のため反映。",
  },
  {
    type: "add",
    fighterId: "kitakata-daichi",
    date: "2015-07-05",
    opponent: "ハイミソン･ブルーノ",
    result: "nc",
    method: "1R 0:49 無効試合（ローブロー）",
    event: "PANCRASE 268",
    round: "R1",
    source: "https://ja.wikipedia.org/wiki/北方大地",
    fetchedDate: "2026-07-19",
    note: "北方大地×ハイミソン・ブルーノ(PANCRASE 268、2015-07-05)。ローブローによる無効試合。相手はFIGHTERS未登録のためmirrorなし。",
  },
  {
    type: "add",
    fighterId: "kim-soochul",
    date: "2024-12-29",
    opponent: "ヤン・ジヨン",
    result: "nc",
    method: "1R 1:02 ノーコンテスト（バッティング）",
    event: "ROAD FC 071 【ROAD FC 63kgトーナメント 決勝】",
    round: "R1",
    source: "https://ja.wikipedia.org/wiki/キム・スーチョル",
    fetchedDate: "2026-07-19",
    note: "キム・スーチョル×ヤン・ジヨン(ROAD FC 071・63kgトーナメント決勝、2024-12-29)。バッティングによるノーコンテスト。",
  },
  {
    type: "add",
    fighterId: "yang-jiyong",
    date: "2024-12-29",
    opponent: "キム・スーチョル",
    result: "nc",
    method: "1R 1:02 ノーコンテスト（バッティング）",
    event: "ROAD FC 071 【63kgトーナメント決勝】",
    round: "R1",
    source: "https://ja.wikipedia.org/wiki/ヤン・ジヨン",
    fetchedDate: "2026-07-19",
    note: "上記キム・スーチョル側と同一試合(相手視点)。",
  },
  {
    type: "add",
    fighterId: "shibisai-shoma",
    date: "2015-09-19",
    opponent: "森川修次",
    result: "nc",
    method: "1R 1:02 無効試合（ローブロー）",
    event: "GRACHAN 19",
    round: "R1",
    source: "https://ja.wikipedia.org/wiki/シビサイ頌真",
    fetchedDate: "2026-07-19",
    note: "シビサイ頌真×森川修次(GRACHAN 19、2015-09-19)。ローブローによる無効試合。相手はFIGHTERS未登録のためmirrorなし。",
  },
  // 2026-08-02(指示書R-5→C型悉皆調査の確定12件+arai-jo追加分・計13件):
  // data/fighterRecords.json(Wikipedia由来「1行目」)の大会名・日付を、
  // data/deepRecords.json・data/shootoRecords.json(DEEP/修斗公式アーカイブの
  // スクレイプ結果)と対戦相手名でクロス突合して裏取りした誤記訂正。
  // 「DEEP 101 IMPACT」6件はいずれも大会名は正しいが日付がWikipedia側で
  // 2021-06-20(実際は同日に別の大会=DEEP JEWELS 33が開催されていた)に
  // ズレていた。DEEP公式サイト(deep2001.com)の当該大会ページで対戦相手・
  // ラウンド・決着方法が一致することを確認済み。
  {
    type: "patch-date",
    fighterId: "hiroya",
    date: "2021-06-20",
    opponent: "関原翔",
    correctedDate: "2021-05-05",
    source: "https://www.deep2001.com/deep-101-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 101 IMPACT」大会ページで確認: 開催日は2021-05-05。" +
      "data/deepRecords.jsonの当該大会にヒロヤ vs 関原翔(勝者:関原翔)のboutが実在し、" +
      "決着方法もWikipedia戦績表の記載と一致するため同一試合と特定できる。" +
      "Wikipedia側の日付だけが2021-06-20(同日開催の別大会DEEP JEWELS 33の日付)に" +
      "誤って引っ張られていた。大会名(DEEP 101 IMPACT)自体は誤りなし。",
  },
  {
    type: "patch-date",
    fighterId: "ito-yuki",
    date: "2021-06-20",
    opponent: "安谷屋智弘",
    correctedDate: "2021-05-05",
    source: "https://www.deep2001.com/deep-101-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 101 IMPACT」大会ページで確認: 開催日は2021-05-05。" +
      "data/deepRecords.jsonの当該大会に安谷屋智弘 vs 伊藤裕樹(勝者:伊藤裕樹、" +
      "2R リアネイキッドチョーク)のboutが実在し、Wikipedia戦績表の決着方法と一致。" +
      "上記ヒロヤと同じ大会・同じ日付誤りパターン。",
  },
  {
    type: "patch-date",
    fighterId: "sekihara-sho",
    date: "2021-06-20",
    opponent: "ヒロヤ",
    correctedDate: "2021-05-05",
    source: "https://www.deep2001.com/deep-101-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 101 IMPACT」大会ページで確認: 開催日は2021-05-05。" +
      "data/deepRecords.jsonの当該大会にヒロヤ vs 関原翔(勝者:関原翔)のboutが実在。" +
      "上記ヒロヤ側と同一試合(相手視点)・同じ日付誤りパターン。",
  },
  {
    type: "patch-date",
    fighterId: "nishitani-taisei",
    date: "2021-06-20",
    opponent: "山本歩夢",
    correctedDate: "2021-05-05",
    source: "https://www.deep2001.com/deep-101-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 101 IMPACT」大会ページで確認: 開催日は2021-05-05。" +
      "data/deepRecords.jsonの当該大会に西谷大成 vs 山本歩夢(勝者:山本歩夢)のbout" +
      "が実在。上記と同じ大会・同じ日付誤りパターン。",
  },
  {
    type: "patch-date",
    fighterId: "ishizuka-koichi",
    date: "2021-06-20",
    opponent: "CORO",
    correctedDate: "2021-05-05",
    source: "https://www.deep2001.com/deep-101-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 101 IMPACT」大会ページで確認: 開催日は2021-05-05。" +
      "data/deepRecords.jsonの当該大会に石司晃一 vs CORO(勝者:石司晃一)のboutが" +
      "実在。上記と同じ大会・同じ日付誤りパターン。",
  },
  {
    type: "patch-date",
    fighterId: "coro",
    date: "2021-06-20",
    opponent: "石司晃一",
    correctedDate: "2021-05-05",
    source: "https://www.deep2001.com/deep-101-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 101 IMPACT」大会ページで確認: 開催日は2021-05-05。" +
      "上記石司晃一側と同一試合(相手視点)・同じ日付誤りパターン。",
  },
  {
    // DEEP 93 IMPACTも同種の日付ズレ(1週間)。パク・シウとの対戦は
    // data/deepRecords.json上で2019-12-15開催の同大会に実在(決着方法・
    // ラウンドがWikipedia戦績表と一致)。
    type: "patch-date",
    fighterId: "aono-hikaru",
    date: "2019-12-22",
    opponent: "パク・シウ",
    correctedDate: "2019-12-15",
    source: "https://www.deep2001.com/deep-93-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 93 IMPACT」大会ページで確認: 開催日は2019-12-15" +
      "(Wikipedia戦績表は2019-12-22と1週間誤記)。data/deepRecords.jsonの当該大会に" +
      "青野ひかる vs パク・シウ(TKO、1R)のboutが実在し決着方法が一致。大会名自体は誤りなし。",
  },
  {
    // DEEP 131 IMPACTも日付ズレ(20日)。data/deepRecords.jsonの正式イベント名は
    // 「DEEP 131 IMPACT 25th Anniversary」だが、Wikipedia側の「DEEP 131 IMPACT」
    // は略称としてそのまま扱う(大会名自体の誤りではなく周年サブタイトルの省略のみ)。
    type: "patch-date",
    fighterId: "miyabi-shunsuke",
    date: "2026-05-24",
    opponent: "瀧澤謙太",
    correctedDate: "2026-05-04",
    source: "https://www.deep2001.com/deep-131-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 131 IMPACT 25th Anniversary」大会ページで確認: 開催日は" +
      "2026-05-04(Wikipedia戦績表は2026-05-24と誤記)。data/deepRecords.jsonの当該大会に" +
      "瀧澤謙太 vs 雅駿介(勝者:瀧澤謙太、3R TKO)のboutが実在し決着方法が一致。",
  },
  {
    // DEEP JEWELS 31も日付ズレ(約3ヶ月)。大会名自体は正しく、開催日のみ誤り。
    type: "patch-date",
    fighterId: "oshima-saori",
    date: "2020-09-20",
    opponent: "パク・シウ",
    correctedDate: "2020-12-19",
    source: "https://www.deep2001.com/deep-jewels-31/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP JEWELS 31」大会ページで確認: 開催日は2020-12-19" +
      "(Wikipedia戦績表は2020-09-20と誤記)。data/deepRecords.jsonの当該大会" +
      "メインイベントに大島沙緒里 vs パク・シウ(勝者:パク・シウ、判定0-3、" +
      "28-28/28-28/27-28)のboutが実在し、決着方法(5分3R終了 判定0-3)が" +
      "Wikipedia戦績表の記載と完全一致。",
  },
  // DEEP 119/120・DEEP 109/110は日付は正しいが大会番号の誤記(いずれも同日開催の
  // 実在大会と番号が1違いだった)。
  {
    type: "patch-method",
    fighterId: "kinoshita-karate",
    date: "2024-07-14",
    opponent: "神田コウヤ",
    correctedMethod: "5分3R終了 判定2-1",
    correctedRound: "R3",
    correctedEvent: "DEEP 120 IMPACT",
    source: "https://www.deep2001.com/deep-120-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 120 IMPACT」(2024-07-14開催)で確認: data/deepRecords.json" +
      "の当該大会に神田コウヤ vs 木下カラテ(勝者:木下カラテ、判定)のboutが実在。" +
      "Wikipedia戦績表は同日開催の「DEEP 119 IMPACT」(実際は2024-07-14には非開催)と" +
      "誤記していた。method/roundはWikipedia側の記載を維持(変更なし、event名のみ訂正)。",
  },
  {
    type: "patch-method",
    fighterId: "coro",
    date: "2024-07-14",
    opponent: "瀧澤謙太",
    correctedMethod: "5分3R終了 判定0-3",
    correctedRound: "R3",
    correctedEvent: "DEEP 120 IMPACT",
    source: "https://www.deep2001.com/deep-120-impact/",
    fetchedDate: "2026-08-02",
    note:
      "上記木下カラテと同一大会・同カード(相手視点)。DEEP公式サイトの「DEEP 120 IMPACT」" +
      "(2024-07-14開催)にCORO vs 瀧澤謙太(勝者:瀧澤謙太、判定)のboutが実在。" +
      "Wikipedia戦績表は「DEEP 119 IMPACT」と誤記していた。method/roundは変更なし。",
  },
  {
    type: "patch-method",
    fighterId: "enju-kenta",
    date: "2022-08-21",
    opponent: "岩見凌",
    correctedMethod: "1R 0:58 リアネイキッドチョーク",
    correctedRound: "R1",
    correctedEvent: "DEEP 109 IMPACT",
    source: "https://www.deep2001.com/deep-109-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 109 IMPACT」(2022-08-21開催)で確認: data/deepRecords.json" +
      "の当該大会にKENTA(猿寿健太) vs 岩見凌(勝者:KENTA、1R0分58秒リアネイキッド" +
      "チョーク)のboutが実在し、Wikipedia戦績表の決着方法と完全一致。Wikipedia側は" +
      "「DEEP110 IMPACT」(実際は2022-08-21には非開催)と誤記していた。" +
      "method/roundは変更なし、event名のみ訂正。",
  },
  {
    // 修斗は公式サイト(shooto-mma.com)の選手プロフィールページから該当試合の
    // /result/?id=NNN(公式大会結果ページ)を直接特定できたため、DEEP勢と異なり
    // 対戦相手名でのクロス突合ではなく公式ページの正式大会名をそのまま採用する。
    type: "patch-method",
    fighterId: "arai-jo",
    date: "2021-06-26",
    opponent: "飯野タテオ",
    correctedMethod: "1R 0:59 KO（パンチ）",
    correctedRound: "R1",
    correctedEvent: "SHOOTO GIG TOKYO Vol.30 Supported by ONEchampionship",
    source: "https://www.shooto-mma.com/result/?id=118",
    fetchedDate: "2026-08-02",
    note:
      "修斗公式サイトの新井丈プロフィールページ(shooto-mma.com/fighters/?id=49)から" +
      "2021-06-26の対戦相手名リンク先(result/?id=118)を特定し、正式大会名" +
      "「プロフェッショナル修斗公式戦 SHOOTO GIG TOKYO Vol.30 Supported by " +
      "ONEchampionship」を確認。data/shootoRecords.jsonの当該大会に飯野タテオ vs " +
      "新井丈(勝者:新井丈、1R KO)のboutが実在し決着方法が一致。Wikipedia戦績表は" +
      "「プロフェッショナル修斗2021 Vol.6」(該当日には非開催)と誤記していた。" +
      "method/roundは変更なし、event名のみ訂正。",
  },
  // 2026-08-02(指示書「C型288件の規模測定」→b)日付誤り群の修正): C型残件の
  // うち団体データ(deepRecords.json)の通し番号(DEEP NN IMPACT)一致で日付誤りの
  // 疑いが機械的に検出できた候補を、DEEP公式サイト(deep2001.com)の該当大会
  // ページで個別のbout単位(対戦相手・決着方法)まで確認できたものだけ訂正する。
  // 同じDEEP 86 IMPACTグループの神龍誠(vs中山ハルキ)・酒井リョウ(vs水口清吾)は
  // 初回調査時点では公式ページに完全一致するboutが確認できず未解決のまま残して
  // いたが、指示書②(2026-08-03)の再調査でDEEP公式サイトの表記が対戦相手の
  // 登録名(神龍誠→高橋誠、水口清吾→誠吾)と異なっていたことが原因と判明し、
  // 両者とも同一試合と特定できたため下記で訂正する。event自体が実在することと、
  // claimされた個々のboutが実在することは別の確認が必要という#353の基準は
  // そのまま踏襲した。
  {
    type: "patch-date",
    fighterId: "motoya-yuki",
    date: "2018-10-27",
    opponent: "釜谷真",
    correctedDate: "2022-10-27",
    source: "https://www.deep2001.com/deep-86-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 86 IMPACT」大会ページで確認: 開催日は2022-10-27" +
      "(Wikipedia戦績表は2018-10-27と年が4年誤記)。DEEPバンタム級王座決定戦、" +
      "元谷友貴 vs 釜谷真(元谷友貴が勝利、TKO 3R4:43リアネイキッドチョーク)が" +
      "実在し、決着方法がWikipedia戦績表の記載と完全一致するため同一試合と特定できる。" +
      "大会名(DEEP 86 IMPACT)自体は誤りなし。",
  },
  {
    type: "patch-date",
    fighterId: "takeda-koji",
    date: "2018-10-27",
    opponent: "北岡悟",
    correctedDate: "2022-10-27",
    source: "https://www.deep2001.com/deep-86-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 86 IMPACT」大会ページで確認: 開催日は2022-10-27" +
      "(Wikipedia戦績表は2018-10-27と年が4年誤記)。DEEPライト級タイトルマッチ、" +
      "武田光司 vs 北岡悟(武田光司が勝利、判定0-5)が実在し、決着方法が" +
      "Wikipedia戦績表の記載と完全一致。上記と同じ大会・同じ日付誤りパターン。",
  },
  {
    type: "patch-date",
    fighterId: "kitaoka-satoru",
    date: "2018-10-27",
    opponent: "武田光司",
    correctedDate: "2022-10-27",
    source: "https://www.deep2001.com/deep-86-impact/",
    fetchedDate: "2026-08-02",
    note:
      "上記武田光司側と同一試合(相手視点)・同じ大会・同じ日付誤りパターン。" +
      "DEEP公式サイトの「DEEP 86 IMPACT」大会ページで確認: 開催日は2022-10-27。",
  },
  {
    // 2026-08-03(指示書②): DEEP公式サイトの「DEEP 86 IMPACT」大会ページで、
    // 神龍誠(fighters.ts上のnameEn: "Makoto Takahashi")の本名表記「高橋誠」で
    // 該当boutを確認できた。第10試合フライ級、〇高橋誠(フリー) vs ●中山ハルキ
    // (K-Clann)、判定3-0で高橋誠が勝利。Wikipedia戦績表の記載(判定3-0)と一致。
    type: "patch-date",
    fighterId: "shinryu-makoto",
    date: "2018-10-27",
    opponent: "中山ハルキ",
    correctedDate: "2022-10-27",
    source: "https://www.deep2001.com/deep-86-impact/",
    fetchedDate: "2026-08-03",
    note:
      "DEEP公式サイトの「DEEP 86 IMPACT」大会ページで確認: 開催日は2022-10-27" +
      "(Wikipedia戦績表は2018-10-27と年が4年誤記)。神龍誠は本名の「高橋誠」" +
      "(fighters.ts nameEn: Makoto Takahashi)名義で掲載されており、初回調査時は" +
      "対戦相手名(神龍誠)での単純突合では一致が確認できなかった。第10試合" +
      "フライ級5分2R、高橋誠 vs 中山ハルキ、判定3-0で高橋誠が勝利。決着方法が" +
      "Wikipedia戦績表の記載(5分3R終了 判定3-0)と一致するため同一試合と特定できる" +
      "(スケジュールラウンド数の表記2R/3Rの差はWikipedia側の慣用的な丸めとみられ" +
      "対象外)。大会名(DEEP 86 IMPACT)自体は誤りなし。同グループの他3件(元谷友貴・" +
      "武田光司・北岡悟)と同じ日付誤りパターン。",
  },
  {
    // 2026-08-03(指示書②): 上記と同一大会・別カード。酒井リョウの対戦相手
    // 「水口清吾」もDEEP公式サイトでは「誠吾」名義で掲載されていた。同一人物で
    // あることは、DEEP 65 IMPACT(2014-03-22)で「誠悟 vs 酒井リョウ」戦が
    // fighterRecords.json側の「水口清吾」戦(同日・同大会・同ラウンド・同決着
    // 時間)と完全一致することから確認できる(この2014年の一戦は日付誤りが
    // 無いため既存のfighterRecords.jsonにそのまま反映済み)。
    type: "patch-date",
    fighterId: "sakai-ryo",
    date: "2018-10-27",
    opponent: "水口清吾",
    correctedDate: "2022-10-27",
    source: "https://www.deep2001.com/deep-86-impact/",
    fetchedDate: "2026-08-03",
    note:
      "DEEP公式サイトの「DEEP 86 IMPACT」大会ページで確認: 開催日は2022-10-27" +
      "(Wikipedia戦績表は2018-10-27と年が4年誤記)。水口清吾は「誠吾」" +
      "(AACC所属)名義で掲載されており、初回調査時は対戦相手名での単純突合では" +
      "一致が確認できなかった。第13試合DEEPメガトン級タイトル挑戦者決定戦5分2R、" +
      "酒井リョウ vs 誠吾、判定0-3(誠吾-酒井リョウ順)で酒井リョウが勝利。" +
      "Wikipedia戦績表の記載(5分3R終了 判定3-0)と勝敗・スコア内容が一致するため" +
      "同一試合と特定できる。「誠吾」=「水口清吾」の同一人物確認はDEEP 65 IMPACT" +
      "(2014-03-22)の「誠悟 vs 酒井リョウ」戦が既存データの「水口清吾」戦" +
      "(同日・同大会・同ラウンド・TKO 1R2:31)と完全一致することによる。" +
      "大会名(DEEP 86 IMPACT)自体は誤りなし。同グループの他3件と同じ日付誤り" +
      "パターン。",
  },
  {
    type: "patch-date",
    fighterId: "koya-kanda",
    date: "2020-11-02",
    opponent: "鬼山斑猫",
    correctedDate: "2020-11-01",
    source: "https://www.deep2001.com/deep-99-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 99 IMPACT」大会ページで確認: 開催日は2020-11-01" +
      "(Wikipedia戦績表は2020-11-02と1日誤記)。第6試合、神田コウヤ vs 鬼山斑猫" +
      "(神田コウヤが勝利、TKO 2R1:49ドクターストップ)が実在し、決着方法が" +
      "Wikipedia戦績表の記載と完全一致。大会名(DEEP 99 IMPACT)自体は誤りなし。",
  },
  // goto-joji(後藤丈治)のDEEP 122 IMPACT(2024-12-08)は#353で「対象外・団体データ
  // 側の欠落の可能性」として未解決のまま残されていたが、今回の再調査でDEEP公式
  // サイトの大会名・日付ともに誤りだったことが判明した。DEEP 122 IMPACT自体は
  // 2024-11-04に後楽園ホールで開催されており、後藤丈治×マンド・グディエレス戦は
  // ビザの都合で出場できなかった相手選手のため2024-11-23開催の「DEEP TOKYO
  // IMPACT 2024 5th ROUND」に延期されていた(DEEP公式サイトのDEEP122 IMPACT
  // ページに延期の経緯が明記されている)。date/eventの両方を訂正するため
  // patch-date→patch-methodの2段で適用する(patch-dateで日付を訂正した後、
  // patch-methodが新しい日付をキーに大会名だけを訂正する)。
  {
    type: "patch-date",
    fighterId: "goto-joji",
    date: "2024-12-08",
    opponent: "マンド・グティエレス",
    correctedDate: "2024-11-23",
    source: "https://www.deep2001.com/deep-122-impact/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP 122 IMPACT」大会ページに記載: 「マンド・グディエレスが" +
      "VISAの関係で2024年11月4日(月)のDEEP 122 IMPACTに間に合わないため11月23日に" +
      "行われるDEEP TOKYO IMPACT 2024 5th ROUNDに延期となりました」。" +
      "Wikipedia戦績表は延期前の大会名・日付(DEEP 122 IMPACT/2024-12-08、" +
      "いずれも実際とは異なる)のまま記録されていた。",
  },
  {
    type: "patch-method",
    fighterId: "goto-joji",
    date: "2024-11-23",
    opponent: "マンド・グティエレス",
    correctedMethod: "5分3R終了 判定1-2",
    correctedRound: "R3",
    correctedEvent: "DEEP TOKYO IMPACT 2024 5th ROUND",
    source: "https://www.deep2001.com/deep-tokyo-impact-2024-5th-round/",
    fetchedDate: "2026-08-02",
    note:
      "DEEP公式サイトの「DEEP TOKYO IMPACT 2024 5th ROUND」(2024-11-23開催)ページで" +
      "確認: 「●後藤丈治(TRIBE TOKYO MMA)○マンド・グディエレス(Murcielago MMA)" +
      "判定1-2」。data/deepRecords.jsonの当該大会にも後藤丈治 vs マンド・グディエレス" +
      "(fighterASlug: goto-joji、winnerName: マンド・グディエレス、判定1-2)のboutが" +
      "実在し完全一致。method/roundはWikipedia戦績表の記載のまま変更なし、" +
      "event名のみ訂正。",
  },
  {
    // 2026-08-02(指示書R-5 A型調査): ケイト・ロータスのhistoryにDEEP OKINAWA
    // IMPACT 2022(2022-10-30)vs にっせー戦が「引き分け」として記録されているが、
    // Wikipedia本文はこの試合を明確に「エキシビション(非公式)」「判定なし」と
    // 記載しており、インフォボックスの通算成績(10勝8敗0分、data/fighterRecords.json
    // のwins/losses/drawsと一致)にも含まれていない。history側にだけプロ戦績外の
    // 試合が混入していたための集計不一致。
    //
    // 【層の違いについて】KNOWN_NON_PROFESSIONAL_BOUTS
    // (scripts/backfill-shooto-pancrase-slugs.ts)と目的は同種(プロ戦績集計外の
    // bout除外)だが、対象レイヤーが異なるため統合しない:
    // KNOWN_NON_PROFESSIONAL_BOUTSはdata/{deep,shooto,pancrase}Records.json
    // (4団体データ・2行目のソース)側で「まだslug未解決のbout」をバックフィル対象
    // から外す機構(既にslug解決済みのboutには効かない)。このremoveは
    // data/fighterRecords.json(Wikipedia由来・1行目のソース)側のhistory配列から
    // 除外する機構で、ソースファイルも適用タイミングも別。
    //
    // 【要フォローアップ・今回は対象外】このケイト・ロータス×にっせー戦は
    // data/deepRecords.json(DEEP OKINAWA IMPACT 2022)側にも既にslug解決済み
    // (fighterBSlug: "kate-lotus", resultType: "draw")で存在しており、2行目
    // (4団体合算)の集計にも同じ「引き分け」が混入している可能性が高い。
    // KNOWN_NON_PROFESSIONAL_BOUTSは未解決bout用のため、この既解決bout向けの
    // 除外は別の仕組みが要る。2行目側の除外はPR #336(4団体通算乖離45名の原因
    // 分類・調査)のスコープであり、このPRでは1行目のみ修正する。
    type: "remove",
    fighterId: "kate-lotus",
    date: "2022-10-30",
    opponent: "にっせー",
    source: "https://ja.wikipedia.org/wiki/ケイト・ロータス",
    fetchedDate: "2026-08-02",
    note:
      "Wikipedia本文がこの試合を「エキシビション(非公式)」「判定なし」と明記しており、" +
      "インフォボックスの通算成績(10勝8敗0分)にも含まれていない。プロ戦績集計外の試合が" +
      "history配列にのみ混入していたため除外する。data/deepRecords.json側(DEEP OKINAWA " +
      "IMPACT 2022、2022-10-30、resultType:draw)にも同一boutが存在するが、2行目の除外は" +
      "別スコープ(PR #336)のため今回は対象外。",
  },
  // 2026-08-03(指示書③: infobox/表本体不一致13名の一次ソース照合): 13名のうち
  // 4名で確定できた訂正。残りは一次情報未到達または現行override機構(bout単位の
  // add/remove/patch)では対応できない構造的ギャップのため未解決のまま残す
  // (詳細はPR #404 説明およびout/配下のレポート参照)。
  {
    // 中村大介: DEEP公式サイトで確認。infobox(35勝29敗1分)は既にこの一戦を
    // 反映済みだが、Wikipedia戦績表({{Fight-cont}})にだけ欠落していた
    // (鈴木博昭・suzuki-hiroakiと同型のサマリー先行更新パターン)。
    type: "add",
    fighterId: "nakamura-daisuke",
    date: "2026-05-04",
    opponent: "狩野優",
    result: "loss",
    method: "5分3R終了 判定0-3",
    event: "DEEP 131 IMPACT 25th Anniversary",
    round: "R3",
    totalsAlreadyReflected: true,
    source: "https://www.deep2001.com/deep-131-impact/",
    fetchedDate: "2026-08-03",
    note:
      "DEEP公式サイトの「DEEP 131 IMPACT 25th Anniversary」(2026-05-04・横浜BUNTAI)大会" +
      "ページで確認: 第7試合DEEPフェザー級、●中村大介(夕月堂本舗)○狩野優(TRIBE TOKYO " +
      "MMA)、判定0-3。data/deepRecords.jsonの当該大会にも同一boutが実在し完全一致。" +
      "Wikipedia戦績表にはこの一戦だけ記載が丸ごと欠落していたが、インフォボックスの" +
      "通算成績(35-29-1)は既にこの敗戦を反映済みのためtotalsAlreadyReflected:trueとする。",
  },
  {
    // ストラッサー起一: 改名前の本名「国本起一」名義でPANCRASE公式サイトを検索し
    // 発見した2006年の2試合。Wikipedia戦績表には改名(2007年)以降の「ストラッサー
    // 起一」名義の試合しか収録されておらず、本名時代の試合が欠落していた。
    type: "add",
    fighterId: "strasser-kiichi",
    date: "2006-03-19",
    opponent: "鳥生将大",
    result: "loss",
    method: "1R 0:05 KO（ハイキック）",
    event: "PANCRASE 2006 BLOW TOUR",
    round: "R1",
    totalsAlreadyReflected: true,
    source: "https://www.pancrase.co.jp/data/result/2006/0319.html",
    fetchedDate: "2026-08-03",
    note:
      "PANCRASE公式サイトの試合結果ページで確認(本名「国本起一」名義、P's LAB大阪 vs " +
      "コブラ会対抗戦・大将戦)。Wikipedia戦績表は改名(2007年9月30日の試合よりリング" +
      "ネームを「ストラッサー起一」に変更、と本文に明記)以前の本名時代の試合を収録して" +
      "おらず欠落していた。インフォボックスの通算成績(21-13-2)は既にこの敗戦を反映済み" +
      "のためtotalsAlreadyReflected:trueとする。",
  },
  {
    type: "add",
    fighterId: "strasser-kiichi",
    date: "2006-10-01",
    opponent: "青山晃剛",
    result: "win",
    method: "2R 2:58 ギブアップ（肩固め）",
    event: "PANCRASE 2006 BLOW TOUR",
    round: "R2",
    totalsAlreadyReflected: true,
    source: "https://www.pancrase.co.jp/data/result/2006/1001.html",
    fetchedDate: "2026-08-03",
    note:
      "上記と同一大会シリーズ(本名「国本起一」名義)。PANCRASE公式サイトの試合結果ページで" +
      "確認。インフォボックスの通算成績(21-13-2)は既にこの勝利を反映済みのため" +
      "totalsAlreadyReflected:trueとする。",
  },
  {
    // 黒部和沙: Wikipedia本文の日付表記タイポ(「2024年4月7月」=「日」を「月」と誤記)
    // により、parseJaDate()が日付を抽出できず該当行が丸ごと欠落していた
    // (parseJaFightHistory()は日付未取得の行を無音でスキップする仕様のため)。
    type: "add",
    fighterId: "kurobe-kazusa",
    date: "2024-04-07",
    opponent: "澤田龍人",
    result: "win",
    method: "1R 3:38 ネックストレッチ",
    event: "SHOOTO GIG TOKYO Vol.36",
    round: "R1",
    totalsAlreadyReflected: true,
    source: "https://www.shooto-mma.com/result/?id=181",
    fetchedDate: "2026-08-03",
    note:
      "修斗公式サイトの試合結果ページ(メインイベント・第9試合、ストロー級)で確認: " +
      "○黒部和沙(TRIBE TOKYO MMA) vs ×澤田龍人(AACC×剛毅會)、1R3:38ネックストレッチ。" +
      "data/shootoRecords.jsonの当該大会にも同一boutが実在し完全一致。Wikipedia戦績表側の" +
      "日付表記が「2024年4月7月」という単純なタイポ(本来「日」の箇所)になっており、" +
      "mnewsの日付パーサ(parseJaDate())が日付を抽出できずこの1行を丸ごと欠落させていた。" +
      "インフォボックスの通算成績(6-1-1)は既にこの勝利を反映済みのため" +
      "totalsAlreadyReflected:trueとする。",
  },
  {
    // パトリッキー・ピットブル: Wikipedia記事の「== 戦績 ==」節はMMA戦績表とは別に
    // 「=== グラップリング ===」という独立節を持つが、mnewsのextractMmaSection()が
    // この記事の見出し(「総合格闘技」という文言を含まない)にマッチせず記事全文を
    // フォールバック対象にしてしまい、グラップリング節の1行がMMA historyに混入した。
    // ケイト・ロータスの「エキシビション混入」除外(本ファイル上部)と同型のバグ。
    type: "remove",
    fighterId: "patricky-pitbull",
    date: "2025-05-31",
    opponent: "アルマン・ツァルキヤン",
    source: "https://ja.wikipedia.org/wiki/パトリッキー・ピットブル",
    fetchedDate: "2026-08-03",
    note:
      "Wikipedia記事本文の「=== グラップリング ===」節(サブミッションのみのADXC 10、" +
      "2025年5月31日、5Rリアネイキドチョークで敗戦)がMMA戦績表({{MMA recordbox}}: " +
      "25勝16敗0分、計41戦)とは別枠の記録であるにもかかわらず、mnews側のパーサが" +
      "MMA節・グラップリング節を区別できず両方から{{Fight-cont}}行を拾ってしまい、" +
      "historyに紛れ込んでいた(indexの見出しが「総合格闘技」という文言を含まないため" +
      "extractMmaSection()のフォールバックが記事全文を対象にしたことが根本原因)。" +
      "インフォボックス(25-16-0)と、記事本文のMMA戦績表本体(グラップリング節を除く41行、" +
      "同じく25-16-0)は元々一致しており、除外対象はグラップリングの1行のみ。",
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
