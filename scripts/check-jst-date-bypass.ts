// デプロイ前ゲート: JST日付計算の唯一の実装(src/lib/eventCountdown.ts)を
// 迂回する新規コードを検出する。
//
// 背景(JSTズレ監査 フェーズ3): フェーズ2-AでtoJstDateStrへの一本化・境界5ケース
// のTZ3種テストをbuildゲートに入れたが、PR-Aは同じ穴(日付の素朴なパース)を
// 再生産した。既存テストは「ヘルパーが正しいか」しか検証せず、ヘルパーを迂回した
// 新規コードは検出しない。監査はある時点のスイープであり、並行ブランチは対象外
// だった。境界ケースを増やすのではなく、迂回そのものをbuildで落とす
// (フォントサイズで3回再発した後に入れたfighterNameSize直呼び検出と同じ形。
// check-event-namesize-override.ts参照)。
//
// 検出対象(いずれもeventCountdown.ts本体と既存の日付テストの外で使われたら違反):
//   1. date-only文字列のnew Date("YYYY-MM-DD")パース
//   2. .toISOString().split("T") / .toISOString().slice(0,10) によるタイムスタンプ
//      からの日付抽出
//   3. 正規表現による日付文字列の分解(.match/.exec + \d{4}を含むパターン)
//   4. getFullYear()/getMonth()/getDate()/getDay() などローカルgetterの直呼び
//      (getUTCXxx は対象外)
//
// 自動修正はしない(検出・停止・ログのみ)。allowlistに入れるか実装を直すかは
// 人間判断。
// 実行: npx tsx scripts/check-jst-date-bypass.ts
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

// この検査自体の対象外(JST日付計算の正規の実装場所+既存の日付テストのみ)。
const ALLOWLIST = new Set([
  "src/lib/eventCountdown.ts",
  "scripts/test-jst-date-str.ts",
  "scripts/test-event-date-format.ts",
  "scripts/test-future-history-filter.ts",
]);

// スキャン対象ディレクトリ(アプリコード+運用スクリプト)。node_modules/.next等は
// 探索しない。
const SCAN_DIRS = ["src", "scripts"];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// new Date(...) の引数を見て「date-onlyの文字列をパースしている」と判断できる
// ケースだけを拾う。no-arg(new Date())やepoch-ms系(new Date(nowMs)等)は対象外。
function isDateOnlyDateConstructorArg(arg: string): boolean {
  const trimmed = arg.trim();
  if (trimmed === "") return false; // new Date()
  // リテラルの日付文字列("YYYY-MM-DD"、"YYYY-MM-DDT..."含む)
  if (/^["'`]\d{4}-\d{1,2}-\d{1,2}/.test(trimmed)) return true;
  // epoch-ms/timestamp/Date.now()由来と見られる引数は対象外
  if (/Ms\b|epoch|timestamp|Date\.now\(\)/i.test(trimmed)) return false;
  // 変数名・プロパティ名に"date"を含む場合のみ疑わしいとみなす
  if (/date/i.test(trimmed)) return true;
  return false;
}

function scanFile(file: string, violations: Violation[]) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((rawLine, idx) => {
    const line = rawLine.replace(/\/\/.*$/, ""); // 行コメントは除外
    const lineNo = idx + 1;

    // 1. new Date("YYYY-MM-DD") 等のdate-onlyパース
    for (const m of line.matchAll(/new Date\(\s*([^()]*)\)/g)) {
      if (isDateOnlyDateConstructorArg(m[1])) {
        violations.push({ file, line: lineNo, pattern: "date-only string passed to Date constructor", code: rawLine.trim() });
      }
    }

    // 2. toISOString().split("T") / toISOString().slice(0,10)
    if (/\.toISOString\(\)\s*\.\s*split\(\s*["'`]T["'`]\s*\)/.test(line)) {
      violations.push({ file, line: lineNo, pattern: "toISOString().split(T)", code: rawLine.trim() });
    }
    if (/\.toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/.test(line)) {
      violations.push({ file, line: lineNo, pattern: "toISOString().slice(0,10)", code: rawLine.trim() });
    }

    // 3. 正規表現による日付文字列の分解(\d{4}を含むパターンでmatch/exec)
    if (/\.(match|exec)\(\s*\/[^/]*\\d\{4\}[^/]*\//.test(line)) {
      violations.push({ file, line: lineNo, pattern: "regex date decomposition", code: rawLine.trim() });
    }

    // 4. ローカルgetterの直呼び(getUTCXxxは対象外。"UTC"が続く場合はマッチしない)
    for (const m of line.matchAll(/\.get(FullYear|Month|Date|Day)\(\)/g)) {
      violations.push({ file, line: lineNo, pattern: `local getter .get${m[1]}()`, code: rawLine.trim() });
    }
  });
}

function main() {
  const violations: Violation[] = [];

  for (const dir of SCAN_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const file of listTsFiles(full)) {
      const rel = path.relative(ROOT, file).split(path.sep).join("/");
      if (ALLOWLIST.has(rel)) continue;
      scanFile(rel, violations);
    }
  }

  if (violations.length) {
    const list = violations
      .map((v) => `    ${v.file}:${v.line} [${v.pattern}] ${v.code}`)
      .join("\n");
    console.error(
      `[JST日付バイパス検査] ★eventCountdown.ts経由のJST日付ヘルパーを迂回している疑いのある箇所を検出(${violations.length}件)。デプロイをブロックします:\n${list}\n` +
        `  対処: eventCountdown.tsのtoJstDateStr/formatEventDateJa/shiftDateStr等の既存ヘルパー経由に書き換えるか、` +
        `本当に迂回が必要な理由があるならこのスクリプトのALLOWLISTに追加してください(判断は人間が行う)。`
    );
    process.exit(1);
  }

  console.log(`[JST日付バイパス検査] OK (0件)`);
}

main();
