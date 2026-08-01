// shooto-mma.com(修斗公式サイト)の「試合結果」アーカイブ全大会を機械取得し、
// data/shootoRecords.json へ書き出すバッチ(生成のみ・ランキング等の本番パイプラインへは
// 一切接続しない)。
//
// 大会idの発見は毎回サイトの一覧ページ+欠番探索から動的に行う(idをハードコードしない)。
// 詳細はdocs/instructions等の指示書、およびout/shooto-records-data-ingest-stop.md参照。
//
// 実行: npx tsx scripts/build-shooto-records.ts
import fs from "fs";
import path from "path";
import { toJstDateStr } from "../src/lib/eventCountdown";
import {
  extractLinkedEventIds,
  computeMissingIds,
  isRealMissingEvent,
  parseEventMeta,
  splitIntoBoutBoxes,
  parseBoutBox,
  resolveOutcome,
  ShootoRawBout,
  ShootoRecordsBout,
  ShootoRecordsEvent,
} from "../src/lib/mnewsRating/shootoScraper";
import { findFighterSlugByName } from "../src/lib/fighters";
import { assertAllowedByRobots } from "./lib/robotsGate";

const OUT = path.join(process.cwd(), "data", "shootoRecords.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const INDEX_URL = "https://www.shooto-mma.com/result/";
const eventUrl = (id: number) => `https://www.shooto-mma.com/result/?id=${id}`;

// 停止条件(指示書2026-07-29差し替え版): 再現bout数が2,136を下回る、または
// 2,200を超える場合は停止する(実在データの自然増では止まらず、異常な増え方でだけ
// 止まるようにする)。
const STOP_MIN_BOUTS = 2136;
const STOP_MAX_BOUTS = 2200;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 2): Promise<string | null> {
  await assertAllowedByRobots(url, UA);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.text();
    } catch {
      /* fall through to retry */
    }
    if (attempt < retries) await sleep(1500);
  }
  return null;
}

const WEIGH_IN_MISS_KEYWORDS = ["体重超過", "計量失格", "計量オーバー", "計量を行うことが出来なかった", "計量をクリアできず"];

function buildEventBouts(html: string, eventName: string): { bouts: ShootoRecordsBout[]; parseFailures: number } {
  const boxes = splitIntoBoutBoxes(html);
  let parseFailures = 0;
  const successful: ShootoRawBout[] = [];

  for (const { boutId, chunk } of boxes) {
    const raw = parseBoutBox(boutId, chunk);
    if (!raw) {
      parseFailures++;
      continue;
    }
    successful.push(raw);
  }

  const total = successful.length;
  const bouts: ShootoRecordsBout[] = successful.map((raw, idx) => {
    const outcome = resolveOutcome(raw, eventName);
    const fighterASlug = findFighterSlugByName(raw.fighterA.name);
    const fighterBSlug = findFighterSlugByName(raw.fighterB.name);
    const winnerName = outcome.winner === "A" ? raw.fighterA.name : outcome.winner === "B" ? raw.fighterB.name : null;
    const winnerSlug = outcome.winner === "A" ? fighterASlug : outcome.winner === "B" ? fighterBSlug : null;

    const methodRaw = [raw.resultTypeText, raw.resultMethodText].filter((s): s is string => !!s).join(" ").trim();
    const isWeighInMiss = !!raw.noteRaw && WEIGH_IN_MISS_KEYWORDS.some((k) => raw.noteRaw!.includes(k));

    return {
      cardPosition: total - idx,
      isOpeningFight: idx === total - 1,
      headingText: raw.headingText,
      fighterAName: raw.fighterA.name,
      fighterBName: raw.fighterB.name,
      fighterASlug,
      fighterBSlug,
      ruleType: "unknown", // 修斗ページにルール種別(MMA/キック等)の明示表記が無いため捏造しない
      weightKg: null, // 選手ごとに別の計量結果を持つため単一値に丸めない(fighterA/BWeighInKg参照)
      namedDivision: raw.namedDivision,
      resultType: outcome.resultType,
      winnerName,
      winnerSlug,
      round: raw.resultRound,
      time: raw.resultTime,
      methodRaw,
      isWeighInMiss,
      fighterAShootoId: raw.fighterA.shootoId,
      fighterBShootoId: raw.fighterB.shootoId,
      fighterAGym: raw.fighterA.gym,
      fighterBGym: raw.fighterB.gym,
      fighterAWeighInKg: raw.fighterA.weighInKg,
      fighterBWeighInKg: raw.fighterB.weighInKg,
      noteRaw: raw.noteRaw,
      strapTitle: raw.strapTitle,
    };
  });

  return { bouts, parseFailures };
}

