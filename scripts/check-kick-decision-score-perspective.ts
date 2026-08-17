// PR #573: /kick 決着欄の判定スコアを選手視点(自分が勝ちならX>=Y、負けならX<=Yの並び)に
// 統一するnormalizeKickDecisionScorePerspective()(src/lib/kick/decisionScorePerspective.ts)
// を選手ページ(src/app/kick/fighters/[slug]/page.tsx)に組み込んだ際の恒久ゲート。
//
// 背景(PR #570の調査): win/loss判定行のうち「判定X-Y」形式のメインスコアが抽出できた
// 6,674行(2026-08-17時点)中972行(14.56%)で、メインスコアの大小関係が勝敗欄(result)と
// 矛盾していた(元の測定はPR #570のアドホックな調査スクリプトによるもので、当時は
// 6,662行中979件・14.70%と報告されている。件数の差はデータの自然な増減によるもので、
// 測定方法自体はPR#570の記述を踏襲している)。無作為10件の出典突合の結果、これは
// mnews側のバグでも出典側の誤記でもなく、出典サイト側の「勝者優先/掲載順優先」という
// 表記慣習をそのまま転記しているために起きる表示上の見え方の問題だと判明した
// (詳細はout/kick-decision-score-perspective-report.md参照)。
//
// このゲートは2つの不変条件を検査する:
//
// 1. ゼロ件不変条件(ratchetではない): normalizeKickDecisionScorePerspective()の出力に
//    含まれるメインスコアの大小関係は、常に勝敗欄(result)と整合していなければならない
//    (メインスコアが抽出できて2値が異なる行に限る。内訳の並べ替えが技術的に困難で
//    メインのみ対応(swapped_main_only)になった行も、メイン自体は必ず整合するはず)。
//    これは関数自体の実装が保証すべき不変条件であり、1件でも破れていたら実装の
//    バグ(回帰)なのでビルドを止める(check-kick-method-label-whitelist.tsと同じ設計)。
//
// 2. 内訳(括弧内の審判別スコア)まで完全に並べ替えられなかった件数
//    (swapped_main_only、実データでは「27:29×3」のような繰り返し表記や、
//    「29-.30」のような区切り文字の破損等で内訳を安全にペア分解できない場合に発生)を
//    ratchetベースラインとして監視する。この件数自体は不整合ではない(メインは
//    正しく直っている)が、新しい内訳パターンが増えていないかを人間が確認する契機にする。
import fs from "fs";
import path from "path";
import { methodLabel, type KickBout } from "../src/lib/kick/data";
import {
  normalizeKickDecisionScorePerspective,
  extractMainScorePair,
} from "../src/lib/kick/decisionScorePerspective";
import { isDecisionScoreOrderCorrect } from "../src/lib/decisionScoreDirection";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");
const BASELINE_PATH = path.join(ROOT, "data/kick/kickDecisionScorePerspectiveBaseline.json");

interface Violation {
  slug: string;
  date: string | null;
  result: string;
  before: string;
  after: string;
}

interface MainOnlyCase {
  slug: string;
  date: string | null;
  before: string;
  after: string;
}

const violations: Violation[] = [];
const mainOnlyCases: MainOnlyCase[] = [];
let boutRows = 0;
let judgedRows = 0; // メインスコアが抽出でき、2値が異なる行(swap判定の対象)
let swappedCount = 0;
let mainOnlyCount = 0;
let alreadyCorrectCount = 0;
let tiedCount = 0;
let noScoreCount = 0;
let notWinLossCount = 0;

