// 指示書R-8: 修斗選手プロフィールページ(/fighters/?id=NNN)経由で発見した
// bout(新規①・新規②-a・新規②-b、合計99行)を data/shootoProfileBouts.json に
// 書き出す。data/shootoRecords.json・src/lib/mnewsRating/shootoScraper.ts は
// 一切変更しない(resolveOutcome()は別セッションが修正中のため二重に触らない。
// PR #350のレポート「設計オプション: 案A(疑似イベント方式)」どおり、1bout=1件の
// 疑似ShootoRecordsEvent互換オブジェクトを別ファイルに分離して作る)。
//
// 入力: out/r7-shooto-profile-dryrun-allrows.json(指示書R-7bで生成・監査済みの
// 884行全件。本スクリプトは再取得せずこの監査済みスナップショットから構築する)。
// 除外: category="matched"(773件、既存と一致=投入しない)、
//       category="mismatch"(12件、既存側のresolveOutcome()バグ修正待ちのため
//       投入対象に含めない。二重に触らない)。
//
// 実行: npx tsx scripts/build-shooto-profile-bouts.ts
import fs from "fs";
import path from "path";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { findFighterSlugByName } from "../src/lib/fighters";
import { ShootoRecordsEvent, ShootoRecordsBout } from "../src/lib/mnewsRating/shootoScraper";

const OUT = path.join(process.cwd(), "data", "shootoProfileBouts.json");
const UNKNOWN_EVENT_NAME = "大会名不明（修斗公式プロフィール由来）";

// 実在id(現状1〜281程度)と衝突しないよう、疑似イベントのidは負数を使う。
const SYNTHETIC_ID_BASE = -1_000_000;

// 停止条件: 指示書R-8の対象件数(新規①43+新規②-a2+新規②-b54=99)から
// 大きく外れる場合は書き込まずに停止する(取得元サイトの状態がR-7b実行時から
// 変わっている可能性があるため、無言で乖離した件数を書き込まない)。
// 99件のうち1件(soki/tamura-hibiki 2019-06-16)は両者とも101名の対象に含まれる
// ため同一boutが両側から出現し、統合すると98件になる。
const STOP_MIN_EVENTS = 90;
const STOP_MAX_EVENTS = 105;

interface AllRow {
  slug: string;
  nameJa: string;
  shootoId: string;
  date: string;
  section: string;
  symbol: string;
  result: "win" | "loss" | "draw" | "unknown";
  opponentRaw: string;
  opponentShootoId: string | null;
  methodRaw: string;
  linkedResultId: string | null;
  category: string;
  note: string;
}

function normName(s: string | null | undefined): string {
  return (s || "").replace(/[\s　]/g, "");
}

