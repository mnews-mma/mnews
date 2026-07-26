// 指示書④ Phase1(収録基準の判断材料づくり)。読み取り専用分析。
// 入力: out/_input-deep-event-participants-updated.csv (PR#208 out/deep-event-participants-updated.csv のコピー)
//       out/_input-roster-coverage-updated.csv (PR#208 out/roster-coverage-updated.csv のコピー)
// 新しい選手名正規化関数は書かない。既存CSVのname_normalized/mnews_slug/statusをそのまま使う。
// 基準そのものは決めない。推奨・優先度づけは書かない。
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

interface ParticipantRow {
  event_id: string;
  brand: string;
  event_date: string;
  bout_index: string;
  side: string;
  result: string;
  name_raw: string;
  gym_raw: string;
  name_normalized: string;
  weight_class_raw: string;
  source_url: string;
  fetched_at: string;
  mnews_slug: string;
  status: string;
  match_confidence: string;
  name_confidence: string;
}

interface RosterRow {
  org: string;
  weight_class_raw: string;
  weight_class_mnews: string;
  weight_class_reason: string;
  rank: string;
  name_official: string;
  name_normalized: string;
  source_url: string;
  fetched_at: string;
  mnews_slug: string;
  status: string;
  match_confidence: string;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadCsv<T>(file: string): T[] {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const lines = raw.split("\n").filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj as T;
  });
}

const participants = loadCsv<ParticipantRow>("out/_input-deep-event-participants-updated.csv");
const roster = loadCsv<RosterRow>("out/_input-roster-coverage-updated.csv");

console.log(`[S0] deep-event-participants: ${participants.length}行`);
console.log(`[S0] roster-coverage(パンクラス・修斗): ${roster.length}行`);

// ── S0: 凍結値との一致確認 ──────────────────────────
const byName = new Map<string, ParticipantRow[]>();
for (const r of participants) {
  if (!byName.has(r.name_normalized)) byName.set(r.name_normalized, []);
  byName.get(r.name_normalized)!.push(r);
}
const uniqueCount = byName.size;
const statusByName = new Map<string, string>();
let statusInconsistency: string[] = [];
for (const [name, rows] of byName) {
  const statuses = new Set(rows.map((r) => r.status));
  if (statuses.size > 1) statusInconsistency.push(name);
  statusByName.set(name, rows[0].status);
}
const statusCounts = { listed: 0, hidden: 0, missing: 0 };
for (const s of statusByName.values()) {
  if (s === "listed") statusCounts.listed++;
  else if (s === "hidden") statusCounts.hidden++;
  else if (s === "missing") statusCounts.missing++;
}
console.log(`[S0] ユニーク選手数: ${uniqueCount} (期待値490)`);
console.log(`[S0] listed=${statusCounts.listed}(期待64) hidden=${statusCounts.hidden}(期待4) missing=${statusCounts.missing}(期待422)`);
console.log(`[S0] status不整合(同一選手で複数status): ${statusInconsistency.length}件`);

const S0_OK =
  uniqueCount === 490 &&
  statusCounts.listed === 64 &&
  statusCounts.hidden === 4 &&
  statusCounts.missing === 422 &&
  roster.length === 189 &&
  statusInconsistency.length === 0;

if (!S0_OK) {
  console.error("[S0] ★凍結値と不一致。停止条件に該当。以降の分析は実行しない。");
  process.exit(1);
}
console.log("[S0] OK: 凍結値(490/listed64/hidden4/missing422、roster189件)と完全一致。");

// ── 選手別集計 ──────────────────────────────────────
interface FighterAgg {
  name: string;
  status: string;
  appearances: ParticipantRow[];
  totalAppearances: number;
  datedAppearances: number; // event_date が空でないもの
  brands: Set<string>;
  primaryBrand: string;
  mostRecentDate: string | null; // "" は除外
  isAllAmateur: boolean; // 日付が取れた出場が1件以上あり、かつ全てアマチュア表記
  hasAnyAmateur: boolean;
  hasTitleMatch: boolean;
  hasRankInRosterSet: boolean; // roster-coverage(189件)側にも同名で存在するか
}

const AMATEUR_RE = /アマチュア/;
const TITLE_RE = /(タイトルマッチ|王座決定戦|王座)/;

const rosterNameSet = new Set(roster.map((r) => r.name_normalized));

