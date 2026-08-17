// PR-G(2026-08-17、修正1): 選手ごとに「外部基準の試合数」と「/kickの掲載数」を突き合わせ、
// 掲載数が外部基準を下回る選手をビルド時に検知するゲート。
//
// ★外部基準の定義変更の経緯: 初版は外部基準として data/kick/bouts_wikipedia.json
// (=/kickの取り込みパイプライン ingest_wikipedia.py が生成した「取り込み済み」行数)を
// 使っていた。これは自分の取り込み結果を自分の掲載結果と比べているだけで、**取り込み漏れ
// そのものを検知できない**(取り込みが漏れていれば基準側も一緒に減るため差分が出ない)。
// 実際、取り込みパイプラインを経由しない独立の再抽出調査(out/kana-leg4-report.md、
// メインworktree)では、Wikipedia記事のある718人で欠落8,375行という、初版ゲートの
// 「差分あり6人」とは全く乖離した規模の欠落が見つかっている。
//
// そのため外部基準を data/kick/kickWikipediaArticleSnapshot.json
// (ja.wikipedia記事の戦績表から、取り込みパイプラインを一切経由せず独立に再抽出した
// 選手ごとの試合数。out/kana-leg4-report.md参照。スナップショットの取り込み経緯は
// 同JSONの `_meta` フィールドに記載)に差し替える。取り込みパイプラインと基準側が
// 完全に独立した実装であるため、取り込み漏れがあれば基準側はそれに引きずられず
// 差分として表面化する。
//
// この定義変更により「差分あり」件数は初版より大幅に増える(むしろ増えて当然、という
// 前提でベースラインを取り直す。ゼロ件を目指すゲートではない)。
//
// 選手名→slugの対応付けは src/lib/kick/nameNormalize.ts の normalizeKickName() で
// 正規化した表記名の完全一致(同名異人が複数いる場合は一意に絞れないため解決しない)で行う。
// 解決できなかった行は「基準なし」とは別に「名前解決不能」として集計し、違反件数には
// 含めない(下記ログ参照)。
import fs from "fs";
import path from "path";
import { normalizeKickName } from "../src/lib/kick/nameNormalize";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");
const GEN = path.join(SRC, "generated");
const BASELINE_PATH = path.join(SRC, "kickCoverageGapBaseline.json");
const SNAPSHOT_PATH = path.join(SRC, "kickWikipediaArticleSnapshot.json");

interface Fighter {
  name: string;
  gym: string | null;
  sources: string[];
}
interface SnapshotRow {
  fighterName: string;
  total: number;
  covered: number;
  missing: number;
  noTableReason: string | null;
}

const fighters: Fighter[] = JSON.parse(fs.readFileSync(path.join(SRC, "fighters.json"), "utf8"));
const identity = (f: Fighter) => `${f.name}|${f.gym ?? ""}|${f.sources[0] ?? ""}`;

const slugMap: Record<string, string> = JSON.parse(fs.readFileSync(path.join(SRC, "slugs.json"), "utf8"));

// 表記名(正規化後)ごとの候補一覧。1件だけならその選手に確定、2件以上(同名異人)は
// 解決不能として扱う(誤リンクと同種の誤結合を避けるため、このゲートでも安全側に倒す)。
const candidatesByNormName = new Map<string, Fighter[]>();
for (const f of fighters) {
  const key = normalizeKickName(f.name);
  const arr = candidatesByNormName.get(key) ?? [];
  arr.push(f);
  candidatesByNormName.set(key, arr);
}

const snapshotDoc: { fighters: SnapshotRow[] } = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));

// スナップショット(kana-leg4、#563の改名反映前に採取)には、PR-18(#554)→#563で
// 恒久化された改名5件(manualOverrides.jsonの renamedFighterWikipediaIdentity)が
// 旧名義のまま残っている。旧名義では現在のfighters.json(新名義)と正規化一致せず
// 「候補0件」で名前解決不能に落ちてしまうため、解決時のみ新名義へ読み替える
// (表示・レポートには元のスナップショット表記名をそのまま使う)。
const manualOverridesPath = path.join(SRC, "manualOverrides.json");
const nameResolveOverrides = new Map<string, string>();
if (fs.existsSync(manualOverridesPath)) {
  const overrides: { renamedFighterWikipediaIdentity?: { oldFighterName: string; newFighterName: string }[] } =
    JSON.parse(fs.readFileSync(manualOverridesPath, "utf8"));
  for (const r of overrides.renamedFighterWikipediaIdentity ?? []) {
    nameResolveOverrides.set(normalizeKickName(r.oldFighterName), r.newFighterName);
  }
}

const index = JSON.parse(fs.readFileSync(path.join(GEN, "index.json"), "utf8"));
const boutCountBySlug = new Map<string, number>(
  (index.fighters as { slug: string; boutCount: number }[]).map((f) => [f.slug, f.boutCount]),
);

