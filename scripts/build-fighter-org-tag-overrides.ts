// 団体タグが無い選手への「直近3試合最頻団体」の常設オーバーライドを
// data/fighterOrgTagOverrides.json に書き出すバッチスクリプト。
// 2026-08、指示書「選手の団体タグ整備」ステップ3(PR #426の穴埋め例外リストの
// 常設化)。日次update-org-records.ymlの末尾(4団体戦績DB取得+slug backfill完了後)
// で実行する想定。src/lib/orgTags.tsのORG_TAG_OVERRIDESコメント・
// computeFighterTags()のフォールバック適用ロジックと対になっている。
//
// 手順:
//   1. FIGHTERS(hidden/delisted除く)全員に、data/orgRankings.jsonを使って
//      computeFighterTags(f, orgRankings, {}) を適用し、現行ルールで既に
//      タグが付く選手を除外する(絶対に既存タグを上書きしない)。
//   2. タグ0件の選手だけを対象に、data/{rizin,deep,shooto,pancrase}Records.json
//      から当該選手のboutを日付降順で最大3件取得し、団体の多数決を取る。
//      同数タイは最新1件の団体を優先する。
//   3. 直近1試合(最新bout)自体が2年より前ならタグを付けない(カットオフ)。
//      4団体データに1件も試合が見つからない選手もタグなしのまま。
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { computeFighterTags, TaggableFighter } from "../src/lib/orgTags";
import type { OrgRankingsFile } from "../src/lib/orgRankingsData";

const ROOT = path.join(__dirname, "..");
const CUTOFF_YEARS = 2;

// scripts/tmp-verify-org-tags.ts 等で使ってきた「今日」の扱いと同じく、
// バッチ実行時点のシステム時刻を使う(この結果はJSONへ焼き込まれ、次回
// バッチ実行まで固定される。リクエスト時点の計算ではない)。
const TODAY = new Date();

type OrgKey = "rizin" | "deep" | "shooto" | "pancrase";
const ORG_FILES: { file: string; org: OrgKey }[] = [
  { file: "rizinRecords.json", org: "rizin" },
  { file: "deepRecords.json", org: "deep" },
  { file: "shootoRecords.json", org: "shooto" },
  { file: "pancraseRecords.json", org: "pancrase" },
];

interface BoutRef {
  date: string;
  org: OrgKey;
}

function loadBoutsBySlug(): Map<string, BoutRef[]> {
  const bySlug = new Map<string, BoutRef[]>();
  for (const { file, org } of ORG_FILES) {
    const events = JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));
    for (const ev of events) {
      const date = ev.date;
      for (const b of ev.bouts ?? []) {
        for (const key of ["fighterASlug", "fighterBSlug"] as const) {
          const slug = b[key];
          if (!slug) continue;
          if (!bySlug.has(slug)) bySlug.set(slug, []);
          bySlug.get(slug)!.push({ date, org });
        }
      }
    }
  }
  return bySlug;
}

function ageInYears(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const bout = new Date(y, m - 1, d);
  return (TODAY.getTime() - bout.getTime()) / (365.25 * 24 * 3600 * 1000);
}

// 直近3試合(日付降順で最大3件)の多数決。同数タイは最新1件の団体を優先。
// 最新1試合自体がCUTOFF_YEARSより前なら null(タグなし)。
function deriveMajorityOrg(bouts: BoutRef[]): OrgKey | null {
  if (bouts.length === 0) return null;
  const sorted = [...bouts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const newest = sorted[0];
  if (ageInYears(newest.date) > CUTOFF_YEARS) return null;

  const last3 = sorted.slice(0, 3);
  const counts = new Map<OrgKey, number>();
  for (const b of last3) counts.set(b.org, (counts.get(b.org) ?? 0) + 1);
  let maxCount = 0;
  for (const c of counts.values()) maxCount = Math.max(maxCount, c);
  const topOrgs = [...counts.entries()].filter(([, c]) => c === maxCount).map(([org]) => org);
  if (topOrgs.length === 1) return topOrgs[0];
  // 同数タイ: 最新1件(newest)の団体を優先。
  return newest.org;
}

function main() {
  const orgRankings: OrgRankingsFile = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "orgRankings.json"), "utf8")
  );
  const bySlug = loadBoutsBySlug();

  const targets = FIGHTERS.filter((f) => !f.hidden && !f.delisted);
  const overrides: Record<string, OrgKey> = {};
  const skippedNoData: string[] = [];
  const skippedStale: { slug: string; newestDate: string; ageYears: number }[] = [];
  let zeroTagCount = 0;

  for (const f of targets) {
    const taggable: TaggableFighter = {
      slug: f.slug,
      nameJa: f.nameJa,
      weightClass: f.weightClass,
      org: f.org,
      history: f.history,
    };
    // 既存ルール(UFC/RIZIN/DEEP/ONE/ランカー/明示例外)で既にタグがある選手は
    // 絶対に対象にしない(overridesは{}で渡し、常設フォールバック自体は無効化)。
    const existingTags = computeFighterTags(taggable, orgRankings, {});
    if (existingTags.length > 0) continue;
    zeroTagCount++;

    const bouts = bySlug.get(f.slug) ?? [];
    if (bouts.length === 0) {
      skippedNoData.push(f.slug);
      continue;
    }
    const sorted = [...bouts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const newest = sorted[0];
    const org = deriveMajorityOrg(bouts);
    if (!org) {
      skippedStale.push({ slug: f.slug, newestDate: newest.date, ageYears: Number(ageInYears(newest.date).toFixed(1)) });
      continue;
    }
    overrides[f.slug] = org;
  }

  // キーをslugのアルファベット順にソートしてから書き出す(FIGHTERS配列の並び順
  // に依存すると、overridesの中身が変わっていなくてもfighters.tsへの無関係な
  // 選手追加でJSONのキー順だけが変わり、無駄なgit diff/commitが発生するため)。
  const sortedOverrides: Record<string, OrgKey> = {};
  for (const slug of Object.keys(overrides).sort()) sortedOverrides[slug] = overrides[slug];

  const outPath = path.join(ROOT, "data", "fighterOrgTagOverrides.json");
  fs.writeFileSync(outPath, JSON.stringify(sortedOverrides, null, 2) + "\n");

  console.log(`対象選手(既存ルールでタグ0件): ${zeroTagCount}`);
  console.log(`タグ付与: ${Object.keys(overrides).length}件`, overrides);
  console.log(`データなしでタグなし: ${skippedNoData.length}件`, skippedNoData);
  console.log(`カットオフでタグなし: ${skippedStale.length}件`, skippedStale);
  console.log(`書き出し先: ${outPath}`);
}

main();
