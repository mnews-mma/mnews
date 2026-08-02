// PR #359の悉皆調査(A型34件+C型5件)を最新mainのdata/で再現し、
// 案①(suppressNoRecordRow中はテーブルもmultiOrgBoutTableを参照)を
// 適用した場合の影響を測る。読み取り専用(data/への書き込み無し)。
//
// 出す情報:
//  1. 最新dataでもA34件/C5件の内訳が同じか(fighterRecords.json等はR-5等の
//     反映で更新されているため、件数がズレていないか確認)
//  2. A型各名について、history(Wikipedia)にあってmultiOrgBoutTableに
//     無いbout(=案①適用で対戦テーブルから消える試合)を列挙
//  3. C型5件について、computeMultiOrgRecordの内訳(rizin/shooto/pancrase/deep
//     それぞれのbouts配列)とcomputeMultiOrgBoutTableの行を突き合わせ、
//     差分の実体(日付未確定decisive/draw bout か、NC bout か)を特定
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { FighterRecordsFile, mergeFighterRecord } from "../src/lib/fighterRecordsCache";
import { computeMultiOrgRecord, computeMultiOrgBoutTable } from "../src/lib/mnewsRating/multiOrgRecord";
import { computeFighterMmaRecord } from "../src/lib/mnewsRating/rizinRecordsAggregate";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { computeFighterPancraseRecord } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { computeFighterDeepRecord } from "../src/lib/mnewsRating/deepRecordsAggregate";
import { SHOW_MULTI_ORG_RECORD } from "../src/lib/featureFlags";
import type { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";

function readLocalJson<T>(file: string): T {
  const p = path.join(process.cwd(), "data", file);
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

const A_SLUGS = [
  "fujii-nobuki","tamura-hibiki","little","otsuka-tomoki","tyson-nobumitsu","yuji-arai","ryoga",
  "kawakita-haruki","lightyear-daiki","yuki-daiki","motonomiki","raika","kurobe-kazusa",
  "young-parkseo","endoraiki","ushiku-juntaro","asahina-ken","nakajima-riku","nojiri-yasuyuki",
  "huang-jenny","takamoto-chiyo","tou-hoiin","umeki-yutoku","yamauchi-wataru","azumi-kento",
  "body-maxthe","sugimoto-megumi","hirata-ayane","aya-murakami","kurobe-mina","hoshuyama-momoka",
  "nada","satoyujibonsai","hamamoto",
];
const C_SLUGS = ["matsuda-arisa", "nishio-shinsuke", "sumiyoshi-ryota", "saijo-hidenari", "kamiya-daichi"];

async function main() {
  const fighterRecords = readLocalJson<FighterRecordsFile>("fighterRecords.json");
  const rizinEvents = readLocalJson<RizinRecordsEvent[]>("rizinRecords.json");
  const shootoArchive = readLocalJson<ShootoRecordsEvent[]>("shootoRecords.json");
  let shootoProfile: ShootoRecordsEvent[] = [];
  try {
    shootoProfile = readLocalJson<ShootoRecordsEvent[]>("shootoProfileBouts.json");
  } catch {
    /* noop */
  }
  const shootoEvents = [...shootoArchive, ...shootoProfile];
  const pancraseEvents = readLocalJson<PancraseRecordsEvent[]>("pancraseRecords.json");
  const deepEvents = readLocalJson<DeepRecordsEvent[]>("deepRecords.json");
  const multiOrgData = { rizinEvents, shootoEvents, pancraseEvents, deepEvents };

  const fighterBySlug = new Map((FIGHTERS as Fighter[]).map((f) => [f.slug, f]));

  console.log("=== A型: 案①適用でテーブルから消えるbout ===");
  let totalLostBouts = 0;
  let fightersWithLoss = 0;
  for (const slug of A_SLUGS) {
    const seed = fighterBySlug.get(slug);
    if (!seed) {
      console.log(`${slug}: FIGHTERSに見つからず(スキップ)`);
      continue;
    }
    const resolved = mergeFighterRecord(seed, fighterRecords);
    const history = resolved.history;
    const multiOrgRows = computeMultiOrgBoutTable(slug, multiOrgData);

    // 相手名の表記ゆれ(姓名スペース・中黒・カタカナ異表記・愛称接頭辞・漢字異体字等)
    // は個別に潰しきれないため、「同日に別の選手と2試合はしない」という前提で
    // 日付一致のみで同一bout判定する(名前は一致確認せず参考情報として出す)。
    const multiOrgDates = new Set(multiOrgRows.map((r) => r.date));
    const lost = history.filter((h) => !multiOrgDates.has(h.date));
    if (lost.length > 0) {
      fightersWithLoss++;
      totalLostBouts += lost.length;
      console.log(`${slug} (${seed.nameJa}): history=${history.length}件 multiOrgBout=${multiOrgRows.length}件 消える=${lost.length}件`);
      for (const l of lost) {
        console.log(`    - ${l.date} vs ${l.opponent} (${l.event ?? "?"}) result=${l.result} ※multiOrgに同日boutなし`);
      }
    } else {
      console.log(`${slug} (${seed.nameJa}): history=${history.length}件 multiOrgBout=${multiOrgRows.length}件 消える=0件`);
    }
  }
  console.log(`\nA型合計: 消えるbout ${totalLostBouts}件 (該当選手 ${fightersWithLoss}/${A_SLUGS.length}名)`);

  console.log("\n=== C型: computeMultiOrgRecord vs computeMultiOrgBoutTable 差分の実体 ===");
  for (const slug of C_SLUGS) {
    const rizin = computeFighterMmaRecord(rizinEvents, slug);
    const shooto = computeFighterShootoRecord(shootoEvents, slug);
    const pancrase = computeFighterPancraseRecord(pancraseEvents, slug);
    const deep = computeFighterDeepRecord(deepEvents, slug);
    const record = computeMultiOrgRecord(slug, multiOrgData);
    const boutRows = computeMultiOrgBoutTable(slug, multiOrgData);
    const recordTotal = record.wins + record.losses + record.draws;

    console.log(`\n${slug}: record(wins+losses+draws)=${recordTotal} table=${boutRows.length}`);

    const allBouts = [
      ...rizin.bouts.map((b) => ({ ...b, org: "RIZIN" })),
      ...shooto.bouts.map((b) => ({ ...b, org: "修斗" })),
      ...pancrase.bouts.map((b) => ({ ...b, org: "パンクラス" })),
      ...deep.bouts.map((b) => ({ ...b, org: "DEEP" })),
    ];
    for (const b of allBouts) {
      const inTable = !!b.date && (b.resultType === "decisive" || b.resultType === "draw" || b.resultType === "nc");
      const countedInRecord = b.resultType === "decisive" || b.resultType === "draw";
      console.log(
        `    [${b.org}] ${b.date ?? "(日付未確定)"} vs ${b.opponentName} resultType=${b.resultType} ` +
        `countedInRecord=${countedInRecord} inTable=${inTable} event=${b.event}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
