// 修斗/パンクラス公式アーカイブの悉皆スクレイピング結果(data/shootoRecords.json・
// data/pancraseRecords.json)には、成人プロMMA戦以外のbout(キッズ・アマチュア・
// 他競技の大会等)が、大会単位ではなくbout単位で本戦カードに混在している。
// out/amateur-contamination-audit.md(2026-07-30監査)で確認した以下のキーワードは
// headingText等の全ユニーク文脈を目視確認済みで、誤判定(本来のプロ成人MMA戦への
// 誤ヒット)がないことを検証してある。
//
// カテゴリ確定の経緯・根拠は上記監査ドキュメント参照。新人王決定トーナメント
// (修斗)・NEO BLOOD!(パンクラス、イベント名ベースのため対象外)はプロの登竜門
// トーナメントとして団体が公式戦績扱いしており、このフィルタでは除外しない
// (=対応するキーワードをこのファイルに含めない)。
//
// 「パンクラスゲート」(2002-2021、262bout、通常のPANCRASE本戦/大阪大会/札幌大会等の
// undercard)は除外しない。結果ページ本文にアマチュア表記が無く通常の対戦カードと
// 同一形式であり、除外する根拠が無いため(2026-07-30追加調査で確定)。
// 「PANCRASE CAGE GATE」/「CAGE GATE」/「CAGEGATE」(2013-2014のみ・Bayside FIGHT
// 1〜3限定・37bout)はパンクラス代表が公式リリースで明示的に「アマチュア専用試合」と
// 説明しており、かつ年代・大会の両面で「パンクラスゲート」とは完全に別シリーズである
// ことを確認した(大会名・出現年が一切重複しない)ため除外する。両者を同じ「ゲート」
// 系として一括で扱わないこと。
//
// 例外(1件確認済み): Bayside FIGHT.3(2014-04-20)の「CAGE GATE 第1試合 第20回
// ネオブラッド・トーナメント フライ級一回戦」は、CAGE GATE表記を含みつつも実体は
// NEO BLOOD!トーナメントの公式戦であり、含める対象(NEO BLOOD!)と除外対象
// (CAGE GATE)の両方に該当する。この場合はNEO BLOOD!を含める判断を優先する
// (=除外しない)。isNeoBloodBout()でCAGE GATE判定より先にガードする。
//
// DEEP等の他団体データに同じ基準を適用する場合、bout側に headingText/strapTitle/
// noteRaw/namedDivision 相当のフィールドがあれば isExcludedBout() をそのまま
// 流用できる。フィールド名が異なる場合は toHaystack() 相当の変換だけ差し替えること。
//
// DEEPフューチャーキングトーナメント(2026-07-31追加)は、キーワードが個別bout側
// (headingText/namedDivision、例:「▼フライ級決勝」)ではなく大会名(eventName)
// にしか現れないため、この判定器だけ例外的に eventName もオプション入力として
// 受け付ける。修斗の新人王決定トーナメント・パンクラスのNEO BLOOD!はプロの
// 登竜門として団体が公式戦績扱いしており対象外(このファイルに該当キーワードを
// 持たない)だが、DEEPフューチャーキングトーナメントはDEEP公式サイト上でアマチュア
// 大会として開催されており性質が異なるため除外する。eventNameを渡さない既存
// 呼び出し(修斗/パンクラスのfilter-nonpro-bouts.ts)はこのフィールドが
// undefinedのままなので、この追加による挙動変化は一切ない。

export type NonProBoutCategory =
  | "non_mma_karate" // 空手道連盟(CKC)主催トーナメント(成人・小学生とも。MMAではない別競技)
  | "non_mma_kids_shooto" // キッズ・ジュニア修斗(子供の組技試合)
  | "non_mma_submission_only" // 寝試合(提出限定ルール。通常のMMAルールと異なる)
  | "not_pro_amateur" // 明確な「アマチュア」表記(IMMAF/JMMAF含む)
  | "not_pro_tryout" // トライアウト(トライアウトルール/トライアウトマッチ)
  | "not_pro_cage_gate" // PANCRASE CAGE GATE/CAGE GATE/CAGEGATE(Bayside FIGHT限定、公式にアマチュア専用と明言)
  | "not_pro_futureking"; // DEEPフューチャーキングトーナメント(アマチュア大会。eventNameでのみ判定)

// 判定順は無関係(複数カテゴリに同時該当してもいずれか1つ返せば除外対象と分かる)。
// ただし呼び出し側でカテゴリ別集計をする場合は先勝ちになる点に注意。
const CATEGORY_KEYWORDS: Record<NonProBoutCategory, string[]> = {
  non_mma_karate: ["新空手", "CKC"],
  non_mma_kids_shooto: ["キッズ", "ジュニア"],
  non_mma_submission_only: ["寝試合"],
  not_pro_amateur: ["アマ", "IMMAF", "JMMAF"],
  not_pro_tryout: ["トライアウト"],
  not_pro_cage_gate: ["CAGE GATE", "CAGEGATE"],
  not_pro_futureking: ["フューチャーキング"],
};

const CATEGORY_ORDER: NonProBoutCategory[] = [
  "non_mma_karate",
  "non_mma_kids_shooto",
  "non_mma_submission_only",
  "not_pro_amateur",
  "not_pro_tryout",
  "not_pro_cage_gate",
  "not_pro_futureking",
];

export interface NonProBoutFilterInput {
  headingText?: string | null;
  strapTitle?: string | null;
  noteRaw?: string | null;
  namedDivision?: string | null;
  eventName?: string | null;
}

function toHaystack(bout: NonProBoutFilterInput): string {
  return [bout.headingText, bout.strapTitle, bout.noteRaw, bout.namedDivision, bout.eventName]
    .filter((v): v is string => !!v)
    .join(" ");
}

const NEO_BLOOD_MARKERS = ["ネオブラッド", "NEO BLOOD"];

// NEO BLOOD!トーナメントの公式戦であることを示す表記を含むか。
// CAGE GATE表記と同時に現れるケース(Bayside FIGHT.3等)があり、その場合は
// NEO BLOOD!を含める判断を優先するためのガードに使う。
function isNeoBloodBout(haystack: string): boolean {
  const upper = haystack.toUpperCase();
  return NEO_BLOOD_MARKERS.some((m) => haystack.includes(m) || upper.includes(m.toUpperCase()));
}

// 該当した最初のカテゴリを返す(複数該当時は判定順で先勝ち)。非該当はnull。
export function classifyNonProBout(bout: NonProBoutFilterInput): NonProBoutCategory | null {
  const haystack = toHaystack(bout);
  if (isNeoBloodBout(haystack)) return null;
  for (const category of CATEGORY_ORDER) {
    if (CATEGORY_KEYWORDS[category].some((kw) => haystack.includes(kw))) {
      return category;
    }
  }
  return null;
}

export function isExcludedNonProBout(bout: NonProBoutFilterInput): boolean {
  return classifyNonProBout(bout) !== null;
}