function main() {
  const allRowsPath = path.join(process.cwd(), "out", "r7-shooto-profile-dryrun-allrows.json");
  const allRows: AllRow[] = JSON.parse(fs.readFileSync(allRowsPath, "utf8"));

  const recordsPath = path.join(process.cwd(), "data", "shootoRecords.json");
  const shootoRecords: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(recordsPath, "utf8"));
  const eventById = new Map<number, ShootoRecordsEvent>(shootoRecords.map((e) => [e.shootoEventId, e]));

  const target = allRows.filter(
    (r) =>
      r.category === "new1_precutoff" ||
      r.category === "new2a_bout_missing_in_existing_event" ||
      r.category === "new2b_event_missing"
  );
  console.log(`[extract] 投入対象(new1+new2a+new2b): ${target.length}件`);

  // 両者とも今回の対象母集団に含まれるため同一boutが両側から出現するケース
  // (実測: soki<->tamura-hibiki 2019-06-16の1組のみ)を1件に統合する。
  // key: 日付+両者名(正規化)をソートして連結したもの(順不同で一致させる)。
  const seenBoutKeys = new Set<string>();
  const dedupedTarget: AllRow[] = [];
  const droppedAsDuplicateSide: AllRow[] = [];
  for (const r of target) {
    const names = [normName(r.nameJa), normName(r.opponentRaw)].sort();
    const key = `${r.date}|${names.join("|")}`;
    if (seenBoutKeys.has(key)) {
      droppedAsDuplicateSide.push(r);
      continue;
    }
    seenBoutKeys.add(key);
    dedupedTarget.push(r);
  }
  console.log(`[dedup] 両側出現による統合: ${droppedAsDuplicateSide.length}件除外 (残り${dedupedTarget.length}件)`);
  for (const d of droppedAsDuplicateSide) {
    console.log(`  - ${d.slug}(${d.nameJa}) ${d.date} vs ${d.opponentRaw} は既に反対側から採用済み`);
  }

  if (dedupedTarget.length < STOP_MIN_EVENTS || dedupedTarget.length > STOP_MAX_EVENTS) {
    console.error(
      `\n[STOP] 統合後の件数(${dedupedTarget.length})が想定範囲(${STOP_MIN_EVENTS}〜${STOP_MAX_EVENTS})外です。書き込みを中止します。`
    );
    process.exitCode = 1;
    return;
  }

  const fetchedDate = toJstDateStr();
  const events: (ShootoRecordsEvent & { sourceType: "profile" })[] = [];
  const unresolvedOpponents: string[] = [];

  dedupedTarget.forEach((r, idx) => {
    const targetShootoId = Number(r.shootoId);
    const opponentShootoId = r.opponentShootoId ? Number(r.opponentShootoId) : null;
    const fighterASlug = r.slug;
    const fighterAName = r.nameJa;
    const fighterBNameRaw = r.opponentRaw.trim();
    const fighterBSlug = findFighterSlugByName(fighterBNameRaw, fighterASlug);
    if (!fighterBSlug) unresolvedOpponents.push(fighterBNameRaw);

    let resultType: string;
    if (r.symbol === "○" || r.symbol === "×") resultType = "decisive";
    else if (r.symbol === "△") resultType = "draw";
    else resultType = "unknown"; // 実測: 99件中これに該当する行は無い(下でassertする)

    const winnerName = resultType === "decisive" ? (r.symbol === "○" ? fighterAName : fighterBNameRaw) : null;
    const winnerSlug = resultType === "decisive" ? (r.symbol === "○" ? fighterASlug : fighterBSlug) : null;

    let eventName: string;
    let sourceUrl: string;
    if (r.category === "new2a_bout_missing_in_existing_event" && r.linkedResultId) {
      const realEvent = eventById.get(Number(r.linkedResultId));
      eventName = realEvent ? realEvent.eventName : UNKNOWN_EVENT_NAME;
      sourceUrl = `https://www.shooto-mma.com/fighters/?id=${targetShootoId}`; // bout自体の一次出典はプロフィールページ
    } else {
      eventName = UNKNOWN_EVENT_NAME;
      sourceUrl = `https://www.shooto-mma.com/fighters/?id=${targetShootoId}`;
    }

    const bout: ShootoRecordsBout & { sourceType: "profile" } = {
      cardPosition: 1,
      isOpeningFight: false,
      headingText: "",
      fighterAName,
      fighterBName: fighterBNameRaw,
      fighterASlug,
      fighterBSlug,
      ruleType: "unknown",
      weightKg: null,
      namedDivision: null,
      resultType,
      winnerName,
      winnerSlug,
      round: null,
      time: null,
      methodRaw: r.methodRaw,
      isWeighInMiss: false,
      fighterAShootoId: targetShootoId,
      fighterBShootoId: opponentShootoId ?? 0,
      fighterAGym: null,
      fighterBGym: null,
      fighterAWeighInKg: null,
      fighterBWeighInKg: null,
      noteRaw: null,
      strapTitle: null,
      sourceType: "profile",
    };

    events.push({
      eventName,
      date: r.date,
      sourceUrl,
      fetchedDate,
      bouts: [bout],
      parseFailures: 0,
      venue: null,
      shootoEventId: SYNTHETIC_ID_BASE - idx,
      sourceType: "profile",
    });
  });

  const unknownCount = events.filter((e) => e.bouts[0].resultType === "unknown").length;
  if (unknownCount > 0) {
    console.error(`\n[STOP] resultType="unknown"の行が${unknownCount}件あります(○/×/△以外の記号)。想定外のため中止します。`);
    process.exitCode = 1;
    return;
  }

  console.log(`[resolve] 相手slug未解決: ${unresolvedOpponents.length}件`);
  if (unresolvedOpponents.length > 0) {
    console.log(`  サンプル: ${unresolvedOpponents.slice(0, 10).join(", ")}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(events, null, 2) + "\n");
  console.log(`\n[OK] ${OUT} に${events.length}件の疑似イベント(=bout)を書き出しました。`);
}

main();
