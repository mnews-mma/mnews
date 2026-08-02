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

// ─────────────────────────────────────────────────────────────────────────
// ルール種別判定(MMA / 非MMA)。上記の「プロ/非プロ」軸とは独立した別軸の判定
// (out/non-mma-rule-contamination-audit.md、PR #369の悉皆調査参照)。
//
// 背景: RIZINは元々rizinScraper.tsのparseRuleInfo()、パンクラスはbuild-pancrase-records.ts
// のresolveRuleType()に、それぞれ独立した非MMAキーワードリストを持っていた。
// 一方をキーワード追加で直しても他方に同じ穴が残る事故(PR #367で発覚した
// 「K-1ルール」「SBルール」(シュートボクシングの略記)がRIZIN側にしか無かった等)が
// 起きたため、判定を1箇所に集約する。DEEP・修斗は元々この軸の判定自体が
// 存在しなかった(DEEPはイベントタイトル単位のisKickEvent()のみ、修斗は
// 「異種目カードを持たない」という誤った前提でルール種別フィルタ自体が無かった)。
//
// 呼び出し元によって入力テキストが異なる:
//   - RIZIN: ruleLineRaw(ルール原文。「フェザー級タイトルマッチ RIZIN MMAルール
//     ：5分 3R」等)を rizinScraper.ts の parseRuleInfo() が渡す(スクレイプ時に
//     一度だけ判定し、結果をruleTypeとしてdata/rizinRecords.jsonに保存する。
//     ruleLineRaw自体は保存されないため、既存データの再判定はできない)。
//   - パンクラス・DEEP・修斗: headingText/namedDivisionにルール原文がそのまま
//     残っているため、各*RecordsAggregate.tsのcomputeFighter*Record()が
//     bout単位で毎回そのまま判定する(スクレイプ時の値=b.ruleTypeは信用しない。
//     stale化・パターン漏れがあっても集計時に常に最新ロジックで再判定される)。
//
// 入力はheadingText/namedDivisionのみを対象にする(noteRaw・strapTitle・eventNameは
// 意図的に除外)。修斗のnoteRaw(次戦告知文)に登場する対戦相手の所属ジム名
// 「柔術&MMAアカデミーG-face」を検索対象に含めると「柔術」に誤ヒットする実例が
// 実際に発生したため(out/non-mma-rule-contamination-audit.md参照)。
export type MmaRuleType =
  | "MMA"
  | "unknown" // ルール表記自体が無い(捏造せずMMAとも非MMAとも決めつけない)
  | "キックボクシング"
  | "シュートボクシング"
  | "グラップリング"
  | "ベアナックル"
  | "スタンディングバウト"
  | "エキシビジョン"
  | "MIXルール"
  | "チャレンジルール"
  | "プロレスルール";

// 非MMAと積極的に判定できる語のパターン。RIZIN(旧rizinScraper.ts、PR #246実測の
// 44件悉皆監査+PR #250)とパンクラス(build-pancrase-records.ts)の既存パターンを
// 統合した上で、以下を追加している(PR #369):
//   - キックボクシング: ISKA(パンクラス側に無かった。PR #369でISKAオリエンタル・
//     ルールがMMAに誤分類されているのを発見)・「K-1」(K-1ルール、PR #367)・
//     「キックルール」「キック戦」(パンクラス側の表記)
//   - シュートボクシング: 「SBルール」(シュートボクシングの略記、PR #367)
//
// 各ラベルの元々の根拠(PR #246、44件悉皆監査で「正しく非MMA」と確認された
// 実際の原文表記。推測で追加した語は無い):
//   - キックボクシング: 「RIZINキックボクシグルール」(誤字表記も実在)・
//     「RIZIN Kickboxingルール」(英語表記)。「キックボクシ」で止め、末尾の
//     「ング」を必須にしない(この誤字表記を拾うため)
//   - グラップリング: 「柔術」も対象(「柔術エキシビジョンイリミネーション
//     マッチ」)
//   - ベアナックル: 「ベアナックルルール」(グローブ無しの別競技)
//   - スタンディングバウト: 「RIZINスタンディングバウト(特別)ルール」
//     (寝技無しの立ち技のみ特別ルール)
//   - エキシビジョン: 「柔術エキシビジョン」「スペシャルエキシビジョン」
//   - MIXルール: 那須川天心の異種格闘技クロスオーバー戦(那須川天心 vs
//     才賀紀左衛門)で使われる表記
//   - チャレンジルール: あい vs 川村虹花戦で使われる表記。「チャレンジ」と
//     「ルール」の間に全角/半角スペースが入る表記が実在するため空白の
//     有無を許容する
export const NON_MMA_RULE_PATTERNS: { pattern: RegExp; label: Exclude<MmaRuleType, "MMA" | "unknown"> }[] = [
  { pattern: /キックボクシ|Kickboxing|ISKA|K-?1(?!グ)|キック(ルール|戦)/i, label: "キックボクシング" },
  { pattern: /シュートボクシング|SB\s*ルール/i, label: "シュートボクシング" },
  { pattern: /グラップリング|柔術/, label: "グラップリング" },
  { pattern: /ベアナックル/, label: "ベアナックル" },
  { pattern: /スタンディングバウト/, label: "スタンディングバウト" },
  { pattern: /エキシビ|エキジビ/, label: "エキシビジョン" },
  { pattern: /MIXルール/i, label: "MIXルール" },
  { pattern: /チャレンジ\s*ルール/, label: "チャレンジルール" },
  { pattern: /プロレスルール/, label: "プロレスルール" },
];

// rizinRecordsOverride.tsが使う「確定的に非MMA」なラベル集合(既存の用途を維持)。
export const NON_MMA_RULE_TYPE_LABELS = new Set<string>(NON_MMA_RULE_PATTERNS.map((p) => p.label));

export interface RuleTypeClassifierInput {
  headingText?: string | null;
  namedDivision?: string | null;
}

export function buildRuleTypeHaystack(input: RuleTypeClassifierInput): string {
  return [input.headingText, input.namedDivision].filter((v): v is string => !!v).join(" ");
}

// ruleLineRaw(RIZIN)、またはheadingText+namedDivisionの結合文字列
// (パンクラス・DEEP・修斗)を受け取り、ルール種別を判定する。
// 「MMA」という文字列が明示されていれば常にMMA(非MMA語と同時に含む表記が
// 実在するため。例:「RIZIN MMAチャレンジルール」。RIZIN側の既存仕様を踏襲)。
export function classifyMmaRuleType(text: string): MmaRuleType {
  if (text.trim() === "") return "unknown";
  if (/MMA/i.test(text)) return "MMA";
  const hit = NON_MMA_RULE_PATTERNS.find((p) => p.pattern.test(text));
  return hit ? hit.label : "MMA";
}

export function nonMmaRuleExcludedReason(ruleType: MmaRuleType): string {
  return `ルール種別がMMA以外(${ruleType})`;
}
