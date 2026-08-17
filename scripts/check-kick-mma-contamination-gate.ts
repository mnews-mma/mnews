// PR-G追補(2026-08、MMA混入監査、項目3): 立ち技名鑑(/kick)にMMA(総合格闘技)ルールの
// 試合が紛れ込んでいないかをビルド時に検知するゼロ件ゲート。
//
// 発端: 2026-06-21 KROSS×OVER CAGE.9の泰斗×岸本篤史戦がMMAタイトルマッチだったことが
// 判明(krossover.jp本文で「MMA PART メインイベントKROSS×OVER PRO-MMA LIGHTWEIGHT」と
// 確認)。全DB走査の結果、他に4件(坂本寿希×森本直哉のKROSS×OVER MMA戦、菊地美乃里の
// GLEAT MMA戦、イ・スファン/レミギウス・モリカビュチスのWikipedia経由MMA戦)を発見し、
// data/kick/manualRuleExclusions.json へ category:"mma" として追加済み。
//
// 検出ロジック(data/kick/generated/、ビルド後の最終データを検査する):
//   event または note フィールドに MMA/ケージ を示す語を含む行を候補とし、以下の
//   既知の正当なパターンを除外したうえで**1件でも残れば失敗**させる(ゼロ件ゲート)。
//
//   - SHOOT BOXING公式の「※MMA」ルールセット注記(method_raw末尾): SB公式サイト自体が
//     選手の他団体(RIZIN/DEEP等)でのMMA戦績を通算戦績として掲載しており、これは
//     methodLabel()が既にrulesetバッジとして表示している「取得元が意図して見せている」
//     情報であり、隠れた混入ではない。この注記があるものは対象外とする。
//
// ★既知の限界(このゲートが検知できないもの): KROSS×OVER公式(krossover.jp)は
// キック興行とMMA興行を同一カードで混在開催しており(例:「KICK PART・MMA PART」)、
// スクレイパー(scripts/standup-pipeline/ingest_krossover.py)がカード単位の大会名しか
// 保持していない(個別試合の見出し「▼第N試合...KICK PART」「...MMA PART」を構造化
// フィールドとして残していない)ため、**大会名に「MMA」を含むがそのbout自体はKICK PART
// (正当な立ち技戦)というケースを、event/noteフィールドの機械判定だけでは区別できない**。
// このゲートはevent側にこの既知の曖昧パターン(KICK PART・MMA PART等の複合表記)がある
// 場合は自動判定の対象から外し、個別確認・data/kick/manualRuleExclusions.jsonへの
// 登録という手動プロセスに委ねる(坂本寿希×森本直哉戦はこの経路で発見・登録した実例)。
// 根本対応(スクレイパーが試合単位の見出しを構造化データとして保持するようにする)は
// このPRのスコープ外(次PRへの申し送り)。
//
// 実行方法: npx tsx scripts/check-kick-mma-contamination-gate.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");

const MMA_SIGNAL_RE = /MMA|ＭＭＡ|ケージ/;
// SHOOT BOXING公式の正当なルールセット注記(methodLabel()が既にバッジ表示している)。
const SB_RULESET_SUFFIX_RE = /※MMA\s*$/;
// KROSS×OVERの「キック興行とMMA興行の混在カード」を示す複合表記。個別試合の
// KICK/MMA区分がスクレイパー側で構造化されていないため、機械判定の対象から外す
// (既知の限界、上記コメント参照)。
const KROSSOVER_COMBINED_TITLE_RE = /KICK[・\s]*PART[・\s]*MMA[・\s]*PART|KICK[・\s]*MMA[・\s]*PART/i;

interface Violation {
  slug: string;
  date: string | null;
  event: string | null;
  note: string | null;
  opponentName: string;
}

const violations: Violation[] = [];
const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));

for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    const event = b.event ?? "";
    const note = b.note ?? "";
    const hasSignal = MMA_SIGNAL_RE.test(event) || MMA_SIGNAL_RE.test(note);
    if (!hasSignal) continue;
    if (SB_RULESET_SUFFIX_RE.test((b.methodRaw ?? "").trim())) continue; // 正当なSBルールセット注記
    if (KROSSOVER_COMBINED_TITLE_RE.test(event) && !MMA_SIGNAL_RE.test(note)) continue; // 既知の限界(手動確認対象)
    violations.push({ slug: f.slug, date: b.date, event: b.event, note: b.note, opponentName: b.opponentName });
  }
}

if (violations.length > 0) {
  console.error(
    `[kick-mma-contamination] ★MMA混入の疑いがある行が${violations.length}件見つかりました。` +
      `デプロイをブロックします:\n` +
      violations
        .map(
          (v) =>
            `  - ${v.slug}: ${v.date ?? "date不明"} vs ${v.opponentName} / event="${v.event}" / note="${v.note}"`,
        )
        .join("\n") +
      `\n  対処法: 個別に一次資料を確認し、MMAルールの試合であればdata/kick/manualRuleExclusions.json` +
      `へcategory:"mma"として追加してください(既存の泰斗・坂本寿希等の登録例を参照)。`,
  );
  process.exit(1);
}

console.log("[kick-mma-contamination] OK(MMA混入0件)");
