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
  /** kanaMissingのうち、公式ローマ字表記は取得できている人数(選手一覧のローマ字表記行)。
   *  読み欄が「かな」「ローマ字のみ」「値なし」の3状態のうち、ローマ字のみの人数。 */
  kanaMissingButHasRomaji: number;
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

/**
 * 「戦績数」表示の単一の正。/kick/fighters(一覧、KickIndexEntry.boutCount)と
 * /kick/fighters/[slug](詳細、KickFighter.bouts.length)は、どちらもbuild-kick-data.tsの
 * 同じ`bouts`配列から一度だけ計算された値を参照する(build-kick-data.ts側で
 * `boutCount: bouts.length`をindexへ、同じ配列をdetail.boutsへ書き出している)。
 * ページ側がそれぞれの生フィールドに直接触れると、将来どちらか一方だけを書き換えて
 * 静かに乖離する恐れがあるため、両ページはこの関数だけを経由する
 * (scripts/check-kick-bout-count-consistency.tsがビルド時に両者の一致を独立検証する)。
 */
export function getFighterBoutCount(f: Pick<KickIndexEntry, "boutCount">): number;
export function getFighterBoutCount(f: Pick<KickFighter, "bouts">): number;
export function getFighterBoutCount(f: { boutCount: number } | { bouts: unknown[] }): number {
  return "boutCount" in f ? f.boutCount : f.bouts.length;
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
 * 決着(methodLabel()の出力)のwhitelist。**旧denylist方式は廃止した(PR #570)。**
 *
 * 旧方式(PROSE_METHOD_RAW、PR-8で確認した大会レポート散文6件の完全一致denylist)は、
 * `.normalize("NFKC")`を入力側にだけ適用しdenylistのSetリテラル側には適用していなかったため、
 * 全角/半角括弧の表記差だけで一致漏れが起きた(50人検品調査で発覚。平原陸の
 * 「酒井柚樹はトーナメント初戦（HIROKAZU）...」の行が、生データ側が半角括弧だったために
 * denylist(全角括弧で登録)に一致せず素通りしていた)。denylist方式は「新しい混入パターンが
 * 出るたびに個別追記が必要」という構造的な弱点もある。
 *
 * whitelist方式では、全32,609bout行(2026-08-17時点)の実際の出力パターンを集計し、
 * 許容する形式を正規表現で確定した(KO/TKO/判定/ドロー/不戦勝敗/ノーコンテスト等の決着語 +
 * ラウンド時間・延長・スコア内訳・括弧付き理由注記の付随パターン)。どのパターンにも
 * 一致しない出力は「不明」にする(**元のmethodRawは変更しない**。title属性で確認可能)。
 * 一致しない値が増えること自体は許容する(「不明」になるだけでデータは壊れない)。
 *
 * scripts/check-kick-method-label-whitelist.ts が、この関数の出力が実際に
 * (whitelistに一致 OR 既知のプレースホルダ)のいずれかであることをビルド時に再検証する
 * (将来この関数からwhitelist判定が誤って外れる回帰を防ぐ多重防御)。
 */
// 2026-08-21: 週次自動更新ジョブの実走検証で、分:秒の秒側が1桁の実データ(例:「1’8”TKO」
// =1分8秒)を発見。従来は秒側\d{2}固定(2桁)だったため一致しなかった。1〜2桁を許容する。
// あわせて「2分59″」のように、分は漢字・秒はプライム記号(″、"秒"の字を伴わない)で書く
// 表記(HoostCup公式で確認)を新しい候補として追加。
const TIME_RE = String.raw`(?:\d{1,2}[:’'′]\d{2}(?:[”"′]{1,2})?|\d{1,2}分\d{1,2}秒|\d{1,2}分\d{1,2}[”"′]{1,2}|\d{1,2}分|\d{1,3}秒|\d{1,2}['’′]\d{1,2}["”′]{0,2})`;
const SEP_RE = String.raw`[-－ー、,/・:：‐−]`; // 全角マイナス(U+2212)含む
const NUM_RE = String.raw`\d{1,3}(?:[.,]\d{1,2})?`;
const SCORE_PAIR_RE = String.raw`${NUM_RE}\s*${SEP_RE}\s*${NUM_RE}`;
const JUDGE_NAME_RE = String.raw`[^\s()（）:：]{1,10}`;
const ONE_SCORE_RE = String.raw`(?:${JUDGE_NAME_RE}\s*[:：]\s*)?\(?${SCORE_PAIR_RE}\)?`;
const SCORE_LIST_RE = String.raw`(?:${ONE_SCORE_RE})(?:\s*[、,\/・]?\s*(?:${ONE_SCORE_RE}))*`;
const PAREN_SCORES_RE = String.raw`[\(（【]\s*(?:三者とも\s*)?${SCORE_LIST_RE}\s*[\)）】]`;
const REASON_RE = String.raw`[\(（【][^()（）【】]{0,60}[\)）】]`;
// 括弧を伴わない決着理由の付記(「TKO 2分51秒 レフェリーストップ」等)は、任意の自由文を
// 許すとプロース混入を検知できなくなるため、実データで確認できた語のみの閉じた候補集合にする。
// 2026-08-21追加: 週次自動更新ジョブの実走検証で新たに取得対象に入った選手(RISE roster統一)
// のbout群で確認できた、決着理由として明確な技名(実データで確認できた語のみ、閉じた候補集合の
// 方針を維持): 右ハイキック・右ストレート・バックチョーク・腕ひしぎ十字固め。
const BARE_REASON_RE = [
  "レフェリーストップ", "ドクターストップ", "セコンドタオル投入", "タオル投入",
  "額のカット", "出血", "棄権", "スリーノックダウン", "10カウント", "3ノックダウン",
  "左膝蹴", "右膝蹴", "右ハイキック", "右ストレート", "バックチョーク", "腕ひしぎ十字固め",
].join("|");
// 2026-08-21追加: 「一本」(組技系ルールを含む団体、例KROSS×OVERの一部bout)を決着語に追加。
const METHOD_WORD_RE = [
  "KO", "TKO", "ノックアウト", "判定", "ユナニマス判定", "マジョリティ判定", "テクニカル判定",
  "スプリット判定", "判定ドロー", "判定負け", "判定勝ち", "反則負け", "反則勝ち", "反則失格", "反則",
  "ドロー", "引分", "引き分け", "不戦勝", "不戦敗", "ノーコンテスト", "NC", "無効試合", "無効",
  "負傷判定", "時間切れ", "棄権", "失格", "運用ルール外", "一本",
].join("|");
// 前置き: 「1:50 KO」のような単純な経過時間つきKO/TKO、「2分 終了 判定」「延長R終了 判定」
// 「2分 延長R終了 判定」「再延長R 1:15 KO」のような(再)延長R・終了を伴う表記、
// 「勝者:江幡 KO」のような勝者名の前置き、「本戦判定」「1回 判定」のような本戦/回数表記、
// 「終了後 TKO」を、いずれも独立に省略可能な組み合わせで許可する。
const WINNER_PREFIX_RE = String.raw`(?:勝者\s*[:：]?\s*[^\s()（）]{1,10}\s+)?`;
// 2026-08-21追加: 「左ミドルによるKO」「左ハイキックによるKO」のように、技名が決着語の前に
// 「による」で連結される表記(HoostCup公式で確認)。技名自体は自由文だが、直後に「による」が
// 続く場合のみに限定しているためプロース混入の余地は小さい。
const TECHNIQUE_PREFIX_RE = String.raw`(?:[^\s()（）]{1,10}による\s*)?`;
const END_MARKER_RE =
  WINNER_PREFIX_RE +
  String.raw`(?:${TIME_RE}\s*)?` +
  String.raw`(?:(?:再?延長R\s*)?終了(?:後)?\s*)?` +
  String.raw`(?:再?延長R\s*)?` +
  String.raw`(?:本戦\s*)?` +
  String.raw`(?:\d\s*回\s*)?` +
  String.raw`(?:ドロー\s*)?` +
  TECHNIQUE_PREFIX_RE;
// [end-marker] METHOD_WORD [勝ち/負け/勝利] (score/paren-scores/reason/bare-reason/time、任意順で反復)
// [ドロー] [延長R終了 判定 反復]
const METHOD_LABEL_WHITELIST_RE = new RegExp(
  String.raw`^${END_MARKER_RE}` +
  String.raw`(?:${METHOD_WORD_RE})` +
  String.raw`(?:\s*(?:勝ち|負け|勝利))?` +
  String.raw`(?:\s*(?:${SCORE_PAIR_RE}|${PAREN_SCORES_RE}|${REASON_RE}|${BARE_REASON_RE}|${TIME_RE}))*` +
  String.raw`(?:\s*ドロー)?` +
  String.raw`(?:\s*(?:再?延長R終了)(?:\s*判定)?(?:\s*(?:${SCORE_PAIR_RE}|${PAREN_SCORES_RE}))?)*` +
  String.raw`\s*$`,
);
/** 決着欄の内容によらず常に許可するプレースホルダ(データそのものが「未定/なし」を表す値)。 */
const METHOD_LABEL_PLACEHOLDERS = new Set(["—", "不明", "試合前", "勝敗無し", "なし"]);

export function isMethodLabelWhitelisted(label: string): boolean {
  return METHOD_LABEL_PLACEHOLDERS.has(label) || METHOD_LABEL_WHITELIST_RE.test(label);
}

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
  let s = raw ?? "";
  // 2026-08-21追加: アキュート(´ U+00B4)・ダイアレシス(¨ U+00A8)・二重アキュート
  // (˝ U+02DD)は.normalize("NFKC")で「スペース+結合文字」に分解されてしまい
  // (例:"2´29¨"→"2 ́29 ̈")、後段の正規表現が数字との隣接を前提にしているため
  // 一致できなくなる。NFKC実行前に、意味の近い標準的なプライム(′)・ダブルプライム(″)へ
  // あらかじめ寄せておく。
  s = s.replace(/´/g, "′").replace(/[¨˝]/g, "″");
  s = s.normalize("NFKC").trim();
  if (!s) return "—";
  // 「※3R 1'24" TKO ※左フックにてダウン×2」のように、決着そのものが※で始まる行がある
  // (PR #570で発見、実測79行)。旧実装は`s.replace(/※.*$/, "")`で「最初の※以降を
  // すべて除去」しており、これだと先頭の※で決着情報そのものが丸ごと消えてしまっていた
  // (「※MMA」のように末尾の注記だけを想定した実装だったため)。先頭の※記号だけを
  // まず取り除き、2つ目以降(=本来の末尾注記)からを従来通り除去する。
  s = s.replace(/^※\s*/, "");
  s = s.replace(/※.*$/, "");                 // ※MMA / ※OFGマッチ / ※左フックにて...(末尾注記)
  // 「勝者:江幡 KO 2:36」「勝者 春樹 2:03 TKO」のように、決着原文が勝者名を前置きする
  // 出典(HoostCup公式等)がある。勝者が誰かは対戦相手欄・勝敗欄の組み合わせで既に判別できる
  // ため、決着欄では冗長(PR #575、50人検品2周目#572で発見、実測14行)。
  // whitelist(WINNER_PREFIX_RE)では許容パターンとして受理しつつ、表示上は取り除く。
  s = s.replace(/^勝者\s*[:：]?\s*[^\s()（）]{1,10}\s+/, "");
  // 【1R】/ (3R) のように丸ごと括弧で囲われたラウンド表記は、括弧ごと除去する
  // (中身のR表記だけを消すと空の括弧【 】( )が残ってしまうため)。
  s = s.replace(/[【(（]\s*(?:延長\s*)?\d+\s*R(?:終了時)?\s*[】)）]/g, " ");
  // 2026-08-21追加: 「3R(1分35秒) 左ハイキックによるKO」のように、経過時間だけを括弧で
  // 囲う表記(HoostCup公式で確認)。括弧の中身が時間表記そのものだけの場合は、括弧だけを
  // 外して裸の時間表記にする(中身の時間情報自体は決着表示として有効なため、上のラウンド
  // 括弧除去とは違って残す)。
  // 対象はTIME_RE全体ではなく「N分M秒」(漢字)の組だけに限定する: TIME_RE には
  // コロン区切りの「N:MM」形式も含まれるが、これは「(48:50)(47:50)(48:50)」のような
  // 審判別判定スコアの1組と表記上区別がつかない(decisionScorePerspective.tsが並べ替え時に
  // 頼っている括弧という区切り情報を誤って剥がしてしまい、正しく並べ替えできなくなる
  // 回帰を実測)。「N分M秒」は判定スコア表記に現れない語のため安全に区別できる。
  s = s.replace(/[（(](\d{1,2}分\d{1,2}秒)[）)]/g, "$1");
  // 「2分3R終了」のように、1ラウンドの時間(2分)がラウンド数(3R)に直接連結している場合、
  // ラウンド数だけ除去すると時間の数字(「2分」)だけが取り残されて残存ノイズになる
  // (PR #570、shimada-shouta/tanimoto-hiroyuki等520行で発見)。ラウンド表記の直前にある
  // 「N分」はラウンドの持ち時間の注記であり決着情報ではないため、ラウンド表記と一緒に除去する。
  s = s.replace(/\d+分(?=\d+\s*R(?:終了時)?)/g, "");
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
  const result = s || "—";
  if (result === "—") return result;
  return isMethodLabelWhitelisted(result) ? result : "不明";
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
