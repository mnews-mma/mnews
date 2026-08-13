// sigmaDivisionScope.ts(σディスカウントの戦数入力を階級スコープに絞り込む
// 分類ロジック)のユニットテスト。実行: npx tsx scripts/test-sigma-division-scope.ts
//
// 2026-08-13改訂: トレランス定数を撤廃し「最も近いリミット値の階級」方式に
// 変更したため、テストもそれに合わせて書き換えた。
import { classifyBoutForDivisionScope, countDivisionScopedFights } from "../src/lib/mnewsRating/sigmaDivisionScope";

let passes = 0;
let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// ── ルール1: 明示的な階級名 ──────────────────────────────────────────
check(
  classifyBoutForDivisionScope("ライト級", "ライト級").kind === "current",
  "ルール1: 明示的階級名が現階級と一致すればcurrent"
);
{
  const r = classifyBoutForDivisionScope("ライト級", "フェザー級");
  check(r.kind === "other" && r.division === "ライト級", "ルール1: 明示的階級名が現階級と異なればother(実例: karamov-vugar)");
}

// ── ルール2: 最も近いリミット(ちょうどの値も含む) ──────────────────────
{
  // 武田光司の実例: 71kg契約、現掲載階級フェザー級 → ライト級戦としてother
  const r = classifyBoutForDivisionScope("71kg契約", "フェザー級");
  check(r.kind === "other" && r.division === "ライト級", "ルール2: 71kgちょうどはライト級(武田光司の実例)");
}
{
  // ノジモフの実例: 66kg契約、現掲載階級ライト級 → フェザー級戦としてother
  const r = classifyBoutForDivisionScope("66kg契約", "ライト級");
  check(r.kind === "other" && r.division === "フェザー級", "ルール2: 66kgちょうどはフェザー級(ノジモフの実例)");
}
check(classifyBoutForDivisionScope("71kg契約", "ライト級").kind === "current", "ルール2: リミットちょうどが現階級自身と一致すればcurrent");

check(
  classifyBoutForDivisionScope("59kg契約", "フライ級").kind === "current",
  "ルール2: 59kgはフライ級リミット57に最も近い(トーレスの実例)"
);
check(classifyBoutForDivisionScope("68kg契約", "フェザー級").kind === "current", "ルール2: 68kgはフェザー級リミット66に最も近い(直樹の実例)");
{
  // 69kgはフェザー66(距離3)よりライト71(距離2)の方が近い → ライト級
  const r = classifyBoutForDivisionScope("69kg契約", "フェザー級");
  check(r.kind === "other" && r.division === "ライト級", "ルール2: 69kgはライト級の方が近い(直樹の実例、旧トレランス版とは結果が変わる)");
}
{
  // 72kgはライト71(距離1)が最も近い → もはやnullではなくライト級
  const r = classifyBoutForDivisionScope("72kg契約", "フェザー級");
  check(r.kind === "other" && r.division === "ライト級", "ルール2: 72kgはライト級が最も近い(武田光司の実例、旧トレランス版のnullから変更)");
}
{
  // 62kgはバンタム61(距離1)が最も近い → バンタム級
  const r = classifyBoutForDivisionScope("62kg契約", "フライ級");
  check(r.kind === "other" && r.division === "バンタム級", "ルール2: 62kgはバンタム級が最も近い(山本アーセンの実例)");
}

// ── 等距離の同着は軽い方 ──────────────────────────────────────────
{
  // 59kg: フライ57(距離2) vs バンタム61(距離2) → 同着、軽い方(フライ級)
  const r = classifyBoutForDivisionScope("59kg契約", "バンタム級");
  check(r.kind === "other" && r.division === "フライ級", "同着(59kg): フライ級とバンタム級が等距離、軽い方(フライ級)を採る");
}
{
  // 63.5kg: バンタム61(距離2.5) vs フェザー66(距離2.5) → 同着、軽い方(バンタム級)
  const r = classifyBoutForDivisionScope("63.5kg契約", "フェザー級");
  check(r.kind === "other" && r.division === "バンタム級", "同着(63.5kg): バンタム級とフェザー級が等距離、軽い方(バンタム級)を採る");
}

// ── ヘビー級(93kg以上) ────────────────────────────────────────────
check(classifyBoutForDivisionScope("95kg契約", "ヘビー級").kind === "current", "93kg以上はヘビー級");
{
  const r = classifyBoutForDivisionScope("95kg契約", "ライト級");
  check(r.kind === "other" && r.division === "ヘビー級", "95kgはヘビー級と判定され、ライト級のcurrentにはならない");
}

// ── ルール3: 生表記の欠損・数値抽出不能 ─────────────────────────────────
{
  const r = classifyBoutForDivisionScope(undefined, "フライ級");
  check(r.kind === "neutral" && r.reason === "missing", "生表記欠損は中立");
}
{
  const r = classifyBoutForDivisionScope("ウェルター級", "フェザー級");
  check(r.kind === "neutral" && r.reason === "unparseable", "非対応階級名(ウェルター等)は中立(unparseable)");
}

// ── countDivisionScopedFights: 配列全体からcurrentの件数だけを数える ────────
{
  const n = countDivisionScopedFights(
    "dummy-slug",
    [
      { date: "2021-01-01", weightClass: "71kg契約" },
      { date: "2021-02-01", weightClass: "71kg契約" },
      { date: "2021-03-01", weightClass: "66kg契約" },
      { date: "2021-04-01", weightClass: "72kg契約" },
      { date: "2021-05-01", weightClass: undefined },
      { date: "2021-06-01", weightClass: "フェザー級" },
    ],
    "フェザー級"
  );
  // 71kg×2→ライト級(other除外)、66kg→current、72kg→ライト級(other除外)、undefined→中立、フェザー級→current
  check(n === 2, "countDivisionScopedFights: current判定分のみをカウントする(期待値2)");
}

// ── ピンポイント訂正(DIVISION_SCOPE_BOUT_OVERRIDES): 直樹×細川一颯の実例 ──────
{
  const n = countDivisionScopedFights(
    "naoki",
    [
      { date: "2025-07-27", weightClass: "68kg契約" },
      { date: "2026-08-11", weightClass: "69kg契約" }, // 機械分類ならライト級だが訂正でフェザー級
    ],
    "フェザー級"
  );
  // 68kg→フェザー級(機械分類どおりcurrent)、69kg→訂正によりフェザー級(current)。両方カウントされる
  check(n === 2, "ピンポイント訂正: 直樹×細川一颯(2026-08-11)は機械分類(ライト級)ではなく訂正どおりフェザー級として数える");
}
{
  // 訂正対象外の選手・日付では機械分類のまま(69kgはライト級=other、current扱いされない)
  const n = countDivisionScopedFights("someone-else", [{ date: "2026-08-11", weightClass: "69kg契約" }], "フェザー級");
  check(n === 0, "ピンポイント訂正: 対象外の選手には適用されない(69kgは機械分類どおりライト級)");
}

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);
