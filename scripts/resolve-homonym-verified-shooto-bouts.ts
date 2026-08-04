// 指示書J: #423/#425で「要裏取り」として投入対象外にしていた修斗4名のうち、
// 所属ジム・階級・活動時期・URL(公式プロフィールの体重階級表記)で個別に
// 裏取りし「同一人物と確定」できた3名(斎藤裕/征矢貴/青井人)の欠落bout
// (新規①pre-cutoff + 新規②-b大会自体無し)を投入する。
//
// 裏取り結果(詳細はout/homonym-verification-report.md参照):
// - 斎藤裕(saito-yutaka, id=5): 体重階級フェザー級[-65.8kg]がFIGHTERS一致。同一人物と確定。
// - 征矢貴(soya-takaki, id=102): 体重階級フライ級[-56.7kg]がFIGHTERS一致。同一人物と確定。
// - 青井人(aoi-jin, id=267): 体重階級フェザー級[-65.8kg]がFIGHTERS一致。同一人物と確定。
// - 鶴屋怜(tsuruya-rei, id=1072): 体重階級が「キッズ・ジュニア修斗」でFIGHTERSの
//   UFCフライ級実績と全く異なる。同一人物である可能性はあるが、対象データが
//   非プロ(キッズ・ジュニア)のため投入対象外(仮に本人でも既存方針上プロ戦績には
//   算入しない)。
// - 関鉄矢(seki-tetsuya, id=1027、指示書Iの同音異表記): 所属ジム「SONIC SQUAD」が
//   DEEP戦績データの表記と一致・階級もフェザー級で一致。同一人物と確定。
// - 金太郎(kintaro, id=962、指示書Iの同音異表記+#423のambiguous): 体重階級
//   バンタム級・所属「パンクラス大阪稲垣組」がFIGHTERSと整合。同一人物と確定
//   だが、該当bout(2015-06-21 vs 祖根寿麻)は既にdata/shootoRecords.json側に
//   反映済みのため投入不要(裏取りの結論のみ記録)。
//
// 実行: npx tsx scripts/resolve-homonym-verified-shooto-bouts.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, findFighterSlugByName } from "../src/lib/fighters";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { ShootoRecordsEvent, ShootoRecordsBout } from "../src/lib/mnewsRating/shootoScraper";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";

const PROFILE_BOUTS_PATH = path.join(process.cwd(), "data", "shootoProfileBouts.json");
const SHOOTO_RECORDS_PATH = path.join(process.cwd(), "data", "shootoRecords.json");
const UNKNOWN_EVENT_NAME = "大会名不明(修斗公式プロフィール由来)";
const CUTOFF = "2012-12-24";

function normName(s: string | null | undefined): string {
  return (s || "").replace(/[\s　]/g, "");
}

interface ProfileBoutRaw {
  date: string;
  symbol: "○" | "×" | "△";
  oppId: string;
  oppName: string;
  method: string;
  linkedResultId: string | null;
}

