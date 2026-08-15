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
  pair_key: string | null;
  source_url: string;
}

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));

const fighters = read<Fighter[]>("fighters.json");
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
];
const allBouts: (Bout & { promotion: string; matchBy: "sourceUrl" | "identity" })[] = [];
for (const b of boutFiles) {
  for (const x of read<Bout[]>(b.file)) allBouts.push({ ...x, promotion: b.label, matchBy: b.matchBy });
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
const normName = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, "").replace(/[・･]/g, "").toLowerCase();

let mergedRows = 0;
function dedupe(bouts: (Bout & { promotion: string })[]) {
  const seen = new Map<string, (Bout & { promotion: string }) & { alsoFrom: string[] }>();
  const out: ((Bout & { promotion: string }) & { alsoFrom: string[] })[] = [];
  for (const b of bouts) {
    const key = b.date ? `${b.date}|${normName(b.opponent_name)}` : `id|${b.bout_id}`;
    const hit = seen.get(key);
    if (hit) {
      // 同じ試合が別団体のページにも載っている。行は1本にまとめ、出典は両方残す。
      if (!hit.alsoFrom.includes(b.source_url)) hit.alsoFrom.push(b.source_url);
      mergedRows++;
      continue;
    }
    const rec = { ...b, alsoFrom: [] as string[] };
    seen.set(key, rec);
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
const fightersByName = new Map<string, Fighter[]>();
for (const f of fighters) {
  const arr = fightersByName.get(f.name) ?? [];
  arr.push(f);
  fightersByName.set(f.name, arr);
}
const realnameBySlug = new Map<string, string>();
let realnameUnresolved = 0;
for (const r of realnames) {
  const candidates = fightersByName.get(r.name) ?? [];
  // 同姓同名(例: "武蔵"が3人)は出典URLがその選手自身のsourcesに含まれるかで一意化する。
  const f = candidates.length === 1 ? candidates[0] : candidates.find((c) => c.sources.includes(r.source_url));
  if (!f) {
    realnameUnresolved++;
    continue;
  }
  realnameBySlug.set(slugByIdentity.get(identity(f))!, r.realname);
}

const KANA_ROWS = "アカサタナハマヤラワ";
function kanaBucket(kana: string | null): string {
  if (!kana) return "―";
  const c = kana[0];
  const table: [string, string][] = [
    ["ア", "アイウエオ"], ["カ", "カキクケコガギグゲゴ"], ["サ", "サシスセソザジズゼゾ"],
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

for (const f of fighters) {
  const key = identity(f);
  const slug = slugByIdentity.get(key)!;
  const raw = boutsByIdentity.get(key) ?? [];
  const bouts = dedupe(raw).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  if (bouts.length) withBouts++;
  totalBoutRows += bouts.length;
  scheduledRows += bouts.filter((b) => b.result === "scheduled").length;

  const detail = {
    slug,
    name: f.name,
    kana: f.kana,
    romaji: romajiOf(f),
    yomiSource: yomiSourceOf(f),
    kanaSource: f.kana_source,
    aliases: f.aliases,
    gym: f.gym,
    orgs: f.orgs,
    sources: f.sources,
    bouts: bouts.map((b) => ({
      date: b.date,
      event: b.event,
      venue: b.venue,
      promotion: b.promotion,
      opponentName: b.opponent_name,
      opponentAffiliation: b.opponent_affiliation,
      // リンクしてよいのは「一意に解決できた相手」だけ。
      // ambiguous(同名異人)・未解決は誤リンクを避けテキスト表示にする。
      opponentSlug:
        b.opponent_resolved && b.opponent_ref
          ? byNameGym.get(`${b.opponent_ref}|${b.opponent_ref_gym ?? ""}`) ?? null
          : null,
      opponentAmbiguous: b.opponent_ambiguous,
      opponentCandidateCount: b.opponent_candidates ? b.opponent_candidates.length : 0,
      result: b.result,
      method: b.method,
      methodRaw: b.method_raw,
      round: b.round,
      isExtension: b.is_extension,
      ruleset: b.ruleset,
      note: b.note,
      isDebut: b.is_debut,
      sourceUrl: b.source_url,
      alsoFrom: b.alsoFrom,
    })),
  };
  fs.writeFileSync(path.join(OUT, "fighters", `${slug}.json`), JSON.stringify(detail));

  index.push({
    slug,
    name: f.name,
    kana: f.kana,
    romaji: romajiOf(f),
    kanaType: f.kana_source?.type ?? null,
    gym: f.gym,
    orgs: f.orgs,
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

const stats = {
  fighters: fighters.length,
  fightersWithBouts: withBouts,
  boutRows: totalBoutRows,
  // 「戦績」として数えるのは実施済みのみ。scheduled(K-1の未実施の予定試合)は別建てにする。
  boutRowsCompleted: totalBoutRows - scheduledRows,
  boutRowsScheduled: scheduledRows,
  boutRowsRaw: allBouts.length,
  mergedDuplicateRows: mergedRows,
  unmatchedBouts,
  kanaFilled: fighters.filter((f) => f.kana).length,
  kanaMissing: fighters.filter((f) => !f.kana).length,
  kanaConverted: fighters.filter((f) => f.kana_source?.type === "from_romaji").length,
  promotions: boutFiles.map((b) => b.label),
};

const sourceUpdatedAt = updateSourceMeta([
  "data/kick/fighters.json",
  "data/kick/fighters.csv",
  ...boutFiles.map((b) => `data/kick/${b.file}`),
  ...(fs.existsSync(path.join(SRC, "realnames.json")) ? ["data/kick/realnames.json"] : []),
]);

fs.writeFileSync(
  path.join(OUT, "index.json"),
  JSON.stringify({ stats, fighters: index, sourceUpdatedAt }),
);
fs.writeFileSync(SLUG_MAP_PATH, JSON.stringify(slugMap, null, 1));

// ---------- 検索インデックス(クライアント側の絞り込み専用、最小フィールドのみ) ----------
// 表記名・かな・ローマ字・所属・本名(一致キーのみ)の部分一致検索に使う。
// 集計値(戦績数等)は含めずサイズを絞る。realnameは該当者のみキーを持たせる
// (2,482件分nullを並べてサイズを膨らませない)。
const searchIndex = (index as { slug: string; name: string; kana: string | null; romaji: string | null; gym: string | null }[]).map(
  (f) => {
    const realname = realnameBySlug.get(f.slug);
    return { slug: f.slug, name: f.name, kana: f.kana, romaji: f.romaji, gym: f.gym, ...(realname ? { realname } : {}) };
  },
);
fs.mkdirSync(PUBLIC_OUT, { recursive: true });
fs.writeFileSync(path.join(PUBLIC_OUT, "search-index.json"), JSON.stringify(searchIndex));

console.log("[kick] generated", JSON.stringify(stats, null, 1));
console.log(
  `[kick] realnames: 解決${realnameBySlug.size}件 / 未解決${realnameUnresolved}件(計${realnames.length}件)`,
);
