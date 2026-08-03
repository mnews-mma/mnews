// 粕谷優介(kasuya-yusuke, 修斗公式プロフィールid=323)の修斗戦績6戦のうち、
// 対戦相手側からの偶発反映(2011-12-18 大尊伸光戦)を除く未反映5戦を
// data/shootoProfileBouts.json に追記する。
//
// 経緯: R-7/R-8(#350)の修斗プロフィール監査はfighters.tsの`org: "shooto"`101名を
// 対象母集団としており、kasuya-yusuke自身は`org: "pancrase"`のため対象外だった
// (本人のプロフィールは一度も取得されていない)。唯一反映済みの1戦は、対戦相手の
// 大尊伸光(tyson-nobumitsu, org: "shooto")側が101名の対象だったために偶発的に
// 拾われたもの。
//
// 投入方式は指示書R-8(scripts/build-shooto-profile-bouts.ts)・C-3
// (scripts/add-shooto-profile-bouts-perpetuo-hernani.ts)で確立済みの
// スキーマ(1bout=1件の疑似ShootoRecordsEvent互換オブジェクト、sourceType:"profile"、
// 負のshootoEventId、eventName不明時はUNKNOWN_EVENT_NAME)をそのまま踏襲する。
// shootoRecords.json・shootoScraper.tsは一切変更しない。
//
// データはhttps://www.shooto-mma.com/fighters/?id=323 から実測(2026-08-03、curl)。
// テーブル本体は6戦4勝2分(△が2013-12-15・2011-10-01の2件)だが、同ページ上部の
// ヘッダー集計は「6戦4勝1分」(分が1件少ない)と食い違っている。既知の
// ヘッダー/テーブル食い違いパターン(out/header-table-row-mismatch調査と同型)に
// 倣い、テーブル本体(実際の対戦行)を正とする。
//
// 2013-12-15(児山佳宏戦)はpost-cutoff(2012-12-24以降)だが、data/shootoRecords.json
// に2013年12月の大会自体が1件も存在しない(archive収録漏れ)。大会単位の再取得には
// 本スクリプトでは手を出さず、他のpost-cutoff新規②-b件と同様にプロフィール経由の
// 疑似イベントとして1bout投入する。
//
// ★既知の残存リスク(このスクリプトでは対応しない): 将来shootoRecords.jsonの
// archive収集が改善され2013年12月の大会が追加された場合、本スクリプトが入れた
// 2013-12-15 vs 児山佳宏のprofile発の1boutと重複する可能性がある。
// src/lib/multiOrgRecordsData.tsのfetchShootoRecords()はarchiveとprofileを
// 単純concatするのみで、日付+対戦相手の複合キーでの重複排除は行っていない
// (実測確認済み)。archive側の収集範囲を広げる作業を行う際は、この1boutが
// 二重計上されないか個別に確認すること。
//
// 実行: npx tsx scripts/add-shooto-profile-bouts-kasuya-yusuke.ts
import fs from "fs";
import path from "path";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { findFighterSlugByName } from "../src/lib/fighters";
import { ShootoRecordsEvent, ShootoRecordsBout } from "../src/lib/mnewsRating/shootoScraper";

const OUT = path.join(process.cwd(), "data", "shootoProfileBouts.json");
const UNKNOWN_EVENT_NAME = "大会名不明（修斗公式プロフィール由来）";
const PROFILE_URL = "https://www.shooto-mma.com/fighters/?id=323";

const FIGHTER_A_SLUG = "kasuya-yusuke";
const FIGHTER_A_NAME = "粕谷  優介";
const FIGHTER_A_SHOOTO_ID = 323;

