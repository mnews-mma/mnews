import fs from "node:fs";
import path from "node:path";

/**
 * /kick 配下が使う読み出し口。scripts/build-kick-data.ts が生成した
 * data/kick/generated/ を読むだけで、集計は一切しない
 * (12,776boutの集計はビルド前のスクリプトで完了済み)。
 *
 * ページはすべて静的生成されるため、このfsアクセスはビルド時のみ走る。
 * リクエスト時には実行されない。
 */

const GEN = path.join(process.cwd(), "data/kick/generated");

export interface KickIndexEntry {
  slug: string;
  name: string;
  kana: string | null;
  romaji: string | null;
  kanaType: "published_kana" | "converted" | "romaji_only" | "none" | null;
  gym: string | null;
  orgs: string[];
  boutCount: number;
  bucket: string;
}

export interface KickBout {
  date: string | null;
  event: string | null;
  venue: string | null;
  promotion: string;
  opponentName: string;
  opponentAffiliation: string | null;
  /** 一意に解決できた相手のみ。ambiguous・未解決はnull(誤リンクを作らない)。 */
  opponentSlug: string | null;
  opponentAmbiguous: boolean;
  opponentCandidateCount: number;
  result: "win" | "loss" | "draw" | "no_contest" | "cancelled" | "scheduled" | "unknown";
  method: string | null;
  methodRaw: string;
  round: number | null;
  isExtension: boolean;
  ruleset: string | null;
  note: string | null;
  isDebut: boolean;
  titleType: "title_match" | "vacant_title_match" | "challenger_decision" | null;
  sourceUrl: string;
  /** Wikipedia由来の行にのみ付く。null(または未定義)は公式一次ソース由来。 */
  sourceType: "wikipedia" | null;
  alsoFrom: string[];
}

export interface KickFighter {
  slug: string;
  name: string;
  kana: string | null;
  romaji: string | null;
  yomiSource: string | null;
  kanaSource: { type: string; url: string } | null;
  aliases: string[];
  gym: string | null;
  orgs: string[];
  sources: string[];
  record: KickFighterRecord;
  bouts: KickBout[];
}

/**
 * 選手ページヘッダーの「収録N試合: X勝Y敗Z分」表示用に、ビルド時(build-kick-data.ts)で
 * 焼き込み済みの集計。scheduled・no_contest・cancelled・walkover(不戦勝/不戦敗)は
 * total(N)に含めない(walkoverを除く理由は SCHEMA.md の method=walkover の定義を参照)。
 * unknownCount は勝敗どちらにも数えず別枠。total = wins + losses + draws + unknownCount。
 */
export interface KickFighterRecord {
  wins: number;
  losses: number;
  draws: number;
  unknownCount: number;
  total: number;
}

export interface KickStats {
  fighters: number;
  fightersWithBouts: number;
  boutRows: number;
  boutRowsCompleted: number;
  boutRowsScheduled: number;
  boutRowsRaw: number;
  /** 戦績の出典内訳。boutRows = boutRowsOfficial + boutRowsWikipedia(ビルド時に恒等式を検証)。 */
  boutRowsOfficial: number;
  boutRowsWikipedia: number;
  mergedDuplicateRows: number;
  unmatchedBouts: number;
  kanaFilled: number;
  /** かな自体がnullの人数。「読みを推測で埋めていない」の文脈ではこちらを使う。 */
  kanaMissing: number;
  /** 五十音順一覧の「―」バケットに実際に並ぶ人数(kanaMissing以上、常にkanaMissing以上になる
   *  ことをビルド時に検証済み)。かなはあるが記号始まり・ラテン文字表記等で分類できない
   *  選手を含むため、kanaMissingとは別概念。一覧ページの見出しはこちらを使う。 */
  kanaUnclassified: number;
  kanaConverted: number;
  titleTypeCount: number;
  resultUnknownCount: number;
  /** 自分側では相手が同名複数人で未解決だったが、相手側ページで自分に一意解決されている
   *  ことを手がかりに逆引きで解決できた行数。scripts/build-kick-data.tsのreverseResolveOpponent参照。 */
  reverseResolvedCount: number;
  /** 表記ゆれ(ニックネーム挿入・旧名・スペース有無)を正規化して一意に解決できた行数。
   *  scripts/build-kick-data.tsのfuzzyResolveOpponent参照(PR-8)。 */
  fuzzyResolvedCount: number;
  /** MMA・エキシビジョン・アマチュア戦・ボクシングルールなど、キックボクシングの
   *  戦績として掲載すべきでないと判定してdata/kick/manualRuleExclusions.jsonの
   *  一覧と照合し除外した行数。 */
  manualExclusionCount: number;
  promotions: string[];
}

