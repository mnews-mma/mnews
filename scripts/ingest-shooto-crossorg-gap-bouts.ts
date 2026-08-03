// 指示書E: #423(修斗クロスorg監査261名候補)で判明した欠落121件のうち、
// 身元確認済み(要裏取り9名を除く)19名について、プロフィール投入型
// (新規①pre-cutoff + 新規②-b大会自体無し)のみを data/shootoProfileBouts.json
// に一括投入する。archive収録漏れ型(新規②-a、大会は既存だがbout欠落)と
// 勝敗食い違い(mismatch)は投入せず、件数・詳細を報告するだけに留める。
//
// スキーマは指示書R-8/C-3/kasuya-yusuke(#399/#418)で確立済みのものをそのまま
// 踏襲する(1bout=1件の疑似ShootoRecordsEvent、sourceType:"profile"、
// 負のshootoEventId、eventNameは大会名不明時のプレースホルダ)。
//
// 実行: npx tsx scripts/ingest-shooto-crossorg-gap-bouts.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, findFighterSlugByName } from "../src/lib/fighters";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { ShootoRecordsEvent, ShootoRecordsBout } from "../src/lib/mnewsRating/shootoScraper";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { assertAllowedByRobots } from "./lib/robotsGate";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 30_000;
const CUTOFF = "2012-12-24";
const UNKNOWN_EVENT_NAME = "大会名不明(修斗公式プロフィール由来)";
const PROFILE_BOUTS_PATH = path.join(process.cwd(), "data", "shootoProfileBouts.json");
const SHOOTO_RECORDS_PATH = path.join(process.cwd(), "data", "shootoRecords.json");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    process.stderr.write(`[fetch] ${url} (試行${attempt + 1}/${retries + 1})\n`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTPステータス${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`[fetch] 取得に失敗しました(${retries + 1}回試行): ${url} (${String(lastError)})`);
}

function normName(s: string | null | undefined): string {
  return (s || "").replace(/[\s　]/g, "");
}

// #423(investigate-shooto-crossorg-audit-261.ts)で身元確認済み(要裏取り9名を
// 除く)と判定した19名。noel/sasaki-shunma/nomura-shunta/usami-sho-patrickは
// 新規②-a(archive収録漏れ)・mismatchのみでprofile投入対象bout自体は0件だが、
// 1行目/2行目報告のためTARGETSに含める。
const TARGETS: { slug: string; nameJa: string; siteNameJa: string; id: string; org: string }[] = [
  { slug: "ougikubo-hiromasa", nameJa: "扇久保 博正", siteNameJa: "扇久保  博正", id: "2", org: "rizin" },
  { slug: "murayama-akihiro", nameJa: "村山暁洋", siteNameJa: "村山  暁洋", id: "379", org: "pancrase" },
  { slug: "yachi-yusuke", nameJa: "矢地 祐介", siteNameJa: "矢地  祐介", id: "263", org: "rizin" },
  { slug: "horiguchi-kyoji", nameJa: "堀口 恭司", siteNameJa: "堀口  恭司", id: "185", org: "ufc" },
  { slug: "fukuda-ryuya", nameJa: "福田 龍彌", siteNameJa: "福田  龍彌", id: "149", org: "rizin" },
  { slug: "gojima-daiki", nameJa: "合島大樹", siteNameJa: "合島  大樹", id: "609", org: "pancrase" },
  { slug: "kindaichi-kosuke", nameJa: "金田一孝介", siteNameJa: "金田一  孝介", id: "282", org: "deep" },
  { slug: "shinya-aoki", nameJa: "青木真也", siteNameJa: "青木  真也", id: "366", org: "one" },
  { slug: "uoi-fullswing", nameJa: "魚井フルスイング", siteNameJa: "魚井  フルスイング", id: "198", org: "deep" },
  { slug: "majima-kazumasa", nameJa: "摩嶋 一整", siteNameJa: "摩嶋  一整", id: "309", org: "rizin" },
  { slug: "sato-shoko", nameJa: "佐藤 将光", siteNameJa: "佐藤  将光", id: "176", org: "rizin" },
  { slug: "matsushima-koyomi", nameJa: "松嶋こよみ", siteNameJa: "松嶋  こよみ", id: "364", org: "rizin" },
  { slug: "honda-ryosuke", nameJa: "本田良介", siteNameJa: "本田  良介", id: "1049", org: "deep" },
  { slug: "ando-tatsuya", nameJa: "安藤 達也", siteNameJa: "安藤  達也", id: "195", org: "rizin" },
  { slug: "minowa-hiroba", nameJa: "箕輪ひろば", siteNameJa: "箕輪  ひろば", id: "84", org: "one" },
  { slug: "noel", nameJa: "NOEL", siteNameJa: "NOEL", id: "1554", org: "rizin" },
  { slug: "sasaki-shunma", nameJa: "佐々木瞬真", siteNameJa: "佐々木  瞬真", id: "1247", org: "pancrase" },
  { slug: "nomura-shunta", nameJa: "野村 駿太", siteNameJa: "野村  駿太", id: "1374", org: "rizin" },
  { slug: "usami-sho-patrick", nameJa: "宇佐美正パトリック", siteNameJa: "宇佐美 正 パトリック", id: "1366", org: "rizin" },
];

