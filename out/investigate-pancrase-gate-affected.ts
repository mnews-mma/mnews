// 指示書④(パンクラスゲート系262bout除外)の実測専用スクリプト。data/は一切変更しない
// (除外後シミュレーションはメモリ上でのみ行う)。
//
// 実行時点(2026-08-03、除外適用前)のdata/pancraseRecords.jsonを対象に実測した。
// このリポジトリでは本スクリプトのマージ後、scripts/apply-pancrase-gate-exclusion.ts
// によって除外が既にdata/pancraseRecords.jsonへ適用済みのため、本スクリプトを
// そのまま再実行しても「除外前(pancraseRaw)」自体が既に除外済み状態になり
// before/afterの差分が出ない(=歴史的な実測記録として読むこと。出力は
// out/pancrase-gate-exclusion-measurement.mdに転記済み)。
//
// 実行: npx tsx out/investigate-pancrase-gate-affected.ts
import fs from "fs";
import path from "path";
import { classifyNonProBout } from "../src/lib/mnewsRating/nonProBoutFilter";
import { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";
import { computeFighterPancraseRecord } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { computeMultiOrgRecord } from "../src/lib/mnewsRating/multiOrgRecord";
import { FIGHTERS } from "../src/lib/fighters";

const PANCRASE_PATH = path.join(__dirname, "..", "data", "pancraseRecords.json");
const RIZIN_PATH = path.join(__dirname, "..", "data", "rizinRecords.json");
const SHOOTO_PATH = path.join(__dirname, "..", "data", "shootoRecords.json");
const DEEP_PATH = path.join(__dirname, "..", "data", "deepRecords.json");
const FIGHTER_RECORDS_PATH = path.join(__dirname, "..", "data", "fighterRecords.json");

const pancraseRaw: PancraseRecordsEvent[] = JSON.parse(fs.readFileSync(PANCRASE_PATH, "utf-8"));
const rizinEvents: RizinRecordsEvent[] = JSON.parse(fs.readFileSync(RIZIN_PATH, "utf-8"));
const shootoEvents: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(SHOOTO_PATH, "utf-8"));
const deepEvents: DeepRecordsEvent[] = JSON.parse(fs.readFileSync(DEEP_PATH, "utf-8"));
const fighterRecordsRaw: Record<string, any> = JSON.parse(fs.readFileSync(FIGHTER_RECORDS_PATH, "utf-8"));

// フィルタ適用後のパンクラスイベント(nonProBoutFilter.tsにnot_pro_pancrase_gateを
// 追加した状態を、コード変更前にシミュレートする。実装後は
// scripts/filter-nonpro-bouts.ts が同じ結果を生成する)。
const PANCRASE_GATE_KEYWORDS = [
  "パンクラスゲート",
  "パンクラス・ゲート",
  "パンクラス ゲート",
  "パンクラス　ゲート", // 全角スペース
  "PANCRASEゲート",
];
const NEO_BLOOD_MARKERS = ["ネオブラッド", "NEO BLOOD"];

function toHaystack(b: any): string {
  return [b.headingText, b.namedDivision, b.eventName].filter((v) => !!v).join(" ");
}

function isPancraseGateBout(b: any): boolean {
  const hay = toHaystack(b);
  const upper = hay.toUpperCase();
  const neoHit = NEO_BLOOD_MARKERS.some((m) => hay.includes(m) || upper.includes(m.toUpperCase()));
  if (neoHit) return false; // NEO BLOOD優先ガード(#269と同型)
  return PANCRASE_GATE_KEYWORDS.some((k) => hay.includes(k));
}

const pancraseFiltered: PancraseRecordsEvent[] = pancraseRaw.map((ev) => ({
  ...ev,
  bouts: ev.bouts.filter((b) => !isPancraseGateBout(b)),
}));

