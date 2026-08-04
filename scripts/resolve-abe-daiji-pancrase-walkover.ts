// 指示書J: #428の欠落11件で「要個別確認」に分類していた阿部大治×奈良貴明
// (2016-09-11、PANCRASE280)を裏取りした結果を反映する。
//
// 裏取り結果: 対戦相手の入れ替わり事故ではなく、同日カードで2試合が
// 行われていた(第22回ネオブラッド・トーナメントの準決勝・決勝)。
// - 準決勝: 阿部大治 vs 中村勇太(阿部KO勝ち) → data/pancraseRecords.jsonに
//   既に正しく収録済み(fighterASlug="abe-daiji"で解決済み)。
// - 決勝: 阿部大治 vs 奈良貴明(奈良の欠場により阿部の不戦勝)
//   → 大会結果ページ(pancrase.co.jp/data/result/2016/0911.html)自体に
//   このカードの記載が無い(奈良の名前が0件、парサ不具合ではなくページに
//   存在しない)。阿部大治・奈良貴明双方の公式プロフィールページが
//   日付・トーナメント名(第22回ネオブラッド・トーナメント決勝戦)・
//   決着方式(不戦勝/不戦敗)で完全に一致しており、実在するboutと確認済み。
//
// data/pancraseProfileBouts.json相当の受け皿は作らず(指示書H踏襲)、既存の
// PANCRASE280(2016-09-11)イベントのbouts配列に直接追記する。
//
// 実行: npx tsx scripts/resolve-abe-daiji-pancrase-walkover.ts
import fs from "fs";
import path from "path";
import { findFighterSlugByName } from "../src/lib/fighters";

const RECORDS_PATH = path.join(process.cwd(), "data", "pancraseRecords.json");

function main() {
  const events: any[] = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const ev = events.find((e) => e.date === "2016-09-11" && e.eventName === "PANCRASE280");
  if (!ev) throw new Error("[ERROR] PANCRASE280(2016-09-11)が見つかりません");

  const dup = ev.bouts.find((b: any) => b.fighterAName === "阿部大治" && b.fighterBName === "奈良貴明");
  if (dup) throw new Error("[ERROR] 既に同一boutが存在(想定外)");

  const fighterASlug = findFighterSlugByName("阿部大治");
  const fighterBSlug = findFighterSlugByName("奈良貴明");
  if (fighterASlug !== "abe-daiji") throw new Error(`[ERROR] 阿部大治のslug解決が想定と異なる: ${fighterASlug}`);

  const maxCardPosition = Math.max(...ev.bouts.map((b: any) => b.cardPosition));

  const newBout = {
    cardPosition: maxCardPosition + 1,
    isOpeningFight: false,
    headingText: "第22回ネオブラッド・トーナメント決勝戦",
    fighterAName: "阿部大治",
    fighterBName: "奈良貴明",
    fighterASlug,
    fighterBSlug,
    ruleType: "MMA",
    weightKg: null,
    namedDivision: null,
    resultType: "decisive",
    winnerName: "阿部大治",
    winnerSlug: fighterASlug,
    round: null,
    time: null,
    methodRaw: "不戦勝(奈良貴明欠場)",
    isWeighInMiss: false,
    weightClassRaw: null,
    leftUrl: "../prfl2/abedaichi.html",
    rightUrl: "../prfl2/nara.html",
    leftMarkerRaw: "○",
    rightMarkerRaw: "×",
    weightLeftRaw: null,
    weightRightRaw: null,
    note: "公式イベント結果ページ自体に記載が無いbout(不戦勝の決勝戦)。阿部大治・奈良貴明双方の公式プロフィールページ(prfl2/abedaichi.html, prfl2/nara.html)で日付・トーナメント名・決着方式が一致することを指示書Jで確認し、プロフィール由来として追記した。",
  };
  ev.bouts.push(newBout);

  fs.writeFileSync(RECORDS_PATH, JSON.stringify(events, null, 2) + "\n");
  console.log("[OK] PANCRASE280に阿部大治×奈良貴明(不戦勝)を1件追記しました");
  console.log(JSON.stringify(newBout, null, 2));
}

main();