const fighters: FighterAgg[] = [];
for (const [name, rows] of byName) {
  const brandCounts = new Map<string, number>();
  let mostRecentDate: string | null = null;
  let datedAppearances = 0;
  let amateurCount = 0;
  let hasAnyAmateur = false;
  let hasTitleMatch = false;
  for (const r of rows) {
    brandCounts.set(r.brand, (brandCounts.get(r.brand) ?? 0) + 1);
    if (r.event_date.trim()) {
      datedAppearances++;
      if (!mostRecentDate || r.event_date > mostRecentDate) mostRecentDate = r.event_date;
    }
    if (AMATEUR_RE.test(r.weight_class_raw)) {
      amateurCount++;
      hasAnyAmateur = true;
    }
    if (TITLE_RE.test(r.weight_class_raw)) hasTitleMatch = true;
  }
  // primaryBrand: 出場数最多(同数はイベント日降順=最新出場のbrandを優先)
  let primaryBrand = rows[0].brand;
  let bestCount = -1;
  const sortedByDateDesc = [...rows].sort((a, b) => (b.event_date || "").localeCompare(a.event_date || ""));
  const brandFirstSeen = new Map<string, number>();
  sortedByDateDesc.forEach((r, i) => {
    if (!brandFirstSeen.has(r.brand)) brandFirstSeen.set(r.brand, i);
  });
  for (const [b, c] of brandCounts) {
    if (c > bestCount || (c === bestCount && (brandFirstSeen.get(b)! < brandFirstSeen.get(primaryBrand)!))) {
      bestCount = c;
      primaryBrand = b;
    }
  }

  fighters.push({
    name,
    status: statusByName.get(name)!,
    appearances: rows,
    totalAppearances: rows.length,
    datedAppearances,
    brands: new Set(brandCounts.keys()),
    primaryBrand,
    mostRecentDate,
    isAllAmateur: datedAppearances > 0 ? amateurCount === rows.length : amateurCount === rows.length && rows.length > 0,
    hasAnyAmateur,
    hasTitleMatch,
    hasRankInRosterSet: rosterNameSet.has(name),
  });
}
console.log(`[集計] 選手別集計完了: ${fighters.length}名`);

// ── S1: ブランド×出場回数クロス集計 ──────────────────────────
function bucket(n: number): "1回" | "2回" | "3回以上" {
  if (n === 1) return "1回";
  if (n === 2) return "2回";
  return "3回以上";
}

function crossTab(subset: FighterAgg[]) {
  const brands = [...new Set(subset.map((f) => f.primaryBrand))].sort();
  const table: Record<string, Record<string, number>> = {};
  for (const b of brands) table[b] = { "1回": 0, "2回": 0, "3回以上": 0 };
  for (const f of subset) {
    table[f.primaryBrand][bucket(f.totalAppearances)]++;
  }
  return { brands, table };
}

const S1_all = crossTab(fighters);
const S1_listed = crossTab(fighters.filter((f) => f.status === "listed"));
const S1_hidden = crossTab(fighters.filter((f) => f.status === "hidden"));
const S1_missing = crossTab(fighters.filter((f) => f.status === "missing"));

// 複数ブランド跨ぎ
const multiBrand = fighters.filter((f) => f.brands.size > 1);

// アマ/エキシビ(エキシビションは今回のweight_class_rawからは検出できなかった=判定不能)
const allAmateur = fighters.filter((f) => f.isAllAmateur);
const anyAmateur = fighters.filter((f) => f.hasAnyAmateur && !f.isAllAmateur);
const titleMatch = fighters.filter((f) => f.hasTitleMatch);
const overlapWithRoster = fighters.filter((f) => f.hasRankInRosterSet);

console.log(`[S1] 複数ブランド跨ぎ: ${multiBrand.length}名`);
console.log(`[S1] 全出場がアマチュア表記: ${allAmateur.length}名`);
console.log(`[S1] 一部アマチュア表記(プロ戦も混在): ${anyAmateur.length}名`);
console.log(`[S1] タイトルマッチ/王座決定戦出場歴あり: ${titleMatch.length}名`);
console.log(`[S1] roster-coverage(パンクラス・修斗189件)との重複: ${overlapWithRoster.length}名`);

// ── S2: 候補基準シミュレーション ──────────────────────────
type Criterion = { id: string; label: string; test: (f: FighterAgg) => boolean | null }; // null=判定不能

const MAIN_BRANDS = new Set(["DEEP IMPACT", "DEEP JEWELS"]);

const criteria: Criterion[] = [
  { id: "F", label: "基準なし(全件採用)", test: () => true },
  { id: "A", label: "ブランド基準: 本戦(DEEP IMPACT/DEEP JEWELS)出場者のみ", test: (f) => [...f.brands].some((b) => MAIN_BRANDS.has(b)) },
  { id: "B1", label: "出場回数基準: (収集期間内)2回以上", test: (f) => f.totalAppearances >= 2 },
  { id: "B2", label: "出場回数基準: (収集期間内)3回以上", test: (f) => f.totalAppearances >= 3 },
  { id: "C", label: "プロ戦基準: アマチュア戦のみの選手を除外", test: (f) => !f.isAllAmateur },
  { id: "D", label: "実績基準: タイトル戦出場歴のある選手", test: (f) => f.hasTitleMatch },
  { id: "E", label: "複合: AまたはD", test: (f) => [...f.brands].some((b) => MAIN_BRANDS.has(b)) || f.hasTitleMatch },
];

