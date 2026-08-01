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
// check-jst-date-bypass.ts自身も対象外: この検出器は日付らしき文字列の
// "形"を判定するために\d{4}を含む正規表現をその実装として持つ必要があり
// (isDateOnlyStringLiteral等)、これはアプリコード側の迂回とは性質が異なる
// 自己参照(検出器が自分自身の実装を誤検出する)。PR-J実装時に判明。
const ALLOWLIST = new Set([
  "src/lib/eventCountdown.ts",
  "scripts/test-jst-date-str.ts",
  "scripts/test-event-date-format.ts",
  "scripts/test-future-history-filter.ts",
  "scripts/check-jst-date-bypass.ts",
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

// 指示書W(2026-08-01): file::pattern単位の粗いキー(行内容を含まない)。
// 完全一致キー(exact)で拾えなかった違反を、この粗いキー単位の「件数の
// 増減」で最終判定するために使う(baseline-key-fragility.md 案1+案2の
// ハイブリッド。詳細はこのファイル冒頭のコメント・PR説明参照)。
function looseKey(v: { file: string; pattern: string }): string {
  return `${v.file}::${v.pattern}`;
}

function loadBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const parsed: BaselineFile = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  return new Set(parsed.violations.map(violationKey));
}

function loadBaselineRaw(): { file: string; pattern: string; code: string }[] {
  if (!fs.existsSync(BASELINE_PATH)) return [];
  const parsed: BaselineFile = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  return parsed.violations;
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

// 文字列リテラル("YYYY-MM-DD..."で始まるクォート文字列)が、time成分や
// UTC明示(Z/オフセット)を一切含まない「date-onlyのみ」の表記かどうかを判定
// する。T・Z・明示的なUTCオフセット(+HH:MM/-HH:MM)のいずれかを含む場合は
// 曖昧性の無いフルタイムスタンプであり、date-onlyパースの踏み穴(UTC 0時解釈)
// には該当しないため対象外とする(2026-07-26 PR-J: #177調査で
// new Date("2999-01-01T00:00:00.000Z")が誤検出されていたことが判明)。
function isDateOnlyStringLiteral(trimmed: string): boolean {
  const m = trimmed.match(/^["'`](\d{4}-\d{1,2}-\d{1,2}[^"'`]*)["'`]/);
  if (!m) return false;
  const inner = m[1];
  if (/T/.test(inner)) return false;
  if (/Z/.test(inner)) return false;
  if (/[+-]\d{2}:\d{2}/.test(inner)) return false;
  return true;
}

// new Date(...) の引数を見て「date-onlyの文字列をパースしている」と判断できる
// ケースだけを拾う。no-arg(new Date())やepoch-ms系(new Date(nowMs)等)は対象外。
function isDateOnlyDateConstructorArg(arg: string): boolean {
  const trimmed = arg.trim();
  if (trimmed === "") return false; // new Date()
  // リテラルの日付文字列: date-onlyのみ対象(T/Z/オフセット付きのフルタイム
  // スタンプは対象外)。
  if (/^["'`]/.test(trimmed)) return isDateOnlyStringLiteral(trimmed);
  // 以下は変数/式渡し(中身を静的判定できないため、従来どおりの挙動を維持する。
  // 絞りすぎて検出漏れを作らないため変更しない)。
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

// 指示書W(2026-08-01): baseline完全一致キー(file::pattern::code)は、
// 該当行の変数名変更・整形・ヘルパー抽出への書き換え等、違反の実質が
// 変わらないリファクタでも機械的に「新規」扱いになる脆弱性がある
// (out/baseline-key-fragility.md参照、案1〜4の比較検討済み)。
// #317→#319→#318→#321で実際にこの経路で本番ビルドが2回落ちた
// (#318が#319のbaseline修正を無自覚に上書きした)。
//
// 対策(案1「file::patternのみをキーにする」+案2「件数管理にする」の
// ハイブリッド): 完全一致(exact)で拾えなかった違反は、即座に「新規」と
// 断定せず、粗いキー(file::pattern、行内容を含まない)単位で件数を
// baseline側の同キー件数と比較する。
//   - 完全一致: 従来どおり無条件で通過(最も確実なケース)。
//   - 不一致だが、その(file,pattern)の不一致件数がbaseline側の
//     不一致件数以下 → 「要確認」(変数名変更・行の書き換え等による
//     キーのズレの可能性が高い。ビルドは止めない。CIログに出す)。
//   - 不一致件数がbaseline側の不一致件数を超える → 超過分だけを
//     「新規違反」として扱いビルドを止める(真に新しく増えた違反を
//     見逃さない)。
// これにより、コードの実質を変えないリファクタ(要件①)ではビルドが
// 落ちず、真に新規のコードが増えた場合(要件②)は従来どおり検出され、
// baseline再生成のタイミングのズレで静かに保護が外れる経路(要件③)は
// 「新規違反」と「要確認」で区別してログに出るようになる。
function main() {
  const violations = scanAll();

  if (process.argv.includes("--write-baseline")) {
    writeBaseline(violations);
    console.log(`[JST日付バイパス検査] baseline再生成: ${violations.length}件を scripts/jst-date-bypass-baseline.json に記録しました。`);
    return;
  }

  const baselineExact = loadBaseline();
  const baselineRaw = loadBaselineRaw();

  // 完全一致で判定できたものを両側から取り除く。
  const exactMatchedCurrentKeys = new Set<string>();
  const currentUnmatched: Violation[] = [];
  for (const v of violations) {
    const k = violationKey(v);
    if (baselineExact.has(k)) {
      exactMatchedCurrentKeys.add(k);
    } else {
      currentUnmatched.push(v);
    }
  }
  const baselineUnmatched = baselineRaw.filter((b) => !violations.some((v) => violationKey(v) === violationKey(b)));

  // 不一致分を粗いキー(file::pattern)単位で件数集計する。
  function countByLooseKey<T extends { file: string; pattern: string }>(items: T[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const it of items) {
      const k = looseKey(it);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }
  const currentUnmatchedCounts = countByLooseKey(currentUnmatched);
  const baselineUnmatchedCounts = countByLooseKey(baselineUnmatched);

  // currentUnmatchedを(file,pattern)ごとにグループ化し、baseline側の
  // 同キー在庫(quota)を消費する形で「要確認」/「新規違反」に振り分ける。
  const groupedCurrentUnmatched = new Map<string, Violation[]>();
  for (const v of currentUnmatched) {
    const k = looseKey(v);
    if (!groupedCurrentUnmatched.has(k)) groupedCurrentUnmatched.set(k, []);
    groupedCurrentUnmatched.get(k)!.push(v);
  }

  const hardNewViolations: Violation[] = [];
  const needsReview: Violation[] = [];
  for (const [k, items] of groupedCurrentUnmatched) {
    const quota = baselineUnmatchedCounts.get(k) ?? 0;
    items.forEach((v, i) => {
      if (i < quota) needsReview.push(v);
      else hardNewViolations.push(v);
    });
  }

  // quotaとして消費されなかったbaseline側の不一致件数 = 実質的に解消済み
  // (対応するcurrent違反が無い。真に直った/削除されたケース)。
  let consumedBaselineTotal = 0;
  for (const [k, count] of currentUnmatchedCounts) {
    consumedBaselineTotal += Math.min(count, baselineUnmatchedCounts.get(k) ?? 0);
  }
  const fixedCount = baselineUnmatched.length - consumedBaselineTotal;
  const knownCount = violations.length - hardNewViolations.length - needsReview.length;

  if (needsReview.length) {
    const list = needsReview.map((v) => `    ${v.file}:${v.line} [${v.pattern}] ${v.code}`).join("\n");
    console.warn(
      `[JST日付バイパス検査] △要確認(${needsReview.length}件、ビルドはブロックしません): baselineの完全一致キー(コードテキスト)からは外れましたが、` +
        `同一ファイル・同一パターンの件数は増えていないため、変数名変更や行の書き換え等によるキーのズレの可能性が高いです:\n${list}\n` +
        `  対処: 意図した変更であれば npx tsx scripts/check-jst-date-bypass.ts --write-baseline でbaselineを更新してコミットしてください。`
    );
  }

  if (hardNewViolations.length) {
    const list = hardNewViolations.map((v) => `    ${v.file}:${v.line} [${v.pattern}] ${v.code}`).join("\n");
    console.error(
      `[JST日付バイパス検査] ★baselineに無い新規のJST日付ヘルパー迂回を検出(${hardNewViolations.length}件)。デプロイをブロックします:\n${list}\n` +
        `  対処: eventCountdown.tsのtoJstDateStr/formatEventDateJa/shiftDateStr等の既存ヘルパー経由に書き換えるか、` +
        `レビュー済みで意図的にgrandfatherするなら npx tsx scripts/check-jst-date-bypass.ts --write-baseline を実行してbaselineをコミットしてください` +
        `(新しく書いたコードの違反を安易にbaselineへ入れないこと)。`
    );
    process.exit(1);
  }

  console.log(
    `[JST日付バイパス検査] OK (新規違反0件。baseline内の既知違反${knownCount}件は引き続き通過` +
      (needsReview.length ? `、要確認${needsReview.length}件` : "") +
      `)` +
      (fixedCount > 0
        ? ` — baseline中${fixedCount}件が解消済みのようです。npx tsx scripts/check-jst-date-bypass.ts --write-baseline でbaselineを更新してください。`
        : "")
  );
}

main();
