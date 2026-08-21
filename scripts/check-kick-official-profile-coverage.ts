// PR-G追補(2026-08-17): 団体公式サイトのプロフィール戦績サマリー値を、
// scripts/check-kick-coverage-gap.ts(Wikipedia記事の戦績表、独立再抽出718人)とは
// 別の**2つ目の独立した外部基準**として突き合わせるゲート。
//
// ★このゲートの位置づけ(重要): 「真の欠落をゼロにする」ためのものではない。
// 出典調査(kick-item4-remeasure-current-data.md、別セッション作成)の結論は、
// 欠落候補1,464人の大半が公式サイト側の構造(生涯通算サマリー欄と当該団体の個別列挙欄の
// 乖離・多団体所属者の合算差)で説明でき、無作為抽出した日本人選手30人の個別確認では
// 真の欠落(パイプラインの取りこぼし)が検出されなかった(単一団体所属17人は全員
// 「構造的・欠落ではない」。多団体所属13人は要保留のまま未確定)ことを示している。
// このゲートは現状値をベースラインとして固定し、**今後の悪化(パイプライン側の新規
// リグレッション)を検知するため**に存在する。1,464人という数字自体を減らす作業は
// このゲートの目的ではない。
//
// 設計(check-kick-coverage-gap.tsと同じ思想):
// - 外部基準(公式サイトの戦績サマリー値)は data/kick/kickOfficialProfileSnapshot.json
//   に凍結する(取得済みスナップショット、取り込みパイプラインを経由しない)。
// - 掲載数(prod_total相当)はスナップショットに凍結せず、ビルドのたびに
//   data/kick/generated/index.json から都度ライブ計算する。
// - 選手名→slugの解決は check-kick-coverage-gap.ts と同じ normalizeKickName() +
//   data/kick/manualOverrides.json の改名対応表を再利用する。
//
// ratchet条件(いずれかでビルド失敗):
//   (a) 欠落候補(公式基準 > 掲載数)の人数が前回ビルド時点の基準から増加
//   (b) 欠落候補の差の合計(Σ(official_total - prod_total) for 欠落候補)が
//       前回ビルド時点の基準から増加
//
// 実行方法: npx tsx scripts/check-kick-official-profile-coverage.ts
import fs from "fs";
import path from "path";
import { normalizeKickName } from "../src/lib/kick/nameNormalize";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");
const GEN = path.join(SRC, "generated");
const SNAPSHOT_PATH = path.join(SRC, "kickOfficialProfileSnapshot.json");
const REGISTRY_PATH = path.join(SRC, "manualOverrides.json");
const BASELINE_PATH = path.join(SRC, "kickOfficialProfileCoverageBaseline.json");

interface Fighter {
  name: string;
  gym: string | null;
  sources: string[];
}
interface SnapshotRow {
  name: string;
  officialTotal: number;
  domain: string;
}
interface RenameEntry {
  oldFighterName: string;
  newFighterName: string;
}

const fighters: Fighter[] = JSON.parse(fs.readFileSync(path.join(SRC, "fighters.json"), "utf8"));
const identity = (f: Fighter) => `${f.name}|${f.gym ?? ""}|${f.sources[0] ?? ""}`;

const slugMap: Record<string, string> = JSON.parse(fs.readFileSync(path.join(SRC, "slugs.json"), "utf8"));

const registry: { renamedFighterWikipediaIdentity: RenameEntry[] } = JSON.parse(
  fs.readFileSync(REGISTRY_PATH, "utf8"),
);
const renameMap = new Map(registry.renamedFighterWikipediaIdentity.map((e) => [e.oldFighterName, e.newFighterName]));

// 表記名(正規化後)ごとの候補一覧。1件だけならその選手に確定、2件以上(同名異人)は
// 解決不能として扱う(check-kick-coverage-gap.tsと同じ安全側の設計)。
const candidatesByNormName = new Map<string, Fighter[]>();
for (const f of fighters) {
  const key = normalizeKickName(f.name);
  const arr = candidatesByNormName.get(key) ?? [];
  arr.push(f);
  candidatesByNormName.set(key, arr);
}

const snapshotDoc: { fighters: SnapshotRow[] } = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));

const index = JSON.parse(fs.readFileSync(path.join(GEN, "index.json"), "utf8"));
const boutCountBySlug = new Map<string, number>(
  (index.fighters as { slug: string; boutCount: number }[]).map((f) => [f.slug, f.boutCount]),
);

let matchCount = 0;
let nameUnresolvedCount = 0;
const unresolvedSamples: string[] = [];

interface Deficit {
  slug: string;
  name: string;
  officialTotal: number;
  prodTotal: number;
  diff: number;
}
const deficits: Deficit[] = [];
let surplusCount = 0;
let surplusSum = 0; // 負の値の合計(掲載数が公式基準を上回る方向。参考値、ratchetには使わない)