interface CriterionResult {
  id: string;
  label: string;
  adopted: FighterAgg[];
  rejected: FighterAgg[];
  newlyAdopted: FighterAgg[]; // missing のうち採用
  existingExcluded: FighterAgg[]; // listed のうち非採用
}

const results: CriterionResult[] = criteria.map((c) => {
  const adopted: FighterAgg[] = [];
  const rejected: FighterAgg[] = [];
  for (const f of fighters) {
    const v = c.test(f);
    if (v) adopted.push(f);
    else rejected.push(f);
  }
  const newlyAdopted = adopted.filter((f) => f.status === "missing");
  const existingExcluded = rejected.filter((f) => f.status === "listed");
  return { id: c.id, label: c.label, adopted, rejected, newlyAdopted, existingExcluded };
});

console.log("[S2] 候補基準シミュレーション:");
for (const r of results) {
  console.log(
    `  ${r.id}: 採用${r.adopted.length} 非採用${r.rejected.length} (計${r.adopted.length + r.rejected.length}) 新規追加${r.newlyAdopted.length} 既存除外${r.existingExcluded.length}`
  );
}

// 停止条件チェック: 既存除外がlisted 64名の2割(13名)を超えるものがあるか
const listedCount = fighters.filter((f) => f.status === "listed").length;
const threshold = Math.floor(listedCount * 0.2);
const overThreshold = results.filter((r) => r.existingExcluded.length > threshold);
console.log(`[S2] listed=${listedCount}, 2割閾値=${threshold}(超えたら停止条件)`);
if (overThreshold.length > 0) {
  console.log(`[S2] ★停止条件該当: 既存除外が閾値を超えた候補 = ${overThreshold.map((r) => r.id).join(", ")}`);
}

// ── 出力: criteria-simulation.csv ──────────────────────────
const simRows: string[] = ["criterion_id,label,adopted,rejected,total,newly_adopted,existing_excluded"];
for (const r of results) {
  simRows.push(
    `${r.id},"${r.label}",${r.adopted.length},${r.rejected.length},${r.adopted.length + r.rejected.length},${r.newlyAdopted.length},${r.existingExcluded.length}`
  );
}
fs.writeFileSync(path.join(ROOT, "out/criteria-simulation.csv"), simRows.join("\n") + "\n");

// ── 出力: criteria-excluded-existing.csv ──────────────────────────
const excludedRows: string[] = ["criterion_id,name,primary_brand,total_appearances,most_recent_date,brands"];
for (const r of results) {
  for (const f of r.existingExcluded) {
    excludedRows.push(`${r.id},${f.name},${f.primaryBrand},${f.totalAppearances},${f.mostRecentDate ?? ""},"${[...f.brands].join("|")}"`);
  }
}
fs.writeFileSync(path.join(ROOT, "out/criteria-excluded-existing.csv"), excludedRows.join("\n") + "\n");

// ── S3: 境界事例 ──────────────────────────────────────
function criterionVerdictLine(f: FighterAgg): string {
  return criteria.map((c) => `${c.id}=${c.test(f) ? "採用" : "非採用"}`).join(" / ");
}

const edgeCases: { category: string; fighters: FighterAgg[] }[] = [];

