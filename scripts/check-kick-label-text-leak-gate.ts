// PR-G追補(2026-08、表示層混入監査、項目4-3): 「内部処理用のラベル文字列が、CSSに
// 依存しない形でユーザー表示側のテキストへそのまま連結して漏れる」バグクラスを検知する
// ゲート。ユーザー指摘: このバグの型は今回で3度目。
//
// 実例(この監査で発見・修正): src/app/kick/fighters/[slug]/page.tsx の
// OpponentCell()で、選手名の<span>と「同姓同名のため未リンク」バッジの<span>が
// 直接隣接しており、通常のブラウザ表示ではバッジ自体のCSS(パディング等)で視覚的に
// 区切られて見えるが、CSSを介さずDOMのテキストノードをそのまま連結する経路
// (スクリーンリーダー・アクセシビリティツリー・自動テキスト監査等)では「一輝同姓同名の
// ため未リンク」のように選手名とバッジ内部ラベルが空白無しで連結して読まれてしまう。
// 同型の隣接(デビュー戦・延長・タイトル種別バッジ)も同時に修正した。
//
// このゲートは、`next build`が生成した実際の静的HTML(.next/server/app/kick/配下)を
// テキスト抽出し、既知の内部ラベル文言の直前に区切り(空白・タグ境界)が無いまま
// 別のテキストが連結されている箇所が無いかをゼロ件で検査する。データ層
// (data/kick/generated/)ではなく実際のレンダリング結果を見る必要があるため、
// package.jsonのbuildチェーンでは`next build`の**後**に実行する(他のcheck:kick-*が
// next buildの前段にあるのとは配置が異なる点に注意)。
//
// 実行方法: npm run build 内で next build 直後に自動実行される
//          (単体実行時は先に next build を済ませておくこと)
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const NEXT_SERVER_APP_KICK = path.join(ROOT, ".next/server/app/kick");

// 検査対象のバッジclassName(kick-badge系。新しいバッジを追加した場合はここにも追記)。
const BADGE_CLASS_PATTERNS = ["kick-badge"];

function findHtmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findHtmlFiles(p));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

interface Violation {
  file: string;
  context: string;
}

const violations: Violation[] = [];
const htmlFiles = findHtmlFiles(NEXT_SERVER_APP_KICK);

if (htmlFiles.length === 0) {
  console.error(
    "[kick-label-text-leak] ★.next/server/app/kick 配下にHTMLファイルが見つかりません。" +
      "このゲートは next build の後に実行する必要があります。",
  );
  process.exit(1);
}

// 単語一致(「タイトルマッチ」等の内部ラベル文言が大会名の一部として自然に出現する場合、
// 例:「K-1ライト級タイトルマッチ」を誤検知する)ではなく、**サーバーレンダリングされた
// 実HTML上でバッジの直前に空白文字が無い(タグが直接隣接している)**という構造的な
// パターンだけを検査する。これによりRSCペイロード(<script>タグ内のJSON文字列表現)や
// 大会名内の自然な語の重複による誤検知を避ける。
for (const file of htmlFiles) {
  let html = fs.readFileSync(file, "utf8");
  // RSC(React Server Components)ハイドレーション用ペイロード(<script>タグ内のJSON)は
  // 実際のレンダリング結果ではなく、シリアライズされた木構造の文字列表現に過ぎない
  // (エスケープされたクォート内に偶然「タイトルマッチ」等の語が現れうる)。検査対象から除く。
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
  for (const badgeClass of BADGE_CLASS_PATTERNS) {
    // 直前の閉じタグ(</span>・</div>・</a>等)の直後(">"の直後)に、空白を1文字も
    // 挟まずバッジのopenタグが続いている箇所(=">"+"<span class=..."が直接連続)を検出する。
    // 修正済み(item 4-3)の箇所は{" "}により実HTML上に" "が1文字入るため、
    // ">"と"<span"の間に必ず空白がある。
    const needle = `><span class="${badgeClass}`;
    let searchFrom = 0;
    while (true) {
      const idx = html.indexOf(needle, searchFrom);
      if (idx === -1) break;
      searchFrom = idx + needle.length;
      violations.push({
        file: path.relative(ROOT, file),
        context: html.slice(Math.max(0, idx - 30), idx + 60).replace(/\s+/g, " "),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `[kick-label-text-leak] ★内部ラベル文言が直前のテキストと区切り無く連結している箇所が` +
      `${violations.length}件見つかりました。デプロイをブロックします:\n` +
      violations
        .slice(0, 20)
        .map((v) => `  - ${v.file}: バッジ直前に区切りが無い(...${v.context}...)`)
        .join("\n") +
      `\n  対処法: JSXでバッジ等の<span>直前に{" "}(明示的な空白テキストノード)を挿入してください。`,
  );
  process.exit(1);
}

console.log(`[kick-label-text-leak] OK(検査対象${htmlFiles.length}ファイル、内部ラベルの連結漏れ0件)`);
