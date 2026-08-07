// デプロイ前ゲート: 公開ページのレンダリング方式(動的/ISR)が「意図して選ばれて
// いる」ことを強制する。
//
// 背景(Fluid Active CPU超過を5日で2回):
//   2026-08-02、/fighters・/fighters/[slug]がforce-dynamicで毎リクエスト全件
//   再計算していたことがVercel Fluid Active CPU急増の主因と判明し修正した
//   (3dc1eaa)。しかし同型パターンの他ルートをsweepしなかったため、/vs・/dream
//   が取り残され、2026-08-07に同じ原因で本番がDeployment Pausedで停止した
//   (Hobby枠4h/月に対し11h56m使用)。実測では/dreamと/vsの2ルートだけで
//   他45ルートの合計を超えるActive CPUを消費していた。
//
//   1回目の修正内容自体は正しく、範囲だけが「その時に見ていたルート」に限られて
//   いた。人間(およびAIエージェント)の注意力に依存する再発防止は2度失敗した
//   ため、ビルドで落とす仕組みにする(フォントサイズで3回再発した後に入れた
//   check-event-namesize-override.ts、JST日付のcheck-jst-date-bypass.tsと同じ形)。
//
// 検査する2点:
//   [1] force-dynamicの明示的な許可制
//       公開ページがexport const dynamic = "force-dynamic"を宣言する場合、
//       ALLOW_FORCE_DYNAMICに理由つきで登録されていること。
//
//   [2] 暗黙の動的レンダリングの禁止(こちらが2026-08-07の真犯人)
//       Next.js App Routerでは、ページがsearchParamsを参照すると宣言が無くても
//       自動的に動的レンダリングになる。/vsはまさにこれで、force-dynamicを
//       grepしても引っかからないまま毎リクエスト再計算されていた。
//       そこで「searchParamsに触れるページはrevalidateかdynamicのどちらかを
//       明示宣言していること」を要求する。動的レンダリング自体を禁止するので
//       はなく、"うっかり動的"を禁止して選択を意識させるのが目的。
//
// 既知の穴(過信しないこと):
//   - 行単位の正規表現ベースで、AST解析はしていない。searchParamsを別名の
//     変数・ヘルパー経由で受け渡す書き方は検出できない。
//   - 対象はsrc/app/**/page.tsxのみ。route.ts(APIルート)は/api/refreshのように
//     本質的に動的であるべきものが多いため対象外。layout.tsxも対象外。
//   - 「宣言があること」しか見ておらず、revalidateの秒数が適切かは判定しない。
//   - 動的であること自体のコストは止められない。あくまで無自覚な動的化を防ぐ
//     ゲートであり、CPU消費量そのものはVercel Observabilityで実測すること。
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src", "app");

// 認証必須(middlewareで保護)かつトラフィックが極小で、本質的に動的であるべき
// 管理画面は対象外にする。CPU消費の観点でも実測上位に現れない。
const EXCLUDED_DIR_PREFIXES = [path.join("src", "app", "admin")];

// force-dynamicを許可する公開ページと、その理由。
// ここに足す前に「本当にISR化できないか」を必ず検討すること。2026-08-07時点で
// 実際に検討した結果、下記2件は理由があって動的のまま残している。
const ALLOW_FORCE_DYNAMIC: Record<string, string> = {
  "src/app/page.tsx":
    "ライブ帯(開催当日/直後の表示切替)の日数判定がSSR確定である必要があり、" +
    "仕様(docs/instructions/mnews-homepage-instructions.md §1)がコード上で明示している。" +
    "ISR化するとJST日付境界で誤表示が出うる。実測36秒/日で消費も小さい。",
  "src/app/archive/page.tsx":
    "searchParams(tab/page)でサーバー側ページネーションを行っており、" +
    "ISR化にはページネーションの再設計が必要(別スコープ)。実測でも消費上位外。",
  "src/app/dream/page.tsx":
    "searchParams(a/b/e/w)で選手・大会名・階級を受け取る仕様で、" +
    "共有URLごとのOGP(generateMetadata)生成にも必要なため動的が必須。" +
    "重い計算側はgetVisibleFighters()のプロセス内キャッシュとReact cache()で" +
    "対処済み(PR#461)。",
  "src/app/vs/[slugA]/[slugB]/page.tsx":
    "searchParams(?red=、赤コーナー入替)を参照するため動的。" +
    "?red=をクライアント側に寄せてISR化する案は効果測定後に判断する(フェーズ2)。",
};

