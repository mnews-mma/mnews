// デプロイ前ゲート(baseline/ratchet方式): JST日付計算の唯一の実装
// (src/lib/eventCountdown.ts)を迂回する新規コードを検出する。
//
// 背景(JSTズレ監査 フェーズ3): フェーズ2-AでtoJstDateStrへの一本化・境界5ケース
// のTZ3種テストをbuildゲートに入れたが、PR-Aは同じ穴(日付の素朴なパース)を
// 再生産した。既存テストは「ヘルパーが正しいか」を検証するもので、ヘルパーを
// 迂回した新規コードは検出しない。境界ケースを増やすのではなく、迂回そのものを
// buildで落とす(フォントサイズで3回再発した後に入れたfighterNameSize直呼び
// 検出と同じ形。check-event-namesize-override.ts参照)。
//
// baseline方式にした理由: 初回スキャン時点で既存コードに98件の該当があった
// (大半はPR-Aと無関係な既存コード)。全件を一括で直す/allowlistに入れるのは
// 人間判断が要る一方、ゲート自体を無効のまま放置すると「新規の迂回コードの
// 追加」という当の再発を何も防げない。そこで既存98件はbaseline(scripts/
// jst-date-bypass-baseline.json)にスナップショットとして記録し、baselineに
// 無い新規違反のみでbuildを落とす(ratchet)。既存分はbaselineから1件ずつ
// 減らしていける。
//
// 検出対象(いずれもeventCountdown.ts本体と既存の日付テストの外で使われたら
// 違反候補。baselineに載っていれば通過、載っていなければbuild失敗):
//   1. date-only文字列のnew Date("YYYY-MM-DD")パース
//   2. .toISOString().split("T") / .toISOString().slice(0,10) によるタイムスタンプ
//      からの日付抽出
//   3. 正規表現による日付文字列の分解(.match/.exec + \d{4}を含むパターン)
//   4. getFullYear()/getMonth()/getDate()/getDay() などローカルgetterの直呼び
//      (getUTCXxx は対象外)
//   5. 日付文字列に対するsplit("-")/split("/")による分解(受け手の変数名/
//      プロパティ名に"date"を含む場合のみ対象。汎用的な文字列分割との誤検出を
//      抑えるため。PR-Fでlatestresultclauseがこのパターンでゲートを迂回した
//      実例があり追加)
//
// 既知の穴(過信しないこと。これは網羅的なJST日付バグ検出器ではなく、上記5
// パターンに一致するコードだけを止める簡易ゲート):
//   - 行単位の正規表現マッチであり、AST解析はしていない。複数行にまたがる
//     式や、パターンの字面を変数・関数に迂回した書き方は検出できない。
//   - パターン1・5は「受け手の変数名/プロパティ名に"date"を含むか」で
//     日付操作かどうかを判定している。したがって `const parts =
//     someString.split("-")` のように変数名に"date"が入っていない場合は
//     素通りする(誤検出を抑えるためのトレードオフとして意図的に絞った設計。
//     広げる場合は誤検出件数とのバランスを見ること)。
//   - パターン3は正規表現リテラル中に`\d{4}`という字面を含む場合のみ検出する。
//     `\d\d\d\d`など等価だが字面が異なる書き方は素通りする。
//   - 対象ディレクトリはsrc/・scripts/のみ。
//
// 運用:
//   通常実行:            npx tsx scripts/check-jst-date-bypass.ts
//   baseline再生成:       npx tsx scripts/check-jst-date-bypass.ts --write-baseline
//     (既存のbaseline項目を直した後、または新規違反をレビュー済みで意図的に
//      grandfatherする場合に実行し、jst-date-bypass-baseline.jsonをコミットする。
//      「新規に書いたコードの違反をbaselineで免罪しない」— 直せるものはこの
//      コマンドを打つ前に直すこと)
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

const BASELINE_PATH = path.join(ROOT, "scripts", "jst-date-bypass-baseline.json");

