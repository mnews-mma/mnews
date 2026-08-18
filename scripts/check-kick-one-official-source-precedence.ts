// PR#580: 和島大海・安保瑠輝也のONE Championship戦が、ONE公式選手プロフィールページ
// (https://www.onefc.com/jp/athletes/{slug}/)に戦績表が存在するにもかかわらず
// Wikipedia出典表示になっていた不具合の再発防止ゲート。
//
// 原因(調査結果): scripts/standup-pipeline/bouts_one.json(ONE公式一次ソース由来)は
// これを全選手に対して回す再現可能なドライバが無く、過去セッションで手動パッチされた
// ものだった(SOURCES.md参照)。和島大海・安保瑠輝也はその母集団に単純に含まれておらず、
// bouts_wikipedia.json側の行(source_type: "wikipedia")だけが残っていた。
//
// 修正: scripts/standup-pipeline/one_official_manifest.json + fetch_one_manifest_pages.py
// が再現可能な取得経路となり、既知の該当選手の公式戦績をbouts_one.jsonへ追加した。
// このゲートは、data/kick/oneOfficialSourceRegistry.json に登録した「公式ソースが
// 存在すると確認済みの試合」が、ビルドのたびに無言でWikipedia出典へ巻き戻っていないかを
// 検証する(check-kick-manual-edit-drift.tsの検査1と同じレジストリ方式)。
//
// レジストリに新しい選手を追加する場合: one_official_manifest.jsonにONE公式slugを追記し
// fetch_one_manifest_pages.pyを再実行してbouts_one.jsonを更新したうえで、
// oneOfficialSourceRegistry.jsonにも対応する試合を追記すること。
//
// 実行方法: npx tsx scripts/check-kick-one-official-source-precedence.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN_FIGHTERS = path.join(ROOT, "data/kick/generated/fighters");
const REGISTRY_PATH = path.join(ROOT, "data/kick/oneOfficialSourceRegistry.json");

interface RegistryEntry {
  fighterSlug: string;
  date: string;
  opponentName: string;
  reason: string;
  fixedInCommit: string;
}
interface Bout {
  date: string | null;
  opponentName: string;
  promotion: string;
  sourceType: "wikipedia" | null;
}

const registry: { knownOfficialBouts: RegistryEntry[] } = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));

const violations: string[] = [];
for (const entry of registry.knownOfficialBouts) {
  const fighterPath = path.join(GEN_FIGHTERS, `${entry.fighterSlug}.json`);
  if (!fs.existsSync(fighterPath)) {
    violations.push(`${entry.fighterSlug}: 選手ファイル自体が生成されていません(${entry.fixedInCommit}参照)`);
    continue;
  }
  const fighter = JSON.parse(fs.readFileSync(fighterPath, "utf8")) as { bouts: Bout[] };
  const bout = fighter.bouts.find(
    (b) => b.date === entry.date && b.opponentName === entry.opponentName && b.promotion === "ONE Championship",
  );
  if (!bout) {
    violations.push(
      `${entry.fighterSlug} ${entry.date} vs ${entry.opponentName}: 該当試合が見つかりません` +
        `(データごと消失した可能性。${entry.fixedInCommit}参照)`,
    );
    continue;
  }
  if (bout.sourceType === "wikipedia") {
    violations.push(
      `${entry.fighterSlug} ${entry.date} vs ${entry.opponentName}: Wikipedia出典に巻き戻っています` +
        `(${entry.reason} / ${entry.fixedInCommit}参照)`,
    );
  }
}

if (violations.length) {
  console.error(
    `[kick-one-official-source-precedence] ★data/kick/oneOfficialSourceRegistry.json に登録済みの` +
      `公式ソース優先が巻き戻っています。デプロイをブロックします:\n` +
      violations.map((v) => `  - ${v}`).join("\n") +
      `\n  対処法: scripts/standup-pipeline/bouts_one.json に該当試合が残っているか、` +
      `data/kick/bouts_one.json と同期されているか確認してください` +
      `(scripts/standup-pipeline/fetch_one_manifest_pages.py を再実行して復元できます)。`,
  );
  process.exit(1);
}

console.log(
  `[kick-one-official-source-precedence] OK(登録${registry.knownOfficialBouts.length}件、公式ソース優先の巻き戻りなし)`,
);