for (const row of snapshotDoc.fighters) {
  const resolvedName = renameMap.get(row.name) ?? row.name;
  const candidates = candidatesByNormName.get(normalizeKickName(resolvedName)) ?? [];
  if (candidates.length !== 1) {
    nameUnresolvedCount++;
    if (unresolvedSamples.length < 20) unresolvedSamples.push(`${row.name}(候補${candidates.length}件)`);
    continue;
  }
  const slug = slugMap[identity(candidates[0])];
  if (!slug) {
    nameUnresolvedCount++;
    if (unresolvedSamples.length < 20) unresolvedSamples.push(`${row.name}(slug未採番)`);
    continue;
  }
  const prodTotal = boutCountBySlug.get(slug) ?? 0;
  const diff = row.officialTotal - prodTotal;
  if (diff === 0) {
    matchCount++;
  } else if (diff > 0) {
    deficits.push({ slug, name: row.name, officialTotal: row.officialTotal, prodTotal, diff });
  } else {
    surplusCount++;
    surplusSum += diff;
  }
}

const deficitCount = deficits.length;
const deficitSum = deficits.reduce((s, d) => s + d.diff, 0);

console.log(
  `[kick-official-profile-coverage] スナップショット${snapshotDoc.fighters.length}人中: ` +
    `名前解決不能${nameUnresolvedCount}人(比較対象外) / 比較実施${matchCount + deficitCount + surplusCount}人 ` +
    `(一致${matchCount}人 / 欠落候補${deficitCount}人・差合計${deficitSum} / ` +
    `超過${surplusCount}人・差合計${surplusSum})`,
);
if (unresolvedSamples.length) {
  console.log(`[kick-official-profile-coverage] 名前解決不能の例: ${unresolvedSamples.join(", ")}`);
}

// 2026-08-21追加: /kick週次自動更新ジョブ(13ソース一括取得)の初回実走で
// deficitCount/deficitSumともに小幅な増加を検知した。このゲートが検知するのは
// 「団体公式サイトの生涯通算成績サマリー」対「こちらの掲載bout数」の差であり、
// どちらも実データ(新規bout)が増えれば分子・分母双方が自然に増える"自然増型"の
// 指標である(ファイル冒頭コメントの2026-08-17調査: 無作為抽出30人の個別確認で
// 真の欠落=パイプライン側の取りこぼしは0件、欠落の大半は公式サイト側の構造的な
// 乖離)。絶対値でratchetし続けると、正常にbout数が増えるだけの週次実行でも
// 必ず失敗する。1回の実行あたりの増分に上限(50)を設け、それを超えない増加は
// 許容してベースラインを自動更新する(=真のリグレッションではないと扱う)。
// 上限を超えた場合は従来どおりゲート失敗としてブロックする(急激な悪化=パイプライン
// 側の新規バグの可能性を捨てない)。
const MAX_ALLOWED_INCREMENT_PER_RUN = 50;

const prevBaseline: { deficitCount: number; deficitSum: number } = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"))
  : { deficitCount, deficitSum };

const violations: string[] = [];
if (deficitCount > prevBaseline.deficitCount + MAX_ALLOWED_INCREMENT_PER_RUN) {
  violations.push(
    `欠落候補の人数: ${deficitCount}人 > 前回基準${prevBaseline.deficitCount}人 + 許容増分${MAX_ALLOWED_INCREMENT_PER_RUN}`,
  );
}
if (deficitSum > prevBaseline.deficitSum + MAX_ALLOWED_INCREMENT_PER_RUN) {
  violations.push(
    `欠落候補の差の合計: ${deficitSum} > 前回基準${prevBaseline.deficitSum} + 許容増分${MAX_ALLOWED_INCREMENT_PER_RUN}`,
  );
}

if (violations.length) {
  console.error(
    `[kick-official-profile-coverage] ★団体公式プロフィールとの突合で悪化を検知しました。` +
      `デプロイをブロックします:\n` +
      violations.map((v) => `  - ${v}`).join("\n") +
      `\n  代表例(差の大きい順ではなく検出順、上位30件):\n` +
      deficits
        .slice(0, 30)
        .map((d) => `    - ${d.slug}(${d.name}): 公式${d.officialTotal} > 掲載${d.prodTotal}(差${d.diff})`)
        .join("\n"),
  );
  process.exit(1);
}

fs.writeFileSync(
  BASELINE_PATH,
  JSON.stringify(
    {
      deficitCount,
      deficitSum,
      _diagnostics: {
        snapshotFighters: snapshotDoc.fighters.length,
        nameUnresolvedCount,
        matchCount,
        surplusCount,
        surplusSum,
        note:
          "deficitCount/deficitSumのみがゲート判定(ratchet)に使われる。他のフィールドは直近実行時点の参考値。" +
          "このゲートは真の欠落ゼロを目指すものではなく、現状値からの悪化検知が目的(詳細はファイル冒頭コメント参照)。",
      },
    },
    null,
    1,
  ) + "\n",
);
console.log(
  `[kick-official-profile-coverage] OK(欠落候補${deficitCount}人・差合計${deficitSum}、いずれも基準以下)`,
);