// https://www.shooto-mma.com/fighters/?id=323 のSHOOTO戦績表から実測(2026-08-03)。
// 2011-12-18(大尊伸光戦)はshootoProfileBouts.jsonに既存(対戦相手側から反映済み)のため対象外。
const BOUTS: {
  date: string;
  symbol: "○" | "×" | "△";
  opponentNameRaw: string;
  opponentShootoId: number;
  methodRaw: string;
}[] = [
  { date: "2013-12-15", symbol: "△", opponentNameRaw: "児山  佳宏", opponentShootoId: 329, methodRaw: "3R  判定 1-1 " },
  { date: "2011-10-01", symbol: "△", opponentNameRaw: "coBa  ", opponentShootoId: 349, methodRaw: "2R  テクニカル判定 0-0 " },
  { date: "2011-05-28", symbol: "○", opponentNameRaw: "藤石  義和", opponentShootoId: 362, methodRaw: "1R 04:47 S  スリーパーホールド" },
  { date: "2011-02-26", symbol: "○", opponentNameRaw: "太田  洋平", opponentShootoId: 346, methodRaw: "1R 04:14 S  スリーパーホールド" },
  { date: "2010-10-16", symbol: "○", opponentNameRaw: "独眼竜  刺牙", opponentShootoId: 286, methodRaw: "1R 04:02 S  スリーパーホールド" },
];

function main() {
  const existing: (ShootoRecordsEvent & { sourceType: "profile" })[] = JSON.parse(fs.readFileSync(OUT, "utf8"));

  // 既存にkasuya-yusuke(id=323)絡みのboutが無いことを確認(2重投入防止)。
  const alreadyPresent = existing.filter(
    (e) =>
      e.bouts.some((b) => b.fighterAShootoId === FIGHTER_A_SHOOTO_ID || b.fighterBShootoId === FIGHTER_A_SHOOTO_ID) &&
      BOUTS.some((b) => b.date === e.date)
  );
  if (alreadyPresent.length > 0) {
    console.error(`[ERROR] 投入予定の日付と重複する既存bout${alreadyPresent.length}件を検出。中止。`);
    process.exit(1);
  }

  const existingIds = existing.map((e) => e.shootoEventId);
  const nextIdBase = Math.min(...existingIds) - 1;

  const fetchedDate = toJstDateStr();
  const unresolvedOpponents: string[] = [];

  const newEvents: (ShootoRecordsEvent & { sourceType: "profile" })[] = BOUTS.map((b, idx) => {
    const fighterBSlug = findFighterSlugByName(b.opponentNameRaw.trim(), FIGHTER_A_SLUG);
    if (!fighterBSlug) unresolvedOpponents.push(b.opponentNameRaw);

    const resultType = b.symbol === "○" || b.symbol === "×" ? "decisive" : "draw";
    const winnerName = resultType === "decisive" ? (b.symbol === "○" ? FIGHTER_A_NAME : b.opponentNameRaw.trim()) : null;
    const winnerSlug = resultType === "decisive" ? (b.symbol === "○" ? FIGHTER_A_SLUG : fighterBSlug) : null;

    const bout: ShootoRecordsBout & { sourceType: "profile" } = {
      cardPosition: 1,
      isOpeningFight: false,
      headingText: "",
      fighterAName: FIGHTER_A_NAME,
      fighterBName: b.opponentNameRaw.trim(),
      fighterASlug: FIGHTER_A_SLUG,
      fighterBSlug,
      ruleType: "unknown",
      weightKg: null,
      namedDivision: null,
      resultType,
      winnerName,
      winnerSlug,
      round: null,
      time: null,
      methodRaw: b.methodRaw,
      isWeighInMiss: false,
      fighterAShootoId: FIGHTER_A_SHOOTO_ID,
      fighterBShootoId: b.opponentShootoId,
      fighterAGym: null,
      fighterBGym: null,
      fighterAWeighInKg: null,
      fighterBWeighInKg: null,
      noteRaw: null,
      strapTitle: null,
      sourceType: "profile",
    };

    return {
      eventName: UNKNOWN_EVENT_NAME,
      date: b.date,
      sourceUrl: PROFILE_URL,
      fetchedDate,
      bouts: [bout],
      parseFailures: 0,
      venue: null,
      shootoEventId: nextIdBase - idx,
      sourceType: "profile",
    };
  });

  console.log(`[resolve] 相手slug未解決: ${unresolvedOpponents.length}/${BOUTS.length}件(FIGHTERS未登録、想定どおり)`);
  if (unresolvedOpponents.length > 0) {
    console.log(`  ${unresolvedOpponents.join(", ")}`);
  }

  const merged = [...existing, ...newEvents];
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
  console.log(`[OK] ${OUT} に${newEvents.length}件追記(既存${existing.length}件 → 合計${merged.length}件)`);
}

main();
