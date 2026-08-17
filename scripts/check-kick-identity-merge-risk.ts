// PR-G追補(2026-08、モノニム誤統合監査): 表記名一致だけで複数出典のbout群が
// 1つの選手identityへ結合されている、誤統合の疑いがある選手を検出するゲート。
//
// 実例(この監査で確認・修正した回帰): /kick/fighters/taito(泰斗)は、K-1公式由来
// (2010-12〜2020-09、-65kg級キックボクシング、LEOPARD GYM所属)と、KROSS×OVER公式由来
// (2026-03-01・2026-06-21、KROSS×OVER PRO-MMA -70.3kg級、krossover.jp本文で確認した
// 実際の所属は「高本道場」)が、表記名「泰斗」の一致だけで同一identityに結合されていた。
// 原因は scripts/standup-pipeline/ingest_krossover.py の resolve() 関数が、
// fighters.json内で候補が1件しかない場合、所属・生年月日等の裏取りを一切せずその1件へ
// 確定させる仕様だったため(該当行は同スクリプト参照)。この2boutはMMAルールの試合でも
// あったため、data/kick/manualRuleExclusions.json への追加(category: "mma")で
// 現在は分離済み。詳細調査は out/kick-taito-misidentification-audit.md 参照。
//
// この種の「名前一致だけの結合」はKROSS×OVER以外の識別子ベース結合団体(RIZIN・ONE・
// DEEP☆KICK・NJKF・HoostCup・NKB・Bigbang・Stand up・SNKA・JKA、scripts/build-kick-data.ts
// のboutFiles matchBy:"identity")すべてで構造的に起こりうる。個別修正のたびにモグラ叩きに
// なることを避けるため、「活動年に不自然な空白がある(=同一人物の連続活動としては疑わしい)」
// ことを代理指標としてビルド時に機械検出し、増加を検知するゲートを設ける。
//
// 検出条件(選手ごとに、日付降順の戦績を年ベースでソートし直して評価):
//   1. 連続する2つの活動クラスタ間の空白が5年以上
//   2. 空白の前後で掲載団体(promotion)が変わっている
//   3. 空白の「後」側の団体が、公式サイトの選手ページURLで直接紐付く4団体
//      (SHOOT BOXING/RISE/KNOCK OUT/K-1)ではなく、かつWikipedia由来でもない
//      (=名前一致のみで結合される識別子ベース団体である)
// SHOOT BOXING/RISE/KNOCK OUT/K-1の4団体は選手本人の公式プロフィールURLに直接紐付いて
// おり(matchBy:"sourceUrl")、名前一致リスクが構造的に無い。Wikipedia由来は独立の
// 日付照合ロジック(ingest_wikipedia.py)を経ており、このゲートでは対象外とする
// (別のカバレッジゲート(check-kick-coverage-gap.ts)で扱う領域のため)。
//
// ベースラインはratchet方式(前回ビルド時点の値を基準にし、増加したら失敗)。
// 個別の分離作業(item 2)はこのゲートの対象外(検出のみ)。
//
// 実行方法: npx tsx scripts/check-kick-identity-merge-risk.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");
const BASELINE_PATH = path.join(ROOT, "data/kick/kickIdentityMergeRiskBaseline.json");

const GAP_THRESHOLD_YEARS = 5;
// 公式サイトの選手ページURLに直接紐付く(matchBy:"sourceUrl")、名前一致リスクが無い団体。
const SOURCE_URL_ORGS = new Set(["SHOOT BOXING", "RISE", "KNOCK OUT", "K-1 / Krush / Krush-EX"]);
const isWikipediaLabel = (label: string) => label.startsWith("Wikipedia");

interface Bout {
  date: string | null;
  promotion: string;
}

interface Candidate {
  slug: string;
  name: string;
  gapYears: number;
  before: string;
  after: string;
}

const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));
const candidates: Candidate[] = [];

for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  const dated = (f.bouts as Bout[])
    .filter((b) => b.date)
    .map((b) => ({ year: Number(b.date!.slice(0, 4)), promotion: b.promotion }))
    .sort((a, b) => a.year - b.year);
  if (dated.length < 2) continue;

  for (let i = 1; i < dated.length; i++) {
    const gap = dated[i].year - dated[i - 1].year;
    if (gap < GAP_THRESHOLD_YEARS) continue;
    if (dated[i].promotion === dated[i - 1].promotion) continue;
    const afterIsRisky = !SOURCE_URL_ORGS.has(dated[i].promotion) && !isWikipediaLabel(dated[i].promotion);
    if (!afterIsRisky) continue;
    candidates.push({
      slug: f.slug,
      name: f.name,
      gapYears: gap,
      before: `${dated[i - 1].year}:${dated[i - 1].promotion}`,
      after: `${dated[i].year}:${dated[i].promotion}`,
    });
    break; // 選手1人につき最初に見つかった空白のみ記録(複数箇所あっても1件として数える)
  }
}

console.log(
  `[kick-identity-merge-risk] 検出${candidates.length}件(活動空白${GAP_THRESHOLD_YEARS}年以上+団体変化+` +
    `後続団体が名前一致ベース結合)`,
);

const prevBaseline: number = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).count
  : candidates.length;

if (candidates.length > prevBaseline) {
  console.error(
    `[kick-identity-merge-risk] ★誤統合疑いの選手が前回ビルド時点の基準(${prevBaseline}件)から` +
      `${candidates.length}件に増加しました。デプロイをブロックします:\n` +
      candidates
        .slice(0, 30)
        .map((c) => `  - ${c.slug}(${c.name}): ${c.before} → ${c.after}(空白${c.gapYears}年)`)
        .join("\n") +
      `\n  対処法: 該当選手の出典を個別確認し、別人であればdata/kick/manualRuleExclusions.json` +
      `での除外、または対戦相手名寄せの分離を検討してください。`,
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ count: candidates.length }, null, 1) + "\n");
console.log(`[kick-identity-merge-risk] OK(${candidates.length}件、基準${prevBaseline}件以下)`);
