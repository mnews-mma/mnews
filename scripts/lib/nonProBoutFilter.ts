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
// DEEP等の他団体データに同じ基準を適用する場合、bout側に headingText/strapTitle/
// noteRaw/namedDivision 相当のフィールドがあれば isExcludedBout() をそのまま
// 流用できる。フィールド名が異なる場合は toHaystack() 相当の変換だけ差し替えること。

export type NonProBoutCategory =
  | "non_mma_karate" // 空手道連盟(CKC)主催トーナメント(成人・小学生とも。MMAではない別競技)
  | "non_mma_kids_shooto" // キッズ・ジュニア修斗(子供の組技試合)
  | "non_mma_submission_only" // 寝試合(提出限定ルール。通常のMMAルールと異なる)
  | "not_pro_amateur" // 明確な「アマチュア」表記(IMMAF/JMMAF含む)
  | "not_pro_tryout"; // トライアウト(トライアウトルール/トライアウトマッチ)

// 判定順は無関係(複数カテゴリに同時該当してもいずれか1つ返せば除外対象と分かる)。
// ただし呼び出し側でカテゴリ別集計をする場合は先勝ちになる点に注意。
const CATEGORY_KEYWORDS: Record<NonProBoutCategory, string[]> = {
  non_mma_karate: ["新空手", "CKC"],
  non_mma_kids_shooto: ["キッズ", "ジュニア"],
  non_mma_submission_only: ["寝試合"],
  not_pro_amateur: ["アマ", "IMMAF", "JMMAF"],
  not_pro_tryout: ["トライアウト"],
};

const CATEGORY_ORDER: NonProBoutCategory[] = [
  "non_mma_karate",
  "non_mma_kids_shooto",
  "non_mma_submission_only",
  "not_pro_amateur",
  "not_pro_tryout",
];

export interface NonProBoutFilterInput {
  headingText?: string | null;
  strapTitle?: string | null;
  noteRaw?: string | null;
  namedDivision?: string | null;
}

function toHaystack(bout: NonProBoutFilterInput): string {
  return [bout.headingText, bout.strapTitle, bout.noteRaw, bout.namedDivision]
    .filter((v): v is string => !!v)
    .join(" ");
}

// 該当した最初のカテゴリを返す(複数該当時は判定順で先勝ち)。非該当はnull。
export function classifyNonProBout(bout: NonProBoutFilterInput): NonProBoutCategory | null {
  const haystack = toHaystack(bout);
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
