// 指示書④ Phase2(inclusion-criteria-phase2-instructions.md)。
// Phase1で人間が決定した基準C(プロ戦の記録がない選手を除外)をDEEP参加者490名に適用し、
// out/inclusion-decision.csv を出力する判定器。
//
// 純関数 decideCriterionC() が判定本体。入力=選手1名分の集計レコード(FighterAgg)、
// 出力={ adopted: boolean, reasonCode: string }。
//
// 流用元: scripts/analyze-inclusion-criteria.ts (PR #220 `feat/inclusion-criteria-analysis`)。
// CSVパーサー(parseCsvLine/loadCsv)、選手別集計ロジック(byName集計・isAllAmateur算出)、
// AMATEUR_RE正規表現は同ファイルの実装をそのまま踏襲した(流用)。新しい正規化・判定ロジックは
// 書いていない。基準Cの定義(「プロ戦」の判定方法)は同ファイルの `isAllAmateur` 算出式と
// 基準テスト `test: (f) => !f.isAllAmateur` をそのまま移植したもの。
//
// 名前照合: 本スクリプトは新規の名前正規化・突合を一切行わない。
// out/_input-deep-event-participants-updated.csv の name_normalized / mnews_slug / status は
// PR #208 (`feat/roster-loose-ends`) 時点で既に確定済みの値をそのまま読むだけ
// (それらの値が既存の findFighterSlugByName 経由の突合結果であることの前提はPhase1から継承)。
//
// 対象母集団: 490名(DEEP参加者データセット)のみ。パンクラス・修斗・DEEP王者(champions.ts)は
// 決定2(公式ランキング/champions.ts掲載をもって採用)により基準Cの対象外
// (指示書④Phase2 §6でも明示的にスコープ外: 「パンクラス・修斗への出場ベース基準の適用」)。
// そのため本スクリプトはS0の入力検証にのみ roster-coverage-updated.csv を使う
// (必達セット189件の凍結値との一致確認)。

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
console.log(`[S0] roster-coverage(パンクラス・修斗・DEEP王者): ${roster.length}行`);

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

// 必達セット189件(listed43/hidden45/missing101、内訳pancrase35/shooto60/deep-champion6)の検証
const rosterStatusCounts = { listed: 0, hidden: 0, missing: 0 };
for (const r of roster) {
  if (r.status === "listed") rosterStatusCounts.listed++;
  else if (r.status === "hidden") rosterStatusCounts.hidden++;
  else if (r.status === "missing") rosterStatusCounts.missing++;
}
const rosterMissingByOrg = { pancrase: 0, shooto: 0, deep: 0 };
for (const r of roster) {
  if (r.status !== "missing") continue;
  if (r.org === "pancrase") rosterMissingByOrg.pancrase++;
  else if (r.org === "shooto") rosterMissingByOrg.shooto++;
  else if (r.org === "deep") rosterMissingByOrg.deep++;
}
console.log(
  `[S0] roster: listed=${rosterStatusCounts.listed}(期待43) hidden=${rosterStatusCounts.hidden}(期待45) missing=${rosterStatusCounts.missing}(期待101)`
);
console.log(
  `[S0] roster missing内訳: pancrase=${rosterMissingByOrg.pancrase}(期待35) shooto=${rosterMissingByOrg.shooto}(期待60) deep-champion=${rosterMissingByOrg.deep}(期待6)`
);

const S0_OK =
  uniqueCount === 490 &&
  statusCounts.listed === 64 &&
  statusCounts.hidden === 4 &&
  statusCounts.missing === 422 &&
  statusInconsistency.length === 0 &&
  roster.length === 189 &&
  rosterStatusCounts.listed === 43 &&
  rosterStatusCounts.hidden === 45 &&
  rosterStatusCounts.missing === 101 &&
  rosterMissingByOrg.pancrase === 35 &&
  rosterMissingByOrg.shooto === 60 &&
  rosterMissingByOrg.deep === 6;

if (!S0_OK) {
  console.error("[S0] ★停止条件1: 凍結値と不一致。以降の処理は実行しない。");
  process.exit(1);
}
console.log("[S0] OK: 母集団490名・必達セット189件とも凍結値と完全一致。");

// ── 選手別集計(scripts/analyze-inclusion-criteria.ts の集計ロジックを踏襲) ──────
interface FighterAgg {
  name: string;
  status: string;
  appearances: ParticipantRow[];
  totalAppearances: number;
  primaryBrand: string;
  mostRecentDate: string | null;
  amateurCount: number;
  isAllAmateur: boolean;
}

const AMATEUR_RE = /アマチュア/;

const fighters: FighterAgg[] = [];
for (const [name, rows] of byName) {
  const brandCounts = new Map<string, number>();
  let mostRecentDate: string | null = null;
  let amateurCount = 0;
  for (const r of rows) {
    brandCounts.set(r.brand, (brandCounts.get(r.brand) ?? 0) + 1);
    if (r.event_date.trim()) {
      if (!mostRecentDate || r.event_date > mostRecentDate) mostRecentDate = r.event_date;
    }
    if (AMATEUR_RE.test(r.weight_class_raw)) amateurCount++;
  }
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
    primaryBrand,
    mostRecentDate,
    amateurCount,
    isAllAmateur: amateurCount === rows.length,
  });
}
console.log(`[集計] 選手別集計完了: ${fighters.length}名`);

