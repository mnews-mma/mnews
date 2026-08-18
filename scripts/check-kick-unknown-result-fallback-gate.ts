// T-3(2026-08、result:"unknown"の実装漏れ修正): HoostCup・NKBの決着原文(methodRaw)から
// 機械的に勝敗が導出できるはずのパターンが、resultに反映されずunknownのまま残っていないかを
// ビルド時にゼロ件で検知するゲート。
//
// 背景: HoostCup(ingest_hoostcup.py)・NKB(ingest_nkb.py)には、写真の"win"クラスや
// ○/×/△マークが無い試合の勝敗を、決着原文の「判定N-M」(審判の支持数)・「試合中止」・
// 「エキシビションマッ(チ)」の文言から機械的に導出するフォールバックを実装した
// (実測85件中31件を修正、うちHoostCup26件・NKB5件は今回反映、残り3件は別バグ
// 〈parse_page()がHTMLコメント内の残骸テキストを誤って解析する既知の問題、
// out/kick-unknown-result-parser-report.md参照〉により今回は保留)。
//
// このゲートは「フォールバック自体が壊れていないか」をビルドごとに再検証する
// 多重防御であり、ゼロ件不変条件(ratchetではない)。新たにunknownへ落ちる同型パターンが
// 増えたら、実装のバグ(回帰)として即座にビルドを止める。
//
// 対象外(意図的にunknownのまま残すべきもの、違反として数えない):
// - HoostCupの決着原文が空文字、または「判定」の後にN-M形式の数字が続かない場合
//   (出典側に決着方法自体の記載が無い構造的欠落)
// - NKBの決着原文が空文字、または上記2パターンに一致しない場合
//   (旧サイト由来のresult='unknown'は、勝敗マーク自体が出典に存在しない構造的欠落であり、
//   ingest_nkb.pyのparse_old_site()が意図的にunknownで収録している。対象外)
import fs from "fs";
import path from "path";
import type { KickBout } from "../src/lib/kick/data";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");

// 既知の例外(2026-08、T-3検品で発見・未修正): parse_page()(ingest_hoostcup.py)は
// <h4>で区切ったブロック内を素朴な文字列検索(block.find('d12'/'box12'))で走査しており、
// HTMLコメント(<!-- ... -->)を除去していない。KINGS NAGOYA11(2022-07-10)のページには
// テンプレート移行時の残骸(コメントアウトされた旧形式の対戦カード)が残っており、
// このコメント内の「判定0-3 (48-50/48-49/47-50)」という文字列が、無関係な3選手
// (剛王・康輝・実方宏介、いずれも実際の決着は別のvs_style形式ブロックか「試合中止」)の
// 行に誤って紐付いている。このバグ自体はparse_page()全体に影響しうる既知の別問題
// (HTMLコメントを剥がさずに正規表現で走査している)であり、このスコアフォールバック
// 機能固有の不具合ではないため、この場では修正しない(コメント除去は影響範囲が広く、
// 既存の637行全体の再検証が必要になるため別タスク)。3件とも安全側のunknownのまま
// 据え置く。詳細はout/kick-unknown-result-parser-report.mdを参照。
const KNOWN_COMMENT_LEAKAGE_EXEMPTIONS = new Set([
  "HoostCup|2022-07-10|判定0-3 (48-50/48-49/47-50)",
]);
let exemptedHits = 0;

interface Violation {
  slug: string;
  promotion: string;
  date: string | null;
  methodRaw: string;
  result: string;
  reason: string;
}

const violations: Violation[] = [];

// 「判定」の直後、任意の全角/半角括弧を挟んでN-M(1桁の審判支持数)が続くパターン。
// ingest_hoostcup.pyのフォールバックと同一の正規表現(意図的に同期させている)。
const HOOSTCUP_SCORE_RE = /判定\s*[（(]?\s*\d\s*-\s*\d/;

const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));
for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as (KickBout & { promotion: string })[]) {
    const methodRaw: string = b.methodRaw ?? "";
    const result: string = b.result;
    if (result !== "unknown") continue;

    if (KNOWN_COMMENT_LEAKAGE_EXEMPTIONS.has(`${b.promotion}|${b.date}|${methodRaw}`)) {
      exemptedHits++;
      continue;
    }

    if (b.promotion === "HoostCup") {
      if (methodRaw.includes("無効試合")) {
        violations.push({ slug: f.slug, promotion: b.promotion, date: b.date, methodRaw, result, reason: "無効試合なのにno_contestでない" });
      } else if (HOOSTCUP_SCORE_RE.test(methodRaw)) {
        violations.push({ slug: f.slug, promotion: b.promotion, date: b.date, methodRaw, result, reason: "判定N-M形式なのにwin/loss/drawが導出されていない" });
      }
    } else if (b.promotion === "NKB") {
      if (methodRaw.includes("試合中止")) {
        violations.push({ slug: f.slug, promotion: b.promotion, date: b.date, methodRaw, result, reason: "試合中止なのにcancelledでない" });
      } else if (methodRaw.includes("エキシビションマッ")) {
        violations.push({ slug: f.slug, promotion: b.promotion, date: b.date, methodRaw, result, reason: "エキシビションマッチなのにno_contestでない" });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    `[kick-unknown-result-fallback] ★機械的に導出できるはずの決着パターンがunknownのまま` +
      `${violations.length}件見つかりました。デプロイをブロックします:\n` +
      violations
        .slice(0, 20)
        .map(
          (v) =>
            `  - ${v.slug} [${v.promotion}] (${v.date ?? "date null"}): methodRaw="${v.methodRaw}" result="${v.result}" (${v.reason})`,
        )
        .join("\n"),
  );
  process.exit(1);
}

if (exemptedHits === 0) {
  console.error(
    "[kick-unknown-result-fallback] ★KNOWN_COMMENT_LEAKAGE_EXEMPTIONSに登録された既知例外が" +
      "1件もヒットしませんでした。バグが別途修正され不要になった可能性があるため、" +
      "このexemptionエントリを削除してください。",
  );
  process.exit(1);
}

console.log(
  `[kick-unknown-result-fallback] OK(HoostCup判定スコア・NKBエキシビション/試合中止のフォールバック漏れ0件、` +
    `既知例外${exemptedHits}件は除外)`,
);
