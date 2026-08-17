// PR-G(2026-08-17): 選手ごとに「外部基準の試合数」と「/kickの掲載数」を突き合わせ、
// 差が大きい(掲載数が外部基準を下回る)選手をビルド時に検知するゲート。
//
// 外部基準として data/kick/bouts_wikipedia.json を採用する理由:
// - 対象509人(ja.wikipedia個別記事に{{Fight-cont}}戦績表を持つ選手、
//   scripts/standup-pipeline/ingest_wikipedia.py の coverage_population.json)は、
//   選手本人のWikipedia記事が「本人自身の戦績」として明示的に列挙した行数である
//   (target_orgの推定を問わず、その選手の記事に載っている試合の総数)。
// - RIZIN/ONE等の他公式データは名簿の掲載元ではなく戦績専用ソースであり、
//   全選手を横断する「この選手が本来何試合しているか」の独立基準にはならない
//   (名簿に載っている選手の一部にしか戦績が無い)。Wikipediaは選手本人の記事という
//   単位で「この人物の試合数」を明示的に述べている点で、掲載数と直接比較できる。
//
// 判定方法:
// - bouts_wikipedia.json の各行の fighter_slug(identity形式)ごとに行数を数え、
//   fighters.jsonのidentityと一致するもの(=名簿に実在する選手)だけを対象にする
//   (これがその選手の「外部基準の試合数」)。
// - slugs.jsonでidentity→slugへ変換し、data/kick/generated/index.jsonのboutCount
//   (掲載数、build-kick-data.tsが計算した最終値)と比較する。
// - 外部基準の試合数 > 掲載数 の選手を「差分あり」としてカウントする
//   (逆に掲載数の方が多いのは、公式一次ソース側にWikipediaが拾っていない試合が
//   別途あるという正常な状態であり、差分としては数えない)。
// - Wikipedia行が1件も無い選手(外部基準そのものが存在しない)は「基準なし」として
//   別集計にし、違反件数には含めない。
//
// ベースラインはこのスクリプトが自動でratchet(前回ビルド時点の値を基準にし、増加したら
// 失敗・減少/同値なら基準を更新)する。data/kick/unmatchedBoutsBaseline.jsonと同じ方式。
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");
const GEN = path.join(SRC, "generated");
const BASELINE_PATH = path.join(SRC, "kickCoverageGapBaseline.json");

interface Fighter {
  name: string;
  gym: string | null;
  sources: string[];
}
interface WikiBout {
  fighter_slug: string;
}

const fighters: Fighter[] = JSON.parse(fs.readFileSync(path.join(SRC, "fighters.json"), "utf8"));
const identity = (f: Fighter) => `${f.name}|${f.gym ?? ""}|${f.sources[0] ?? ""}`;
const knownIdentities = new Set(fighters.map(identity));

const slugMap: Record<string, string> = JSON.parse(fs.readFileSync(path.join(SRC, "slugs.json"), "utf8"));

const wikiBouts: WikiBout[] = fs.existsSync(path.join(SRC, "bouts_wikipedia.json"))
  ? JSON.parse(fs.readFileSync(path.join(SRC, "bouts_wikipedia.json"), "utf8"))
  : [];

const externalCount = new Map<string, number>();
for (const b of wikiBouts) {
  if (!knownIdentities.has(b.fighter_slug)) continue; // 名簿に実在しない(=この選手自身の記事ではない)行は対象外
  externalCount.set(b.fighter_slug, (externalCount.get(b.fighter_slug) ?? 0) + 1);
}

const index = JSON.parse(fs.readFileSync(path.join(GEN, "index.json"), "utf8"));
const boutCountBySlug = new Map<string, number>(
  (index.fighters as { slug: string; boutCount: number }[]).map((f) => [f.slug, f.boutCount]),
);

interface Gap {
  slug: string;
  externalCount: number;
  mnewsCount: number;
}
const gaps: Gap[] = [];
let noBaselineCount = 0;
let okCount = 0;

for (const [ident, ext] of externalCount) {
  const slug = slugMap[ident];
  if (!slug) continue; // slugが採番されていない(理論上起きない)場合はスキップ
  const mnews = boutCountBySlug.get(slug) ?? 0;
  if (ext > mnews) {
    gaps.push({ slug, externalCount: ext, mnewsCount: mnews });
  } else {
    okCount++;
  }
}
// 「基準なし」= fighters.json全選手のうちWikipedia行を持たない人数(参考値、違反には含めない)。
noBaselineCount = fighters.length - externalCount.size;

console.log(
  `[kick-coverage-gap] 外部基準あり${externalCount.size}人(うち一致${okCount}人・差分あり${gaps.length}人) / 基準なし${noBaselineCount}人`,
);

const prevBaseline: number = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).gapCount
  : gaps.length;

if (gaps.length > prevBaseline) {
  console.error(
    `[kick-coverage-gap] ★掲載数が外部基準(Wikipedia本人記事の戦績表)を下回る選手が` +
      `前回ビルド時点の基準(${prevBaseline}人)から${gaps.length}人に増加しました。デプロイをブロックします:\n` +
      gaps
        .slice(0, 30)
        .map((g) => `  - ${g.slug}: 外部基準${g.externalCount}試合 > 掲載${g.mnewsCount}試合`)
        .join("\n"),
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ gapCount: gaps.length }, null, 1) + "\n");
console.log(`[kick-coverage-gap] OK(差分あり${gaps.length}人、基準${prevBaseline}人以下)`);
