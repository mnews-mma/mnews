// 指示書H: extractBoutTables()の`<table id="...">`取りこぼしバグ(#428で発見・
// 本PRでregex修正済み)により未収録だった残り7件を、公式イベントページの
// 生HTMLから実測して該当イベントに追記する。
//
// 全418大会をscripts/scan-pancrase-table-id-gap.tsで走査し、既回収済み
// (#428の3件)を除いた真の取りこぼしが7件(6大会)であることを確認済み
// (2017-2022年の大会に偏在。1993-2016年・2023年以降は0件)。
//
// regex修正自体は将来の再スクレイピング(nightly batch)で自動的に
// この種のbout表を拾えるようにするためのもの。本スクリプトは現在の
// data/pancraseRecords.jsonを直ちに正しい状態にするための直接追記
// (フル再スクレイピングは、蓄積された手動slug backfill済みデータへの
// 未検証の副作用リスクがあるため本PRでは行わない)。
//
// 実行: npx tsx scripts/recover-pancrase-table-id-bouts.ts
import fs from "fs";
import path from "path";
import { findFighterSlugByName } from "../src/lib/fighters";
import { classifyMmaRuleType } from "../src/lib/mnewsRating/nonProBoutFilter";

const RECORDS_PATH = path.join(process.cwd(), "data", "pancraseRecords.json");

interface NewBout {
  eventDate: string;
  eventName: string;
  headingText: string;
  fighterAName: string;
  fighterBName: string;
  leftMarkerRaw: string; // ""は両者マーカー無し(試合中止等)
  rightMarkerRaw: string;
  decisionRaw: string; // methodRaw(判定・中止理由等の生テキスト)
  round: string | null;
  time: string | null;
  leftUrl: string;
  rightUrl: string;
  weightLeftRaw: string | null;
  weightRightRaw: string | null;
}

const NEW_BOUTS: NewBout[] = [
  {
    eventDate: "2017-04-23",
    eventName: "PANCRASE286",
    headingText: "第5試合　ライト級　3分3ラウンド",
    fighterAName: "楳原嵩",
    fighterBName: "井上雄策",
    leftMarkerRaw: "×",
    rightMarkerRaw: "○",
    decisionRaw: "1R 2:20、KO/バックブロー",
    round: "1R",
    time: "2:20",
    leftUrl: "../../../data/prfl2/umehara.html",
    rightUrl: "../../../data/prfl2/inoueyusaku.html",
    weightLeftRaw: "楳原嵩(68.4kg)",
    weightRightRaw: "井上雄策(69.9kg)",
  },
  {
    eventDate: "2018-12-09",
    eventName: "PANCRASE302",
    headingText: "第8試合　フライ級　5分3ラウンド",
    fighterAName: "中村龍之",
    fighterBName: "鈴木千裕",
    leftMarkerRaw: "",
    rightMarkerRaw: "",
    decisionRaw: "試合中止",
    round: null,
    time: null,
    leftUrl: "../../../data/prfl2/nakamuratatsuyuki.html",
    rightUrl: "../../../data/prfl2/suzukichihiro.html",
    weightLeftRaw: null,
    weightRightRaw: null,
  },
  {
    eventDate: "2019-09-29",
    eventName: "PANCRASE308",
    headingText: "第7試合　女子ストロー級 暫定王者決定4人トーナメント1回戦　ストロー級　5分3ラウンド",
    fighterAName: "法 DATE",
    fighterBName: "チャン・ヒョンジ",
    leftMarkerRaw: "",
    rightMarkerRaw: "",
    decisionRaw: "試合中止/法 DATE計量失格",
    round: null,
    time: null,
    leftUrl: "../../../data/prfl-a/noridate.html",
    rightUrl: "../../../data/prfl-a/hyunjijang.html",
    weightLeftRaw: "法 DATE(54.65kg)",
    weightRightRaw: "チャン・ヒョンジ(51.25kg)",
  },
  {
    eventDate: "2020-02-16",
    eventName: "PANCRASE312",
    headingText: "第1試合　ストロー級　5分3ラウンド",
    fighterAName: "八田亮",
    fighterBName: "永井美自戒",
    leftMarkerRaw: "○",
    rightMarkerRaw: "×",
    decisionRaw: "2R 2:50、タップアウト/フロントチョーク",
    round: "2R",
    time: "2:50",
    leftUrl: "../../../data/prfl2/hatta.html",
    rightUrl: "../../../data/prfl2/nagaimijikai.html",
    weightLeftRaw: "八田亮(52.25kg)",
    weightRightRaw: "永井美自戒(52.25kg)",
  },
  {
    eventDate: "2020-07-24",
    eventName: "PANCRASE316",
    headingText: "①2020年・第26回ネオブラッドトーナメント・フライ級1回戦　5分3ラウンド",
    fighterAName: "西村大輝",
    fighterBName: "梅川毒一郎",
    leftMarkerRaw: "×",
    rightMarkerRaw: "○",
    decisionRaw: "1R 2:50、TKO/グラウンドのパンチ",
    round: "1R",
    time: "2:50",
    leftUrl: "../../../data/prfl2/nishimuradaiki.html",
    rightUrl: "../../../data/prfl2/baisen.html",
    weightLeftRaw: "西村大輝(56.65kg)",
    weightRightRaw: "梅川毒一郎(56.2kg)",
  },
  {
    eventDate: "2020-07-24",
    eventName: "PANCRASE316",
    headingText: "②2020年・第26回ネオブラッドトーナメント・フライ級1回戦　5分3ラウンド",
    fighterAName: "田代悠生",
    fighterBName: "坪内一将",
    leftMarkerRaw: "×",
    rightMarkerRaw: "○",
    decisionRaw: "1R 3:58、タップアウト/バックチョーク",
    round: "1R",
    time: "3:58",
    leftUrl: "../../../data/prfl2/tashiroyuki.html",
    rightUrl: "../../../data/prfl2/tsubouchi.html",
    weightLeftRaw: "田代悠生(56.3kg)",
    weightRightRaw: "坪内一将(55.85kg)",
  },
  {
    eventDate: "2022-09-11",
    eventName: "PANCRASE 329",
    headingText: "第1試合　アトム級　5分3ラウンド",
    fighterAName: "沙弥子",
    fighterBName: "原田よき",
    leftMarkerRaw: "○",
    rightMarkerRaw: "×",
    decisionRaw: "1R 3:22、TO/アームロック",
    round: "1R",
    time: "3:22",
    leftUrl: "../../../data/prfl-a/sayako.html",
    rightUrl: "../../../data/prfl-a/harada.html",
    weightLeftRaw: "沙弥子(47.5kg)",
    weightRightRaw: "原田よき(47.45kg)",
  },
];