// 指示書J対象4名(#423裏取り確定分)。プロフィールページのSHOOTO/VTJ戦績表
// (https://www.shooto-mma.com/fighters/?id=NNN)から実測済み。
const TARGETS: { slug: string; nameJa: string; siteNameJa: string; shootoId: number; bouts: ProfileBoutRaw[] }[] = [
  {
    slug: "saito-yutaka",
    nameJa: "斎藤 裕",
    siteNameJa: "斎藤  裕",
    shootoId: 5,
    bouts: [
      { date: "2019-09-22", symbol: "○", oppId: "249", oppName: "髙谷  裕之", method: "1R 01:17 KO", linkedResultId: "75" },
      { date: "2019-05-06", symbol: "×", oppId: "1197", oppName: "アギー  サルダリ", method: "判定 0-2", linkedResultId: "81" },
      { date: "2019-01-27", symbol: "○", oppId: "1169", oppName: "マーカス  ヘルド", method: "2R 01:29 KO  グラウンド・パンチ", linkedResultId: "68" },
      { date: "2018-05-13", symbol: "○", oppId: "266", oppName: "リオン  武", method: "判定 3-0", linkedResultId: "56" },
      { date: "2018-03-25", symbol: "○", oppId: "1136", oppName: "ドレックス  ザンボアンガ", method: "3R 04:58 KO  グランドパンチ", linkedResultId: "54" },
      { date: "2017-04-23", symbol: "○", oppId: "8", oppName: "宇野  薫", method: "判定 3-0", linkedResultId: "41" },
      { date: "2017-01-29", symbol: "×", oppId: "1044", oppName: "マイク  グランディ", method: "3R  判定 0-3", linkedResultId: "36" },
      { date: "2016-04-23", symbol: "○", oppId: "7", oppName: "キム  ミンジェ", method: "1R 03:11 S  スリーパーホールド", linkedResultId: "1" },
      { date: "2016-01-11", symbol: "○", oppId: "257", oppName: "中村  ジュニア", method: "5R  判定 3-0", linkedResultId: "29" },
      { date: "2015-05-03", symbol: "○", oppId: "257", oppName: "中村  ジュニア", method: "3R  判定 3-0", linkedResultId: null },
      { date: "2014-12-21", symbol: "○", oppId: "307", oppName: "藤田  ブロディ", method: "1R 00:36 S  スリーパーホールド", linkedResultId: null },
      { date: "2014-09-27", symbol: "○", oppId: "272", oppName: "太田  拓己", method: "2R  判定 3-0", linkedResultId: null },
      { date: "2014-07-19", symbol: "○", oppId: "255", oppName: "TOMA", method: "2R  判定 3-0", linkedResultId: null },
      { date: "2014-03-16", symbol: "△", oppId: "215", oppName: "城田  和秀", method: "2R  判定 0-0", linkedResultId: null },
      { date: "2013-11-09", symbol: "○", oppId: "866", oppName: "村津  孝徳", method: "2R  判定 0-3", linkedResultId: null },
      { date: "2013-09-22", symbol: "○", oppId: "286", oppName: "独眼竜  刺牙", method: "2R  判定 3-0", linkedResultId: null },
      { date: "2013-06-08", symbol: "○", oppId: "563", oppName: "鷹島  大樹", method: "2R  判定 3-0", linkedResultId: null },
      { date: "2013-02-23", symbol: "△", oppId: "520", oppName: "河野  啓太", method: "2R  判定 0-1", linkedResultId: null },
      { date: "2012-10-21", symbol: "○", oppId: "584", oppName: "吉田  真也", method: "2R 03:45 KO", linkedResultId: null },
      { date: "2012-09-30", symbol: "×", oppId: "583", oppName: "ユータ＆ロック", method: "2R  判定 0-3", linkedResultId: null },
      { date: "2012-06-30", symbol: "○", oppId: "559", oppName: "地浜  敏郎", method: "2R  判定 3-0", linkedResultId: null },
      { date: "2011-11-27", symbol: "○", oppId: "287", oppName: "佐々木  郁矢", method: "2R  判定 3-0", linkedResultId: null },
      { date: "2016-09-19", symbol: "×", oppId: "965", oppName: "ISAO", method: "判定 2-1", linkedResultId: "19" },
    ],
  },
  {
    slug: "soya-takaki",
    nameJa: "征矢 貴",
    siteNameJa: "征矢  貴",
    shootoId: 102,
    bouts: [
      { date: "2017-05-12", symbol: "×", oppId: "100", oppName: "清水  清隆", method: "3R 00:32 KO  スタンドパンチ", linkedResultId: "42" },
      { date: "2016-12-18", symbol: "○", oppId: "150", oppName: "藤田 ケオン 寿大", method: "2R  判定 2-0", linkedResultId: "12" },
      { date: "2016-07-17", symbol: "○", oppId: "121", oppName: "梶川  卓", method: "1R 01:29 KO  グラウンドパンチ", linkedResultId: "7" },
      { date: "2016-05-28", symbol: "△", oppId: "96", oppName: "北原  史寛", method: "2R  判定 1-0", linkedResultId: "3" },
      { date: "2016-02-27", symbol: "×", oppId: "18", oppName: "オニボウズ", method: "2R  判定 2-0", linkedResultId: "28" },
      { date: "2015-01-25", symbol: "○", oppId: "121", oppName: "梶川  卓", method: "3R  判定 3-0", linkedResultId: null },
      { date: "2014-09-27", symbol: "×", oppId: "1", oppName: "菅原  雅顕", method: "1R 03:19 KO", linkedResultId: null },
      { date: "2014-05-05", symbol: "○", oppId: "528", oppName: "ズ  ギョンズン", method: "1R 03:01 KO", linkedResultId: null },
      { date: "2013-12-15", symbol: "○", oppId: "149", oppName: "福田  龍彌", method: "1R 05:00 KO", linkedResultId: null },
      { date: "2013-09-01", symbol: "○", oppId: "124", oppName: "亀島  聖児", method: "1R 02:02 KO", linkedResultId: null },
      { date: "2013-06-08", symbol: "○", oppId: "449", oppName: "鳥越  顕", method: "1R 03:52 KO", linkedResultId: null },
      { date: "2015-09-13", symbol: "×", oppId: "11", oppName: "前田  吉朗", method: "3R  判定 3-0", linkedResultId: "16" },
    ],
  },
  {
    slug: "aoi-jin",
    nameJa: "青井人",
    siteNameJa: "青井  人",
    shootoId: 267,
    bouts: [
      { date: "2020-02-16", symbol: "○", oppId: "669", oppName: "久保村  ヨシTERU", method: "1R 03:20 KO  グラウンドパンチ", linkedResultId: "89" },
      { date: "2019-07-15", symbol: "×", oppId: "15", oppName: "内藤  太尊", method: "2R 03:21 KO  グラウンドパンチ", linkedResultId: "74" },
      { date: "2019-01-27", symbol: "×", oppId: "300", oppName: "仲山  貴志", method: "1R 02:16 S  スリーパーホールド", linkedResultId: "68" },
      { date: "2017-10-15", symbol: "×", oppId: "248", oppName: "高橋  遼伍", method: "3R  判定 2-0", linkedResultId: "46" },
      { date: "2017-06-25", symbol: "○", oppId: "333", oppName: "タクミ", method: "2R 00:51 TKO", linkedResultId: "43" },
      { date: "2017-01-29", symbol: "○", oppId: "329", oppName: "児山  佳宏", method: "1R 02:07 KO  スタンドパンチ", linkedResultId: "36" },
      { date: "2016-11-13", symbol: "○", oppId: "308", oppName: "前口  緑一色", method: "判定 0-2", linkedResultId: null },
      { date: "2016-04-23", symbol: "△", oppId: "16", oppName: "美木  航", method: "2R  ドロー 1-0", linkedResultId: "1" },
      { date: "2015-09-21", symbol: "○", oppId: "275", oppName: "小川  将貴", method: "2R  判定 3-0", linkedResultId: null },
      { date: "2015-06-21", symbol: "○", oppId: "274", oppName: "大森  カヲル", method: "1R 04:06 S  腕ひしぎ十字固め", linkedResultId: null },
      { date: "2016-06-19", symbol: "○", oppId: "585", oppName: "ファン  チョンホ", method: "1R 04:19 S  三角絞め", linkedResultId: "5" },
    ],
  },
  {
    slug: "seki-tetsuya",
    nameJa: "関鉄矢",
    siteNameJa: "関  鉄也",
    shootoId: 1027,
    bouts: [{ date: "2016-09-19", symbol: "×", oppId: "1026", oppName: "山本  哲也", method: "判定 3-0", linkedResultId: "19" }],
  },
];