async function discoverEventIds(): Promise<number[]> {
  const indexHtml = await fetchHtml(INDEX_URL);
  if (!indexHtml) throw new Error(`大会一覧ページの取得に失敗しました: ${INDEX_URL}`);
  const linkedIds = extractLinkedEventIds(indexHtml);
  console.log(`[discover] リンク済み大会id: ${linkedIds.length}件 (範囲 ${Math.min(...linkedIds)}〜${Math.max(...linkedIds)})`);

  const missingIds = computeMissingIds(linkedIds);
  console.log(`[discover] 欠番id: ${missingIds.length}件。全件フェッチして実在確認します。`);

  const extraIds: number[] = [];
  for (const id of missingIds) {
    await sleep(300);
    const html = await fetchHtml(eventUrl(id));
    if (!html) {
      console.warn(`[discover][WARN] 欠番id=${id} の取得に失敗(スキップ)`);
      continue;
    }
    if (isRealMissingEvent(html)) {
      extraIds.push(id);
      console.log(`[discover] id=${id}: リンク欠落だが実在する大会として追加`);
    }
  }

  const allIds = [...linkedIds, ...extraIds].sort((a, b) => a - b);
  console.log(`[discover] 最終id集合: ${allIds.length}件 (リンク済み${linkedIds.length} + 欠落実在${extraIds.length})`);
  return allIds;
}

async function main() {
  // JST日付計算の唯一の実装(eventCountdown.ts)を使う。実行開始時に一度だけ
  // 計算して使い回すことで、実行途中で日付が変わっても非決定的にならないようにする。
  const fetchedDate = toJstDateStr();

  const eventIds = await discoverEventIds();

  const events: ShootoRecordsEvent[] = [];
  let totalBouts = 0;
  let totalParseFailures = 0;
  let totalUnresolvedNames = 0;
  const unresolvedNameSamples: string[] = [];

  for (const id of eventIds) {
    await sleep(300);
    const url = eventUrl(id);
    const html = await fetchHtml(url);
    if (!html) {
      console.warn(`[WARN] fetch失敗: id=${id} (${url})`);
      continue;
    }
    // parseEventMeta自体が「実在しうる日付か」「テストページでないか」を判定する
    // (linkedなidにbout件数0件を要求しない。id=66のように実在するがbout件数が
    // 0件のページも有効な大会として扱う。欠番id探索専用の厳しめの判定
    // isRealMissingEventはdiscoverEventIds側でのみ使う)。
    const meta = parseEventMeta(html);
    if (!meta) {
      console.warn(`[WARN] 実在イベントと判定できないためスキップ: id=${id} (${url})`);
      continue;
    }
    const { bouts, parseFailures } = buildEventBouts(html, meta.eventName);
    events.push({
      eventName: meta.eventName,
      date: meta.date,
      sourceUrl: url,
      fetchedDate,
      bouts,
      parseFailures,
      venue: meta.venue,
      shootoEventId: id,
    });
    totalBouts += bouts.length;
    totalParseFailures += parseFailures;
    for (const b of bouts) {
      if (!b.fighterASlug) {
        totalUnresolvedNames++;
        if (unresolvedNameSamples.length < 30) unresolvedNameSamples.push(b.fighterAName);
      }
      if (!b.fighterBSlug) {
        totalUnresolvedNames++;
        if (unresolvedNameSamples.length < 30) unresolvedNameSamples.push(b.fighterBName);
      }
    }
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  console.log(`\n=== 集計結果 ===`);
  console.log(`大会数: ${events.length}`);
  console.log(`bout数: ${totalBouts}`);
  console.log(`パース失敗チャンク数: ${totalParseFailures}`);
  console.log(`選手名未解決(fighterASlug/fighterBSlug null): ${totalUnresolvedNames}件`);
  if (unresolvedNameSamples.length > 0) {
    console.log(`未解決名サンプル: ${unresolvedNameSamples.slice(0, 10).join(", ")}`);
  }

  if (totalBouts < STOP_MIN_BOUTS || totalBouts > STOP_MAX_BOUTS) {
    console.error(
      `\n[STOP] 停止条件に該当しました: bout数=${totalBouts} (許容範囲 ${STOP_MIN_BOUTS}〜${STOP_MAX_BOUTS})。` +
        `data/shootoRecords.jsonへの書き込みを行わずに終了します。`
    );
    const reportPath = path.join(process.cwd(), "out", "shooto-records-data-build-stop.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          eventCount: events.length,
          totalBouts,
          totalParseFailures,
          totalUnresolvedNames,
          stopMin: STOP_MIN_BOUTS,
          stopMax: STOP_MAX_BOUTS,
        },
        null,
        2
      ) + "\n"
    );
    console.error(`詳細を ${reportPath} に書き出しました。`);
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(OUT, JSON.stringify(events, null, 2) + "\n");
  console.log(`\n[OK] ${OUT} に書き出しました。`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
