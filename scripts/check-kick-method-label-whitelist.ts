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
//
// PR #571追記: 上記の不変条件チェックとは別に、「不明」化した件数(fuMeiCount)自体を
// ratchetベースラインとして監視する。whitelist方式は「一致しない入力は静かに『不明』に
// 逃がす」設計であるため、新しい混入パターン(旧denylistが個別追記していたような欠陥)が
// 増えても、このゲート単体(不変条件チェックのみ)ではビルドは落ちない――「不明」が
// 増えるだけで、それ自体は不変条件違反ではないため。件数の増加を別途ratchetで検知し、
// 人間が「新規パターンとしてwhitelistへ追加すべきか」「新しい混入か」を判断する契機にする。
import fs from "fs";
import path from "path";
import { methodLabel, isMethodLabelWhitelisted } from "../src/lib/kick/data";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");
const FUMEI_BASELINE_PATH = path.join(ROOT, "data/kick/kickMethodFumeiBaseline.json");

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

const prevFumeiBaseline: number = fs.existsSync(FUMEI_BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(FUMEI_BASELINE_PATH, "utf8")).fuMeiCount
  : fuMeiCount;

if (fuMeiCount > prevFumeiBaseline) {
  console.error(
    `[kick-method-fumei-ratchet] ★決着欄が「不明」になった件数が前回ビルド時点の基準` +
      `(${prevFumeiBaseline}件)から${fuMeiCount}件に増加しました。デプロイをブロックします。\n` +
      `  対処法: 新しく「不明」になった行のmethodRawを確認し、正当な決着表記の新パターンで` +
      `あればsrc/lib/kick/data.tsのwhitelist正規表現に追加してください。逆に大会レポート散文等の` +
      `混入であれば、whitelistに追加せず「不明」のままでよく、この基準自体を更新して問題ありません。`,
  );
  process.exit(1);
}

fs.writeFileSync(FUMEI_BASELINE_PATH, JSON.stringify({ fuMeiCount }, null, 1) + "\n");
console.log(
  `[kick-method-fumei-ratchet] OK(「不明」化${fuMeiCount}件、基準${prevFumeiBaseline}件以下)`,
);