const DECISIVE_MARKERS = ["○", "◯", "〇"];
const NAMED_DIVISION_TOKENS = [
  "ライトヘビー級", "ライトフライ級", "スーパーヘビー級", "スーパーフライ級", "スーパーストロー級",
  "無差別級", "ヘビー級", "ミドル級", "ウェルター級", "ライト級", "フェザー級", "バンタム級", "フライ級", "ストロー級", "アトム級", "ミニマム級",
];

function main() {
  const events: any[] = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const patchLog: any[] = [];

  for (const nb of NEW_BOUTS) {
    const ev = events.find((e) => e.date === nb.eventDate && e.eventName === nb.eventName);
    if (!ev) throw new Error(`[ERROR] event not found: ${nb.eventDate} ${nb.eventName}`);
    const dup = ev.bouts.find((b: any) => b.fighterAName === nb.fighterAName && b.fighterBName === nb.fighterBName);
    if (dup) throw new Error(`[ERROR] 既に同一boutが存在(想定外): ${nb.eventDate} ${nb.fighterAName} vs ${nb.fighterBName}`);

    let resultType: string;
    let winnerName: string | null = null;
    if (DECISIVE_MARKERS.includes(nb.leftMarkerRaw) || DECISIVE_MARKERS.includes(nb.rightMarkerRaw)) {
      resultType = "decisive";
      winnerName = DECISIVE_MARKERS.includes(nb.leftMarkerRaw) ? nb.fighterAName : nb.fighterBName;
    } else if (/中止|計量失格/.test(`${nb.headingText} ${nb.decisionRaw}`)) {
      resultType = "cancelled";
    } else {
      resultType = "unknown";
    }

    const fighterASlug = findFighterSlugByName(nb.fighterAName);
    const fighterBSlug = findFighterSlugByName(nb.fighterBName);
    const winnerSlug = winnerName === nb.fighterAName ? fighterASlug : winnerName === nb.fighterBName ? fighterBSlug : null;
    const namedDivisionMatch = NAMED_DIVISION_TOKENS.find((t) => nb.headingText.includes(t)) ?? null;
    const ruleType = classifyMmaRuleType(nb.headingText);
    const isWeighInMiss = nb.decisionRaw.includes("計量失格");
    const maxCardPosition = Math.max(...ev.bouts.map((b: any) => b.cardPosition));

    const newBout = {
      cardPosition: maxCardPosition + 1,
      isOpeningFight: false,
      headingText: nb.headingText,
      fighterAName: nb.fighterAName,
      fighterBName: nb.fighterBName,
      fighterASlug,
      fighterBSlug,
      ruleType,
      weightKg: null,
      namedDivision: namedDivisionMatch,
      resultType,
      winnerName,
      winnerSlug,
      round: nb.round,
      time: nb.time,
      methodRaw: nb.decisionRaw,
      isWeighInMiss,
      weightClassRaw: namedDivisionMatch,
      leftUrl: nb.leftUrl,
      rightUrl: nb.rightUrl,
      leftMarkerRaw: nb.leftMarkerRaw,
      rightMarkerRaw: nb.rightMarkerRaw,
      weightLeftRaw: nb.weightLeftRaw,
      weightRightRaw: nb.weightRightRaw,
      note: "extractBoutTables()の<table id=...>取りこぼしバグにより未収録だったbout(指示書Hで公式イベントページから回収・追記。regex自体も本PRで修正済み)",
    };
    ev.bouts.push(newBout);
    patchLog.push({ eventDate: nb.eventDate, eventName: nb.eventName, bout: newBout });
  }

  fs.writeFileSync(RECORDS_PATH, JSON.stringify(events, null, 2) + "\n");
  console.log(`[OK] ${RECORDS_PATH} に${NEW_BOUTS.length}件追記しました`);
  fs.writeFileSync(
    path.join(process.cwd(), "out", "pancrase-table-id-recovery-log.json"),
    JSON.stringify(patchLog, null, 2) + "\n"
  );
  console.log("書き出し: out/pancrase-table-id-recovery-log.json");
}

main();
