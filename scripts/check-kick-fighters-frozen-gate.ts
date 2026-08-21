// 2026-08-21新設: /kick 週次自動更新ジョブ(.github/workflows/update-kick-data.yml)は
// 選手名簿(data/kick/fighters.json・fighters.csv)を再生成しない(=凍結、RIZIN・
// Wikipedia・NKB旧サイトと同じ扱い)。scripts/standup-pipeline/build.pyの
// SKIP_FROZEN_SOURCES=1が名簿生成(generate_roster.py)自体を呼ばないことでこれを
// 実現しているが、コード側の防御だけでは「promote_to_data_kick.py等の別経路から
// 無言で書き換わる」というクラスの回帰を検知できない。このゲートは、Gitの直前コミット
// (HEAD)と現在のワークツリーでこの2ファイルが1バイトも変わっていないことを直接
// 検証する(内容の意味比較ではなくバイト比較、名簿の無言の巻き戻り・意図しない
// 再生成のどちらも同じ形で検知できる)。
//
// 対象を広げない: fighters.json/fighters.csvの2ファイルのみを見る。data/kick/配下の
// 他ファイル(bouts_*.json等)は毎週更新されるのが正常な挙動のため対象外。
//
// このゲートが落ちた場合: 名簿が変化した理由を確認すること。意図した名簿更新
// (人間の判断でcache/配下を更新し、generate_roster.pyを再度呼んだ場合)であれば
// このゲート自体を無効化するのではなく、週次自動更新ジョブのスコープ外の別作業として
// 扱うこと(名簿の自動拡張はこのジョブのスコープ外という前提が変わっていないため)。
//
// 実行方法: npx tsx scripts/check-kick-fighters-frozen-gate.ts
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const TARGETS = ["data/kick/fighters.json", "data/kick/fighters.csv"];

function headContent(relPath: string): Buffer | null {
  try {
    return execFileSync("git", ["show", `HEAD:${relPath}`], { cwd: ROOT, maxBuffer: 1024 * 1024 * 64 });
  } catch {
    return null; // HEADに存在しない(新規ファイル等)場合はnull扱い
  }
}

const diffs: string[] = [];
for (const rel of TARGETS) {
  const headBuf = headContent(rel);
  const currentPath = path.join(ROOT, rel);
  const currentBuf = fs.existsSync(currentPath) ? fs.readFileSync(currentPath) : null;
  if (headBuf === null && currentBuf === null) continue;
  if (headBuf === null || currentBuf === null || !headBuf.equals(currentBuf)) {
    diffs.push(
      `${rel}: HEAD=${headBuf ? `${headBuf.length}bytes` : "(無し)"} 現在=${currentBuf ? `${currentBuf.length}bytes` : "(無し)"}`,
    );
  }
}

if (diffs.length > 0) {
  console.error(
    "[kick-fighters-frozen] ★選手名簿(fighters.json/fighters.csv)がHEADコミット時点から変化しています。" +
      "週次自動更新ジョブはこの2ファイルを凍結対象とし再生成しない設計のため、これは想定外の変化です:\n" +
      diffs.map((d) => `  - ${d}`).join("\n"),
  );
  process.exit(1);
}

console.log("[kick-fighters-frozen] OK(fighters.json/fighters.csvはHEADコミット時点から1バイトも変化なし)");
