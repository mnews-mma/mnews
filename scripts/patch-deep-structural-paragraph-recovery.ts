// 見出し表記に依存しない構造段落回収bout最小パッチ(2026-08-02、PR #374の
// フォローアップ)。
//
// out/deep-headingless-recovery-reconciliation.mdで判明した「a)監査の21件の
// うち2件はrecoverHeadinglessBouts()(見出し語ベース)では回収できなかった」
// 件への対応:
//   - DEEP OSAKA IMPACT 2022 5th ROUND セミファイナル: VS型(mark無し)カードの
//     bout境界検出がGroup1(BOUT_RE_GROUP1)の複雑な先読み境界と噛み合わず、
//     同一大会内の大半のboutが道連れで欠落していた。
//   - DEEP 130 IMPACT メインイベント: ノーコンテストのため勝敗markが存在せず、
//     「王者：/：挑戦者」という肩書き付き表記のみで選手が示される特殊構造。
//
// 見出しパターンを追加する方向には戻らず、deepScraper.tsの
// countStructuralBoutBlocks()と同じ根拠(生HTMLの<p class="wp-block-paragraph">
// 1個=bout1件というDOM構造+ジム括弧+決着手がかり)でrecoverStructuralParagraphBouts()
// を実装し、それを使って回収する(3.7節、deepScraper.ts参照)。
//
// data/deepRecords.jsonへの反映方式はPR #374と同じ最小パッチ(既存bout・
// 既存フィールドは完全に不変のまま、回収boutだけを追記)。
//
// 実行: npx tsx scripts/patch-deep-structural-paragraph-recovery.ts
import fs from "fs";
import path from "path";
import { isExcludedNonProBout } from "../src/lib/mnewsRating/nonProBoutFilter";
import { recoverStructuralParagraphBouts, resolveOutcome, DeepRecordsBout, DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";
import { findFighterSlugByName } from "../src/lib/fighters";

const DATA_PATH = path.join(process.cwd(), "data", "deepRecords.json");
const CACHE_DIR = path.join(process.cwd(), "out", "deep-html-cache");
const REPORT_OUT = path.join(process.cwd(), "out", "deep-structural-paragraph-recovery-patch-report.md");

// build-deep-records.tsのBARE_NAME_WEIGHT_CLASS_OVERRIDES/
// resolveBareNameWithWeightClassと同一(裸表記選手名の階級限定フォールバック)。
const BARE_NAME_WEIGHT_CLASS_OVERRIDES: { bareName: string; weightClassPattern: RegExp; slug: string }[] = [
  { bareName: "大成", weightClassPattern: /メガトン級/, slug: "sekino-taisei" },
];
function resolveBareNameWithWeightClass(name: string, weightClassRaw: string | null): string | null {
  const trimmed = name.trim();
  const hit = BARE_NAME_WEIGHT_CLASS_OVERRIDES.find(
    (o) => o.bareName === trimmed && !!weightClassRaw && o.weightClassPattern.test(weightClassRaw)
  );
  return hit ? hit.slug : null;
}

function slugFor(url: string): string {
  const slug = url.replace(/\/$/, "").split("/").pop() || "unknown";
  return slug.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function findCachedHtml(url: string): string | null {
  if (!fs.existsSync(CACHE_DIR)) return null;
  const suffix = `_${slugFor(url)}.html`;
  const match = fs.readdirSync(CACHE_DIR).find((f) => f.endsWith(suffix));
  return match ? fs.readFileSync(path.join(CACHE_DIR, match), "utf-8") : null;
}

function main() {
  const events: DeepRecordsEvent[] = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const reportLines: string[] = [
    "# deep-structural-paragraph-recovery-patch-report",
    "",
    "PR #374フォローアップ: 構造段落(countStructuralBoutBlocks()と同じ根拠)からの回収bout最小パッチ適用結果。",
    "既存bout・既存フィールドは一切変更していない(追記のみ)。",
    "",
    "| 大会名 | 日付 | 追加bout | 相手 | 勝敗 | 決まり手 |",
    "|---|---|---|---|---|---|",
  ];

  let missingCache = 0;
  let totalAdded = 0;
  let totalNonProSkipped = 0;

  for (const ev of events) {
    const html = findCachedHtml(ev.sourceUrl);
    if (!html) {
      missingCache++;
      console.warn(`[WARN] キャッシュ無し: ${ev.eventName} (${ev.sourceUrl})`);
      continue;
    }
    const existingPairs = ev.bouts.map((b) => ({ fighterAName: b.fighterAName, fighterBName: b.fighterBName }));
    const recovered = recoverStructuralParagraphBouts(html, existingPairs);
    if (recovered.length === 0) continue;

    const maxCardPosition = ev.bouts.reduce((m, b) => Math.max(m, b.cardPosition), 0);
    const newBouts: DeepRecordsBout[] = [];
    recovered.forEach((raw, i) => {
      if (
        isExcludedNonProBout({
          headingText: raw.weightClassRaw,
          namedDivision: raw.weightClassRaw,
          eventName: ev.eventName,
        })
      ) {
        totalNonProSkipped++;
        return;
      }
      const outcome = resolveOutcome(raw);
      const fighterASlug = findFighterSlugByName(raw.fighterAName) ?? resolveBareNameWithWeightClass(raw.fighterAName, raw.weightClassRaw);
      const fighterBSlug = findFighterSlugByName(raw.fighterBName) ?? resolveBareNameWithWeightClass(raw.fighterBName, raw.weightClassRaw);
      const winnerName = outcome.winner === "A" ? raw.fighterAName : outcome.winner === "B" ? raw.fighterBName : null;
      const winnerSlug = outcome.winner === "A" ? fighterASlug : outcome.winner === "B" ? fighterBSlug : null;

      newBouts.push({
        cardPosition: maxCardPosition + recovered.length - i,
        isOpeningFight: false,
        headingText: raw.weightClassRaw ?? "",
        fighterAName: raw.fighterAName,
        fighterBName: raw.fighterBName,
        fighterASlug,
        fighterBSlug,
        ruleType: "unknown",
        weightKg: null,
        namedDivision: raw.weightClassRaw,
        resultType: outcome.resultType,
        winnerName,
        winnerSlug,
        round: null,
        time: null,
        methodRaw: raw.methodRaw,
        isWeighInMiss: false,
        format: raw.format,
        boutNumber: raw.boutNumber,
      });

      reportLines.push(
        `| ${ev.eventName} | ${ev.date} | ${raw.fighterAName} | ${raw.fighterBName} | ${winnerName ?? "(判定不可)"} | ${raw.methodRaw.slice(0, 60)} |`
      );
    });

    if (newBouts.length === 0) continue;
    ev.bouts = [...newBouts, ...ev.bouts];
    totalAdded += newBouts.length;
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(events, null, 2) + "\n");
  reportLines.splice(
    5,
    0,
    "",
    `合計追加bout数: ${totalAdded}件`,
    `非プロ/非MMA判定で除外: ${totalNonProSkipped}件`,
    `キャッシュ無しでスキップした大会: ${missingCache}件`,
    ""
  );
  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, reportLines.join("\n") + "\n");

  console.log(`\n合計追加bout数: ${totalAdded}件`);
  console.log(`非プロ/非MMA判定で除外: ${totalNonProSkipped}件`);
  console.log(`キャッシュ無しでスキップした大会: ${missingCache}件`);
  console.log(`[OK] ${DATA_PATH} を更新しました。`);
  console.log(`[OK] ${REPORT_OUT} に書き出しました。`);
}

main();