// --- 1. 表記ゆれ内訳・NEO BLOOD同居・0boutイベント ---
let totalGateHit = 0;
let totalGuardedByNeoBlood = 0;
const variantCounts: Record<string, number> = {
  パンクラスゲート: 0,
  "パンクラス・ゲート": 0,
  "パンクラス ゲート(半角/全角スペース)": 0,
  PANCRASEゲート: 0,
};
const neoBloodCoOccurrence: any[] = [];
const zeroBoutEvents: string[] = [];

for (const ev of pancraseRaw) {
  const beforeCount = ev.bouts.length;
  let removedInThisEvent = 0;
  for (const b of ev.bouts as any[]) {
    const hay = toHaystack(b);
    const gateHit = PANCRASE_GATE_KEYWORDS.some((k) => hay.includes(k));
    if (!gateHit) continue;
    totalGateHit++;
    if (hay.includes("パンクラス・ゲート")) variantCounts["パンクラス・ゲート"]++;
    else if (hay.includes("パンクラス ゲート") || hay.includes("パンクラス　ゲート"))
      variantCounts["パンクラス ゲート(半角/全角スペース)"]++;
    else if (/PANCRASEゲート/i.test(hay)) variantCounts["PANCRASEゲート"]++;
    else variantCounts["パンクラスゲート"]++;

    const upper = hay.toUpperCase();
    const neoHit = NEO_BLOOD_MARKERS.some((m) => hay.includes(m) || upper.includes(m.toUpperCase()));
    if (neoHit) {
      totalGuardedByNeoBlood++;
      neoBloodCoOccurrence.push({ event: ev.eventName, date: ev.date, heading: b.headingText });
    } else {
      removedInThisEvent++;
    }
  }
  if (beforeCount > 0 && removedInThisEvent === beforeCount) {
    zeroBoutEvents.push(`${ev.date} ${ev.eventName}`);
  }
}

console.log("=== 1. 表記ゆれ内訳 ===");
console.log("ゲート表記ヒット合計:", totalGateHit, "(2026-07-30実測: 262)");
console.log(variantCounts);
console.log("NEO BLOOD同居によりガードされ除外対象から外れる件数:", totalGuardedByNeoBlood);
console.log(neoBloodCoOccurrence);
console.log("実際に除外されるbout数:", totalGateHit - totalGuardedByNeoBlood);
console.log("0boutになる大会:", zeroBoutEvents.length, zeroBoutEvents);

// --- 2. 影響選手の特定(fighterASlug/fighterBSlugが解決しているboutのみ対象) ---
const affectedSlugs = new Set<string>();
for (const ev of pancraseRaw) {
  for (const b of ev.bouts as any[]) {
    if (!isPancraseGateBout(b)) continue;
    if (b.fighterASlug) affectedSlugs.add(b.fighterASlug);
    if (b.fighterBSlug) affectedSlugs.add(b.fighterBSlug);
  }
}
console.log("\n=== 2. 影響選手(slug解決済み) ===");
console.log([...affectedSlugs].sort());

interface FmtRecord {
  wins: number;
  losses: number;
  draws: number;
  ncs: number;
  bouts: number;
}
function fmt(r: { wins: number; losses: number; draws: number; ncs: number; bouts: { length: number } }): FmtRecord {
  return { wins: r.wins, losses: r.losses, draws: r.draws, ncs: r.ncs, bouts: r.bouts.length };
}

