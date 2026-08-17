/**
 * data/kick/*.json (選手名簿2,484人 + 戦績4団体12,776bout) を、
 * /kick 配下のページがそのまま描画できる形へ変換してビルド時に焼き込む。
 *
 * 設計方針:
 * - リクエスト時の集計をゼロにする。ページ側は生成済みJSONを読むだけにする。
 * - slugは data/kick/slugs.json に固定して保存し、以降は再利用する
 *   (データが更新されてもURLが変わらないようにするため。新規選手のみ採番)。
 * - 読み・勝敗の品質情報(未取得/ambiguous/未解決)は落とさずそのまま渡す。
 *
 * 出力: data/kick/generated/index.json, data/kick/generated/fighters/<slug>.json,
 *       public/kick/search-index.json (/kick/fighters のクライアント検索用。
 *       静的アセットとして配信するだけなのでリクエスト時の処理は増えない)。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeKickName } from "../src/lib/kick/nameNormalize";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");
const OUT = path.join(SRC, "generated");
const PUBLIC_OUT = path.join(ROOT, "public/kick");
const SLUG_MAP_PATH = path.join(SRC, "slugs.json");
const SOURCE_META_PATH = path.join(SRC, "sourceMeta.json");

// 選手名簿・戦績の実データ(fighters.json/fighters.csv/bouts_*.json)を最後に
// 取得し直した日時。/kick トップの「データ取得時点」表示に使う。
//
// git log は使わない: Vercelのビルドはshallow clone(depth=10程度)のため、
// このリポジトリのように main への出コミット頻度が高い環境では、対象ファイルの
// 最終変更コミットがすぐ履歴の外に出て `git log` が空を返す(表示が消える)。
// 代わりに data/kick/sourceMeta.json (通常のコミット対象ファイル) にハッシュと
// 日時を持たせ、ソースファイルの内容ハッシュが前回コミット時と一致する限り
// 日時を据え置き、内容が変わった回だけ現在時刻に更新して書き戻す。
// この仕組みなら、無関係な変更でのデプロイでは日付が動かず、データを実際に
// 再取得してコミットした回だけ自動で日付が進む(手で日付を書き換える運用にしない)。
function updateSourceMeta(sourceFiles: string[]): string {
  const hash = crypto.createHash("sha256");
  for (const f of sourceFiles) hash.update(fs.readFileSync(path.join(ROOT, f)));
  const contentHash = hash.digest("hex");

  const prev: { contentHash?: string; updatedAt?: string } = fs.existsSync(SOURCE_META_PATH)
    ? JSON.parse(fs.readFileSync(SOURCE_META_PATH, "utf8"))
    : {};

  if (prev.contentHash === contentHash && prev.updatedAt) return prev.updatedAt;

  const updatedAt = new Date().toISOString();
  fs.writeFileSync(SOURCE_META_PATH, JSON.stringify({ contentHash, updatedAt }, null, 1) + "\n");
  return updatedAt;
}

interface Fighter {
  name: string;
  kana: string | null;
  aliases: string[];
  gym: string | null;
  orgs: string[];
  sources: string[];
  kana_source: { type: string; url: string } | null;
}

interface Bout {
  bout_id: string;
  date: string | null;
  event: string | null;
  venue: string | null;
  fighter_slug: string;
  fighter_name: string;
  opponent_raw: string;
  opponent_name: string;
  opponent_affiliation: string | null;
  opponent_site_slug: string | null;
  opponent_ref: string | null;
  opponent_ref_gym: string | null;
  opponent_resolved: boolean;
  opponent_ambiguous: boolean;
  opponent_candidates: { name: string; gym: string | null; orgs: string[] }[] | null;
  result: string;
  result_mark: string | null;
  method: string | null;
  method_raw: string;
  round: number | null;
  is_extension: boolean;
  ruleset: string | null;
  note: string | null;
  is_debut: boolean;
  title_type: "title_match" | "vacant_title_match" | "challenger_decision" | null;
  pair_key: string | null;
  source_url: string;
  // Wikipedia由来の行にのみ付く。無指定(undefined)は従来どおり公式一次ソース由来。
  source_type?: "wikipedia";
}

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));

const fighters = read<Fighter[]>("fighters.json");
// サンチャイ・TEPPENGYM誤分割監査(2026-08): 対戦相手欄に所属欄(opponent_affiliation)が
// 無く、かつ相手名の文字列そのものにジム/GYM等の語を含む行(例:「サンチャイ・TEPPENGYM」)は、
// splitOpponentGymSuffix()が「人名+所属の連結」と誤認して分割してしまう。しかし
// 「サンチャイ・TEPPENGYM」は名簿(fighters.json)に**1語のリングネームとしてそのまま
// 登録されている実在の選手名**であり、分割すべきではない。相手名(空白除去後)が
// 名簿に実在する選手の表記名(同じく空白除去後)と完全一致する場合は、分割を試みる前に
// 除外する(既存選手の一部を切り取って別の所属を捏造しない)。
// 空白に加え中黒類(・･·•)も除去して比較する。Wikipedia由来の行は出典側の表記慣習で
// 「洋・センチャイジム」のように登録名(「洋センチャイジム」、区切り無し)には無い中黒を
// 挟んで書かれることがあり、空白除去だけでは同一名と判定できなかった(実測: NJKF
// MuayThaiOpen 23の洋センチャイジム戦2件で発覚)。
const stripNameSeparators = (s: string) => s.replace(/[\s　・･·•]/g, "");
const KNOWN_FIGHTER_NAMES = new Set(fighters.map((f) => stripNameSeparators(f.name)));
// matchBy: "sourceUrl" は選手の名簿掲載ページ(=bout.source_url)が選手側のsourcesにも
// 載っている前提で選手を特定する(SB/RISE/KNOCK OUT/K-1の従来ソース)。RIZIN/ONEは名簿の
// 掲載元と戦績の出典元が別サイトのため、代わりに fighter_slug に選手側と同一の
// identity(f)文字列("name|gym|sources[0]")を事前計算して埋めてある(データ側取り込み時の規約)。
const boutFiles: { tag: string; label: string; file: string; matchBy: "sourceUrl" | "identity" }[] = [
  { tag: "sb", label: "SHOOT BOXING", file: "bouts_sb.json", matchBy: "sourceUrl" },
  { tag: "rise", label: "RISE", file: "bouts_rise.json", matchBy: "sourceUrl" },
  { tag: "knockout", label: "KNOCK OUT", file: "bouts_knockout.json", matchBy: "sourceUrl" },
  { tag: "k1", label: "K-1 / Krush / Krush-EX", file: "bouts_k1.json", matchBy: "sourceUrl" },
  { tag: "rizin", label: "RIZIN", file: "bouts_rizin.json", matchBy: "identity" },
  { tag: "one", label: "ONE Championship", file: "bouts_one.json", matchBy: "identity" },
  { tag: "deepkick", label: "DEEP☆KICK", file: "bouts_deepkick.json", matchBy: "identity" },
  { tag: "njkf", label: "NJKF", file: "bouts_njkf.json", matchBy: "identity" },
  { tag: "hoostcup", label: "HoostCup", file: "bouts_hoostcup.json", matchBy: "identity" },
  { tag: "nkb", label: "NKB", file: "bouts_nkb.json", matchBy: "identity" },
  { tag: "bigbang", label: "Bigbang", file: "bouts_bigbang.json", matchBy: "identity" },
  { tag: "standup", label: "Stand up", file: "bouts_standup.json", matchBy: "identity" },
  { tag: "krossover", label: "KROSS×OVER", file: "bouts_krossover.json", matchBy: "identity" },
  { tag: "snka", label: "新日本キックボクシング協会(SNKA)", file: "bouts_snka.json", matchBy: "identity" },
  { tag: "jka", label: "JKA", file: "bouts_jka.json", matchBy: "identity" },
];
// PR #575: 大会名文字列に埋め込まれた年(西暦4桁)と日付フィールドの年が食い違う行を
// 検出・補正する。実例: NJKF公式サイトのURL自体に古い年が紛れ込んだページ
// (https://www.njkf.info/result/njkf2012_west_kyoto_result.html。ページ本文の
// 「日時：2021年12月5日」で裏取り済み、実際の開催は2021年)があり、
// scripts/standup-pipeline/ingest_njkf.pyの日付抽出フォールバック(本文に完全な
// 「YYYY年M月D日」表記が無い場合、URL中の西暦4桁+タイトル中の「N月N日」を組み合わせる)が
// URL側の誤った年(2012)を採用してしまっていた。この1ページだけで6行が影響を受け、うち
// 2行(山川敏弘×鈴木力登、エミNFC×AYA)は正しい日付(2021-12-05)の行が別ソース
// (RISE公式)にも存在するため、日付が食い違ったまま二重計上されていた。
// 大会名(イベント名)自体に「NJKF2021」のように年が埋め込まれており、かつ大会名中の
// 「N月N日」がdateの月日と一致する場合は、大会名側の年をより信頼できる値とみなし
// dateの年を補正する(誤補正を避けるため、大会名に埋め込まれた年が複数種類ある場合は
// 判断がつかないとみなし補正しない)。
function correctEventEmbeddedYearMismatch(date: string | null, event: string | null): string | null {
  if (!date || !event) return date;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const [, dateYear, dateMonth, dateDay] = m;
  const eventYears = [...event.matchAll(/(?:19|20)\d{2}/g)].map((x) => x[0]);
  if (eventYears.length === 0 || eventYears.includes(dateYear)) return date;
  const uniqueYears = new Set(eventYears);
  if (uniqueYears.size !== 1) return date;
  const md = /(\d{1,2})月(\d{1,2})日/.exec(event);
  if (!md || Number(md[1]) !== Number(dateMonth) || Number(md[2]) !== Number(dateDay)) return date;
  return `${eventYears[0]}-${dateMonth}-${dateDay}`;
}

// PR #575: methodRaw(決着原文)に明示的なノーコンテスト系のキーワードが含まれる
// (取り込みスクリプトscripts/standup-pipeline/bouts.py line46がmethod=no_contest判定に
// 使っている語"ノーコンテスト"・"無効"と揃える)のに、構造化されたresultがdraw/win/lossに
// なっている行を補正する。実例: KNOCK OUT公式サイトの試合結果ページで、勝敗を表す
// CSSクラス(fight-log--draw)がノーコンテストの試合にもそのまま使われており(選手本人の
// プロフィールページの通算成績欄には「1NC」と別枠で明記されているにもかかわらず)、
// クラス名ベースで判定するresultだけが「draw」になっていた(ミル・ブン・ティエン、
// 50人検品2周目#572で発覚)。method(テキストベースの判定、こちらは正しく
// no_contestになっている)を正とし、resultを上書きする。
function correctNoContestResultMismatch(method: string | null, methodRaw: string, result: string): string {
  const isNcText = /ノーコンテスト|無効/.test(methodRaw ?? "");
  if (method === "no_contest" && isNcText && (result === "draw" || result === "win" || result === "loss")) {
    return "no_contest";
  }
  return result;
}

const allBouts: (Bout & { promotion: string; matchBy: "sourceUrl" | "identity" })[] = [];
for (const b of boutFiles) {
  for (const x of read<Bout[]>(b.file)) {
    allBouts.push({
      ...x,
      date: correctEventEmbeddedYearMismatch(x.date, x.event),
      result: correctNoContestResultMismatch(x.method, x.method_raw, x.result),
      promotion: b.label,
      matchBy: b.matchBy,
    });
  }
}
const tagByLabel = new Map(boutFiles.map((b) => [b.label, b.tag]));

// Wikipedia由来(bouts_wikipedia.json)は独立ファイル。各行の target_org(ingest_wikipedia.pyが
// 推定した実際の団体名)を対応する既存promotionラベルへマッピングして allBouts に合流させる。
// promotion(=団体)とsource_type(=出典がWikipediaか公式一次ソースか)は別の軸であり、
// Wikipedia由来でも「どの団体の試合か」は実際の団体名で扱う(検索の団体タグ付け・表示上の
// グルーピングを公式ソースの場合と統一するため)。区別はsource_typeバッジのみで行う。
const orgNameToLabel: Record<string, string> = {
  "K-1": "K-1 / Krush / Krush-EX",
  RISE: "RISE",
  "SHOOT BOXING": "SHOOT BOXING",
  "KNOCK OUT": "KNOCK OUT",
  RIZIN: "RIZIN",
  "ONE Championship": "ONE Championship",
  "DEEP☆KICK": "DEEP☆KICK",
  NJKF: "NJKF",
  HoostCup: "HoostCup",
  NKB: "NKB",
  Bigbang: "Bigbang",
  "Stand up": "Stand up",
  "KROSS×OVER": "KROSS×OVER",
  SNKA: "新日本キックボクシング協会(SNKA)",
  JKA: "JKA",
};
// PR-15: 15団体フィルタを撤廃し、Wikipedia側で推定した実際の団体名をそのまま採用する。
// 既存15団体に該当する場合は公式一次ソースと同じラベルに正規化して合流させる(同一団体の
// 試合として束ねる・重複排除するため)。該当しない団体(GLORY・ルンピニー・WAKO
// SuperLeague等の副次団体、および見出しから団体名を特定できなかった「その他団体」)は、
// target_orgの文字列をそのままpromotionラベルとして採用する(黙って捨てない)。
// tagByLabelにこれら新規ラベルの持つtagが存在しないと、後段のboutOrgTagSet/
// orgTagsBySlug計算で選手ページの団体タグ(orgs)から欠落するため、tag=label自身として
// 動的に登録する(boutFiles自体には追加しない — boutFilesは実ファイルのロードにも
// 使われるため、対応するbouts_*.jsonファイルを持たないこの種のラベルを混ぜると壊れる)。
if (fs.existsSync(path.join(SRC, "bouts_wikipedia.json"))) {
  for (const x of read<(Bout & { target_org?: string })[]>("bouts_wikipedia.json")) {
    const rawOrg = x.target_org ?? "";
    if (!rawOrg) continue; // target_org自体が空のデータは想定外として合流させない
    const label = orgNameToLabel[rawOrg] ?? rawOrg;
    if (!tagByLabel.has(label)) tagByLabel.set(label, label);
    const { target_org: _drop, ...bout } = x;
    allBouts.push({
      ...bout,
      date: correctEventEmbeddedYearMismatch(bout.date, bout.event),
      result: correctNoContestResultMismatch(bout.method, bout.method_raw, bout.result),
      promotion: label,
      matchBy: "identity",
    });
  }
}

// 検査C3(相手名への所属連結、306件)の機械分離層。相手名(opponent_name)の末尾に
// 「ジム/道場/塾/GYM/Team/Club/協会/会館」等の所属らしき語が「・」「(」「（」「半角/全角スペース」
// のいずれかの区切り文字を挟んで連結している行(例:「サンチャイ・TEPPEN GYM」)を、
// 人名部分と所属部分に分割する。区切り文字が無く直接連結している行(例:「壱センチャイジム」
// 「洋センチャイジム」)は人名と所属の境界を機械的に確定できないため対象外とし、そのまま残す
// (PR-9本文に対象外リストを記録)。
//
// モノニム/MMA混入監査(2026-08)の追補: PR-9時点の対象外47件を再調査した結果、2種類の
// 追加パターンが見つかった。
// 1. 区切り文字自体はあるが、GYM_SUFFIX_BREAK_CHARSに含まれていなかった異体字
//    (半角中点"･"U+FF65・中黒"·"U+00B7・ビュレット"•"U+2022。全角中黒"・"U+30FBとは別の
//    Unicode文字で、出典サイトによって使い分けられている)。この3文字を追加する。
// 2. 区切り文字が全く無く直接連結しているが、末尾がタイの有名なムエタイジムの表記として
//    高頻度に出現する固定語(「センチャイジム」「センチャジム」(表記ゆれ)「ヨックタイジム」
//    「K.T.ジム」「KTジム」)であるため、辞書的にこの語を境界として確定できるもの
//    (例:「洋センチャイジム」→人名「洋」+所属「センチャイジム」)。この語より前が空になる
//    場合(語自体が単独で出現)は対象外のまま。
const GYM_SUFFIX_KEYWORD_RE = /ジム|道場|塾|GYM|Gym|gym|Team|TEAM|team|Club|CLUB|club|協会|会館/g;
const GYM_SUFFIX_BREAK_CHARS = new Set(["・", "･", "·", "•", "(", "（", " ", "　"]);
// 区切り文字が無い直接連結でも、末尾がこれらの既知の固定語(実データ調査で確認済み)と
// 完全一致する場合のみ境界として認める。未知の語を推測で境界にはしない。
const KNOWN_GYM_SUFFIX_TOKENS = ["センチャイジム", "センチャジム", "ヨックタイジム", "K.T.ジム", "KTジム"];
export function splitOpponentGymSuffix(name: string): { person: string; gym: string } | null {
  const matches = [...name.matchAll(GYM_SUFFIX_KEYWORD_RE)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const idx = last.index!;
  let breakPos = -1;
  for (let i = idx - 1; i >= 0; i--) {
    if (GYM_SUFFIX_BREAK_CHARS.has(name[i])) {
      breakPos = i;
      break;
    }
  }
  if (breakPos >= 0) {
    const person = name.slice(0, breakPos).trim();
    const gym = name
      .slice(breakPos)
      .replace(/^[・･·•(（\s]+/, "")
      .replace(/[)）\s]+$/, "")
      .trim();
    if (person && gym) return { person, gym };
  }
  for (const token of KNOWN_GYM_SUFFIX_TOKENS) {
    if (name.endsWith(token) && name.length > token.length) {
      const person = name.slice(0, name.length - token.length).trim();
      if (person) return { person, gym: token };
    }
  }
  return null;
}

// ---------- slug ----------
const KANA_ROMAJI: [RegExp, string][] = [
  [/キャ/g, "kya"], [/キュ/g, "kyu"], [/キョ/g, "kyo"], [/シャ/g, "sha"], [/シュ/g, "shu"], [/ショ/g, "sho"],
  [/チャ/g, "cha"], [/チュ/g, "chu"], [/チョ/g, "cho"], [/ニャ/g, "nya"], [/ニュ/g, "nyu"], [/ニョ/g, "nyo"],
  [/ヒャ/g, "hya"], [/ヒュ/g, "hyu"], [/ヒョ/g, "hyo"], [/ミャ/g, "mya"], [/ミュ/g, "myu"], [/ミョ/g, "myo"],
  [/リャ/g, "rya"], [/リュ/g, "ryu"], [/リョ/g, "ryo"], [/ギャ/g, "gya"], [/ギュ/g, "gyu"], [/ギョ/g, "gyo"],
  [/ジャ/g, "ja"], [/ジュ/g, "ju"], [/ジョ/g, "jo"], [/ビャ/g, "bya"], [/ビュ/g, "byu"], [/ビョ/g, "byo"],
  [/ピャ/g, "pya"], [/ピュ/g, "pyu"], [/ピョ/g, "pyo"], [/ヴァ/g, "va"], [/ヴィ/g, "vi"], [/ヴェ/g, "ve"], [/ヴォ/g, "vo"],
  [/ファ/g, "fa"], [/フィ/g, "fi"], [/フェ/g, "fe"], [/フォ/g, "fo"], [/ティ/g, "ti"], [/ディ/g, "di"],
  [/ア/g, "a"], [/イ/g, "i"], [/ウ/g, "u"], [/エ/g, "e"], [/オ/g, "o"],
  [/カ/g, "ka"], [/キ/g, "ki"], [/ク/g, "ku"], [/ケ/g, "ke"], [/コ/g, "ko"],
  [/サ/g, "sa"], [/シ/g, "shi"], [/ス/g, "su"], [/セ/g, "se"], [/ソ/g, "so"],
  [/タ/g, "ta"], [/チ/g, "chi"], [/ツ/g, "tsu"], [/テ/g, "te"], [/ト/g, "to"],
  [/ナ/g, "na"], [/ニ/g, "ni"], [/ヌ/g, "nu"], [/ネ/g, "ne"], [/ノ/g, "no"],
  [/ハ/g, "ha"], [/ヒ/g, "hi"], [/フ/g, "fu"], [/ヘ/g, "he"], [/ホ/g, "ho"],
  [/マ/g, "ma"], [/ミ/g, "mi"], [/ム/g, "mu"], [/メ/g, "me"], [/モ/g, "mo"],
  [/ヤ/g, "ya"], [/ユ/g, "yu"], [/ヨ/g, "yo"],
  [/ラ/g, "ra"], [/リ/g, "ri"], [/ル/g, "ru"], [/レ/g, "re"], [/ロ/g, "ro"],
  [/ワ/g, "wa"], [/ヲ/g, "o"], [/ン/g, "n"],
  [/ガ/g, "ga"], [/ギ/g, "gi"], [/グ/g, "gu"], [/ゲ/g, "ge"], [/ゴ/g, "go"],
  [/ザ/g, "za"], [/ジ/g, "ji"], [/ズ/g, "zu"], [/ゼ/g, "ze"], [/ゾ/g, "zo"],
  [/ダ/g, "da"], [/ヂ/g, "ji"], [/ヅ/g, "zu"], [/デ/g, "de"], [/ド/g, "do"],
  [/バ/g, "ba"], [/ビ/g, "bi"], [/ブ/g, "bu"], [/ベ/g, "be"], [/ボ/g, "bo"],
  [/パ/g, "pa"], [/ピ/g, "pi"], [/プ/g, "pu"], [/ペ/g, "pe"], [/ポ/g, "po"],
  [/ヴ/g, "vu"], [/ァ/g, "a"], [/ィ/g, "i"], [/ゥ/g, "u"], [/ェ/g, "e"], [/ォ/g, "o"],
  [/ッ/g, ""], [/ー/g, ""], [/・/g, "-"],
];

function kanaToRomaji(kana: string): string {
  let s = kana;
  for (const [re, r] of KANA_ROMAJI) s = s.replace(re, r);
  return s;
}

function kebab(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 既存slugは data/kick/slugs.json から再利用する(URLを固定するため)。 */
const slugMap: Record<string, string> = fs.existsSync(SLUG_MAP_PATH)
  ? JSON.parse(fs.readFileSync(SLUG_MAP_PATH, "utf8"))
  : {};