// ── 判定器本体(純関数) ──────────────────────────────
// 入力: 選手1名分の集計レコード(FighterAgg)
// 出力: 採用可否 + 理由コード
// 基準C: `weight_class_raw` に「アマチュア」を含まない出場が1件以上あれば採用。
//        全出場が「アマチュア」表記なら非採用。
type Decision = { adopted: boolean; reasonCode: string };

function decideCriterionC(f: FighterAgg): Decision {
  if (f.isAllAmateur) {
    return { adopted: false, reasonCode: "C_ALL_AMATEUR" };
  }
  return { adopted: true, reasonCode: "C_HAS_PRO_APPEARANCE" };
}

// ── S3: 490名全件に適用・出力 ──────────────────────────
const decided = fighters.map((f) => ({ fighter: f, decision: decideCriterionC(f) }));
const adopted = decided.filter((d) => d.decision.adopted);
const rejected = decided.filter((d) => !d.decision.adopted);
const newlyAdopted = adopted.filter((d) => d.fighter.status === "missing");
const existingExcluded = rejected.filter((d) => d.fighter.status === "listed");

console.log(
  `[S3] 採用${adopted.length} 非採用${rejected.length} 計${adopted.length + rejected.length} 新規採用${newlyAdopted.length} 既存除外${existingExcluded.length}`
);

const S3_EXPECT_OK =
  adopted.length === 371 && rejected.length === 119 && newlyAdopted.length === 303 && existingExcluded.length === 0;
console.log(
  `[S3] 期待値(採用371/非採用119/新規採用303/既存除外0)との一致: ${S3_EXPECT_OK ? "OK" : "★不一致"}`
);

// 出力: out/inclusion-decision.csv (490行、非採用119名も理由コード付きで全件列挙)
const csvHeader =
  "name,status,decision,reason_code,primary_brand,total_appearances,amateur_appearances,pro_appearances,most_recent_date";
const csvRows = [csvHeader];
// 出力順序を決定的にするため name でソート
const sortedDecided = [...decided].sort((a, b) => a.fighter.name.localeCompare(b.fighter.name, "ja"));
for (const { fighter: f, decision: d } of sortedDecided) {
  csvRows.push(
    [
      f.name,
      f.status,
      d.adopted ? "採用" : "非採用",
      d.reasonCode,
      f.primaryBrand,
      f.totalAppearances,
      f.amateurCount,
      f.totalAppearances - f.amateurCount,
      f.mostRecentDate ?? "",
    ].join(",")
  );
}
fs.writeFileSync(path.join(ROOT, "out/inclusion-decision.csv"), csvRows.join("\n") + "\n");
console.log(`[S3] out/inclusion-decision.csv 出力完了(${sortedDecided.length}行 + ヘッダー)`);

// ── S4: 逆向き検証 ──────────────────────────────────
// listed64名に判定器を当て、既存除外が0で再現することを確認する。
const listedFighters = fighters.filter((f) => f.status === "listed");
const listedExcluded = listedFighters.filter((f) => !decideCriterionC(f).adopted);
console.log(`[S4] listed64名(実測${listedFighters.length}名)に判定器を適用: 既存除外=${listedExcluded.length}名`);
if (listedFighters.length !== 64) {
  console.error(`[S4] ★listed実測数が64と不一致(${listedFighters.length}名)。停止条件1相当として扱い、以降を中断する。`);
  process.exit(1);
}
if (listedExcluded.length > 0) {
  console.error("[S4] ★停止条件2: 既存除外が1名以上出た。除外された選手を全件列挙する:");
  for (const f of listedExcluded) {
    console.error(`  - ${f.name} (primaryBrand=${f.primaryBrand}, 出場${f.totalAppearances}回, amateurCount=${f.amateurCount})`);
  }
  process.exit(1);
}
console.log("[S4] OK: 既存除外0名で再現した。");

// ── 自己検証用サマリ出力 ──────────────────────────────
const summary = {
  generatedAt: new Date().toISOString(),
  s0: {
    participantsUnique: uniqueCount,
    participantsStatus: statusCounts,
    rosterTotal: roster.length,
    rosterStatus: rosterStatusCounts,
    rosterMissingByOrg,
    ok: S0_OK,
  },
  s3: {
    adopted: adopted.length,
    rejected: rejected.length,
    total: adopted.length + rejected.length,
    newlyAdopted: newlyAdopted.length,
    existingExcluded: existingExcluded.length,
    matchesExpected: S3_EXPECT_OK,
  },
  s4: {
    listedCount: listedFighters.length,
    listedExcluded: listedExcluded.length,
    ok: listedExcluded.length === 0,
  },
};
fs.writeFileSync(path.join(ROOT, "out/inclusion-decision-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log("[完了] out/inclusion-decision.csv, out/inclusion-decision-summary.json を書き出した。");