const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));
for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as KickBout[]) {
    boutRows++;
    const label = methodLabel(b.methodRaw);
    const res = normalizeKickDecisionScorePerspective(label, b.result);

    switch (res.category) {
      case "not_win_loss":
        notWinLossCount++;
        continue;
      case "no_score":
        noScoreCount++;
        continue;
      case "tied":
        tiedCount++;
        continue;
      case "already_correct":
        alreadyCorrectCount++;
        break;
      case "swapped":
        swappedCount++;
        break;
      case "swapped_main_only":
        mainOnlyCount++;
        if (mainOnlyCases.length < 200) {
          mainOnlyCases.push({ slug: f.slug, date: b.date, before: label, after: res.text });
        }
        break;
      case "unparseable":
        // unparseableは「並べ替えなかった」だけで不整合とは限らない(判断を保留した行)。
        // 件数自体は別途レポートで扱う対象だが、このゲートの不変条件チェック対象からは
        // 除外する(swap後の整合性を主張していないため)。
        continue;
    }

    // ここに来るのは already_correct / swapped / swapped_main_only のいずれか。
    // 出力中のメインスコア(判定直後の最初の数字ペア)を再抽出し、resultと整合しているか検証する。
    // 抽出には実装本体(src/lib/kick/decisionScorePerspective.ts)と同じ
    // extractMainScorePair()を使う(ゲート側で独自に正規表現を再実装すると定義がズレて
    // 検知の意味が無くなる。開発中に実際にこれで誤検知した経緯があるため徹底する)。
    judgedRows++;
    const pair = extractMainScorePair(res.text);
    if (!pair) {
      violations.push({ slug: f.slug, date: b.date, result: b.result, before: label, after: res.text });
      continue;
    }
    if (pair.a !== pair.b && !isDecisionScoreOrderCorrect(pair.a, pair.b, b.result as "win" | "loss")) {
      violations.push({ slug: f.slug, date: b.date, result: b.result, before: label, after: res.text });
    }
  }
}

console.log(
  `[kick-decision-score-perspective] 検査対象${boutRows}行` +
    ` (勝敗無し/引分等${notWinLossCount}・スコア無し${noScoreCount}・メイン同数${tiedCount}` +
    `・既に選手視点${alreadyCorrectCount}・全体並べ替え${swappedCount}・メインのみ並べ替え${mainOnlyCount})`,
);

if (violations.length > 0) {
  console.error(
    `[kick-decision-score-perspective] ★並べ替え後もメインスコアの大小関係が勝敗欄と矛盾する行が` +
      `${violations.length}件見つかりました。normalizeKickDecisionScorePerspective()の実装に` +
      `回帰がある可能性があります。デプロイをブロックします:\n` +
      violations
        .slice(0, 20)
        .map((v) => `  - ${v.slug} (${v.date ?? "date null"}, ${v.result}): "${v.before}" → "${v.after}"`)
        .join("\n"),
  );
  process.exit(1);
}

console.log(
  `[kick-decision-score-perspective] OK(判定対象${judgedRows}行すべてでメインスコアが勝敗欄と整合)`,
);

const prevBaseline: number = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).mainOnlyCount
  : mainOnlyCount;

if (mainOnlyCount > prevBaseline) {
  console.error(
    `[kick-decision-score-perspective-ratchet] ★内訳(審判別スコア)を並べ替えられずメインの` +
      `みの対応になった行が前回ビルド時点の基準(${prevBaseline}件)から${mainOnlyCount}件に` +
      `増加しました。デプロイをブロックします。\n` +
      `  対処法: 新しく発生した行のmethodRaw/内訳表記を確認し、安全に一般化できるパターン` +
      `であればsrc/lib/kick/decisionScorePerspective.tsのWITHIN_PAIR_CONNECTOR_RE等を拡張して` +
      `ください。単なるデータ側のノイズ(繰り返し表記「×N」・区切り文字の欠損等)であれば、` +
      `メインのみの対応のままでよく、この基準自体を更新して問題ありません。\n` +
      mainOnlyCases
        .slice(0, 20)
        .map((c) => `  - ${c.slug} (${c.date ?? "date null"}): "${c.before}" → "${c.after}"`)
        .join("\n"),
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ mainOnlyCount }, null, 1) + "\n");
console.log(
  `[kick-decision-score-perspective-ratchet] OK(メインのみ対応${mainOnlyCount}件、基準${prevBaseline}件以下)`,
);
