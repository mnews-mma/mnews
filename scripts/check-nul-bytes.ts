// デプロイ前ゲート(ゼロ件): ソースファイルにリテラルのNULバイト(U+0000)が
// 混入していないか検査する。
//
// 背景(2026-08-04、PR#431→#434): Mapのキー区切りとして `${a}<NUL>${b}` を
// 書いたつもりが、エスケープ表記ではなく生のNULバイトとしてファイルに入って
// しまった。tsc・next buildは通り、実行時の挙動も正しいため気づけない一方、
// gitがそのファイルをbinary扱いして**レビュー時に差分が読めない**状態になる
// (実際に#431はdiffが表示されないままマージされ、#434で事後修正した)。
//
// gitのbinary判定は「先頭8000バイト以内にNULがあるか」で決まるため、同じ混入
// でも実害の有無がNULの位置次第という運任せの状態になる。したがってbaseline
// (ratchet)方式は採らずゼロ件ゲートにする。既存の混入も同時に解消済み
// (src/lib/mnewsRating/deepScraper.ts の2件、PR同梱で置換)。
//
// NUL区切り自体は選手名の連結キー等で有用なので禁止しない。エスケープ表記
// (バックスラッシュ + u0000)で書けば実行時の値は同一で、ソースはプレーン
// テキストのまま保てる。
//
// 対象: src/ と scripts/ 配下のテキストソース。画像・フォント等のバイナリは
// 拡張子で除外する(favicon.ico や *.png は当然NULを含む)。
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "scripts"];

// バイナリとして正当にNULを含みうる拡張子(検査対象外)。
const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|ico|icns|woff2?|ttf|otf|eot|pdf|zip|gz|mp4|webm|wasm)$/i;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (!BINARY_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

interface Violation {
  file: string;
  line: number;
  column: number;
  offset: number;
  count: number;
  excerpt: string;
}

const violations: Violation[] = [];
let scanned = 0;

for (const dir of SCAN_DIRS) {
  for (const file of listFiles(path.join(ROOT, dir))) {
    let buf: Buffer;
    try {
      buf = fs.readFileSync(file);
    } catch {
      continue;
    }
    scanned++;
    const first = buf.indexOf(0);
    if (first === -1) continue;

    let count = 0;
    for (let i = 0; i < buf.length; i++) if (buf[i] === 0) count++;

    // 行・桁を出す(NULは制御文字なのでexcerptでは可視化する)
    const head = buf.subarray(0, first).toString("utf8");
    const line = head.split("\n").length;
    const column = first - (head.lastIndexOf("\n") + 1) + 1;
    const lineText = buf
      .toString("utf8")
      .split("\n")[line - 1]
      .replace(/\0/g, "<NUL>");

    violations.push({
      file: path.relative(ROOT, file),
      line,
      column,
      offset: first,
      count,
      excerpt: lineText.trim().slice(0, 160),
    });
  }
}

if (violations.length > 0) {
  console.error(`✗ ソースにリテラルのNULバイトが混入しています (${violations.length}ファイル)`);
  for (const v of violations) {
    const gitBinary = v.offset < 8000 ? " ← gitがbinary扱いし差分が読めません" : "";
    console.error(`  ${v.file}:${v.line}:${v.column} (${v.count}個, 先頭offset=${v.offset})${gitBinary}`);
    console.error(`    ${v.excerpt}`);
  }
  console.error("");
  console.error('  対処: 生のNULバイトをエスケープ表記("\\u0000")に置き換えてください。');
  console.error("  実行時の値は同一のまま、ソースをプレーンテキストに保てます。");
  console.error("  検出のみ: npx tsx scripts/check-nul-bytes.ts");
  process.exit(1);
}

console.log(`✓ NULバイト検査: 0件 (${scanned}ファイル検査 / ${SCAN_DIRS.join(", ")})`);
