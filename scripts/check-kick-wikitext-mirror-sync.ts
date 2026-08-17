// PR-G(2026-08-17、修正2): scripts/lib/kickWikitextMirror.ts は
// scripts/standup-pipeline/ingest_wikipedia.py の find_fight_cont_blocks() /
// _strip_cell_attrs() をTypeScriptへ手動移植したもの(npm run buildをPython実行に
// 依存させない設計上の理由。詳細はkickWikitextMirror.tsのコメント参照)。
//
// 手動移植である以上、「Python側だけが変更されてもTS側は自動的には追随しない」という
// 構造的なリスクが常にある。このゲートは、Python側の該当2関数のテキストをハッシュ化して
// 記録しておき、ビルドのたびに現在のPythonファイルから再抽出したハッシュと突合することで、
// **Python側だけが変更されたことを機械的に検知**する(TS側が実際に追随したかまでは
// 判定できないが、「気づかず放置される」ことは防げる)。
//
// ファイル全体のハッシュにしない理由: ingest_wikipedia.pyは他の関数(母集団判定・
// 団体推定等)も含む大きなファイルで、対象2関数と無関係な変更(#563のような欠陥修正・
// 機能追加)のたびに毎回ゲートが落ちるとノイズになり、本来検知したい変更(対象2関数への
// 変更)が埋もれる。対象関数のテキストだけを抽出してハッシュ化する。
//
// ベースラインの更新方法: 通常のビルドではこのスクリプトは更新しない(ratchet系の
// 他ゲートと異なり、自動での「良い方向への更新」という概念が無いため)。Python側の
// 対象関数を変更した場合は、kickWikitextMirror.ts側も同じ修正が必要か確認し、
// 必要な修正を両方に入れたうえで `UPDATE_KICK_MIRROR_SYNC_BASELINE=1` を付けて
// このスクリプトを再実行し、記録用ハッシュを更新してコミットすること。
//
// 実行方法: npx tsx scripts/check-kick-wikitext-mirror-sync.ts
//          (ベースライン更新時) UPDATE_KICK_MIRROR_SYNC_BASELINE=1 npx tsx scripts/check-kick-wikitext-mirror-sync.ts
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { extractPyFunction } from "./lib/extractPyFunction";

const ROOT = path.join(__dirname, "..");
const PY_FILE = path.join(ROOT, "scripts/standup-pipeline/ingest_wikipedia.py");
const BASELINE_PATH = path.join(ROOT, "data/kick/kickWikitextMirrorSyncBaseline.json");

// TS側の移植(scripts/lib/kickWikitextMirror.ts)が対応しているPython関数の一覧。
// TS側に新しい移植を追加した場合はここにも追記すること。
const TARGET_FUNCTIONS = ["find_fight_cont_blocks", "_strip_cell_attrs"];

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

const pySource = fs.readFileSync(PY_FILE, "utf8");

const current: Record<string, { hash: string; text: string }> = {};
const extractionErrors: string[] = [];
for (const name of TARGET_FUNCTIONS) {
  const text = extractPyFunction(pySource, name);
  if (text === null) {
    extractionErrors.push(name);
    continue;
  }
  current[name] = { hash: sha256(text), text };
}

if (extractionErrors.length) {
  console.error(
    `[kick-wikitext-mirror-sync] ★ingest_wikipedia.pyから次の関数を抽出できませんでした` +
      `(関数名の変更・削除の可能性があります): ${extractionErrors.join(", ")}\n` +
      "  scripts/lib/kickWikitextMirror.ts・scripts/check-kick-wikitext-mirror-sync.ts の対象関数名を確認してください。",
  );
  process.exit(1);
}

const shouldUpdate = process.env.UPDATE_KICK_MIRROR_SYNC_BASELINE === "1";

if (!fs.existsSync(BASELINE_PATH) || shouldUpdate) {
  const doc = Object.fromEntries(TARGET_FUNCTIONS.map((name) => [name, current[name]]));
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 1) + "\n");
  console.log(
    `[kick-wikitext-mirror-sync] ${shouldUpdate ? "更新" : "新規作成"}: ` +
      `data/kick/kickWikitextMirrorSyncBaseline.json (対象: ${TARGET_FUNCTIONS.join(", ")})`,
  );
  process.exit(0);
}

const baseline: Record<string, { hash: string; text: string }> = JSON.parse(
  fs.readFileSync(BASELINE_PATH, "utf8"),
);

const changed = TARGET_FUNCTIONS.filter((name) => baseline[name]?.hash !== current[name].hash);

if (changed.length) {
  console.error(
    `[kick-wikitext-mirror-sync] ★scripts/standup-pipeline/ingest_wikipedia.py の次の関数が、` +
      `記録済みのハッシュから変更されています: ${changed.join(", ")}\n` +
      "  scripts/lib/kickWikitextMirror.ts(TS移植)も同じ修正が必要か確認し、" +
      "必要であれば両方直したうえで、以下のコマンドで記録ハッシュを更新してコミットしてください:\n" +
      "    UPDATE_KICK_MIRROR_SYNC_BASELINE=1 npx tsx scripts/check-kick-wikitext-mirror-sync.ts\n" +
      changed
        .map(
          (name) =>
            `  --- ${name} (記録済み) ---\n${baseline[name]?.text ?? "(記録なし)"}\n` +
            `  --- ${name} (現在) ---\n${current[name].text}`,
        )
        .join("\n"),
  );
  process.exit(1);
}

console.log(`[kick-wikitext-mirror-sync] OK(対象関数${TARGET_FUNCTIONS.length}件、Python側の変更なし)`);