interface ProfileBout {
  section: "SHOOTO" | "VTJ";
  date: string;
  symbol: "○" | "×" | "△" | string;
  result: "win" | "loss" | "draw" | "unknown";
  opponentNameRaw: string;
  opponentShootoId: string | null;
  methodRaw: string;
  linkedResultId: string | null;
}

function resultFromSymbol(sym: string): ProfileBout["result"] {
  if (sym === "○") return "win";
  if (sym === "×") return "loss";
  if (sym === "△") return "draw";
  return "unknown";
}

const ROW_RE =
  /<tr><td[^>]*>(?:<a href="\/result\/\?id=(\d+)">)?(\d{4}-\d{2}-\d{2})(?:<\/a>)?<\/td><td[^>]*>([○×△])<\/td><td><a href="\/fighters\/\?id=(\d+)">([^<]*)<\/a><p>([^<]*)<\/p><\/tr>/g;

function parseProfilePage(html: string): ProfileBout[] {
  const bouts: ProfileBout[] = [];
  const sectionRe = /<h5>(SHOOTO戦績|VTJ戦績)<\/h5><table[^>]*>([\s\S]*?)<\/table>/g;
  let secM: RegExpExecArray | null;
  while ((secM = sectionRe.exec(html))) {
    const section: "SHOOTO" | "VTJ" = secM[1] === "SHOOTO戦績" ? "SHOOTO" : "VTJ";
    const tableHtml = secM[2];
    let rowM: RegExpExecArray | null;
    ROW_RE.lastIndex = 0;
    while ((rowM = ROW_RE.exec(tableHtml))) {
      const [, resultId, date, symbol, oppId, oppNameRaw, methodRaw] = rowM;
      bouts.push({
        section,
        date,
        symbol,
        result: resultFromSymbol(symbol),
        opponentNameRaw: oppNameRaw.trim(),
        opponentShootoId: oppId,
        methodRaw: methodRaw.trim(),
        linkedResultId: resultId ?? null,
      });
    }
  }
  return bouts;
}

interface ExistingBout {
  date: string;
  opponentNorm: string;
  opponentRaw: string;
  result: "win" | "loss" | "draw" | "unknown";
}

type Category = "new1_precutoff" | "new2a_bout_missing_in_existing_event" | "new2b_event_missing" | "mismatch" | "matched";