interface Gap {
  slug: string;
  fighterName: string;
  externalTotal: number;
  mnewsCount: number;
}
const gaps: Gap[] = [];
let okCount = 0;
let noTableCount = 0; // total===0(記事に戦績表そのものが無い、比較対象外)
let nameUnresolvedCount = 0; // 表記名が0件または2件以上ヒット(同名異人含む)し、slugを一意に決められなかった行

const unresolvedSamples: string[] = [];

for (const row of snapshotDoc.fighters) {
  if (row.total === 0) {
    noTableCount++;
    continue;
  }
  const resolveName = nameResolveOverrides.get(normalizeKickName(row.fighterName)) ?? row.fighterName;
  const candidates = candidatesByNormName.get(normalizeKickName(resolveName)) ?? [];
  if (candidates.length !== 1) {
    nameUnresolvedCount++;
    if (unresolvedSamples.length < 20) {
      unresolvedSamples.push(`${row.fighterName}(候補${candidates.length}件)`);
    }
    continue;
  }
  const slug = slugMap[identity(candidates[0])];
  if (!slug) {
    nameUnresolvedCount++;
    if (unresolvedSamples.length < 20) unresolvedSamples.push(`${row.fighterName}(slug未採番)`);
    continue;
  }
  const mnews = boutCountBySlug.get(slug) ?? 0;
  if (row.total > mnews) {
    gaps.push({ slug, fighterName: row.fighterName, externalTotal: row.total, mnewsCount: mnews });
  } else {
    okCount++;
  }
}

// 診断用(ゲート判定には使わない): #563がWikipedia到達母集団を718→833人へ拡張したため、
// 現行の外部基準スナップショット(leg3/leg4方式、718人固定)がカバーしていない人数を
// 参考表示する。この+115人前後は「独立再抽出(kana-leg4方式)がまだ行われていない」層で
// あり、スナップショットに含める場合はbouts_wikipedia.json(パイプライン自身の出力)を
// 使うしかなく、それは修正1で排除した循環参照を再導入することになるため、本ゲートでは
// 意図的に対象外のままにしている(詳細はout/kick-silent-failure-gates-report.md参照)。
{
  const popPath = path.join(ROOT, "scripts/standup-pipeline/coverage_population.json");
  if (fs.existsSync(popPath)) {
    const pop: { name: string }[] = JSON.parse(fs.readFileSync(popPath, "utf8"));
    const snapNames = new Set(snapshotDoc.fighters.map((f) => f.fighterName));
    const notInSnapshot = pop.filter((p) => !snapNames.has(p.name)).length;
    console.log(
      `[kick-coverage-gap] 参考(ゲート対象外): coverage_population.json(#563時点${pop.length}人)のうち` +
        `外部基準スナップショット(${snapshotDoc.fighters.length}人)に含まれない人数 = ${notInSnapshot}人` +
        `(独立再抽出が未実施の層、次PRへの申し送り)`,
    );
  }
}

console.log(
  `[kick-coverage-gap] 外部基準スナップショット${snapshotDoc.fighters.length}人中: ` +
    `戦績表なし${noTableCount}人(比較対象外) / 名前解決不能${nameUnresolvedCount}人(比較対象外) / ` +
    `比較実施${okCount + gaps.length}人(一致${okCount}人・差分あり${gaps.length}人)`,
);
if (unresolvedSamples.length) {
  console.log(`[kick-coverage-gap] 名前解決不能の例: ${unresolvedSamples.join(", ")}`);
}

const prevBaseline: number = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).gapCount
  : gaps.length;

if (gaps.length > prevBaseline) {
  console.error(
    `[kick-coverage-gap] ★掲載数が外部基準(ja.wikipedia記事の戦績表、取り込みパイプライン非経由の` +
      `独立再抽出)を下回る選手が前回ビルド時点の基準(${prevBaseline}人)から${gaps.length}人に` +
      `増加しました。デプロイをブロックします:\n` +
      gaps
        .slice(0, 30)
        .map((g) => `  - ${g.slug}(${g.fighterName}): 外部基準${g.externalTotal}試合 > 掲載${g.mnewsCount}試合`)
        .join("\n"),
  );
  process.exit(1);
}

fs.writeFileSync(
  BASELINE_PATH,
  JSON.stringify(
    {
      gapCount: gaps.length,
      _diagnostics: {
        snapshotFighters: snapshotDoc.fighters.length,
        noTableCount,
        nameUnresolvedCount,
        okCount,
        note: "gapCountのみがゲート判定(ratchet)に使われる。他のフィールドは直近実行時点の参考値。",
      },
    },
    null,
    1,
  ) + "\n",
);
console.log(`[kick-coverage-gap] OK(差分あり${gaps.length}人、基準${prevBaseline}人以下)`);
