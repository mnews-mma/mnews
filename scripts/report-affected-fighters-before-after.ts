// 検証専用スクリプト(read-only、data/は一切書き換えない)。
// PR #369で特定した非MMAルール混入の影響選手13名(DEEP6名・修斗7名)について、
// 団体別戦績と4団体通算(computeMultiOrgRecord)を出力する。
// before/after比較は呼び出し側(git stashで*RecordsAggregate.tsの変更有無を
// 切り替えながら2回実行)で行う。0-0-0(4団体通算が完全にゼロ)になる選手が
// いないかのチェックも行う。
import fs from "fs";
import { computeFighterDeepRecord } from "../src/lib/mnewsRating/deepRecordsAggregate";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { computeFighterPancraseRecord } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { computeMultiOrgRecord } from "../src/lib/mnewsRating/multiOrgRecord";

const AFFECTED_FIGHTERS = [
  { slug: "ayaka-miura", name: "三浦彩佳", org: "DEEP" },
  { slug: "sarami", name: "SARAMI", org: "DEEP" },
  { slug: "sugimoto-megumi", name: "杉本恵", org: "DEEP" },
  { slug: "izawa-seika", name: "伊澤星花", org: "DEEP" },
  { slug: "naito-tank", name: "タンク内藤", org: "DEEP" },
  { slug: "aono-hikaru", name: "青野ひかる", org: "DEEP" },
  { slug: "kurobe-mina", name: "黒部三奈", org: "修斗" },
  { slug: "uehara-taira", name: "上原平", org: "修斗" },
  { slug: "noel", name: "NOEL", org: "修斗" },
  { slug: "fujino-emi", name: "藤野恵実", org: "修斗" },
  { slug: "nakajima-riku", name: "中島陸", org: "修斗" },
  { slug: "aya-murakami", name: "村上彩", org: "修斗" },
  { slug: "hirata-ayane", name: "平田彩音", org: "修斗" },
];

function main() {
  const rizinEvents = JSON.parse(fs.readFileSync("data/rizinRecords.json", "utf8"));
  const shootoEvents = JSON.parse(fs.readFileSync("data/shootoRecords.json", "utf8"));
  const pancraseEvents = JSON.parse(fs.readFileSync("data/pancraseRecords.json", "utf8"));
  const deepEvents = JSON.parse(fs.readFileSync("data/deepRecords.json", "utf8"));

  const fmt = (r: { wins: number; losses: number; draws: number }) => `${r.wins}-${r.losses}-${r.draws}`;

  console.log("slug,name,org,org単体,4団体通算,4団体通算合計試合数");
  for (const f of AFFECTED_FIGHTERS) {
    const orgRecord =
      f.org === "DEEP" ? computeFighterDeepRecord(deepEvents, f.slug) : computeFighterShootoRecord(shootoEvents, f.slug);
    const multi = computeMultiOrgRecord(f.slug, { rizinEvents, shootoEvents, pancraseEvents, deepEvents });
    const total = multi.wins + multi.losses + multi.draws;
    console.log(`${f.slug},${f.name},${f.org},${fmt(orgRecord)},${fmt(multi)},${total}`);
  }
}

main();