interface Violation {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

interface BaselineFile {
  _readme: string[];
  violations: { file: string; pattern: string; code: string }[];
}

// baseline識別子: file+pattern+codeテキストの組み合わせ。行番号は含めない
// (無関係な編集で行がズレてもbaselineが誤って「新規違反」を報告しないため)。
// 該当行のコード自体が変わった場合のみ「新規」として再度検出対象になる
// (それは実質的に見直すべきタイミングなので意図的な挙動)。
function violationKey(v: { file: string; pattern: string; code: string }): string {
  return `${v.file}::${v.pattern}::${v.code}`;
}

function loadBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const parsed: BaselineFile = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  return new Set(parsed.violations.map(violationKey));
}

function writeBaseline(violations: Violation[]) {
  const data: BaselineFile = {
    _readme: [
      "このファイルはscripts/check-jst-date-bypass.tsのbaseline(ratchet)です。",
      "手で編集しないこと。再生成: npx tsx scripts/check-jst-date-bypass.ts --write-baseline",
      "既存項目を直した後、または新規違反をレビュー済みでgrandfatherする場合にのみ再生成すること。",
      "新しく書いたコードの違反はbaselineに入れず先に直すこと(baselineの意味が無くなるため)。",
    ],
    violations: violations
      .map((v) => ({ file: v.file, pattern: v.pattern, code: v.code }))
      .sort((a, b) => (a.file + a.pattern + a.code).localeCompare(b.file + b.pattern + b.code)),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2) + "\n");
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

    // 5. 日付文字列に対するsplit("-")/split("/")による分解。受け手の変数名/
    // プロパティ名(レシーバ式)に"date"を含む場合のみ対象とし、無関係な文字列
    // 分割(URL・スラッグ・カンマ区切りリスト等)との誤検出を抑える。
    for (const m of line.matchAll(/([\w.[\]]+)\.split\(\s*["'`]([-/])["'`]\s*\)/g)) {
      const receiver = m[1];
      if (/date/i.test(receiver)) {
        violations.push({ file, line: lineNo, pattern: `date string split("${m[2]}")`, code: rawLine.trim() });
      }
    }
  });
}

function scanAll(): Violation[] {
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
  return violations;
}

function main() {
  const violations = scanAll();

  if (process.argv.includes("--write-baseline")) {
    writeBaseline(violations);
    console.log(`[JST日付バイパス検査] baseline再生成: ${violations.length}件を scripts/jst-date-bypass-baseline.json に記録しました。`);
    return;
  }

  const baseline = loadBaseline();
  const newViolations = violations.filter((v) => !baseline.has(violationKey(v)));
  const knownCount = violations.length - newViolations.length;
  const fixedCount = [...baseline].filter((k) => !violations.some((v) => violationKey(v) === k)).length;

  if (newViolations.length) {
    const list = newViolations
      .map((v) => `    ${v.file}:${v.line} [${v.pattern}] ${v.code}`)
      .join("\n");
    console.error(
      `[JST日付バイパス検査] ★baselineに無い新規のJST日付ヘルパー迂回を検出(${newViolations.length}件)。デプロイをブロックします:\n${list}\n` +
        `  対処: eventCountdown.tsのtoJstDateStr/formatEventDateJa/shiftDateStr等の既存ヘルパー経由に書き換えるか、` +
        `レビュー済みで意図的にgrandfatherするなら npx tsx scripts/check-jst-date-bypass.ts --write-baseline を実行してbaselineをコミットしてください` +
        `(新しく書いたコードの違反を安易にbaselineへ入れないこと)。`
    );
    process.exit(1);
  }

  console.log(
    `[JST日付バイパス検査] OK (新規違反0件。baseline内の既知違反${knownCount}件は引き続き通過)` +
      (fixedCount > 0
        ? ` — baseline中${fixedCount}件が解消済みのようです。npx tsx scripts/check-jst-date-bypass.ts --write-baseline でbaselineを更新してください。`
        : "")
  );
}

main();
