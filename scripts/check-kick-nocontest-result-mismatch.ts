// PR #575: methodRaw(決着原文)に明示的なノーコンテスト系のキーワード("ノーコンテスト"・
// "無効")が含まれるのに、構造化されたresultがdraw/win/lossになっている行をビルド時に
// ゼロ件で検知するゲート。
//
// 背景: KNOCK OUT公式サイトの試合結果ページで、勝敗を表すCSSクラス(fight-log--draw)が
// ノーコンテストの試合にもそのまま使われており(選手本人のプロフィールページの通算成績欄
// には「1NC」と別枠で明記されているにもかかわらず)、クラス名ベースで判定するresultだけが
// 「draw」になっていた(ミル・ブン・ティエン、50人検品2周目#572で発覚、実測7行、
// うち6行がKNOCK OUT公式・1行がBigbang公式)。
//
// scripts/build-kick-data.tsのcorrectNoContestResultMismatch()が、methodテキストベースの
// 判定(method==="no_contest"、method_rawに明示的なNC語を含む)を正としてresultを補正する
// ため、正常に動作していれば以下はゼロ件のはず。このゲートはその不変条件をビルド時に
// 多重防御として再検証する。
//
// data/kick/generated/ (scripts/build-kick-data.tsが直前に生成) を読む。生データ
// (data/kick/*.json)は一切変更しない。
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");

interface Violation {
  slug: string;
  date: string | null;
  method: string | null;
  methodRaw: string;
  result: string;
}

const violations: Violation[] = [];
const NC_KEYWORD_RE = /ノーコンテスト|無効/;
const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));

for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    const methodRaw: string = b.methodRaw ?? "";
    const result: string = b.result;
    if (NC_KEYWORD_RE.test(methodRaw) && b.method === "no_contest" && (result === "draw" || result === "win" || result === "loss")) {
      violations.push({ slug: f.slug, date: b.date, method: b.method, methodRaw, result });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `[kick-nocontest-result-mismatch] ★決着原文がノーコンテスト系なのにresultがdraw/win/lossの` +
      `行が${violations.length}件見つかりました。デプロイをブロックします:\n` +
      violations
        .slice(0, 20)
        .map((v) => `  - ${v.slug} (${v.date ?? "date null"}): methodRaw="${v.methodRaw}" result="${v.result}"`)
        .join("\n"),
  );
  process.exit(1);
}

console.log("[kick-nocontest-result-mismatch] OK(ノーコンテスト原文とresultの食い違い0件)");
