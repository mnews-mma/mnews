// 指示書①(選手ページの1行目/勝率/フィニッシュ率/決まり手内訳チャートの
// ソース混在解消)の変更前後diffを列挙する検証スクリプト(読み取り専用)。
// 修正後のsrc/lib/fighters.ts calcFighterRates()・historyReconciles()を実際に
// importして「後」の値を出し、「前」の値はこのスクリプト内で旧ロジックを
// 再現して算出する(旧コードは既に書き換え済みのため再現でしか出せない)。
// 実行: npx tsx scripts/verify-fighter-rate-source-unify.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { calcFighterRates } from "../src/lib/fighters";
import { historyReconciles } from "../src/lib/fighterRecordIntegrity";
import { tallyMethods } from "../src/lib/methodClassify";
import type { FighterRecordEntry, FighterRecordsFile } from "../src/lib/fighterRecordsCache";
import { computeMultiOrgRecord } from "../src/lib/mnewsRating/multiOrgRecord";
import type { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", file), "utf8")) as T;
}

// 旧ロジックの再現(分子=history再集計/分母=infobox値のハイブリッド、修正前のcalcFighterRates)。
function oldFinishRate(f: FighterRecordEntry): number | null {
  const winMethods = tallyMethods(f.history.filter((h) => h.result === "win"));
  const finishCount = f.history.length > 0 ? winMethods.ko + winMethods.sub : f.ko + f.sub;
  return f.wins > 0 ? Math.round((finishCount / f.wins) * 100) : null;
}
// 旧チャート(修正前のMethodButterfly、bar合計をそのまま見出しにする)。
function oldChartTotals(f: FighterRecordEntry): { winTotal: number; lossTotal: number } | null {
  const wins = f.history.filter((h) => h.result === "win");
  const losses = f.history.filter((h) => h.result === "loss");
  if (wins.length === 0 && losses.length === 0) return null;
  const w = wins.length > 0 ? tallyMethods(wins) : { ko: 0, sub: 0, decision: 0, other: 0 };
  const l = losses.length > 0 ? tallyMethods(losses) : { ko: 0, sub: 0, decision: 0, other: 0 };
  return { winTotal: w.ko + w.sub + w.decision + w.other, lossTotal: l.ko + l.sub + l.decision + l.other };
}

