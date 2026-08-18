// PR#580フォローアップ②⑤: check-kick-one-official-source-precedence.ts(PR#580で新設)は
// data/kick/oneOfficialSourceRegistry.jsonに個別登録した「既知の3試合」だけを検査する
// ゼロ件ゲートであり、それ以外の選手(one_official_manifest.jsonに載っている全106人)の
// ONE公式データが丸ごと消失しても検知できないことが実測で確認された(2026-08-18、
// bouts_one.jsonを空にして検証: 登録3件は検知したが、未登録分は無検知のまま
// ビルドが通ってしまった)。
//
// このゲートはその穴を塞ぐ、欠落側に発火する2つのratchet:
//
// ★スコープの限界(重要、必ず読むこと): このゲートは `for (const entry of manifest)` で
// one_official_manifest.json**に既に登録されている選手だけ**を走査する。「manifestに
// 登録されていないが、実際にはONE公式プロフィールを持つ選手がいる」ケースを見つける
// ロジックは存在しない。つまり和島大海・安保瑠輝也が最初に抱えていた欠陥(ONE公式に
// プロフィールが実在するのに取得母集団に含まれておらずWikipedia出典のままになる)と
// **全く同じクラスの欠陥は、このゲート導入後も依然として無検知のまま**である。
// 新しく日本人選手がONEデビューし、かつcountry=jpタグの対象にもならない場合(①で
// 実測済みの通りこのタグ自体が非網羅)、その選手の欠落を機械的に検知する手段は
// 現状存在しない。この穴を塞ぐには「Wikipedia側でtarget_org=ONE Championshipの
// 選手全員」対「manifest登録選手」の突合を行う別ロジックが必要だが、本PRのスコープ外
// として実装していない。
//
// 検査A(zeroOfficialCount): one_official_manifest.json に登録された選手(=ONE公式に
// 戦績表が存在すると確認済み)のうち、生成データ上でONE公式(onefc.com)由来のbout行が
// 1件も無い選手の数。「promotion==='ONE Championship'」ではなく「sourceUrl または
// alsoFromにonefc.comが含まれるか」で判定する(実測で判明: RISE公式等、他団体側でも
// 同じクロスオーバー興行の結果を掲載しているケースがあり、dedupe()はboutFiles宣言順で
// 先に処理された団体のpromotionラベルを維持する。例: 髙橋聖人のONE Friday Fights 117
// はRISE公式データが先に処理されるため最終的にpromotion:"RISE"のまま残り、
// promotion==='ONE Championship'だけで判定すると「消失した」と誤検知する。
// alsoFromには取得元のonefc.com URLがちゃんと残っているため、これを見れば
// 誤検知を避けられる)。manifest登録済みなのに丸ごと0件は「取得パイプラインが
// 壊れて選手ごと消失した」ことを強く示唆する(プロフィールにキックボクシング/
// ムエタイの試合が実際に0件だった場合もここに入りうるため、現状値をratchetの
// 基準にする。ゼロを強制しない。実測では4人がこれに該当し、いずれも取得した
// プロフィールに対象スポーツの試合が無い正当なケースと確認済み)。
//
// 検査B(residualWikipediaCount): 定義は「公式に行が存在する選手(=manifest登録済み)に
// おいて、個別の試合単位でなおWikipedia出典のままの行数」であり、検査Aの「公式に行が
// 丸ごと無い」とは別の指標。対象はONE Championshipのみ(他15ソースは対象外、
// b.promotion === "ONE Championship" でフィルタしている)。参考値: サイト全体では
// ONE Championship×Wikipedia出典の行が63件あるが(2026-08-18時点)、このうち
// manifest登録選手分が21件、manifest未登録選手分が42件で、後者はこのゲートの
// 監視対象外(前述の「スコープの限界」参照)。
// ★これはゼロを目指すゲートではない:
// 実測で確認した通り、ONE公式プロフィールの戦績表自体が選手の全キャリアを表示
// しない(例: 秋元皓貴はWikipediaに2019年からの記録があるが、ONE公式プロフィールの
// 戦績表は2022年11月以降の6試合しか表示しない=公式サイト側の構造的な表示省略。
// GLORY公式で既知の同型事象と同じ)。この構造的な残余を「悪化」と区別するため、
// 現状値(21件、2026-08-18時点)をベースラインとして固定し、**増加のみ**を検知する。
//
// 実行方法: npx tsx scripts/check-kick-one-manifest-coverage.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");
const GEN_FIGHTERS = path.join(SRC, "generated/fighters");
const MANIFEST_PATH = path.join(ROOT, "scripts/standup-pipeline/one_official_manifest.json");
const BASELINE_PATH = path.join(SRC, "kickOneManifestCoverageBaseline.json");