function resultFromSymbol(sym: string): "win" | "loss" | "draw" | "unknown" {
  if (sym === "○") return "win";
  if (sym === "×") return "loss";
  if (sym === "△") return "draw";
  return "unknown";
}

function main() {
  const shootoRecords: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(SHOOTO_RECORDS_PATH, "utf8"));
  const existingProfileBouts: (ShootoRecordsEvent & { sourceType: "profile" })[] = JSON.parse(
    fs.readFileSync(PROFILE_BOUTS_PATH, "utf8")
  );
  const combinedEvents = [...shootoRecords, ...existingProfileBouts];
  const eventIdSet = new Set<number>(shootoRecords.map((e) => e.shootoEventId));
  const fighterBySlug = new Map(FIGHTERS.map((f) => [f.slug, f]));

  function buildExistingIndex(slug: string): { date: string; opponentNorm: string; result: string }[] {
    const out: { date: string; opponentNorm: string; result: string }[] = [];
    const rec = computeFighterShootoRecord(combinedEvents, slug);
    for (const b of rec.bouts) {
      let result = "unknown";
      if (b.resultType === "draw") result = "draw";
      else if (b.resultType === "decisive") result = b.isWin ? "win" : "loss";
      out.push({ date: b.date, opponentNorm: normName(b.opponentName), result });
    }
    const fighter = fighterBySlug.get(slug);
    if (fighter && Array.isArray((fighter as any).history)) {
      for (const h of (fighter as any).history as any[]) {
        out.push({ date: h.date, opponentNorm: normName(h.opponent), result: h.result === "nc" ? "unknown" : h.result });
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
  const archiveGapReport: any[] = [];
  const mismatchReport: any[] = [];
  const alreadyReflected: any[] = [];

  for (const t of TARGETS) {
    const existing = buildExistingIndex(t.slug);
    const existingByKey = new Map<string, { date: string; opponentNorm: string; result: string }[]>();
    for (const e of existing) {
      const key = `${e.date}|${e.opponentNorm}`;
      const arr = existingByKey.get(key) ?? [];
      arr.push(e);
      existingByKey.set(key, arr);
    }

    for (const b of t.bouts) {
      const oppNorm = normName(b.oppName);
      const candidates = existingByKey.get(`${b.date}|${oppNorm}`) ?? [];
      const result = resultFromSymbol(b.symbol);

      if (candidates.length === 0) {
        if (b.date < CUTOFF || (b.linkedResultId && !eventIdSet.has(Number(b.linkedResultId))) || !b.linkedResultId) {
          toInject.push({
            slug: t.slug,
            fighterAName: t.siteNameJa,
            fighterAShootoId: t.shootoId,
            date: b.date,
            symbol: b.symbol,
            opponentNameRaw: b.oppName,
            opponentShootoId: Number(b.oppId),
            methodRaw: b.method,
          });
        } else {
          archiveGapReport.push({ slug: t.slug, date: b.date, opponent: b.oppName, linkedResultId: b.linkedResultId });
        }
      } else {
        const cand = candidates[0];
        if (cand.result !== "unknown" && result !== "unknown" && cand.result !== result) {
          mismatchReport.push({ slug: t.slug, date: b.date, opponent: b.oppName, profileResult: result, existingResult: cand.result });
        } else {
          alreadyReflected.push({ slug: t.slug, date: b.date, opponent: b.oppName });
        }
      }
    }
  }

  console.log(`投入対象(profile投入型): ${toInject.length}件`);
  console.log(`archive収録漏れ型(投入せず報告のみ): ${archiveGapReport.length}件`, archiveGapReport);
  console.log(`mismatch(投入せず報告のみ): ${mismatchReport.length}件`, mismatchReport);
  console.log(`既に反映済み: ${alreadyReflected.length}件`);

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

  console.log(`\n[resolve] 相手slug未解決: ${unresolvedOpponents.length}/${newEvents.length}件`);

  const merged = [...existingProfileBouts, ...newEvents];
  fs.writeFileSync(PROFILE_BOUTS_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`\n[OK] ${PROFILE_BOUTS_PATH} に${newEvents.length}件追記(既存${existingProfileBouts.length}件 → 合計${merged.length}件)`);

  fs.writeFileSync(
    path.join(process.cwd(), "out", "homonym-shooto-ingestion-report.json"),
    JSON.stringify({ toInject, archiveGapReport, mismatchReport, alreadyReflected, unresolvedOpponents }, null, 2) + "\n"
  );
  console.log("書き出し: out/homonym-shooto-ingestion-report.json");
}

main();
