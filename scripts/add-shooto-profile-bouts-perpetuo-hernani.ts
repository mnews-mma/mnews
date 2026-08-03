// 指示書C-3: エルナニ ペルペトゥオ(perpetuo-hernani, 修斗公式プロフィールid=830)の
// 戦績表12件(win8/loss3/draw1、プロフィールページのヘッダー集計と一致)を
// data/shootoProfileBouts.json に追記する。
//
// 投入方式は指示書R-8(scripts/build-shooto-profile-bouts.ts)で確立済みの
// スキーマ(1bout=1件の疑似ShootoRecordsEvent互換オブジェクト、sourceType:"profile"、
// 負のshootoEventId、eventName不明時はUNKNOWN_EVENT_NAME)をそのまま踏襲し、
// 新しい設計は起こさない。shootoRecords.json・shootoScraper.tsは一切変更しない。
//
// 対象データはscripts/investigate-shooto-profile-dryrun.tsのparseProfilePage()と
// 同一ロジックで https://www.shooto-mma.com/fighters/?id=830 から取得した12件
// (全件linkedResultId=null、既存data/shootoRecords.json・shootoProfileBouts.jsonに
// 該当bout 0件を実測済み。全件がcutoff(2012-12-24)以前、または大会リンクなしの
// post-cutoffのため、eventNameは全件UNKNOWN_EVENT_NAMEになる)。
//
// 実行: npx tsx scripts/add-shooto-profile-bouts-perpetuo-hernani.ts
import fs from "fs";
import path from "path";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { findFighterSlugByName } from "../src/lib/fighters";
import { ShootoRecordsEvent, ShootoRecordsBout } from "../src/lib/mnewsRating/shootoScraper";

const OUT = path.join(process.cwd(), "data", "shootoProfileBouts.json");
const UNKNOWN_EVENT_NAME = "大会名不明（修斗公式プロフィール由来）";
const PROFILE_URL = "https://www.shooto-mma.com/fighters/?id=830";

const FIGHTER_A_SLUG = "perpetuo-hernani";
const FIGHTER_A_NAME = "エルナニ ペルペトゥオ";
const FIGHTER_A_SHOOTO_ID = 830;

// https://www.shooto-mma.com/fighters/?id=830 のSHOOTO戦績表から実測(2026-08-03)。
// ヘッダー集計(12戦8勝3敗1分)と件数一致。
const BOUTS: {
  date: string;
  symbol: "○" | "×" | "△";
  opponentNameRaw: string;
  opponentShootoId: number;
  methodRaw: string;
}[] = [
  { date: "2013-08-25", symbol: "○", opponentNameRaw: "トミー  デプレット", opponentShootoId: 841, methodRaw: "5R  判定 3-0" },
  { date: "2012-04-26", symbol: "○", opponentNameRaw: "エドガー  セドビア", opponentShootoId: 840, methodRaw: "3R  判定 2-1" },
  { date: "2011-04-01", symbol: "△", opponentNameRaw: "マルコス アントニオ サンタナ", opponentShootoId: 839, methodRaw: "1R  判定" },
  { date: "2010-10-17", symbol: "○", opponentNameRaw: "ロマーリオ マノエル ダ・シウバ", opponentShootoId: 838, methodRaw: "3R  判定 3-0" },
  { date: "2010-08-06", symbol: "×", opponentNameRaw: "ロマーリオ マノエル ダ・シウバ", opponentShootoId: 838, methodRaw: "1R 04:47 S  腕ひしぎ十字固め" },
  { date: "2010-06-12", symbol: "○", opponentNameRaw: "アレクサンドレ  アンドレオッティ", opponentShootoId: 837, methodRaw: "1R 03:30 KO" },
  { date: "2009-08-27", symbol: "×", opponentNameRaw: "バスティアン  レジェン", opponentShootoId: 836, methodRaw: "2R 03:57 TKO" },
  { date: "2009-03-28", symbol: "○", opponentNameRaw: "ファビアーノ  トーレス", opponentShootoId: 835, methodRaw: "1R 04:50 S  フロントスリーパーホールド" },
  { date: "2008-11-29", symbol: "×", opponentNameRaw: "イゴール  フェルナンデス", opponentShootoId: 834, methodRaw: "3R  判定 0-3" },
  { date: "2008-06-28", symbol: "○", opponentNameRaw: "ホセ カルロス ダ・シウバ", opponentShootoId: 833, methodRaw: "1R 01:25 S  スリーパーホールド" },
  { date: "2008-01-26", symbol: "○", opponentNameRaw: "フランシスコ マリオ マリーニョ", opponentShootoId: 832, methodRaw: "2R  S  腕ひしぎ十字固め" },
  { date: "2007-10-27", symbol: "○", opponentNameRaw: "タエデス  メンドンカ", opponentShootoId: 831, methodRaw: "1R 01:50 KO" },
];

function main() {
  const existing: (ShootoRecordsEvent & { sourceType: "profile" })[] = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const existingIds = existing.map((e) => e.shootoEventId);
  const nextIdBase = Math.min(...existingIds) - 1; // 既存の最小id(-1000097)より小さい側に追加する

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

  console.log(`[resolve] 相手slug未解決: ${unresolvedOpponents.length}/${BOUTS.length}件(海外選手のためFIGHTERS未登録、想定どおり)`);
  if (unresolvedOpponents.length > 0) {
    console.log(`  ${unresolvedOpponents.join(", ")}`);
  }

  const merged = [...existing, ...newEvents];
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 2) + "\n");
  console.log(`[OK] ${OUT} に${newEvents.length}件追記(既存${existing.length}件 → 合計${merged.length}件)`);
}

main();