interface ManifestEntry {
  one_slug: string;
  fighter_identity: string;
}
interface Bout {
  promotion: string;
  sourceType: "wikipedia" | null;
  date: string | null;
  opponentName: string;
  sourceUrl: string;
  alsoFrom: string[];
}

const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
// slugs.json は identity -> slug(mnewsの選手ページslug)。ONE公式のURLスラッグ(one_slug)とは別物。
const identityToSlug: Record<string, string> = JSON.parse(fs.readFileSync(path.join(SRC, "slugs.json"), "utf8"));

let zeroOfficialCount = 0;
const zeroOfficialSamples: string[] = [];
let residualWikipediaCount = 0;
const residualSamples: string[] = [];

for (const entry of manifest) {
  const slug = identityToSlug[entry.fighter_identity];
  if (!slug) {
    // fighters.jsonのidentityが変わった(改名等)場合はここに来うるが、この検査の対象外
    // (identity不一致自体は他のゲート(kick-manual-edit-drift等)の管轄)。
    continue;
  }
  const fighterPath = path.join(GEN_FIGHTERS, `${slug}.json`);
  if (!fs.existsSync(fighterPath)) {
    zeroOfficialCount++;
    zeroOfficialSamples.push(`${slug}(選手ファイル自体が無い)`);
    continue;
  }
  const fighter = JSON.parse(fs.readFileSync(fighterPath, "utf8")) as { bouts: Bout[] };
  const isOnefcBacked = (b: Bout) =>
    (b.sourceUrl ?? "").includes("onefc.com") || (b.alsoFrom ?? []).some((u) => u.includes("onefc.com"));
  const onefcBackedBouts = fighter.bouts.filter(isOnefcBacked);
  if (onefcBackedBouts.length === 0) {
    zeroOfficialCount++;
    zeroOfficialSamples.push(`${slug}(onefc.com由来のbout行が0件)`);
  }
  const oneBouts = fighter.bouts.filter((b) => b.promotion === "ONE Championship");
  for (const b of oneBouts) {
    if (b.sourceType === "wikipedia") {
      residualWikipediaCount++;
      if (residualSamples.length < 30) residualSamples.push(`${slug} ${b.date ?? "date不明"} vs ${b.opponentName}`);
    }
  }
}

const prevBaseline: { zeroOfficialCount: number; residualWikipediaCount: number } = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"))
  : { zeroOfficialCount, residualWikipediaCount };

const violations: string[] = [];
if (zeroOfficialCount > prevBaseline.zeroOfficialCount) {
  violations.push(
    `検査A(公式行が丸ごと0件の選手数): ${zeroOfficialCount}人 > 前回基準${prevBaseline.zeroOfficialCount}人\n` +
      `    例: ${zeroOfficialSamples.slice(0, 10).join(", ")}`,
  );
}
if (residualWikipediaCount > prevBaseline.residualWikipediaCount) {
  violations.push(
    `検査B(公式ソース確認済み選手の残存Wikipedia出典行数): ${residualWikipediaCount}件 > ` +
      `前回基準${prevBaseline.residualWikipediaCount}件\n    例: ${residualSamples.slice(0, 10).join(", ")}`,
  );
}

if (violations.length) {
  console.error(
    `[kick-one-manifest-coverage] ★one_official_manifest.json登録選手のONE公式データ` +
      `カバレッジが悪化しています。デプロイをブロックします:\n` +
      violations.map((v) => `  - ${v}`).join("\n") +
      `\n  対処法: scripts/standup-pipeline/bouts_one.json が最新か、` +
      `fetch_one_manifest_pages.py の再実行結果と同期しているか確認してください。`,
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ zeroOfficialCount, residualWikipediaCount }, null, 1) + "\n");
console.log(
  `[kick-one-manifest-coverage] OK(manifest${manifest.length}人中、公式行0件=${zeroOfficialCount}人、` +
    `残存Wikipedia出典=${residualWikipediaCount}件、いずれも基準以下)`,
);
