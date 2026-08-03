// 指示書F: #423で発見された野村駿太×宇佐美正パトリック(2021-11-06、
// shootoEventId=122)の勝者反転バグと同型の事例を、修斗全231大会・1,895件
// (decisiveかつopacity装飾信号あり)を対象に走査した(scripts/scan-shooto-winner-reversal.ts)。
// 6件がscore判定(resolveOutcome()のresultTypeText由来)とopacity判定
// (敗者を示す装飾)で食い違っていた。
//
// 6件全てについて、当事者2名それぞれの修斗公式プロフィールページ
// (/fighters/?id=NNN、対戦相手側からも参照できる独立した情報源)を個別に
// 実測し、opacity判定側が正しく・score判定側(現在のdata/shootoRecords.json
// の値)が誤っていることを裏付けた(全6件で両者のプロフィールが一致して
// 同じ勝者を示した)。
//
// 根本原因: resolveOutcome()(shootoScraper.ts)の「N-M」スコア判定
// (resultTypeText由来、a>b→A勝ち/a<b→B勝ち)が、この6件では実際の勝敗と
// 逆になっていた。ジャッジ個別採点(noteRaw、例:「20-18」)もscore判定と
// 同じ誤った側を支持しており、判定材料としては独立していない(同じ抽出元の
// 可能性が高い)。opacity装飾(center-blockのopacity:0.3=敗者)のみが
// 6件全てで正しい勝者と一致した。
//
// resolveOutcome()自体の判定優先順位(score→opacityの順、コード内コメントに
// 「オラクルCSVとの照合でscoreが正しいと判明」と記載)は、他の約1,889件では
// 検証済みの前提のため、本PRでは変更しない(一般ロジックの変更は未検証の
// 範囲への副作用リスクが大きい)。今回はプロフィールページで個別に裏取り
// できた6件のみを直接パッチする(藤田大和backfill等と同じ方針)。
//
// なお注記: コード内コメントはshootoEventId=191/bout=4069を「scoreが正しい
// 検証済み事例」として引用しているが、今回両者のプロフィールページを実測した
// 結果、実際にはopacity側が正しく、コメントの前提は誤りだったと判明した
// (別途コメント修正が望ましいが、本スクリプトでは既存コメントの文言修正は
// 行わない。データの訂正のみ)。
//
// 実行: npx tsx scripts/fix-shooto-winner-reversal-verified-bouts.ts
import fs from "fs";
import path from "path";
import { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";

const RECORDS_PATH = path.join(process.cwd(), "data", "shootoRecords.json");

interface VerifiedFix {
  shootoEventId: number;
  fighterAShootoId: number;
  fighterBShootoId: number;
  correctWinnerSide: "A" | "B";
  note: string;
}

// 各bout: 両者の修斗公式プロフィールページ(/fighters/?id=NNN)を実測し、
// ○/×マーカーが一致して示す側をcorrectWinnerSideとした。
const VERIFIED_FIXES: VerifiedFix[] = [
  { shootoEventId: 8, fighterAShootoId: 96, fighterBShootoId: 121, correctWinnerSide: "A", note: "北原史寛(id=96)○/梶川卓(id=121)×で一致(2016-03-21)" },
  { shootoEventId: 70, fighterAShootoId: 200, fighterBShootoId: 219, correctWinnerSide: "B", note: "エダ塾長こうすけ(id=200)×/玉城優介(id=219)○で一致(2018-11-25)" },
  { shootoEventId: 79, fighterAShootoId: 1037, fighterBShootoId: 1110, correctWinnerSide: "B", note: "ハンセン玲雄(id=1037)×/ガッツTakato(id=1110)○で一致(2019-01-20)" },
  { shootoEventId: 116, fighterAShootoId: 1120, fighterBShootoId: 1335, correctWinnerSide: "B", note: "ムテカツ(id=1120)×/神武羅☆ヒカル(id=1335)○で一致(2021-07-04)" },
  { shootoEventId: 122, fighterAShootoId: 1366, fighterBShootoId: 1374, correctWinnerSide: "A", note: "宇佐美正パトリック(id=1366)○/野村駿太(id=1374)×で一致(2021-11-06、#423で発見済み)" },
  { shootoEventId: 191, fighterAShootoId: 1740, fighterBShootoId: 1570, correctWinnerSide: "B", note: "シン・ケンザン(id=1740)×/高橋佑太(id=1570)○で一致(2024-09-08)" },
];

function main() {
  const events: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));

  let patchedCount = 0;
  const patchLog: any[] = [];

  for (const fix of VERIFIED_FIXES) {
    const ev = events.find((e) => e.shootoEventId === fix.shootoEventId);
    if (!ev) throw new Error(`[ERROR] shootoEventId=${fix.shootoEventId} が見つかりません`);

    const bout: any = ev.bouts.find(
      (b: any) => b.fighterAShootoId === fix.fighterAShootoId && b.fighterBShootoId === fix.fighterBShootoId
    );
    if (!bout) throw new Error(`[ERROR] shootoEventId=${fix.shootoEventId}内にfighterAShootoId=${fix.fighterAShootoId}/fighterBShootoId=${fix.fighterBShootoId}のboutが見つかりません`);

    if (bout.resultType !== "decisive") {
      throw new Error(`[ERROR] shootoEventId=${fix.shootoEventId}のboutはresultType=${bout.resultType}(decisiveを期待)`);
    }

    const currentWinnerSide = bout.winnerName === bout.fighterAName ? "A" : bout.winnerName === bout.fighterBName ? "B" : null;
    if (currentWinnerSide === fix.correctWinnerSide) {
      throw new Error(`[ERROR] shootoEventId=${fix.shootoEventId}は既に${fix.correctWinnerSide}が勝者になっている(想定外、二重修正の可能性)`);
    }
    if (currentWinnerSide === null) {
      throw new Error(`[ERROR] shootoEventId=${fix.shootoEventId}のwinnerNameが両者の名前と一致しない: ${bout.winnerName}`);
    }

    const correctName = fix.correctWinnerSide === "A" ? bout.fighterAName : bout.fighterBName;
    const correctSlug = fix.correctWinnerSide === "A" ? bout.fighterASlug : bout.fighterBSlug;

    patchLog.push({
      shootoEventId: fix.shootoEventId,
      eventName: ev.eventName,
      date: ev.date,
      fighterAName: bout.fighterAName,
      fighterBName: bout.fighterBName,
      before: { winnerName: bout.winnerName, winnerSlug: bout.winnerSlug },
      after: { winnerName: correctName, winnerSlug: correctSlug },
      note: fix.note,
    });

    bout.winnerName = correctName;
    bout.winnerSlug = correctSlug;
    patchedCount++;
  }

  if (patchedCount !== VERIFIED_FIXES.length) {
    throw new Error(`[ERROR] パッチ件数(${patchedCount})が期待値(${VERIFIED_FIXES.length})と一致しません`);
  }

  fs.writeFileSync(RECORDS_PATH, JSON.stringify(events, null, 2) + "\n");
  console.log(`[OK] ${RECORDS_PATH} を${patchedCount}件パッチしました`);
  console.log(JSON.stringify(patchLog, null, 2));

  fs.writeFileSync(
    path.join(process.cwd(), "out", "shooto-winner-reversal-fix-log.json"),
    JSON.stringify(patchLog, null, 2) + "\n"
  );
}

main();