async function main() {
  const shootoRecords: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(SHOOTO_RECORDS_PATH, "utf8"));
  const existingProfileBouts: (ShootoRecordsEvent & { sourceType: "profile" })[] = JSON.parse(
    fs.readFileSync(PROFILE_BOUTS_PATH, "utf8")
  );
  const combinedEvents = [...shootoRecords, ...existingProfileBouts];
  const eventIdSet = new Set<number>(shootoRecords.map((e) => e.shootoEventId));
  const eventNameByLinkedId = new Map<number, string>(shootoRecords.map((e) => [e.shootoEventId, e.eventName]));
  const fighterBySlug = new Map(FIGHTERS.map((f) => [f.slug, f]));

  function buildExistingIndex(slug: string): ExistingBout[] {
    const out: ExistingBout[] = [];
    const rec = computeFighterShootoRecord(combinedEvents, slug);
    for (const b of rec.bouts) {
      let result: ExistingBout["result"] = "unknown";
      if (b.resultType === "draw") result = "draw";
      else if (b.resultType === "decisive") result = b.isWin ? "win" : "loss";
      out.push({ date: b.date, opponentNorm: normName(b.opponentName), opponentRaw: b.opponentName, result });
    }
    const fighter = fighterBySlug.get(slug);
    if (fighter && Array.isArray((fighter as any).history)) {
      for (const h of (fighter as any).history as any[]) {
        out.push({
          date: h.date,
          opponentNorm: normName(h.opponent),
          opponentRaw: h.opponent,
          result: h.result === "nc" ? "unknown" : h.result,
        });
      }
    }
    return out;
  }

  interface ToInject {
    slug: string;
    fighterAName: string;
    fighterAShootoId: number;
    date: string;
    symbol: string;
    opponentNameRaw: string;
    opponentShootoId: number;
    methodRaw: string;
  }
  const toInject: ToInject[] = [];
  const archiveGapReport: { slug: string; nameJa: string; date: string; opponentNameRaw: string; eventName: string | null; linkedResultId: string | null }[] = [];
  const mismatchReport: { slug: string; nameJa: string; date: string; opponentNameRaw: string; profileResult: string; existingResult: string }[] = [];
  const unreachable: { slug: string; nameJa: string; id: string; error: string }[] = [];

  let fetchedCount = 0;
  for (const t of TARGETS) {
    const url = `https://www.shooto-mma.com/fighters/?id=${t.id}`;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      unreachable.push({ slug: t.slug, nameJa: t.nameJa, id: t.id, error: String(err) });
      await sleep(DELAY_MS);
      continue;
    }
    fetchedCount++;
    await sleep(DELAY_MS);

    const bouts = parseProfilePage(html);
    const existing = buildExistingIndex(t.slug);
    const existingByKey = new Map<string, ExistingBout[]>();
    const existingByDateOnly = new Map<string, ExistingBout[]>();
    for (const e of existing) {
      const key = `${e.date}|${e.opponentNorm}`;
      const arr = existingByKey.get(key) ?? [];
      arr.push(e);
      existingByKey.set(key, arr);
      const dArr = existingByDateOnly.get(e.date) ?? [];
      dArr.push(e);
      existingByDateOnly.set(e.date, dArr);
    }

    for (const b of bouts) {
      const oppNorm = normName(b.opponentNameRaw);
      const candidates = existingByKey.get(`${b.date}|${oppNorm}`) ?? [];
      let category: Category;

      if (candidates.length === 0) {
        if (b.date < CUTOFF) category = "new1_precutoff";
        else if (b.linkedResultId && eventIdSet.has(Number(b.linkedResultId))) category = "new2a_bout_missing_in_existing_event";
        else category = "new2b_event_missing";
      } else {
        const cand = candidates[0];
        category = "matched";
        if (cand.result !== "unknown" && b.result !== "unknown" && cand.result !== b.result) category = "mismatch";
      }

      if (category === "new1_precutoff" || category === "new2b_event_missing") {
        if (!b.opponentShootoId) continue; // 相手idが無い行は対象外(実データでは未観測)
        toInject.push({
          slug: t.slug,
          fighterAName: t.siteNameJa,
          fighterAShootoId: Number(t.id),
          date: b.date,
          symbol: b.symbol,
          opponentNameRaw: b.opponentNameRaw,
          opponentShootoId: Number(b.opponentShootoId),
          methodRaw: b.methodRaw,
        });
      } else if (category === "new2a_bout_missing_in_existing_event") {
        archiveGapReport.push({
          slug: t.slug,
          nameJa: t.nameJa,
          date: b.date,
          opponentNameRaw: b.opponentNameRaw,
          eventName: b.linkedResultId ? eventNameByLinkedId.get(Number(b.linkedResultId)) ?? null : null,
          linkedResultId: b.linkedResultId,
        });
      } else if (category === "mismatch") {
        mismatchReport.push({
          slug: t.slug,
          nameJa: t.nameJa,
          date: b.date,
          opponentNameRaw: b.opponentNameRaw,
          profileResult: b.result,
          existingResult: candidates[0].result,
        });
      }
    }
  }

  console.log(`fetch対象: ${TARGETS.length} / 成功: ${fetchedCount} / unreachable: ${unreachable.length}`);
  console.log(`投入対象(profile投入型): ${toInject.length}件`);
  console.log(`archive収録漏れ型(投入せず報告のみ): ${archiveGapReport.length}件`);
  console.log(`mismatch(投入せず報告のみ): ${mismatchReport.length}件`);

  if (unreachable.length > 0) {
    console.log("\n[unreachable]", JSON.stringify(unreachable, null, 2));
  }

  // ── 安全策: 投入予定の(fighterAShootoId, date)の組が既存shootoProfileBoutsに
  // 既に無いことを確認(二重投入防止)。
  const existingIdDateSet = new Set<string>();
  for (const e of existingProfileBouts) {
    const b = e.bouts[0];
    if (b.fighterAShootoId) existingIdDateSet.add(`${b.fighterAShootoId}|${e.date}`);
    if (b.fighterBShootoId) existingIdDateSet.add(`${b.fighterBShootoId}|${e.date}`);
  }
  const dupes = toInject.filter((t) => existingIdDateSet.has(`${t.fighterAShootoId}|${t.date}`));
  if (dupes.length > 0) {
    console.error(`\n[ERROR] 投入予定の中に既存shootoProfileBoutsと重複する${dupes.length}件を検出。中止。`);
    console.error(JSON.stringify(dupes, null, 2));
    process.exit(1);
  }

  // ── 一括投入 ──
  const existingIds = existingProfileBouts.map((e) => e.shootoEventId);
  let nextId = Math.min(...existingIds) - 1;
  const fetchedDate = toJstDateStr();
  const unresolvedOpponents: string[] = [];

  const newEvents: (ShootoRecordsEvent & { sourceType: "profile" })[] = toInject.map((t) => {
    const fighterBSlug = findFighterSlugByName(t.opponentNameRaw, t.slug);
    if (!fighterBSlug) unresolvedOpponents.push(`${t.slug}:${t.opponentNameRaw}`);

    const resultType = t.symbol === "○" || t.symbol === "×" ? "decisive" : "draw";
    const winnerName = resultType === "decisive" ? (t.symbol === "○" ? t.fighterAName : t.opponentNameRaw) : null;
    const winnerSlug = resultType === "decisive" ? (t.symbol === "○" ? t.slug : fighterBSlug) : null;

    const bout: ShootoRecordsBout & { sourceType: "profile" } = {
      cardPosition: 1,
      isOpeningFight: false,
      headingText: "",
      fighterAName: t.fighterAName,
      fighterBName: t.opponentNameRaw,
      fighterASlug: t.slug,
      fighterBSlug,
      ruleType: "unknown",
      weightKg: null,
      namedDivision: null,
      resultType,
      winnerName,
      winnerSlug,
      round: null,
      time: null,
      methodRaw: t.methodRaw,
      isWeighInMiss: false,
      fighterAShootoId: t.fighterAShootoId,
      fighterBShootoId: t.opponentShootoId,
      fighterAGym: null,
      fighterBGym: null,
      fighterAWeighInKg: null,
      fighterBWeighInKg: null,
      noteRaw: null,
      strapTitle: null,
      sourceType: "profile",
    } as any;

    const ev = {
      eventName: UNKNOWN_EVENT_NAME,
      date: t.date,
      sourceUrl: `https://www.shooto-mma.com/fighters/?id=${t.fighterAShootoId}`,
      fetchedDate,
      bouts: [bout],
      parseFailures: 0,
      venue: null,
      shootoEventId: nextId,
      sourceType: "profile" as const,
    };
    nextId -= 1;
    return ev;
  });

  console.log(`\n[resolve] 相手slug未解決: ${unresolvedOpponents.length}/${newEvents.length}件(FIGHTERS未登録、想定どおり)`);
  if (unresolvedOpponents.length > 0) console.log(`  ${unresolvedOpponents.join(", ")}`);

  const merged = [...existingProfileBouts, ...newEvents];
  fs.writeFileSync(PROFILE_BOUTS_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`\n[OK] ${PROFILE_BOUTS_PATH} に${newEvents.length}件追記(既存${existingProfileBouts.length}件 → 合計${merged.length}件)`);

  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-crossorg-ingestion-report.json"),
    JSON.stringify({ toInject, archiveGapReport, mismatchReport, unreachable, unresolvedOpponents }, null, 2) + "\n"
  );
  console.log(`書き出し: out/shooto-crossorg-ingestion-report.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
