// デプロイ前ゲート: data/fighterRecords.json の内部整合性を検査する。
// package.json の "prebuild" として next build のたびに自動実行されるため、
// ローカルのtsc/build確認・Vercelのデプロイビルドの両方で必ず通る(手動編集と
// 日次バッチ更新の取りこぼしマージ等で紛れ込んだ論理破綻を、人手の再検証に
// 頼らずビルド段階で機械的に検出してブロックする)。
//
// 判定ロジックはscripts/update-fighter-records.tsと共通(checkFighterRecordIntegrity)。
// - fatal(論理破綻。例: 勝ちの決着内訳合計がwinsを超える): デプロイをブロック(exit 1)。
// - warning(stored/history不一致だが単体では矛盾しない。一次ソース未確認の保留
//   ケースを含む): 警告ログのみでデプロイは継続する。全部ブロックすると
//   一次ソース確認中の選手が残る限り永久にデプロイできなくなるため。
//
// 自動修正はしない(検出・停止・ログのみ)。
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { checkFighterRecordIntegrity } from "../src/lib/fighterRecordIntegrity";
import type { FighterRecordsFile } from "../src/lib/fighterRecordsCache";

const DATA_PATH = path.join(process.cwd(), "data", "fighterRecords.json");

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    // 初回セットアップ等でまだバッチが一度も走っていない場合はスキップ
    // (存在しないファイルを理由にビルドをブロックしない)。
    console.log("[整合チェック] data/fighterRecords.json が存在しないためスキップ");
    return;
  }

  let data: FighterRecordsFile;
  try {
    data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch (e) {
    console.error(`[整合チェック] data/fighterRecords.json のJSON解析に失敗: ${e}`);
    process.exit(1);
  }

  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
  const fatals: string[] = [];
  const warnings: string[] = [];

  for (const [slug, entry] of Object.entries(data)) {
    if (entry.noRecordData) continue;
    const nameJa = nameBySlug.get(slug) ?? slug;
    const issue = checkFighterRecordIntegrity(slug, nameJa, entry);
    if (!issue) continue;
    const line = `${issue.slug}(${issue.nameJa}): ${issue.message}`;
    if (issue.severity === "fatal") fatals.push(line);
    else warnings.push(line);
  }

  if (warnings.length) {
    console.warn(
      `[整合チェック] 非破綻の不一致(${warnings.length}件・デプロイは継続、一次ソース確認が必要な保留リスト):\n  ${warnings.join("\n  ")}`
    );
  }

  if (fatals.length) {
    console.error(
      `[整合チェック] ★論理破綻を検出(${fatals.length}件)。デプロイをブロックします:\n  ${fatals.join("\n  ")}`
    );
    process.exit(1);
  }

  console.log(`[整合チェック] OK(fatal: 0件 / warning: ${warnings.length}件)`);
}

main();