const zeroedOut: string[] = [];
console.log("\n=== 3. 選手別 before/after(パンクラス単独 + 4団体通算) ===");
for (const slug of [...affectedSlugs].sort()) {
  const pBefore = computeFighterPancraseRecord(pancraseRaw, slug);
  const pAfter = computeFighterPancraseRecord(pancraseFiltered, slug);

  const multiBefore = computeMultiOrgRecord(slug, {
    rizinEvents,
    shootoEvents,
    pancraseEvents: pancraseRaw,
    deepEvents,
  });
  const multiAfter = computeMultiOrgRecord(slug, {
    rizinEvents,
    shootoEvents,
    pancraseEvents: pancraseFiltered,
    deepEvents,
  });

  const fighterEntry = FIGHTERS.find((f) => f.slug === slug);
  const fr = fighterRecordsRaw[slug];

  // MultiOrgRecordはNC(no contest)を持たない(wins/losses/drawsのみ)。
  const totalAfter = multiAfter.wins + multiAfter.losses + multiAfter.draws;
  const totalBefore = multiBefore.wins + multiBefore.losses + multiBefore.draws;
  if (totalBefore > 0 && totalAfter === 0) zeroedOut.push(slug);

  console.log(`\n--- ${slug} ---`);
  console.log("  パンクラス単独:", fmt(pBefore), "→", fmt(pAfter));
  console.log(
    "  4団体通算    :",
    { wins: multiBefore.wins, losses: multiBefore.losses, draws: multiBefore.draws },
    "→",
    { wins: multiAfter.wins, losses: multiAfter.losses, draws: multiAfter.draws }
  );
  console.log("  needsReview:", fighterEntry?.needsReview ?? false, " recordFromResults:", (fighterEntry as any)?.recordFromResults ?? false);
  console.log(
    "  fighterRecords.json(1行目/Wikipedia infobox):",
    fr ? `${fr.wins}-${fr.losses}-${fr.draws}` : "(エントリなし)"
  );
}

console.log("\n=== 4. 0-0-0化した選手 ===");
console.log(zeroedOut.length === 0 ? "なし" : zeroedOut);

// --- 5. draws超過24名との照合 ---
const DRAWS_EXCESS_24 = [
  "azumi-kento", "erika", "fujii-nobuki", "goto-joji", "hoshuyama-momoka", "isao",
  "karamov-vugar", "katayama-tomoe", "kate-lotus", "kurobe-kazusa", "lee-kaiwen",
  "mio-shiyama", "miyake-kisa", "nakajima-taichi", "nakamura-daisuke", "noa-tokumoto",
  "nojiri-yasuyuki", "ohara-juri", "patricky-pitbull", "raika", "saito-tsubasa",
  "sato-shoko", "seki-tetsuya", "shikijima-kazuma", "strasser-kiichi", "sugimoto-megumi",
  "sugiyama", "takada-atsuhi", "takamoto-chiyo", "tamura-hibiki", "tokoro-hideo",
  "uehara-taira", "uno-caol", "uoi-fullswing", "ushiku-juntaro", "waki-grappler", "yuki-daiki",
];
// 上記37名リスト(A∪B)のうち、Bカテゴリ(2行目draws > 1行目draws)は
// out/sato-shoko-record-mismatch-result.jsonのtype別内訳を要参照。ここでは
// 「1行目のdraws」と「4団体通算(除外前/除外後)のdraws」を突合して判定する。
console.log("\n=== 5. draws超過候補との照合(1行目 vs 4団体通算draws) ===");
let resolvedCount = 0;
for (const slug of DRAWS_EXCESS_24) {
  const fr = fighterRecordsRaw[slug];
  if (!fr) {
    console.log(`  ${slug}: fighterRecords.jsonにエントリなし(スキップ)`);
    continue;
  }
  const multiBefore = computeMultiOrgRecord(slug, {
    rizinEvents,
    shootoEvents,
    pancraseEvents: pancraseRaw,
    deepEvents,
  });
  const multiAfter = computeMultiOrgRecord(slug, {
    rizinEvents,
    shootoEvents,
    pancraseEvents: pancraseFiltered,
    deepEvents,
  });
  const excessBefore = multiBefore.draws - fr.draws;
  const excessAfter = multiAfter.draws - fr.draws;
  const wasExcess = excessBefore > 0;
  const stillExcess = excessAfter > 0;
  const resolved = wasExcess && !stillExcess;
  if (resolved) resolvedCount++;
  if (wasExcess || multiBefore.draws !== multiAfter.draws) {
    console.log(
      `  ${slug}: 1行目draws=${fr.draws} / 4団体通算draws ${multiBefore.draws}→${multiAfter.draws}` +
        `${resolved ? " ★解消" : wasExcess ? " (超過継続)" : ""}`
    );
  }
}
console.log(`draws超過24名リスト中、今回の除外で解消した人数: ${resolvedCount}`);