// 行コメントとブロックコメントを除去する(判定をコード部分に限定するため)。
// /events/[slug]のように「searchParamsには一切触れない」と説明をコメントで
// 書いているページを誤検出しないために必要(実際に初回実装時に誤検出した)。
function stripComments(source: string): string {
  let out = "";
  let inBlock = false;
  for (const rawLine of source.split("\n")) {
    let line = rawLine;
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) {
        out += "\n";
        continue;
      }
      line = line.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const block = line.indexOf("/*");
      const lineComment = line.indexOf("//");
      if (block !== -1 && (lineComment === -1 || block < lineComment)) {
        const end = line.indexOf("*/", block + 2);
        if (end === -1) {
          line = line.slice(0, block);
          inBlock = true;
          break;
        }
        line = line.slice(0, block) + line.slice(end + 2);
        continue;
      }
      if (lineComment !== -1) line = line.slice(0, lineComment);
      break;
    }
    out += line + "\n";
  }
  return out;
}

function walkPages(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPages(full, files);
    else if (entry.name === "page.tsx") files.push(full);
  }
  return files;
}

function main() {
  if (!fs.existsSync(APP_DIR)) return;

  const violations: string[] = [];
  const staleAllowlist: string[] = [];
  const seenForceDynamic = new Set<string>();

  for (const file of walkPages(APP_DIR)) {
    const rel = path.relative(ROOT, file);
    if (EXCLUDED_DIR_PREFIXES.some((p) => rel.startsWith(p))) continue;

    const code = stripComments(fs.readFileSync(file, "utf8"));
    const hasForceDynamic = /^export const dynamic\s*=\s*["']force-dynamic["']/m.test(code);
    const hasRevalidate = /^export const revalidate\s*=/m.test(code);
    const hasDynamicDecl = /^export const dynamic\s*=/m.test(code);
    const usesSearchParams = /\bsearchParams\b/.test(code);

    // [1] force-dynamicは許可リスト制
    if (hasForceDynamic) {
      seenForceDynamic.add(rel);
      if (!(rel in ALLOW_FORCE_DYNAMIC)) {
        violations.push(
          `${rel}: force-dynamicが許可リストにありません。\n` +
            `      ISR化(export const revalidate = N)を検討してください。動的が必要なら\n` +
            `      scripts/check-route-rendering-mode.ts の ALLOW_FORCE_DYNAMIC に理由つきで追加してください。`
        );
      }
    }

    // [2] searchParamsを参照するなら宣言を明示すること(暗黙の動的化を防ぐ)
    if (usesSearchParams && !hasRevalidate && !hasDynamicDecl) {
      violations.push(
        `${rel}: searchParamsを参照していますが revalidate / dynamic の宣言がありません。\n` +
          `      Next.jsはこの場合ページを暗黙に動的レンダリングします(force-dynamicをgrepしても\n` +
          `      見つからないまま毎リクエスト再計算される。2026-08-07の本番停止の実際の原因)。\n` +
          `      意図を明示してください: ISRなら export const revalidate = N、\n` +
          `      動的が必須なら export const dynamic = "force-dynamic" + 許可リスト登録。`
      );
    }
  }

  // 許可リストに載っているが実際にはforce-dynamicでなくなったページを検出する。
  // ISR化した後に許可リストを消し忘れると、次に誰かがforce-dynamicを付け直した
  // ときに素通りしてしまうため(ratchetを緩めない)。
  for (const rel of Object.keys(ALLOW_FORCE_DYNAMIC)) {
    if (!seenForceDynamic.has(rel)) staleAllowlist.push(rel);
  }

  if (staleAllowlist.length) {
    console.error(
      `[ルートレンダリング方式検査] ★許可リストが実態と乖離しています(${staleAllowlist.length}件)。\n` +
        `  以下はALLOW_FORCE_DYNAMICに載っていますが、現在force-dynamicではありません:\n    ` +
        staleAllowlist.join("\n    ") +
        `\n  ISR化が済んだ場合は scripts/check-route-rendering-mode.ts の該当エントリを削除してください` +
        `(消し忘れると、次にforce-dynamicが付け直されたとき検出できなくなります)。`
    );
    process.exit(1);
  }

  if (violations.length) {
    console.error(
      `[ルートレンダリング方式検査] ★${violations.length}件の違反を検出。デプロイをブロックします:\n\n  ` +
        violations.join("\n\n  ") +
        `\n\n  背景: 2026-08-02に/fighters系で同種の問題を修正しながら横展開しなかったため、\n` +
        `  2026-08-07に/vs・/dreamが同じ原因で本番をDeployment Pausedに追い込みました。\n` +
        `  このゲートは3回目を防ぐためのものです。`
    );
    process.exit(1);
  }

  console.log(
    `[ルートレンダリング方式検査] OK (force-dynamic許可 ${Object.keys(ALLOW_FORCE_DYNAMIC).length}件、暗黙の動的化なし)`
  );
}

main();
