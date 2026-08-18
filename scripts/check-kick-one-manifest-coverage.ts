// PR#580フォローアップ②⑤: check-kick-one-official-source-precedence.ts(PR#580で新設)は
// data/kick/oneOfficialSourceRegistry.jsonに個別登録した「既知の3試合」だけを検査する
// ゼロ件ゲートであり、それ以外の選手(one_official_manifest.jsonに載っている全106人)の
// ONE公式データが丸ごと消失しても検知できないことが実測で確認された(2026-08-18、
// bouts_one.jsonを空にして検証: 登録3件は検知したが、未登録分は無検知のまま
// ビルドが通ってしまった)。
//
// このゲートはその穴を塞ぐ、欠落側に発火する3つの検査:
//
// PR#584(⑦⑧)追記: 上記の限界(「manifestに登録されていないが実際にはONE公式
// プロフィールを持つ選手がいる」ケースを検知できない)を塞ぐため、検査C
// (unregisteredWithOneBouts)を追加した。生成データ全体をスキャンし、
// 「manifest未登録なのにONE Championship行を持つ選手」を洗い出し、
// data/kick/oneUnregisteredExceptionsRegistry.json に理由付きで登録された
// 既知の例外を除いて**ゼロ件**をratchetする(検査A・Bと異なり、検査Cは現状値を
// 基準にせず常にゼロを要求する)。これにより「ONE公式ページが実在するのに
// 取得母集団から漏れる」欠陥クラス(和島大海・安保瑠輝也の当初の欠陥と同じ)を
// 機械検知できるようになった。ただし検査Cが対象にできるのは「Wikipedia出典等
// 何らかの経路で既にmnewsのデータに取り込まれている選手」に限られる(検査対象は
// data/kick/generated/fighters/の既存ファイルのスキャンのため)。ONE公式にしか
// プロフィールが無くWikipedia側にも一切情報が無い選手(=mnewsが一度も認知して
// いない選手)はこの検査でも検知できない、という限界は残る。
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

const EXCEPTIONS_PATH = path.join(SRC, "oneUnregisteredExceptionsRegistry.json");

const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
// slugs.json は identity -> slug(mnewsの選手ページslug)。ONE公式のURLスラッグ(one_slug)とは別物。
const identityToSlug: Record<string, string> = JSON.parse(fs.readFileSync(path.join(SRC, "slugs.json"), "utf8"));
const slugToIdentity: Record<string, string> = Object.fromEntries(
  Object.entries(identityToSlug).map(([identity, slug]) => [slug, identity]),
);
const manifestIdentities = new Set(manifest.map((m) => m.fighter_identity));
interface ExceptionEntry {
  fighterIdentity: string;
  reason: string;
  detail: string;
}
const exceptions: { knownExceptions: ExceptionEntry[] } = JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, "utf8"));
const exceptionIdentities = new Set(exceptions.knownExceptions.map((e) => e.fighterIdentity));

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

// 検査C(unregisteredWithOneBouts): 生成データ全体をスキャンし、manifest未登録なのに
// ONE Championship行を持つ選手を洗い出す。oneUnregisteredExceptionsRegistry.jsonに
// 理由付きで登録済みの選手を除き、**常にゼロ**を要求する(検査A・Bと異なりratchetの
// 基準値を持たない)。
const unregisteredWithOneBouts: string[] = [];
for (const file of fs.readdirSync(GEN_FIGHTERS)) {
  const slug = file.replace(/\.json$/, "");
  const identity = slugToIdentity[slug];
  if (identity && manifestIdentities.has(identity)) continue; // manifest登録済み
  if (identity && exceptionIdentities.has(identity)) continue; // 既知の例外として説明済み
  const fighter = JSON.parse(fs.readFileSync(path.join(GEN_FIGHTERS, file), "utf8")) as {
    name: string;
    bouts: Bout[];
  };
  const oneBouts = fighter.bouts.filter((b) => b.promotion === "ONE Championship");
  if (oneBouts.length > 0) {
    unregisteredWithOneBouts.push(`${slug}(${fighter.name}, ${oneBouts.length}件)`);
  }
}

const prevBaseline: { zeroOfficialCount: number; residualWikipediaCount: number } = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"))
  : { zeroOfficialCount, residualWikipediaCount };

const violations: string[] = [];
if (unregisteredWithOneBouts.length > 0) {
  violations.push(
    `検査C(manifest未登録なのにONE Championship行を持つ選手): ${unregisteredWithOneBouts.length}人 > 基準0人\n` +
      `    ${unregisteredWithOneBouts.slice(0, 20).join(", ")}`,
  );
}
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
    `[kick-one-manifest-coverage] ★ONE公式データのカバレッジが悪化しています。` +
      `デプロイをブロックします:\n` +
      violations.map((v) => `  - ${v}`).join("\n") +
      `\n  対処法(検査A・B): scripts/standup-pipeline/bouts_one.json が最新か、` +
      `fetch_one_manifest_pages.py の再実行結果と同期しているか確認してください。` +
      `\n  対処法(検査C): 該当選手にONE公式プロフィールが実在するか確認し、実在するなら` +
      `one_official_manifest.jsonへ追加してfetch_one_manifest_pages.pyを再実行、` +
      `実在しないなら理由付きでdata/kick/oneUnregisteredExceptionsRegistry.jsonへ登録してください。`,
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ zeroOfficialCount, residualWikipediaCount }, null, 1) + "\n");
console.log(
  `[kick-one-manifest-coverage] OK(manifest${manifest.length}人中、公式行0件=${zeroOfficialCount}人、` +
    `残存Wikipedia出典=${residualWikipediaCount}件、manifest未登録なのにONE行を持つ選手=` +
    `${unregisteredWithOneBouts.length}人、いずれも基準以下)`,
);
