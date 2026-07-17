// デプロイ前ゲート: src/app/**のexport const revalidateがリテラル数値(またはfalse)
// であることを検査する。定数importを代入するとNext.jsがページセグメントconfigを
// 静的解析できず「can't recognize the exported `config` field」でビルドが壊れる
// (2026-07-13〜07-16、/rankings系の2ファイルで実際に発生した回帰)。
//
// 判定は正規表現ベースの簡易チェック(tscの型情報を使わない)。目的は「importした
// 識別子を代入する」典型的な回帰パターンの再発防止であり、リテラル以外の値
// (計算式・関数呼び出し等)も同様にNext.jsの制約に反するため一律ブロックする。
import fs from "fs";
import path from "path";

const APP_DIR = path.join(process.cwd(), "src", "app");
const REVALIDATE_RE = /^export const revalidate = (.+);\s*$/m;
const LITERAL_RE = /^-?\d+$|^false$/;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function main() {
  if (!fs.existsSync(APP_DIR)) return;

  const violations: string[] = [];
  for (const file of walk(APP_DIR)) {
    const content = fs.readFileSync(file, "utf8");
    const match = content.match(REVALIDATE_RE);
    if (!match) continue;
    const value = match[1].trim();
    if (!LITERAL_RE.test(value)) {
      violations.push(`${path.relative(process.cwd(), file)}: revalidate = ${value}`);
    }
  }

  if (violations.length) {
    console.error(
      `[revalidateリテラル検査] ★リテラル値ではないrevalidate指定を検出(${violations.length}件)。デプロイをブロックします:\n  ${violations.join("\n  ")}\n` +
        `Next.jsのページセグメントconfigは静的解析のみでリテラル値しか認識できません。定数importではなく数値(またはfalse)を直接指定してください。`
    );
    process.exit(1);
  }

  console.log("[revalidateリテラル検査] OK");
}

main();