// 同名異人がいるため、名前だけではキーにできない。名前+所属+出典1件目で一意化する。
const identity = (f: Fighter) => `${f.name}|${f.gym ?? ""}|${f.sources[0] ?? ""}`;

const used = new Set<string>(Object.values(slugMap));
function assignSlug(f: Fighter): string {
  const key = identity(f);
  if (slugMap[key]) return slugMap[key];
  // 優先: 公式ローマ字 → かなの翻字 → 出典サイトのslug → 連番
  const romaji = romajiOf(f);
  let base = "";
  if (romaji) base = kebab(romaji);
  if (!base && f.kana) base = kebab(kanaToRomaji(f.kana));
  if (!base) {
    // 読みもローマ字も無い場合は出典サイトのslugを使う。数値IDのK-1は団体名を前置して
    // 意味のあるURLにする(fighter-1, fighter-2... のような無意味な連番を避ける)。
    const u = f.sources[0] ?? "";
    const m = u.match(/\/fighters?\/([^/?]+)\/?$/);
    if (m) {
      if (/^\d+$/.test(m[1])) {
        if (u.includes("k-1.co.jp")) base = `k1-${m[1]}`;
      } else base = kebab(m[1]);
    }
  }
  // ラテン文字のリングネーム(DAISUKE, Dyki 等)は表記名そのものをslugにできる。
  if (!base) base = kebab(f.name);
  // 読みが一切取れていない日本語表記名は、推測でローマ字を作らず表記名をそのまま
  // slugにする(URLでは百分率エンコードされる)。無意味な連番を避けるため。
  if (!base) base = f.name.normalize("NFKC").replace(/[\s\u3000/?#%]+/g, "-").replace(/^-|-$/g, "");
  if (!base) base = "fighter";
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  slugMap[key] = slug;
  return slug;
}

// fighters.csv が持つ「団体公式が公開しているローマ字」を読む。
// fighters.json 側はローマ字を持たないため、表示(選手ページ)とslug採番の両方でこれを使う。
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift()!.map((h) => h.replace(/^\uFEFF/, ""));
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const csvRows = parseCsv(fs.readFileSync(path.join(SRC, "fighters.csv"), "utf8"));
// 出典URL列は fighters.json の sources と同じ内容なので結合キーに使える。
const csvBySources = new Map<string, Record<string, string>>();
for (const r of csvRows) csvBySources.set(r.source_urls, r);
const romajiOf = (f: Fighter) => csvBySources.get(f.sources.join("|"))?.yomi_romaji || null;
const yomiSourceOf = (f: Fighter) => csvBySources.get(f.sources.join("|"))?.yomi_source || null;

// ---------- 出典URL → 選手 の索引 ----------
const bySourceUrl = new Map<string, Fighter>();
for (const f of fighters) for (const u of f.sources) bySourceUrl.set(u, f);
const knownIdentities = new Set<string>(fighters.map((f) => identity(f)));

// ---------- 選手ごとにboutを束ねる ----------
const boutsByIdentity = new Map<string, (Bout & { promotion: string })[]>();
let unmatchedBouts = 0;
for (const b of allBouts) {
  let key: string | null = null;
  if (b.matchBy === "identity") {
    // RIZIN/ONE: fighter_slug に identity(f) と同一形式の文字列が入っている前提。
    key = knownIdentities.has(b.fighter_slug) ? b.fighter_slug : null;
  } else {
    const f = bySourceUrl.get(b.source_url);
    key = f ? identity(f) : null;
  }
  if (!key) {
    unmatchedBouts++;
    continue;
  }
  if (!boutsByIdentity.has(key)) boutsByIdentity.set(key, []);
  boutsByIdentity.get(key)!.push(b);
}

// ---------- 同一試合の重複除去(複数団体に掲載がある選手) ----------
// ニックネーム引用符の除去(PR-8のstripQuotedNicknameと同じロジック。重複除去の同定にも
// 使うため、定義をここに前出しする)。和島大海の「木村"フィリップ"ミノル」(K-1公式)と
// 「木村ミノル」(Wikipedia側、ニックネーム抜き)が同一試合として統合されず二重計上されていた
// バグの修正(2026-08、和島大海欠落調査)。
const QUOTE_PAIRS: [string, string][] = [
  ["“", "”"],
  ['"', '"'],
  ["'", "'"],
  ["‘", "’"],
];
export function stripQuotedNickname(s: string): string {
  for (const [open, close] of QUOTE_PAIRS) {
    const oi = s.indexOf(open);
    if (oi === -1) continue;
    const ci = s.indexOf(close, oi + open.length);
    if (ci === -1) continue;
    return s.slice(0, oi) + s.slice(ci + close.length);
  }
  return s;
}
// PR-G(2026-08-17): 名前突合の正規化は src/lib/kick/nameNormalize.ts の
// normalizeKickName() に一本化。以前はここ独自のNFKC+空白除去+中黒除去のみだったが、
// 引用符類・旧字体異体字・字形類似字の統一を含む共通関数に差し替えた
// (詳細は同ファイルのコメント参照)。
const normName = normalizeKickName;
// 重複除去の同一試合判定専用: ニックネーム引用符の有無だけの表記ゆれを吸収する。
const normNameForDedupe = (s: string) => normName(stripQuotedNickname(s));
// 対戦相手名が「不明」等のプレースホルダーの場合、同日に複数試合(トーナメント等)があると
// 全く別の相手なのに同じ文字列になり、date+相手名キーでは誤って同一試合とみなされ
// 一方が消えてしまう(安保瑠輝也2011-12-04のZIHAD cup STIR KING 2011で実測: 準決勝・
// 1回戦の相手がともに「不明」表記で、準決勝の勝利が黙って統合され消えていた)。
// プレースホルダー名はdate+相手名キーでの同一試合判定に使わない(常に別試合として扱う)。
// PR #570(横断確認): このSetは元々素のリテラル文字列だった。normName()側の入力だけを
// 正規化してSet側は正規化しないまま.has()で照合する構造は、src/lib/kick/data.tsの旧
// PROSE_METHOD_RAW denylist(全角/半角括弧の差で一致漏れした実例)と同じ「片側だけ正規化」
// パターンであり、たまたま現在の4値(不明・未定・tba・unknown)はNFKC正規化しても変化しない
// 表記のため実害が出ていなかっただけで、将来ここに全角文字等を含む値を追加すると同種の
// 一致漏れが再発しうる。値自体もnormName()に通し、恒久的に対称にしておく。
const PLACEHOLDER_OPPONENT_NAMES = new Set(["不明", "未定", "tba", "unknown"].map(normName));
const isPlaceholderOpponentName = (s: string) => PLACEHOLDER_OPPONENT_NAMES.has(normName(s));
// 大会名がWikipedia由来の「?」(未取得・不明を表すプレースホルダー)のみの場合、そのまま
// 表示すると「?」という文字化けのように見えるバグと区別が付かない(PR #570、実測9行)。
// nullにして「不明」バッジ表示(既存のb.event ?? "不明"バッジ)に統一する。
const PLACEHOLDER_EVENT_NAMES = new Set(["?", "？"].map((s) => s.normalize("NFKC")));
const isPlaceholderEventName = (s: string | null) => !!s && PLACEHOLDER_EVENT_NAMES.has(s.normalize("NFKC"));
// SNKA(新日本キックボクシング協会)のameblo.jpブログ記事の meta description(要約文)が
// 会場欄に誤って取り込まれ、末尾が「…」で切れたまま表示されていた(PR #570、実測40行、
// 出典: data/kick/bouts_krossover.json)。実際の会場名ではなくブログ要約の断片のため、
// 既知のパターンに一致する場合はvenueそのものを無効(null)として扱う
// (実在しない会場名を捏造するのではなく、単に非表示にする)。
const isJunkVenue = (v: string | null) => !!v && v.includes("…") && v.includes("ameblo.jp");
// スクレイプ元の名前欄・大会名欄に紛れ込んだ孤立した記号の除去。生データ自体は変更しない
// (突合・スラグ生成には元の値を使い続ける。表示専用のクリーンアップ)。
// - 末尾の全角読点「、」: 選手名欄が実際に「吉宗、」のように読点付きで登録されている実例
//   (data/kick/fighters.json、出典: KNOCK OUT公式)がある(PR #570)。
const stripTrailingKickPunct = (s: string) => s.replace(/[、,]+$/u, "").trim();
// - 先頭に残った勝敗マーク記号(⚪️・●等): 出典サイトの勝敗マーク(○×△等の記号)が対戦相手名
//   欄の先頭にそのまま残っている実例(PR #575、"⚪️佐々木勝海"・"●藤野 伸哉"等、NJKF/NKB
//   公式で実測7行、我如古優貴の頁で発見)。結果は別途resultフィールドで正しく持っているため
//   名前欄の記号は冗長。
const stripLeadingKickMark = (s: string) => s.replace(/^[⚪️○×△◎●▲✕✖️✗✘\s]+/u, "").trim();
// - 対応する開き括弧(『)の無い孤立した閉じ括弧(』): krossoverスクレイパーが大会名を
//   誤って範囲取得した実例(PR #570、"KROSS×OVER -CAGE-』GENスポーツパレス大会")。
//   『』のバランスが取れている通常の大会名(合致無し)は一切変更しない。
const stripUnmatchedCornerBracket = (s: string): string => {
  const openCount = (s.match(/『/g) ?? []).length;
  const closeCount = (s.match(/』/g) ?? []).length;
  if (openCount === closeCount) return s;
  return s.replace(/』/g, " ").replace(/\s+/g, " ").trim();
};
// 大会名は主催者の冠(スポンサー名等)が出典サイトごとに付いたり付かなかったりするため
// (例: "MAROOMS presents KNOCK OUT.60 ～K.O CLIMAX 2025～" と "KNOCK OUT.60 ～K.O CLIMAX 2025～")、
// 完全一致ではなく正規化後の包含関係で「同じ大会」とみなす(PR-1.5)。
const normEvent = (s: string | null) => (s ?? "").normalize("NFKC").replace(/[\s　]+/g, "").toLowerCase();
const eventCompatible = (a: string | null, b: string | null) => {
  const na = normEvent(a);
  const nb = normEvent(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
};

let mergedRows = 0;
let mergedRows_debug_slug = "";
function dedupe(bouts: (Bout & { promotion: string })[]) {
  // 同日+相手名一致は従来通りのキー方式(既存挙動を変えない)。
  const seen = new Map<string, (Bout & { promotion: string }) & { alsoFrom: string[] }>();
  const out: ((Bout & { promotion: string }) & { alsoFrom: string[] })[] = [];
  const merge = (hit: (Bout & { promotion: string }) & { alsoFrom: string[] }, b: Bout & { promotion: string }) => {
    // 同じ試合が別団体のページにも載っている。行は1本にまとめ、出典は両方残す。
    if (!hit.alsoFrom.includes(b.source_url)) hit.alsoFrom.push(b.source_url);
    // title_typeは最初に見つかった団体側が空欄でも、統合先の別団体が持っていれば採用する
    // (同じ試合なのに掲載順の都合でタイトル情報が欠落するのを防ぐ)。
    if (!hit.title_type && b.title_type) hit.title_type = b.title_type;
    mergedRows++;
  };
  for (const b of bouts) {
    const sameDayKey =
      b.date && !isPlaceholderOpponentName(b.opponent_name)
        ? `${b.date}|${normNameForDedupe(b.opponent_name)}`
        : `id|${b.bout_id}`;
    const sameDayHit = seen.get(sameDayKey);
    if (sameDayHit) {
      merge(sameDayHit, b);
      continue;
    }
    // 出典サイト間で試合日の記載が±1日ずれるケースがある(例: KNOCK OUT.60が出典サイトごとに
    // 12/30・12/31に割れていた実例)。相手名一致に加え大会名も互換な場合のみ同一試合とみなす
    // (誤結合を避けるため日付だけでは判定しない)。
    let fuzzyHit: ((Bout & { promotion: string }) & { alsoFrom: string[] }) | null = null;
    if (b.date) {
      const bt = Date.parse(b.date);
      if (!Number.isNaN(bt)) {
        for (const o of out) {
          if (!o.date) continue;
          const ot = Date.parse(o.date);
          if (Number.isNaN(ot) || ot === bt) continue; // 同日は上のsameDayHitで処理済み
          if (
            Math.abs(bt - ot) <= 86400000 &&
            !isPlaceholderOpponentName(b.opponent_name) &&
            normNameForDedupe(o.opponent_name) === normNameForDedupe(b.opponent_name) &&
            eventCompatible(o.event, b.event)
          ) {
            fuzzyHit = o;
            break;
          }
        }
      }
    }
    if (fuzzyHit) {
      merge(fuzzyHit, b);
      continue;
    }
    // 日付が未取得(date===null)の行は、sameDayKeyが`id|${b.bout_id}`にフォールバックし
    // 常にユニーク扱いになるため、上のsameDayHit・fuzzyHit(どちらも`if (b.date)`の中でしか
    // 動かない)のどちらにも一切照合されず、常に別試合として残ってしまっていた
    // (PR #570で発見: hayashi-kentaの「林 京平」戦がK-1公式(日付null、boutFiles宣言順で
    // Bigbangより先に処理される)とBigbang公式(日付あり)の2ソースにまたがって
    // 二重計上されていた実例)。
    // 既存行(o)側も日付がnullの場合は、日付という手がかりが両側とも無いまま大会名の
    // 部分一致(eventCompatible)だけで同一試合と断定することになり、誤結合のリスクが
    // 高い(実測で発見: 宮越慶二郎の「Kunlun Fight」ウェイ・ニンヒュイ戦が、
    // 「Kunlun Fight」と「Kunlun Fight 4」という別大会・かつ判定スコアが0-3と3-0で
    // 正反対という別試合の可能性が高いペアを、部分一致だけで誤って同一試合とマージ
    // しかけた)。日付が無い側同士のマージは行わず、**片方だけが実日付を持つ場合のみ**
    // 同一試合とみなす。boutFilesの宣言順によってどちらが先に処理されるかは団体の並び順
    // 次第で変わる(hayashi-kentaはnullの行が先、他の実例は日付ありの行が先)ため、
    // 両方向(b側がnull/o側がnull)を見る。
    let nullDateHit: ((Bout & { promotion: string }) & { alsoFrom: string[] }) | null = null;
    if (!b.date && !isPlaceholderOpponentName(b.opponent_name)) {
      for (const o of out) {
        if (
          o.date &&
          normNameForDedupe(o.opponent_name) === normNameForDedupe(b.opponent_name) &&
          eventCompatible(o.event, b.event)
        ) {
          nullDateHit = o;
          break;
        }
      }
    }
    if (nullDateHit) {
      if (process.env.KICK_DEBUG_DEDUPE) console.error(`[dedupe-null-date] slug=${mergedRows_debug_slug} opponent=${b.opponent_name} event=${b.event} matched_against_date=${nullDateHit.date}`);
      merge(nullDateHit, b);
      continue;
    }
    // 逆方向: bの方が実日付を持ち、既にoutに入っている行(o)がdate:nullの場合
    // (hayashi-kentaはこちら: K-1公式(date:null)が先にoutへ積まれ、後から処理される
    // Bigbang公式(date:あり)がそれに気付けなかった)。この場合は情報量の少ないo側では
    // なくb側を正としたいため、oのフィールドをbの内容で上書きしてから両者のalsoFrom/
    // 出典URLを両方残す。
    let dateUpgradeHit: ((Bout & { promotion: string }) & { alsoFrom: string[] }) | null = null;
    if (b.date && !isPlaceholderOpponentName(b.opponent_name)) {
      for (const o of out) {
        if (
          !o.date &&
          normNameForDedupe(o.opponent_name) === normNameForDedupe(b.opponent_name) &&
          eventCompatible(o.event, b.event)
        ) {
          dateUpgradeHit = o;
          break;
        }
      }
    }
    if (dateUpgradeHit) {
      if (process.env.KICK_DEBUG_DEDUPE) console.error(`[dedupe-date-upgrade] slug=${mergedRows_debug_slug} opponent=${b.opponent_name} event=${b.event} upgrading_from_null_date, incoming_date=${b.date}`);
      const priorAlsoFrom = dateUpgradeHit.alsoFrom;
      const priorSourceUrl = dateUpgradeHit.source_url;
      const priorTitleType = dateUpgradeHit.title_type;
      Object.assign(dateUpgradeHit, b, { alsoFrom: priorAlsoFrom });
      if (!dateUpgradeHit.title_type && priorTitleType) dateUpgradeHit.title_type = priorTitleType;
      if (!dateUpgradeHit.alsoFrom.includes(priorSourceUrl)) dateUpgradeHit.alsoFrom.push(priorSourceUrl);
      if (!dateUpgradeHit.alsoFrom.includes(b.source_url)) dateUpgradeHit.alsoFrom.push(b.source_url);
      // dateUpgradeHitはoutの要素を直接書き換えるだけで、seenマップのキーは元の
      // (date:null時点の)`id|${bout_id}`キーのままになる。この後に3件目以降の重複行
      // (bと同じ日付+相手名)が来た場合、sameDayKeyの照合先が更新後のこの行のはずなのに
      // seenに新しいキーが登録されていないと見つからず、素通りして別行として残ってしまう
      // (3ソース以上にまたがる重複で発見)。更新後の日付+相手名でsameDayKeyを登録し直す。
      seen.set(`${dateUpgradeHit.date}|${normNameForDedupe(dateUpgradeHit.opponent_name)}`, dateUpgradeHit);
      mergedRows++;
      continue;
    }
    const rec = { ...b, alsoFrom: [] as string[] };
    seen.set(sameDayKey, rec);
    out.push(rec);
  }
  return out;
}

// ---------- 出力 ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "fighters"), { recursive: true });

// slugを先に全員分確定させる(相手選手へのリンク解決に必要なため)。
const slugByIdentity = new Map<string, string>();
for (const f of fighters) slugByIdentity.set(identity(f), assignSlug(f));

// opponent_ref(+gym)から相手の選手ページを引くための索引。
// 同名異人は (name, gym) の組でしか一意にならない(SCHEMA.md参照)。
const byNameGym = new Map<string, string>();
for (const f of fighters) {
  byNameGym.set(`${f.name}|${f.gym ?? ""}`, slugByIdentity.get(identity(f))!);
}

// PR-1(fix/kick-name-merge-and-reverse-resolution)でkaito-2/kaito-3を統合した際、
// 統合前の所属表記(SHOOT BOXING／TEAM FOD)は fighters.json から消えたが、他選手の生bout側には
// その旧表記をopponent_ref_gymとして直接参照している行が残っている(例: シッティチャイ・シッソン
// ピーノン側のKNOCK OUTデータ)。旧表記でも引けるようエイリアスを張る。今後同種の統合を行う場合は
// ここに追記する。
const MERGED_GYM_ALIASES: [name: string, oldGym: string, newGym: string][] = [
  ["海人", "SHOOT BOXING／TEAM FOD", "TEAM F.O.D"],
];
for (const [name, oldGym, newGym] of MERGED_GYM_ALIASES) {
  const canonicalSlug = byNameGym.get(`${name}|${newGym}`);
  if (canonicalSlug) byNameGym.set(`${name}|${oldGym}`, canonicalSlug);
}

// ---------- 対戦相手名の柔軟な名寄せ(PR-8) ----------
// opponent_ref による厳密解決・逆引き解決でも埋まらない相手のうち、表記ゆれ(ニックネーム挿入・
// 旧名・スペースの有無)だけが原因で不一致になっているものを追加で解決する。誤リンクを避けるため、
// 正規化後に「一意の候補」が見つかった場合のみ採用する(複数候補・0候補は何もしない)。
// 語順入れ替え(姓が失われるケースの信頼度が低い)とローマ字→かな変換は対象外(採用しない方針)。
function buildUniqueIndex(pairs: [string, string][]): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const [key, slugValue] of pairs) {
    if (!key) continue;
    if (m.has(key)) {
      if (m.get(key) !== slugValue) m.set(key, null);
    } else {
      m.set(key, slugValue);
    }
  }
  return m;
}
const byNormNamePlain = buildUniqueIndex(
  fighters.map((f) => [normName(f.name), slugByIdentity.get(identity(f))!] as [string, string]),
);
const byNormNameNicknameStripped = buildUniqueIndex(
  fighters.map(
    (f) => [normName(stripQuotedNickname(f.name)), slugByIdentity.get(identity(f))!] as [string, string],
  ),
);
const byAliasNorm = buildUniqueIndex(
  fighters.flatMap((f) =>
    (f.aliases ?? []).map((a) => [normName(a), slugByIdentity.get(identity(f))!] as [string, string]),
  ),
);
// PR-11(名寄せ第3弾): 姓が失われる語順入れ替え(下の名前だけの一致)とローマ字→かな一致は、
// PR-8時点では「信頼度が低いため対象外」の方針だった(上のコメント参照)。今回、機械マッチング
// 不能だった4,973件のうち語順入れ替え低信頼度3件(浜本"キャット"雄大/関根"シュレック"秀樹/
// 和泉"マチェッター"遼)とローマ字→かな32件を個別に実機確認(候補選手自身の戦績に同日・同大会の
// 対応する一致行があるかを突合)した。結果、語順入れ替え3件は候補側の戦績に対応する行が
// 一切見つからず不採用(未確証のまま)。ローマ字→かな32件のうち3件(KAZUMU/YUTO/HIROKI)は
// 候補側の戦績に日付・大会・相手名まで完全に一致する行が見つかり確証が取れた。
// ただしKAZUMU以外(YUTO/HIROKI)は同じ表記が他選手の他の試合でも複数回使われており
// (例: 「HIROKI」は5回出現するが確証が取れたのは内藤凌太戦の1件のみ)、opponent_name文字列
// だけをキーにした汎用置換だと未確証の残り4件まで誤って同一人物と結び付けてしまう
// (実際に試して確認: fuzzyResolveOpponentの文字列マッチにすると+9件解決され、確証を
// 取っていない4件が誤リンクされていた)。そのためbout単位(自分のslug+日付+相手表記)で
// 一致した場合のみ適用する行レベルの上書きとし、opponent_nameだけの汎用ルールにはしない。
const VERIFIED_OPPONENT_BOUT_OVERRIDES: Record<string, string> = {
  // key: `${自分のslug}|${date}|${opponent_name}` -> 相手のslug。相手側(和夢/YU斗/弘樹)の
  // 戦績にも同日・同大会・同じ相手名で対応する行があることを個別に確認済み。
  "shota-2|2017-05-28|KAZUMU": "kazumu", // 和夢 vs 翔太、Krush.76
  "masumoto-shoya|2017-03-18|KAZUMU": "kazumu", // 和夢 vs 桝本翔也(自称"翔也")、KHAOS.1
  "yamamoto-naoki|2015-04-12|KAZUMU": "kazumu", // 和夢 vs 山本直樹、Krush.53
  "inoue-yamato|2022-06-12|YUTO": "yuto-2", // YU斗 vs 井上大和、DEEP☆KICK 62
  "naito-ryota|2021-03-21|HIROKI": "hiroki-2", // 弘樹 vs 内藤凌太、RIZIN.27
  // 「足利 和正」(姓名の並びが入れ替わった表記)。名簿には「足利 正和」で登録されている。
  // 4件中3件で足利正和自身の戦績と日付・大会・相手名が一致(残り1件は対応なし、未確証のまま除外)
  "miwa-yuki|2018-03-10|足利 和正": "ashikaga-masakazu", // Krush.86
  "saito-yuto|2019-01-26|足利 和正": "ashikaga-masakazu", // Krush.97
  "fujita-yoshifumi|2019-09-16|足利 和正": "ashikaga-masakazu", // Krush.105
  // 「京谷祐希」は名簿に完全一致する選手が存在するが、この1行(2021-11-14)だけ未解決だった。
  // 原因はopponent_name原文に所属+決着注記が連結していたため(「京谷祐希（山口道場）※偶然の
  // バッティングにより3R 1分02秒までの途中判定」)。表示名は正しく「京谷祐希」に整形されているが
  // fuzzyResolveOpponent()は整形前の原文で判定するため一致しなかった。同一試合の相手側
  // (京谷祐希本人のページ)には対応する行(vs 植山征紀、同日同大会)が実在する。
  "seiki-ueyama|2021-11-14|京谷祐希（山口道場）※偶然のバッティングにより3R 1分02秒までの途中判定":
    "yuki-kyotani", // Cygames presents RISE WORLD SERIES 2021 OSAKA2
  // 「昇也」も名簿に完全一致する選手がおり、bouts_bigbang.json経由の行は正しく解決しているが、
  // 同じ試合を別途収録しているbouts_rise.json側は開き括弧が閉じないまま(「昇也（士魂村上塾」)
  // 相手名に残っており不一致だった(セル崩れ)。
  "tatsuya-inaishi|2020-11-08|昇也（士魂村上塾": "shoya", // スーパービッグバン2020
};

function fuzzyResolveOpponent(opponentName: string): string | null {
  const n = normName(opponentName);
  const aliasHit = byAliasNorm.get(n);
  if (aliasHit) return aliasHit;
  const stripped = normName(stripQuotedNickname(opponentName));
  if (stripped !== n) {
    const strippedHit = byNormNamePlain.get(stripped);
    if (strippedHit) return strippedHit;
  }
  const plainHit = byNormNamePlain.get(n);
  if (plainHit) return plainHit;
  const nickStrippedHit = byNormNameNicknameStripped.get(n);
  if (nickStrippedHit) return nickStrippedHit;
  return null;
}
let fuzzyResolvedCount = 0;

// ---------- 逆引き解決 ----------
// 通常の解決(opponent_resolved && opponent_ref)は「自分側の行が相手を一意に指せているか」
// だけを見るため、相手が同名複数人(opponent_ambiguous)だと最初からnullになる。
// しかし候補の中に「相手側の試合記録には自分の名前がほぼ一意に載っている」人がいれば、
// それを手がかりに解決できることがある(例: 安保瑠輝也×海人 2015-10-03。海人側の記録は
// 安保へ一意解決済みだが、安保側は「海人」が同名複数人でopponent_resolved:falseのまま)。
// 候補のうち「相手側ページで自分に一意解決される」者がちょうど1人だけの場合に限り解決する
// (0人・2人以上は誤リンクの危険があるため何もしない)。
const fighterBySlug = new Map<string, Fighter>();
for (const f of fighters) fighterBySlug.set(slugByIdentity.get(identity(f))!, f);

const dateNear = (d1: string | null, d2: string | null, maxDays: number): boolean => {
  if (!d1 || !d2) return false;
  const t1 = Date.parse(d1);
  const t2 = Date.parse(d2);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return false;
  return Math.abs(t1 - t2) <= maxDays * 86400000;
};

function reverseResolveOpponent(bout: Bout, mySlug: string, myName: string): string | null {
  if (bout.opponent_resolved || !bout.opponent_candidates) return null;
  const resolved = new Set<string>();
  for (const cand of bout.opponent_candidates) {
    const candSlug = byNameGym.get(`${cand.name}|${cand.gym ?? ""}`);
    if (!candSlug || candSlug === mySlug) continue;
    const candFighter = fighterBySlug.get(candSlug);
    if (!candFighter) continue;
    const candBouts = boutsByIdentity.get(identity(candFighter)) ?? [];
    const reciprocal = candBouts.some((cb) => {
      if (normName(cb.opponent_name) !== normName(myName)) return false;
      if (!dateNear(cb.date, bout.date, 3)) return false;
      // 相手側のその行自体が自分へ一意に解決されているかを確認する(誤リンク防止)。
      return (
        cb.opponent_resolved &&
        !!cb.opponent_ref &&
        byNameGym.get(`${cb.opponent_ref}|${cb.opponent_ref_gym ?? ""}`) === mySlug
      );
    });
    if (reciprocal) resolved.add(candSlug);
  }
  return resolved.size === 1 ? [...resolved][0] : null;
}
let reverseResolvedCount = 0;

// ---------- 本名(検索の一致キー専用。画面には一切表示しない) ----------
// data/kick/realnames.json: ja.wikipedia個別記事の|realname=欄が表記名と異なるもの(158件)。
// source_url(出典)はこのファイル自体(リポジトリにコミット)が保持先であり、
// クライアントに配信する検索インデックスには含めない(画面にもネットワーク越しにも出さない)。
interface RealnameEntry {
  name: string;
  realname: string;
  realname_raw_field: string;
  source_url: string;
}
const realnames = fs.existsSync(path.join(SRC, "realnames.json"))
  ? read<RealnameEntry[]>("realnames.json")
  : [];
// PR-G(2026-08-17): 「Wikipedia記事(realnames.json)↔選手(fighters.json)の結合」は
// 従来 f.name への完全一致のみ(正規化なし)だった。空白・引用符・旧字体等の表記ゆれが
// あると結合そのものが失敗する(相手名寄せ側のnormNameとは異なる基準だった)。
// normalizeKickName()による正規化キーへ統一する(同名異人の一意化ロジックは変更しない)。
const fightersByNormName = new Map<string, Fighter[]>();
for (const f of fighters) {
  const key = normName(f.name);
  const arr = fightersByNormName.get(key) ?? [];
  arr.push(f);
  fightersByNormName.set(key, arr);
}
const realnameBySlug = new Map<string, string>();
let realnameUnresolved = 0;
for (const r of realnames) {
  const candidates = fightersByNormName.get(normName(r.name)) ?? [];
  // 同姓同名(例: "武蔵"が3人)は出典URLがその選手自身のsourcesに含まれるかで一意化する。
  const f = candidates.length === 1 ? candidates[0] : candidates.find((c) => c.sources.includes(r.source_url));
  if (!f) {
    realnameUnresolved++;
    continue;
  }
  realnameBySlug.set(slugByIdentity.get(identity(f))!, r.realname);
}

const KANA_ROWS = "アカサタナハマヤラワ";
// 選手一覧(/kick/fighters)の3件修正調査(2026-08)で発見: kanaフィールドはK-1由来は
// カタカナだが、他ソース(RISE等)はひらがなで格納されている選手が42人いた(例:
// 朝倉未来「あさくら みくる」)。下のtableはカタカナの文字範囲でしか判定しておらず、
// ひらがなの先頭文字は一致せずすべて「―」(読み未取得・分類不能)行きになっていた
// (実際には読みを取得できているのに、五十音グルーピングの対象外として末尾に落ちる
// 表示バグ)。判定前にひらがな→カタカナ変換を行うことで解消する。
function hiraganaToKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function kanaBucket(kana: string | null): string {
  if (!kana) return "―";
  // ニックネームの引用符(“”「」等)で始まるかなは、その記号ではなく後続の実際の
  // 読みで分類する(例: "“コング” コウセイ" は「”」ではなく「コ」＝カ行)。
  const stripped = hiraganaToKatakana(kana.replace(/^[“”"'’「」『』【】〈〉《》〔〕・\s]+/, ""));
  const c = stripped[0];
  if (!c) return "―";
  const table: [string, string][] = [
    // 「ヴ」は外国人選手名の音写に頻出するため、辞書配列の慣習どおりア行に含める。
    ["ア", "アイウエオヴ"], ["カ", "カキクケコガギグゲゴ"], ["サ", "サシスセソザジズゼゾ"],
    ["タ", "タチツテトダヂヅデド"], ["ナ", "ナニヌネノ"], ["ハ", "ハヒフヘホバビブベボパピプペポ"],
    ["マ", "マミムメモ"], ["ヤ", "ヤユヨ"], ["ラ", "ラリルレロ"], ["ワ", "ワヲン"],
  ];
  for (const [row, chars] of table) if (chars.includes(c)) return row;
  return "―";
}

const index: unknown[] = [];
let withBouts = 0;
let totalBoutRows = 0;
let scheduledRows = 0;
let titleTypeRows = 0;
let resultUnknownRows = 0;
let boutRowsWikipedia = 0;
// 検索インデックス用: 選手が実際にboutを持つ団体(戦績の出典団体)。
// fighters.json 側の orgs(名簿の掲載元)とは別概念のため、選手ごとの bouts から都度求める。
const orgTagsBySlug = new Map<string, string[]>();

// ---------- ルール除外(PR-2) ----------
// MMA・エキシビジョン・アマチュア戦・ボクシングルールの試合など、キックボクシングの
// 戦績として掲載すべきでないboutを、1件ずつ事実確認のうえ除外する。生データ
// (bouts_*.json)は変更せず、この一覧(data/kick/manualRuleExclusions.json、
// 選手slug・日付・相手・決着原文・除外理由を保持)とビルド時に照合して除外する。
// キーワードだけでの機械判定はしない(同じ「一本」でもK-1甲子園はアマ、KROSS×OVERは
// MMAケージ、といった具合に文脈で意味が異なるため)。
interface ManualExclusion {
  slug: string;
  date: string | null;
  opponent: string;
  methodRaw: string;
  category: "mma" | "exhibition" | "amateur" | "boxing";
  reason: string;
}
const manualExclusions: ManualExclusion[] = fs.existsSync(path.join(SRC, "manualRuleExclusions.json"))
  ? JSON.parse(fs.readFileSync(path.join(SRC, "manualRuleExclusions.json"), "utf8"))
  : [];
const exclusionByKey = new Map<string, ManualExclusion[]>();
for (const e of manualExclusions) {
  const k = `${e.slug}|${e.date ?? "null"}|${normName(e.opponent)}`;
  const arr = exclusionByKey.get(k) ?? [];
  arr.push(e);
  exclusionByKey.set(k, arr);
}
const exclusionMatchCount = new Map<ManualExclusion, number>();
function findExclusion(slug: string, b: Bout & { promotion: string }): ManualExclusion | null {
  const k = `${slug}|${b.date ?? "null"}|${normName(b.opponent_name)}`;
  const hit = (exclusionByKey.get(k) ?? []).find((e) => e.methodRaw === b.method_raw);
  if (hit) exclusionMatchCount.set(hit, (exclusionMatchCount.get(hit) ?? 0) + 1);
  return hit ?? null;
}
const excludedRowsLog: (ManualExclusion & { name: string; event: string | null; promotion: string })[] = [];

for (const f of fighters) {
  const key = identity(f);
  const slug = slugByIdentity.get(key)!;
  const raw = boutsByIdentity.get(key) ?? [];
  if (process.env.KICK_DEBUG_DEDUPE) mergedRows_debug_slug = slug;
  const bouts = dedupe(raw)
    .filter((b) => {
      const ex = findExclusion(slug, b);
      if (!ex) return true;
      excludedRowsLog.push({ ...ex, name: f.name, event: b.event, promotion: b.promotion });
      return false;
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  if (bouts.length) withBouts++;
  totalBoutRows += bouts.length;
  scheduledRows += bouts.filter((b) => b.result === "scheduled").length;
  titleTypeRows += bouts.filter((b) => b.title_type).length;
  resultUnknownRows += bouts.filter((b) => b.result === "unknown").length;
  boutRowsWikipedia += bouts.filter((b) => b.source_type === "wikipedia").length;

  // PR-15: 既存15団体はboutFiles宣言順を維持(既存の並び順・出力を変えない)。
  // それ以外(Wikipedia由来の新規団体)はboutFilesに項目が無いため、選手ごとの
  // bouts配列(日付降順)に現れた順で末尾に追加する。
  const boutOrgTagSet = new Set(bouts.map((b) => tagByLabel.get(b.promotion)!));
  const knownOrgTagSet = new Set(boutFiles.map((bf) => bf.tag));
  const extraOrgTags = [...boutOrgTagSet].filter((t) => !knownOrgTagSet.has(t));
  const boutOrgLabels = [
    ...boutFiles.filter((bf) => boutOrgTagSet.has(bf.tag)).map((bf) => bf.label),
    ...extraOrgTags,
  ];
  orgTagsBySlug.set(slug, [...boutFiles.filter((bf) => boutOrgTagSet.has(bf.tag)).map((bf) => bf.tag), ...extraOrgTags]);

  // 選手ページヘッダーの「収録N試合: X勝Y敗Z分」集計。ビルド時に確定させ、
  // ページ側はこの値をそのまま出す(リクエスト時集計はしない)。
  // - scheduled(未実施)は数えない
  // - no_contest / cancelled は勝敗に数えない(試合として成立していない、またはSCHEMA.md定義上「行われていない」扱い)
  // - walkover(不戦勝/不戦敗、method=walkoverでresultはwin/lossどちらも取りうる)は
  //   SCHEMA.mdが「集計時に除外できるようにする」ことを明示して設計した項目のため、
  //   このNには含めない(試合が実際には行われていないため)
  // - unknown(マーク無しで判定不能)は勝敗には数えず、別枠でカウントする
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let unknownCount = 0;
  for (const b of bouts) {
    if (b.method === "walkover") continue;
    if (b.result === "scheduled" || b.result === "no_contest" || b.result === "cancelled") continue;
    if (b.result === "win") wins++;
    else if (b.result === "loss") losses++;
    else if (b.result === "draw") draws++;
    else if (b.result === "unknown") unknownCount++;
  }
  const record = { wins, losses, draws, unknownCount, total: wins + losses + draws + unknownCount };

  // 表示専用のクリーンアップ(f.name自体は変更しない。identity()・スラグ生成・突合は
  // 元のf.nameを使い続ける。PR #570、stripTrailingKickPunctのコメント参照)。
  const displayName = stripTrailingKickPunct(f.name);

  const detail = {
    slug,
    name: displayName,
    kana: f.kana,
    romaji: romajiOf(f),
    yomiSource: yomiSourceOf(f),
    kanaSource: f.kana_source,
    aliases: f.aliases,
    gym: f.gym,
    // PR-12: 従来はf.orgs(名簿の掲載元、fighters.json由来)をそのまま表示していたが、
    // これは選手ページ登録時のソースタグに過ぎず戦績の実態と食い違うことがあった
    // (実例: ブアカーオの名簿タグは「K-1 WORLD GP」のみだが、実際の戦績にはK-1に加えて
    // RIZIN・SHOOT BOXING・SNKAの4団体分が載っている)。実際にboutを持つ団体
    // (boutOrgLabels、検索インデックスのorgTagsBySlugと同じ計算元)に置き換える。
    orgs: boutOrgLabels,
    sources: f.sources,
    record,
    bouts: bouts.map((b) => {
      // リンクしてよいのは「一意に解決できた相手」だけ。
      // ambiguous(同名異人)・未解決は誤リンクを避けテキスト表示にする。
      const directSlug =
        b.opponent_resolved && b.opponent_ref
          ? byNameGym.get(`${b.opponent_ref}|${b.opponent_ref_gym ?? ""}`) ?? null
          : null;
      const reverseSlug = directSlug ? null : reverseResolveOpponent(b, slug, f.name);
      const verifiedOverride =
        directSlug || reverseSlug
          ? null
          : (VERIFIED_OPPONENT_BOUT_OVERRIDES[`${slug}|${b.date}|${b.opponent_name}`] ?? null);
      const fuzzySlug =
        directSlug || reverseSlug || verifiedOverride ? null : fuzzyResolveOpponent(b.opponent_name);
      const opponentSlug = directSlug ?? reverseSlug ?? verifiedOverride ?? fuzzySlug;
      if (reverseSlug) reverseResolvedCount++;
      if (verifiedOverride) fuzzyResolvedCount++;
      if (fuzzySlug) fuzzyResolvedCount++;
      // サンチャイ・TEPPENGYM誤分割監査(2026-08)で発見した2つの誤分割条件を、
      // splitOpponentGymSuffix()の適用前にどちらも除外する。
      // (1) 出典側が既に所属を別フィールド(opponent_affiliation)として持っている行にも
      //     無条件で適用されており、所属欄が既知にもかかわらず名前側だけ切り詰められていた。
      //     splitOpponentGymSuffix()は「所属欄が無いため名前と所属が連結されたまま出典に
      //     載っている」行を救済するためのものであり、所属欄が既にある行では適用しない。
      // (2) 所属欄が無い場合でも、相手名そのものが名簿に実在する1語のリングネーム
      //     (例:「サンチャイ・TEPPENGYM」)と完全一致する場合は、実在の選手名の一部を
      //     切り取って別の所属を捏造することになるため適用しない。
      const gymSplit =
        b.opponent_affiliation || KNOWN_FIGHTER_NAMES.has(stripNameSeparators(b.opponent_name))
          ? null
          : splitOpponentGymSuffix(b.opponent_name);
      // event===""(空文字列)はnullとは区別されてしまい、page.tsx側の`b.event ?? <不明バッジ>`
      // ではnullish coalescingが働かず「不明」表示すら出ない完全な空欄になっていた
      // (PR #575、robu-kaman・50人検品2周目#572で発見、実測69行)。空文字列もnull同様に
      // 扱い、既存の「不明」バッジ表示に統一する。
      const cleanedEvent = !b.event || isPlaceholderEventName(b.event) ? null : stripUnmatchedCornerBracket(b.event);
      return {
        date: b.date,
        event: cleanedEvent,
        venue: isJunkVenue(b.venue) ? null : b.venue,
        promotion: b.promotion,
        opponentName: stripLeadingKickMark(stripTrailingKickPunct(gymSplit ? gymSplit.person : b.opponent_name)),
        opponentAffiliation: b.opponent_affiliation || (gymSplit ? gymSplit.gym : b.opponent_affiliation),
        opponentSlug,
        // 逆引きで解決できた行はambiguousバッジを出さない(実リンクが出るため不要)。
        opponentAmbiguous: b.opponent_ambiguous && !opponentSlug,
        opponentCandidateCount: b.opponent_candidates ? b.opponent_candidates.length : 0,
        result: b.result,
        method: b.method,
        methodRaw: b.method_raw,
        round: b.round,
        isExtension: b.is_extension,
        ruleset: b.ruleset,
        note: b.note,
        isDebut: b.is_debut,
        titleType: b.title_type,
        sourceUrl: b.source_url,
        sourceType: b.source_type ?? null,
        alsoFrom: b.alsoFrom,
      };
    }),
  };
  fs.writeFileSync(path.join(OUT, "fighters", `${slug}.json`), JSON.stringify(detail));

  index.push({
    slug,
    name: displayName,
    kana: f.kana,
    romaji: romajiOf(f),
    kanaType: f.kana_source?.type ?? null,
    gym: f.gym,
    orgs: boutOrgLabels, // PR-12: detail.orgsと同じく実bout側算出に統一(名簿ソースタグは使わない)
    boutCount: bouts.length,
    bucket: kanaBucket(f.kana),
  });
}

// 五十音順。読み未取得は末尾にまとめ、表記名で並べる(推測で読みを補わない)。
index.sort((a: any, b: any) => {
  if (!a.kana && !b.kana) return a.name.localeCompare(b.name, "ja");
  if (!a.kana) return 1;
  if (!b.kana) return -1;
  return a.kana.localeCompare(b.kana, "ja") || a.name.localeCompare(b.name, "ja");
});

// 「読み未取得」の定義は2つある: (1)kanaMissing = kana自体がnull、(2)五十音順一覧で
// 「―」バケットに実際に並ぶ人数(kanaはあるが記号始まり・ラテン文字表記等で分類できない選手を含む)。
// この2つは概念として別物であり、値を揃えるのではなく両方を明示的にstatsへ持たせ、
// 全画面がこの2つのどちらかを参照するよう一元化する(画面ごとに別の再計算をしない)。
const kanaUnclassifiedCount = (index as { bucket: string }[]).filter((f) => f.bucket === "―").length;

const stats = {
  fighters: fighters.length,
  fightersWithBouts: withBouts,
  boutRows: totalBoutRows,
  // 「戦績」として数えるのは実施済みのみ。scheduled(K-1の未実施の予定試合)は別建てにする。
  boutRowsCompleted: totalBoutRows - scheduledRows,
  boutRowsScheduled: scheduledRows,
  boutRowsRaw: allBouts.length,
  // 戦績の出典内訳(各団体公式サイト由来 / Wikipedia由来)。B.出典説明の内訳表示に使う。
  boutRowsOfficial: totalBoutRows - boutRowsWikipedia,
  boutRowsWikipedia,
  mergedDuplicateRows: mergedRows,
  unmatchedBouts,
  kanaFilled: fighters.filter((f) => f.kana).length,
  kanaMissing: fighters.filter((f) => !f.kana).length,
  // kanaMissing(かな自体が無い899人)のうち、公式ローマ字は取得できている人数。
  // 選手一覧の3件修正調査(2026-08)で、読み欄にローマ字が表示される行が「読み未取得」の
  // 見出し配下に一律で混ざり、かな・ローマ字・値なしの3状態が区別できなかった問題への対応。
  kanaMissingButHasRomaji: fighters.filter((f) => !f.kana && romajiOf(f)).length,
  // 五十音順一覧の「―」バケットに実際に並ぶ人数。kanaMissingとの差は、かな自体はあるが
  // 記号始まりのニックネームや表記がラテン文字のみ等で五十音順に分類できない選手。
  kanaUnclassified: kanaUnclassifiedCount,
  kanaConverted: fighters.filter((f) => f.kana_source?.type === "from_romaji").length,
  titleTypeCount: titleTypeRows,
  resultUnknownCount: resultUnknownRows,
  reverseResolvedCount,
  fuzzyResolvedCount,
  manualExclusionCount: excludedRowsLog.length,
  promotions: boutFiles.map((b) => b.label),
};

// ---------- 集計値の恒等式チェック(A.一元化の再発防止ネット) ----------
// 画面ごとに別の集計をしてしまうと定義が静かにズレる(PR-6の発端)。
// ビルド時に成立すべき恒等式を機械的に検証し、崩れたらビルドを失敗させる。
{
  const errors: string[] = [];
  if (stats.fighters !== index.length) {
    errors.push(`stats.fighters(${stats.fighters}) !== index.length(${index.length})`);
  }
  if (stats.boutRows !== stats.boutRowsCompleted + stats.boutRowsScheduled) {
    errors.push(
      `boutRows(${stats.boutRows}) !== boutRowsCompleted(${stats.boutRowsCompleted}) + boutRowsScheduled(${stats.boutRowsScheduled})`,
    );
  }
  if (stats.boutRows !== stats.boutRowsOfficial + stats.boutRowsWikipedia) {
    errors.push(
      `boutRows(${stats.boutRows}) !== boutRowsOfficial(${stats.boutRowsOfficial}) + boutRowsWikipedia(${stats.boutRowsWikipedia})`,
    );
  }
  if (stats.kanaUnclassified < stats.kanaMissing) {
    errors.push(
      `kanaUnclassified(${stats.kanaUnclassified}) はkanaMissing(${stats.kanaMissing})以上のはず(かな無しは必ず―バケットに入る)`,
    );
  }
  if (errors.length) {
    throw new Error(`[kick] 集計値の恒等式が崩れています:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}

// ---------- unmatchedBoutsの恒久ガード(ratchet) ----------
// 選手の統合(名前・所属の変更)でidentity(名前|所属|出典URL)が変わると、bouts_*.jsonに
// ハードコードされたfighter_slugとの不一致でunmatchedBoutsが静かに増える
// (PR-6・PR-7で複合キーが原因の同型の副作用を2回連続で踏んだ)。前回ビルド時点の値を
// 基準(ratchet)にし、増加したらビルドを失敗させる。減少・同値なら基準を更新する。
{
  const baselinePath = path.join(SRC, "unmatchedBoutsBaseline.json");
  const prevBaseline: number = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, "utf8")).unmatchedBouts
    : stats.unmatchedBouts;
  if (stats.unmatchedBouts > prevBaseline) {
    throw new Error(
      `[kick] unmatchedBouts が前回ビルド時点の基準(${prevBaseline}件)から${stats.unmatchedBouts}件に増加しました。` +
        `選手の名前・所属を変更した際、その選手のbouts_*.json側のfighter_slug(identity形式)が` +
        `古い値のまま残っている可能性があります(PR-6・PR-7で発生した罠と同型)。` +
        `変更した選手のsourcesに該当するbouts_*.jsonのfighter_slugを新しいidentityに更新してください。`,
    );
  }
  fs.writeFileSync(baselinePath, JSON.stringify({ unmatchedBouts: stats.unmatchedBouts }, null, 1) + "\n");
}

// data/kick/manualRuleExclusions.json の各行が実際にちょうど1件のboutと
// マッチしたかを確認する(0件=データ変化でヒットしなくなった古いエントリ、
// 2件以上=キーが一意でない)。手動キュレーションした一覧のドリフトを
// ビルド時に検知するための安全網で、ビルド自体は止めない(警告のみ)。
for (const e of manualExclusions) {
  const n = exclusionMatchCount.get(e) ?? 0;
  if (n !== 1) {
    console.warn(
      `[kick] manualRuleExclusions.json: ${e.slug} / ${e.date} / ${e.opponent} が${n}件マッチしました(想定は1件)。データが変化した可能性があります。`,
    );
  }
}
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "out/kick-rule-exclusion-log.json"),
  JSON.stringify(excludedRowsLog, null, 1),
);

const sourceUpdatedAt = updateSourceMeta([
  "data/kick/fighters.json",
  "data/kick/fighters.csv",
  ...boutFiles.map((b) => `data/kick/${b.file}`),
  ...(fs.existsSync(path.join(SRC, "realnames.json")) ? ["data/kick/realnames.json"] : []),
  ...(fs.existsSync(path.join(SRC, "bouts_wikipedia.json")) ? ["data/kick/bouts_wikipedia.json"] : []),
]);

fs.writeFileSync(
  path.join(OUT, "index.json"),
  JSON.stringify({ stats, fighters: index, sourceUpdatedAt }),
);
fs.writeFileSync(SLUG_MAP_PATH, JSON.stringify(slugMap, null, 1));

// ---------- 検索インデックス(クライアント側の絞り込み専用、最小フィールドのみ) ----------
// 表記名・かな・ローマ字・所属・本名(一致キーのみ)の部分一致検索に使う。
// 集計値(戦績数等)は含めずサイズを絞る。realname・orgsは該当者のみキーを持たせる
// (該当なしの選手分までnull/空配列を並べてサイズを膨らませない)。
// orgsは戦績の出典団体(15団体、build-kick-data.tsのtag)。データ量を抑えるため
// フルラベルではなく短縮タグで持たせ、表示側(FighterSearch.tsx)でラベルに変換する。
const searchIndex = (index as { slug: string; name: string; kana: string | null; romaji: string | null; gym: string | null }[]).map(
  (f) => {
    const realname = realnameBySlug.get(f.slug);
    const orgs = orgTagsBySlug.get(f.slug) ?? [];
    return {
      slug: f.slug,
      name: f.name,
      kana: f.kana,
      romaji: f.romaji,
      gym: f.gym,
      ...(realname ? { realname } : {}),
      ...(orgs.length ? { orgs } : {}),
    };
  },
);
fs.mkdirSync(PUBLIC_OUT, { recursive: true });
fs.writeFileSync(path.join(PUBLIC_OUT, "search-index.json"), JSON.stringify(searchIndex));

console.log("[kick] generated", JSON.stringify(stats, null, 1));
console.log(
  `[kick] realnames: 解決${realnameBySlug.size}件 / 未解決${realnameUnresolved}件(計${realnames.length}件)`,
);