// 直近デビュー戦1回のみ、以降出場なし(=総出場1回)
edgeCases.push({ category: "デビュー戦1回のみ(以降出場記録なし)", fighters: fighters.filter((f) => f.totalAppearances === 1 && f.status === "missing").slice(0, 5) });
// 若手育成イベントのみ複数回(DEEP FIGHT CHALLENGE中心で2回以上)
edgeCases.push({
  category: "若手育成イベント(DEEP FIGHT CHALLENGE)中心で複数回出場",
  fighters: fighters.filter((f) => f.primaryBrand === "DEEP FIGHT CHALLENGE" && f.totalAppearances >= 2).slice(0, 5),
});
// 女子(DEEP JEWELS)のみ
edgeCases.push({ category: "DEEP JEWELS(女子)のみの出場", fighters: fighters.filter((f) => f.brands.size === 1 && f.brands.has("DEEP JEWELS")).slice(0, 5) });
// 外国人選手(name_confidence=foreignの層) → 名前の文字種で推定(カタカナのみ・中黒あり等)。
// name_confidenceカラムの値種類を確認したうえで使う。
const nameConfidenceValues = new Set(participants.map((r) => r.name_confidence));
edgeCases.push({
  category: `外国人選手層(name_confidence値: ${[...nameConfidenceValues].join("/")})`,
  fighters: fighters.filter((f) => f.appearances.some((a) => a.name_confidence === "foreign")),
});
// カタカナ表記のみ(kana_only)層も外国人選手の判定材料として追加(foreignだけでは3appearanceしか無く手薄なため)
edgeCases.push({
  category: "カタカナ表記のみ(name_confidence=kana_only、外国人選手推定の補助層)",
  fighters: fighters.filter((f) => f.appearances.some((a) => a.name_confidence === "kana_only")).slice(0, 5),
});
// 装飾リングネーム
edgeCases.push({
  category: "装飾リングネーム(decorated_suspect)",
  fighters: fighters.filter((f) => f.appearances.some((a) => a.name_confidence === "decorated_suspect")),
});
// DEEPとパンクラス/修斗の両方
edgeCases.push({ category: "DEEPとパンクラス/修斗の両方に出場", fighters: fighters.filter((f) => f.hasRankInRosterSet) });
// 過去実績はあるが直近出場が少ない(タイトル戦経験あり、かつ総出場1回のみ=直近以外の出場が捕捉範囲外の可能性)
edgeCases.push({ category: "タイトル戦出場歴はあるが収集期間内の出場は少ない(1回)", fighters: fighters.filter((f) => f.hasTitleMatch && f.totalAppearances === 1) });
// listedだがどの候補基準でも採用されない
const listedNeverAdopted = fighters.filter((f) => f.status === "listed" && results.every((r) => !r.adopted.some((a) => a.name === f.name) || r.id === "F"));
edgeCases.push({ category: "listed済みだが基準Fを除く全候補で非採用(該当有無の確認用)", fighters: listedNeverAdopted.slice(0, 5) });
// listed済みだが基準A(本戦ブランドのみ)には非採用のケース(境界として重要)
edgeCases.push({
  category: "listed済みだが基準A(DEEP IMPACT/JEWELS本戦のみ)では非採用",
  fighters: fighters.filter((f) => f.status === "listed" && ![...f.brands].some((b) => MAIN_BRANDS.has(b))).slice(0, 5),
});

const edgeCaseFlat: FighterAgg[] = [];
const seenEdge = new Set<string>();
for (const group of edgeCases) {
  for (const f of group.fighters) {
    if (!seenEdge.has(f.name)) {
      seenEdge.add(f.name);
      edgeCaseFlat.push(f);
    }
  }
}
console.log(`[S3] 境界事例: ${edgeCaseFlat.length}名(カテゴリ横断の重複除去後)`);
for (const group of edgeCases) {
  console.log(`  ■ ${group.category} (${group.fighters.length}名)`);
  for (const f of group.fighters) {
    console.log(`     ${f.name} | status=${f.status} | 出場${f.totalAppearances}回 | brands=${[...f.brands].join("|")} | ${criterionVerdictLine(f)}`);
  }
}

// ── S5: 存続基準の材料 ──────────────────────────────────────
// listed(64名)のうち、収集期間(2025-08-17〜2026-07-24)内に出場記録が無い者は
// この参加者CSVの定義上存在しない(listedはDEEP参加者CSVから来ているため、
// 全員が最低1回はこの期間内に出場している)。「直近12ヶ月に出場記録なし」を
// 判定するには、listedの母集団をfighters.ts側(DEEP以外=パンクラス/修斗/RIZIN等)
// まで広げる必要があるが、それは本CSVの収集範囲外(DEEPイベント参加者のみ)。
// → 判定不能として空欄+理由を明記する(推測で埋めない)。

console.log("[S5] listed(全団体)の『直近12ヶ月に出場記録なし』判定: 本CSVはDEEPイベント参加者のみのため判定不能(理由: パンクラス/修斗/RIZIN等の出場記録はこのデータセットの収集範囲外)。roster-coverage-updated.csv(189件)はパンクラス/修斗の現行公式ランキング掲載者のみで、非掲載になった元選手の出場記録は追っていない。");

fs.writeFileSync(path.join(ROOT, "out/_analysis-state.json"), JSON.stringify({
  uniqueCount, statusCounts, rosterCount: roster.length,
  S1: { all: S1_all, listed: S1_listed, hidden: S1_hidden, missing: S1_missing },
  multiBrandCount: multiBrand.length,
  allAmateurCount: allAmateur.length,
  anyAmateurCount: anyAmateur.length,
  titleMatchCount: titleMatch.length,
  overlapWithRosterCount: overlapWithRoster.length,
  listedCount, threshold, overThresholdIds: overThreshold.map(r=>r.id),
  results: results.map(r => ({id:r.id,label:r.label,adopted:r.adopted.length,rejected:r.rejected.length,newlyAdopted:r.newlyAdopted.length,existingExcluded:r.existingExcluded.length})),
}, null, 2));

console.log("[完了] out/criteria-simulation.csv, out/criteria-excluded-existing.csv, out/_analysis-state.json を書き出した。");