function main() {
  const records = readJson<FighterRecordsFile>("fighterRecords.json");
  const rizinEvents = readJson<RizinRecordsEvent[]>("rizinRecords.json");
  const shootoArchive = readJson<ShootoRecordsEvent[]>("shootoRecords.json");
  const shootoProfile = readJson<ShootoRecordsEvent[]>("shootoProfileBouts.json");
  const pancraseEvents = readJson<PancraseRecordsEvent[]>("pancraseRecords.json");
  const deepEvents = readJson<DeepRecordsEvent[]>("deepRecords.json");
  const multiOrgData = { rizinEvents, shootoEvents: [...shootoArchive, ...shootoProfile], pancraseEvents, deepEvents };

  // A: チャート≠1行目 (本PRの修正対象)
  const typeASlugs = new Set<string>();
  // B: 2行目draws > 1行目draws (本PRのスコープ外。root causeが別=パンクラスゲートの
  // プロ/アマ判定基準の食い違い。out/sato-shoko-record-mismatch-report.md参照)
  const typeBSlugs = new Set<string>();

  let historyIncompleteStrict = 0; // 指示書①の定義: history行数 < wins+losses+draws
  let historyEmptyCount = 0;
  let population = 0; // out/sato-shoko-record-mismatch-report.md と同じ母集団定義

  for (const f of FIGHTERS) {
    const rec = records[f.slug];
    if (!rec) continue;
    const { wins, losses, draws, history, noRecordData } = rec;
    // 母集団: noRecordData=false かつ historyが空でない選手のみ(1行目自体が
    // 存在しない/history未取得の選手を「食い違い」として数えない)。
    if (noRecordData || history.length === 0) {
      if (history.length === 0) historyEmptyCount++;
      continue;
    }
    population++;
    if (history.length < wins + losses + draws) historyIncompleteStrict++;
    const oldChart = oldChartTotals(rec);
    if (oldChart && (oldChart.winTotal !== wins || oldChart.lossTotal !== losses)) {
      typeASlugs.add(f.slug);
    }
    const multiRecord = computeMultiOrgRecord(f.slug, multiOrgData);
    if (multiRecord.draws > draws) typeBSlugs.add(f.slug);
  }
  console.log(`母集団(noRecordData=false かつ historyが空でない): ${population}名`);

  const union = new Set<string>([...typeASlugs, ...typeBSlugs]);
  const overlap = [...typeASlugs].filter((s) => typeBSlugs.has(s));

  console.log(`A(チャート≠1行目): ${typeASlugs.size}名`);
  console.log(`B(2行目draws>1行目draws、本PRスコープ外): ${typeBSlugs.size}名`);
  console.log(`A∩B: ${overlap.length}名`);
  console.log(`A∪B(37名想定): ${union.size}名`);
  console.log(`history不完全(行数<wins+losses+draws、指示書①の定義): ${historyIncompleteStrict}名`);
  console.log(`history空(既知の正常パターン): ${historyEmptyCount}名`);
  console.log("");

  type DiffRow = {
    slug: string;
    nameJa: string;
    type: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  const diffRows: DiffRow[] = [];

  for (const slug of [...union].sort()) {
    const f = FIGHTERS.find((x) => x.slug === slug);
    const rec = records[slug];
    if (!f || !rec) continue;
    const isA = typeASlugs.has(slug);
    const isB = typeBSlugs.has(slug);
    const type = isA && isB ? "A+B" : isA ? "A" : "B";

    const oldWinRate = (() => {
      const decided = rec.wins + rec.losses;
      return decided > 0 ? Math.round((rec.wins / decided) * 100) : null;
    })();
    const before: Record<string, unknown> = {
      finishRate: oldFinishRate(rec),
      winRate: oldWinRate,
      chart: oldChartTotals(rec),
    };
    const reliable = historyReconciles(rec);
    const { finishRate: newFinishRate, winRate } = calcFighterRates(rec);
    const after: Record<string, unknown> = {
      finishRate: newFinishRate,
      winRate,
      chartReliable: reliable,
      chart: reliable ? { winTotal: rec.wins, lossTotal: rec.losses, note: "不明行あり得(捏造なし)" } : "非表示(history不完全のため)",
    };
    diffRows.push({ slug, nameJa: f.nameJa, type, before, after });
  }

  for (const r of diffRows) {
    console.log(`[${r.type}] ${r.slug} (${r.nameJa})`);
    console.log(`  before: ${JSON.stringify(r.before)}`);
    console.log(`  after : ${JSON.stringify(r.after)}`);
  }

  // 0%化・NaN・意図しない非表示化の検知
  let zeroPctFromNonZero = 0;
  let nanCount = 0;
  for (const r of diffRows) {
    const b = r.before.finishRate as number | null;
    const a = r.after.finishRate as number | null;
    if (Number.isNaN(a)) nanCount++;
    if (b !== null && b !== 0 && a === 0) zeroPctFromNonZero++;
  }
  console.log("");
  console.log(`finishRateがNaNになった件数: ${nanCount}`);
  console.log(`finishRateが非ゼロ→0%になった件数: ${zeroPctFromNonZero}`);
  const chartHiddenCount = diffRows.filter((r) => r.after.chartReliable === false).length;
  console.log(`チャートが非表示化した件数(意図的、A-1型): ${chartHiddenCount}`);

  fs.writeFileSync(
    path.join(process.cwd(), "out", "fighter-rate-source-unify-diff.json"),
    JSON.stringify({ typeASlugs: [...typeASlugs], typeBSlugs: [...typeBSlugs], union: [...union], diffRows }, null, 2)
  );
}

main();