interface KickIndex {
  stats: KickStats;
  fighters: KickIndexEntry[];
  /** 選手名簿・戦績データを最後に取得し直した日時(ISO8601)。data/kick/sourceMeta.json由来。 */
  sourceUpdatedAt: string;
}

let cached: KickIndex | null = null;

export function getKickIndex(): KickIndex {
  if (!cached) cached = JSON.parse(fs.readFileSync(path.join(GEN, "index.json"), "utf8"));
  return cached!;
}

export function getKickFighter(slug: string): KickFighter | null {
  const f = path.join(GEN, "fighters", `${slug}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

/** 掲載団体(戦績の取得元)。/kick の収録範囲表示に使う。
 *  RIZIN・ONE Championship・DEEP☆KICK・NJKF・HoostCup・NKBは名簿の掲載元ではなく、
 *  名簿に載っている選手の戦績を追加で収録した戦績専用ソース
 *  (RIZINはmnews既存資産・他は各公式サイトの直接クロール)。 */
export const KICK_PROMOTIONS = [
  { label: "SHOOT BOXING", url: "https://shootboxing.org/" },
  { label: "RISE", url: "https://rise-rc.com/" },
  { label: "KNOCK OUT", url: "https://knockoutkb.com/" },
  { label: "K-1 / Krush / Krush-EX", url: "https://www.k-1.co.jp/" },
  { label: "RIZIN", url: "https://jp.rizinff.com/fighters" },
  { label: "ONE Championship", url: "https://www.onefc.com" },
  { label: "DEEP☆KICK", url: "https://www.deep-kick.com/" },
  { label: "NJKF", url: "https://www.njkf.info/" },
  { label: "HoostCup", url: "https://www.hoostcup.com/" },
  { label: "NKB", url: "https://www.nkb-r.com/" },
  { label: "Bigbang", url: "https://bigbang-kick.com/" },
  { label: "Stand up", url: "https://standup-kick.com/" },
  { label: "KROSS×OVER", url: "https://krossover.jp/" },
  { label: "新日本キックボクシング協会(SNKA)", url: "https://ameblo.jp/skb-blog/" },
  { label: "JKA", url: "https://jka-japan-kickboxing-association.jp/" },
];

/** 名簿の取得元(6ソース)。KICK_PROMOTIONSの一部(K-1/RISE/SB/KNOCK OUT) + Wikipedia男女2一覧。
 *  戦績のみのソース(RIZIN/ONE等)は名簿には掲載していないため、ここには含まれない。 */
export const KICK_ROSTER_SOURCES = [
  "ja.wikipedia「男子キックボクサー一覧」",
  "ja.wikipedia「女子キックボクサー一覧」",
  "K-1 / Krush / Krush-EX 公式",
  "RISE 公式",
  "SHOOT BOXING 公式",
  "KNOCK OUT 公式",
];

/** 戦績表の「出典」列に出す短縮名。団体名をそのまま出すと列幅に対して長く、
 *  「K-1 / Krush / Krush-EX」がスラッシュ区切りの複数リンクに見えるため。 */
export const PROMOTION_SHORT: Record<string, string> = {
  "SHOOT BOXING": "SB公式",
  RISE: "RISE公式",
  "KNOCK OUT": "KO公式",
  "K-1 / Krush / Krush-EX": "K-1公式",
  RIZIN: "RIZIN公式",
  "ONE Championship": "ONE公式",
  "DEEP☆KICK": "DEEP☆KICK公式",
  NJKF: "NJKF公式",
  HoostCup: "HoostCup公式",
  NKB: "NKB公式",
  Bigbang: "Bigbang公式",
  "Stand up": "Stand up公式",
  "KROSS×OVER": "KROSS×OVER公式",
  "新日本キックボクシング協会(SNKA)": "SNKA公式",
  JKA: "JKA公式",
};

/** 「掲載団体」欄・団体フィルタ表示用のラベル置換。build-kick-data.tsが内部的に使う
 *  団体名(bouts_wikipedia.jsonのtarget_org値)をそのまま出すと、"Wikipedia(その他団体)"が
 *  内部処理用のラベルのように見えてしまう(PR-21.5で指摘)。データ側の値(フィルタの照合キー・
 *  orgTagsBySlug等)は変更せず、表示テキストのみここで読み替える。 */
export const ORG_DISPLAY_LABEL: Record<string, string> = {
  "Wikipedia(その他団体)": "Wikipedia掲載(対象15団体・大手団体以外)",
};
export function displayOrgLabel(org: string): string {
  return ORG_DISPLAY_LABEL[org] ?? org;
}

/**
 * methodRawが決着情報ではなく大会レポート記事の一節がそのまま入ってしまっている行(6種、PR-8で確認)。
 * 「決着方法だけに揃える」という決着列の目的に合わないため、決着欄には出さず「不明」扱いにする。
 * 原文自体(methodRaw)は変更しない(title属性で確認可能なまま)。
 */
const PROSE_METHOD_RAW = new Set([
  "※荻原がウイルス性の疾患の為欠場となり、DJナックルハンマーYOKKOに変更となる。",
  "デビュー2戦目にして衝撃の秒殺KO勝ちを収めた横山が、準決勝進出に初名乗りを上げた。",
  "2R 2’35” ＴKO ※右ボディフック ※1R：森本はボディ連打によりダウンあり。",
  "1R TK02'42” 平野に1Rダウン2有。3回目でTKO",
  "互いに倒すか倒されるかの激闘スタイルで勝ち上がってきただけに判定決着なしの大激闘のタイトルマッチが予想される。",
  "酒井柚樹はトーナメント初戦（HIROKAZU）と準決勝（大久保俊）戦と連続KOで決勝戦に駒を進めた。",
]);

/**
 * 戦績表の「決着」列に出す表示用テキスト。**生データ(method_raw)は変更しない。**
 *
 * 出典サイトの原文は `3R 判定` / `3R判定` / `1R KO` / `1RKO` / `KO 1R` のように
 * 表記が揺れており、かつラウンドは専用のR列があるため重複している。
 * 表示ではラウンド・延長・ルール注記を取り除いた「決着方法だけ」に揃える
 * (ラウンドはR列、延長とルールはバッジで別に出している)。
 * 原文は title 属性で確認できるようにする。
 */
export function methodLabel(raw: string): string {
  if (PROSE_METHOD_RAW.has((raw ?? "").normalize("NFKC").trim())) return "不明";
  let s = (raw ?? "").normalize("NFKC").trim();
  if (!s) return "—";
  s = s.replace(/※.*$/, "");                 // ※MMA / ※OFGマッチ → ruleset バッジで表示済み
  // 【1R】/ (3R) のように丸ごと括弧で囲われたラウンド表記は、括弧ごと除去する
  // (中身のR表記だけを消すと空の括弧【 】( )が残ってしまうため)。
  s = s.replace(/[【(（]\s*(?:延長\s*)?\d+\s*R(?:終了時)?\s*[】)）]/g, " ");
  s = s.replace(/延長\s*R?/g, "");            // 延長 → is_extension バッジで表示済み
  s = s.replace(/\d+\s*R(?:終了時)?/g, " ");  // 3R / 1R / 3R終了時 → R列で表示済み
  s = s.replace(/\s+/g, " ").trim();
  // 「3R+延長R終了」「再延長R終了」のように、通常R+延長Rの連結表記や「再延長」は、
  // 上記のR除去だけでは「+終了」「再終了」という壊れた表示になる(延長のRに数字が
  // 付くと「延長」だけが除去されR側は数字R除去に回るため、「+」記号だけが取り残される)。
  // 「延長した」という情報自体はisExtensionバッジだけでは「再延長」を区別できないため、
  // 後処理でラベルに復元する。
  s = s.replace(/\+\s*再\s*終了/g, "再延長R終了");
  s = s.replace(/再\s*終了/g, "再延長R終了");
  s = s.replace(/\+\s*終了/g, "延長R終了");
  // 「終了」を伴わず判定・KO等が直接続く場合(「再延長R 判定」等)は、上と同じ壊れ方が
  // 「+」や孤立した「再」として現れる。直後が空白/文字列末尾のときだけ復元する
  // (「再延長」のようにまだ「延長」が続く箇所を誤って触らないため)。
  s = s.replace(/\+\s*再(?=\s|$)/g, "再延長R");
  s = s.replace(/(^|\s)再(?=\s|$)/g, "$1再延長R");
  s = s.replace(/\+(?=\s|$)/g, "延長R");
  s = s.replace(/\s+/g, " ").trim();
  return s || "—";
}

export const RESULT_LABEL: Record<KickBout["result"], string> = {
  win: "勝",
  loss: "敗",
  draw: "分",
  no_contest: "無効",
  cancelled: "中止",
  scheduled: "予定",
  unknown: "不明",
};

/** タイトル種別バッジ。nullは対象外(何も出さない)。 */
export const TITLE_TYPE_LABEL: Record<Exclude<KickBout["titleType"], null>, string> = {
  title_match: "タイトルマッチ",
  vacant_title_match: "王座決定戦",
  challenger_decision: "挑戦者決定戦",
};
