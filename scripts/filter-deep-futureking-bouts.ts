// data/deepRecords.json から DEEPフューチャーキングトーナメント(アマチュア大会)の
// boutを除外する。scripts/filter-nonpro-bouts.ts(修斗/パンクラス、PR #265)と
// 同じ「既存jsonにbout単位フィルタを事後適用する」方式を踏襲する(DEEP公式サイトの
// 再スクレイピングは行わない=無関係な新規大会が紛れ込むリスクを避ける)。
//
// 判定はsrc/lib/mnewsRating/nonProBoutFilter.tsの共有判定器(not_pro_futureking)に
// eventNameを渡して行う。キーワードが大会名にしか現れないため(bout単位の
// headingText/namedDivisionには現れない)、この団体だけeventNameを渡す。
//
// 大会(event)自体は削除しない。bouts配列だけを絞り込む。
//
// 実行方法: npx tsx scripts/filter-deep-futureking-bouts.ts [--dry-run]
import fs from "fs";
import path from "path";
import { classifyNonProBout, NonProBoutCategory } from "../src/lib/mnewsRating/nonProBoutFilter";
import { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";
import { computeFighterDeepRecord } from "../src/lib/mnewsRating/deepRecordsAggregate";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { computeFighterPancraseRecord } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { computeFighterMmaRecord } from "../src/lib/mnewsRating/rizinRecordsAggregate";
import { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";

const DRY_RUN = process.argv.includes("--dry-run");

const DEEP_PATH = path.join(__dirname, "..", "data", "deepRecords.json");
const SHOOTO_PATH = path.join(__dirname, "..", "data", "shootoRecords.json");
const PANCRASE_PATH = path.join(__dirname, "..", "data", "pancraseRecords.json");
const RIZIN_PATH = path.join(__dirname, "..", "data", "rizinRecords.json");

interface FilterStats {
  totalBoutsBefore: number;
  totalBoutsAfter: number;
  removedByCategory: Record<NonProBoutCategory, number>;
  eventsAffected: { date: string; eventName: string; boutsBefore: number; boutsAfter: number }[];
  eventsBecameEmpty: { date: string; eventName: string }[];
}

function filterDeepEvents(events: DeepRecordsEvent[]): { filtered: DeepRecordsEvent[]; stats: FilterStats } {
  const removedByCategory: Record<NonProBoutCategory, number> = {
    non_mma_karate: 0,
    non_mma_kids_shooto: 0,
    non_mma_submission_only: 0,
    not_pro_amateur: 0,
    not_pro_tryout: 0,
    not_pro_cage_gate: 0,
    not_pro_pancrase_gate: 0,
    not_pro_futureking: 0,
  };
  let totalBoutsBefore = 0;
  let totalBoutsAfter = 0;
  const eventsAffected: FilterStats["eventsAffected"] = [];
  const eventsBecameEmpty: FilterStats["eventsBecameEmpty"] = [];

  const filtered = events.map((ev) => {
    totalBoutsBefore += ev.bouts.length;
    const hadBouts = ev.bouts.length > 0;
    const keptBouts = ev.bouts.filter((b) => {
      const category = classifyNonProBout({
        headingText: b.headingText,
        namedDivision: b.namedDivision,
        eventName: ev.eventName,
      });
      if (category) {
        removedByCategory[category]++;
        return false;
      }
      return true;
    });
    totalBoutsAfter += keptBouts.length;
    if (keptBouts.length !== ev.bouts.length) {
      eventsAffected.push({
        date: ev.date,
        eventName: ev.eventName,
        boutsBefore: ev.bouts.length,
        boutsAfter: keptBouts.length,
      });
    }
    if (hadBouts && keptBouts.length === 0) {
      eventsBecameEmpty.push({ date: ev.date, eventName: ev.eventName });
    }
    return { ...ev, bouts: keptBouts };
  });

  return {
    filtered,
    stats: { totalBoutsBefore, totalBoutsAfter, removedByCategory, eventsAffected, eventsBecameEmpty },
  };
}

function collectAffectedSlugs(events: DeepRecordsEvent[], removedBoutKeys: Set<string>): Set<string> {
  const slugs = new Set<string>();
  for (const ev of events) {
    for (const b of ev.bouts) {
      const key = `${ev.eventName}|${ev.date}|${b.cardPosition}`;
      if (removedBoutKeys.has(key)) {
        if (b.fighterASlug) slugs.add(b.fighterASlug);
        if (b.fighterBSlug) slugs.add(b.fighterBSlug);
      }
    }
  }
  return slugs;
}

function main() {
  const deepRaw: DeepRecordsEvent[] = JSON.parse(fs.readFileSync(DEEP_PATH, "utf-8"));
  const shootoRaw: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(SHOOTO_PATH, "utf-8"));
  const pancraseRaw: PancraseRecordsEvent[] = JSON.parse(fs.readFileSync(PANCRASE_PATH, "utf-8"));
  const rizinRaw: RizinRecordsEvent[] = JSON.parse(fs.readFileSync(RIZIN_PATH, "utf-8"));

  // 除外前に「除外される個々のbout」を特定し、絡んだ選手slugを集める
  // (event+date+cardPositionで一意に特定。deepRecordsのbout自体にはIDが無い)。
  const removedBoutKeys = new Set<string>();
  for (const ev of deepRaw) {
    for (const b of ev.bouts) {
      const category = classifyNonProBout({
        headingText: b.headingText,
        namedDivision: b.namedDivision,
        eventName: ev.eventName,
      });
      if (category) {
        removedBoutKeys.add(`${ev.eventName}|${ev.date}|${b.cardPosition}`);
      }
    }
  }
  const affectedSlugs = [...collectAffectedSlugs(deepRaw, removedBoutKeys)].sort();

  const { filtered: deepFiltered, stats } = filterDeepEvents(deepRaw);

  const lines: string[] = [];
  lines.push("# DEEPフューチャーキングトーナメント bout除外 実行結果");
  lines.push("");
  lines.push("## 除外件数");
  lines.push("");
  lines.push(
    `- 全bout数: ${stats.totalBoutsBefore} → ${stats.totalBoutsAfter}(${stats.totalBoutsBefore - stats.totalBoutsAfter}件除外)`
  );
  for (const [cat, count] of Object.entries(stats.removedByCategory)) {
    if (count > 0) lines.push(`  - ${cat}: ${count}件`);
  }
  lines.push("");

  lines.push("## 除外の影響を受けた大会");
  if (stats.eventsAffected.length === 0) {
    lines.push("なし");
  } else {
    for (const e of stats.eventsAffected) {
      lines.push(`- [${e.date}] ${e.eventName}: ${e.boutsBefore}bout → ${e.boutsAfter}bout`);
    }
  }
  lines.push("");

  lines.push("## 除外により空(0bout)になった大会");
  if (stats.eventsBecameEmpty.length === 0) {
    lines.push("なし");
  } else {
    for (const e of stats.eventsBecameEmpty) lines.push(`- [${e.date}] ${e.eventName}`);
  }
  lines.push("");

  lines.push("## 影響を受けた選手(4団体通算、除外前 → 除外後)");
  lines.push("");
  lines.push(`対象: ${affectedSlugs.length}名`);
  lines.push("");
  lines.push("| slug | DEEP(前→後) | 4団体通算(前→後) |");
  lines.push("|---|---|---|");

  const fmt = (r: { wins: number; losses: number; draws: number; ncs: number }) =>
    `${r.wins}-${r.losses}-${r.draws}${r.ncs ? `-${r.ncs}nc` : ""}`;

  const zeroedOut: string[] = [];
  for (const slug of affectedSlugs) {
    const deepBefore = computeFighterDeepRecord(deepRaw, slug);
    const deepAfter = computeFighterDeepRecord(deepFiltered, slug);
    const shooto = computeFighterShootoRecord(shootoRaw, slug);
    const pancrase = computeFighterPancraseRecord(pancraseRaw, slug);
    const rizin = computeFighterMmaRecord(rizinRaw, slug);

    const totalBefore =
      deepBefore.wins + deepBefore.losses + deepBefore.draws + deepBefore.ncs +
      shooto.wins + shooto.losses + shooto.draws + shooto.ncs +
      pancrase.wins + pancrase.losses + pancrase.draws + pancrase.ncs +
      rizin.wins + rizin.losses + rizin.draws + rizin.ncs;
    const totalAfter =
      deepAfter.wins + deepAfter.losses + deepAfter.draws + deepAfter.ncs +
      shooto.wins + shooto.losses + shooto.draws + shooto.ncs +
      pancrase.wins + pancrase.losses + pancrase.draws + pancrase.ncs +
      rizin.wins + rizin.losses + rizin.draws + rizin.ncs;

    const combinedBefore = {
      wins: deepBefore.wins + shooto.wins + pancrase.wins + rizin.wins,
      losses: deepBefore.losses + shooto.losses + pancrase.losses + rizin.losses,
      draws: deepBefore.draws + shooto.draws + pancrase.draws + rizin.draws,
      ncs: deepBefore.ncs + shooto.ncs + pancrase.ncs + rizin.ncs,
    };
    const combinedAfter = {
      wins: deepAfter.wins + shooto.wins + pancrase.wins + rizin.wins,
      losses: deepAfter.losses + shooto.losses + pancrase.losses + rizin.losses,
      draws: deepAfter.draws + shooto.draws + pancrase.draws + rizin.draws,
      ncs: deepAfter.ncs + shooto.ncs + pancrase.ncs + rizin.ncs,
    };

    let mark = "";
    if (totalBefore > 0 && totalAfter === 0) {
      mark = " ⚠0-0-0化";
      zeroedOut.push(slug);
    }
    lines.push(
      `| \`${slug}\` | ${fmt(deepBefore)} → ${fmt(deepAfter)} | ${fmt(combinedBefore)} → ${fmt(combinedAfter)}${mark} |`
    );
  }
  lines.push("");

  lines.push("## 4団体通算が0-0-0になった選手");
  if (zeroedOut.length === 0) {
    lines.push("なし");
  } else {
    lines.push(
      "以下の選手は除外適用後に4団体通算戦績が0-0-0(該当bout無し)になった。**除外は適用済みだが、この選手達をどう扱うかは別途人間の判断待ち。**"
    );
    for (const slug of zeroedOut) lines.push(`- \`${slug}\``);
  }
  lines.push("");

  const report = lines.join("\n");
  console.log(report);

  const reportPath = path.join(__dirname, "..", "out", "deep-futureking-bout-filter-report.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report + "\n");

  if (!DRY_RUN) {
    fs.writeFileSync(DEEP_PATH, JSON.stringify(deepFiltered, null, 2) + "\n");
    console.log(`\n書き込み完了: ${DEEP_PATH}`);
  } else {
    console.log("\n--dry-run のためファイルへの書き込みはしていません。");
  }
}

main();
