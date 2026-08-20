// V-4(2026-08-20): data/kick/bouts_*.json(本番ビルドの入力)と
// scripts/standup-pipeline/bouts_*.json(Pythonパイプラインの出力・レビュー用の置き場)は
// 同名16ファイルが二重に存在し、data側だけを手で修正した場合(例: PR#567の
// DEEP☆KICK大会名混入修正)、pipeline側は無言のまま古い値を持ち続ける。パイプラインを
// 再実行してdata側へコピーし直すと、この手修正は無言で巻き戻る。
//
// 検知方法: 両ディレクトリの同名bouts_*.jsonをbout_idキーで突合し、
// 「片方にしか無いbout_id」「同じbout_idでもフィールド値が異なる」の2種のdriftを
// ゼロ件ゲートとして検証する(構築時点で両者は同一のはずのため、baselineは持たない)。
//
// 実行方法: npx tsx scripts/check-kick-pipeline-mirror-sync.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data/kick");
const PIPELINE_DIR = path.join(ROOT, "scripts/standup-pipeline");

interface Bout {
  bout_id: string;
  [key: string]: unknown;
}

function loadBoutMap(filePath: string): Map<string, Bout> {
  const rows: Bout[] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const map = new Map<string, Bout>();
  for (const row of rows) map.set(row.bout_id, row);
  return map;
}

function diffFields(a: Bout, b: Bout): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(key);
  }
  return changed;
}

const dataFiles = fs
  .readdirSync(DATA_DIR)
  .filter((f) => /^bouts_.*\.json$/.test(f))
  .sort();

interface Problem {
  file: string;
  kind: "missing_on_pipeline_side" | "missing_on_data_side" | "field_mismatch";
  detail: string;
}

const problems: Problem[] = [];

for (const file of dataFiles) {
  const dataPath = path.join(DATA_DIR, file);
  const pipelinePath = path.join(PIPELINE_DIR, file);

  if (!fs.existsSync(pipelinePath)) {
    problems.push({
      file,
      kind: "missing_on_pipeline_side",
      detail: `scripts/standup-pipeline/${file} が存在しません`,
    });
    continue;
  }

  const dataMap = loadBoutMap(dataPath);
  const pipelineMap = loadBoutMap(pipelinePath);

  for (const [boutId, dataRow] of dataMap) {
    const pipelineRow = pipelineMap.get(boutId);
    if (!pipelineRow) {
      problems.push({
        file,
        kind: "missing_on_pipeline_side",
        detail: `${boutId} がpipeline側に存在しません`,
      });
      continue;
    }
    const changed = diffFields(dataRow, pipelineRow);
    if (changed.length > 0) {
      problems.push({
        file,
        kind: "field_mismatch",
        detail: `${boutId}: フィールド[${changed.join(", ")}]が食い違い`,
      });
    }
  }

  for (const boutId of pipelineMap.keys()) {
    if (!dataMap.has(boutId)) {
      problems.push({
        file,
        kind: "missing_on_data_side",
        detail: `${boutId} がdata側に存在しません`,
      });
    }
  }
}

if (problems.length > 0) {
  console.error(
    `[kick-pipeline-mirror-sync] ★data/kickとscripts/standup-pipelineの` +
      `bouts_*.jsonミラーに${problems.length}件のdriftがあります。ビルドを失敗させます:\n` +
      problems
        .slice(0, 30)
        .map((p) => `  - ${p.file} [${p.kind}] ${p.detail}`)
        .join("\n") +
      (problems.length > 30 ? `\n  ...他${problems.length - 30}件` : ""),
  );
  process.exit(1);
}

console.log(
  `[kick-pipeline-mirror-sync] OK(data/kickとscripts/standup-pipelineの` +
    `bouts_*.json ${dataFiles.length}ペア全てが一致)`,
);
