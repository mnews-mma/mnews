// PR #570(50人検品調査の是正): 決着(methodLabel()の出力)をdenylist方式からwhitelist方式に
// 置き換えた際の恒久ゲート。
//
// 背景: 旧denylist(PROSE_METHOD_RAW、src/lib/kick/data.ts)は「入力側だけNFKC正規化し、
// denylist(Set)のリテラル側は正規化しない」という片側正規化バグを持っており、全角/半角
// 括弧の表記差だけで大会レポート散文が決着欄にそのまま表示される欠陥が本番で見つかった
// (50人層化無作為検品、hirahara-riku)。denylist方式は「新しい混入パターンが出るたびに
// 個別追記が必要」という構造的な弱点もある。methodLabel()自体をwhitelist方式(許可した
// パターンにだけ一致させ、外れたら「不明」)に置き換えたが、このゲートはその不変条件が
// 将来のリファクタで崩れていないかをビルド時に多重防御として再検証する。
//
// isMethodLabelWhitelisted()はsrc/lib/kick/data.tsからmethodLabel()と同じ定義を再利用する
// (このゲート専用に別定義を持たない。定義がズレると検知の意味が無くなるため)。
//
// data/kick/generated/ (scripts/build-kick-data.tsが直前に生成) を読む。生データ
// (data/kick/*.json)は一切変更しない。
//
// このゲートはゼロ件不変条件(ratchetではない): methodLabel()の出力は常に
// (プレースホルダ OR whitelistに一致)のいずれかでなければならない。これは
// methodLabel()の実装そのものが保証すべき不変条件であり、1件でも破れていたら
// 実装のバグ(whitelist判定の書き換え忘れ等)なのでビルドを止める。
import fs from "fs";
import path from "path";
import { methodLabel, isMethodLabelWhitelisted } from "../src/lib/kick/data";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");

interface Violation {
  slug: string;
  date: string | null;
  methodRaw: string;
  output: string;
}

const violations: Violation[] = [];
let total = 0;
let fuMeiCount = 0;

const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));
for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    total++;
    const output = methodLabel(b.methodRaw);
    if (output === "不明") fuMeiCount++;
    if (!isMethodLabelWhitelisted(output)) {
      violations.push({ slug: f.slug, date: b.date, methodRaw: b.methodRaw, output });
    }
  }
}

console.log(
  `[kick-method-label-whitelist] 検査対象${total}行、whitelist外→「不明」化${fuMeiCount}行` +
    `(${((fuMeiCount / total) * 100).toFixed(2)}%)`,
);

if (violations.length > 0) {
  console.error(
    `[kick-method-label-whitelist] ★methodLabel()の出力が(プレースホルダ OR whitelist一致)の` +
      `どちらでもない行が${violations.length}件見つかりました。methodLabel()の実装で` +
      `whitelist判定が外れている(または回帰した)可能性があります。デプロイをブロックします:\n` +
      violations
        .slice(0, 20)
        .map((v) => `  - ${v.slug} (${v.date ?? "date null"}): methodRaw="${v.methodRaw}" → output="${v.output}"`)
        .join("\n"),
  );
  process.exit(1);
}

console.log("[kick-method-label-whitelist] OK(全行がプレースホルダまたはwhitelistのいずれかに一致)");
