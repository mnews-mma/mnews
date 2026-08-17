// PR-22: 公開前の全件検品。全レコード×全フィールドのユニーク値を頻度順で列挙し、
// 既知の異常型(HTMLコメント残存・延長記号の壊れ・散文混入・内部保留ラベルの露出・
// エキシビジョン混入・PR-21.5のwikitableセル属性列ずれ)の再発有無を機械的に確認する。
const fs = require("fs");
const path = require("path");

const DIR = "data/kick/generated/fighters";
const files = fs.readdirSync(DIR);

let allFighters = [];
let allBouts = [];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  allFighters.push(d);
  for (const b of d.bouts) allBouts.push({ ...b, fighterName: d.name, fighterKana: d.kana, fighterSlug: d.slug });
}

console.log("=== 対象規模 ===");
console.log("選手数:", allFighters.length, "戦績行数:", allBouts.length);

function freqTable(values, label, topN = 9999) {
  const counts = new Map();
  for (const v of values) {
    const key = v === null || v === undefined ? "(null)" : String(v);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ${label}: ユニーク値${sorted.length}種類、頻度上位${Math.min(topN, sorted.length)}件 ===`);
  for (const [k, c] of sorted.slice(0, topN)) console.log(c, JSON.stringify(k));
  return sorted;
}

freqTable(allBouts.map((b) => b.methodRaw), "決着(表示後 methodRaw)", 0);
freqTable(allFighters.map((f) => f.gym), "所属(gym)", 30);
freqTable(allBouts.map((b) => b.event), "大会名(event)", 0);
freqTable(allFighters.map((f) => f.kana), "かな(kana)", 0);
const datePatterns = allBouts.map((b) => {
  if (b.date === null || b.date === undefined) return "(null)";
  if (/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return "YYYY-MM-DD";
  return "OTHER:" + b.date;
});
freqTable(datePatterns, "日付フォーマット(パターン集計)", 5);
freqTable(allBouts.map((b) => b.result), "勝敗(result)のみ", 10);
freqTable(allBouts.map((b) => b.promotion), "団体タグ(promotion)", 30);

console.log("\n\n########## 既知異常型の再発チェック ##########");

function scan(fieldName, getValue) {
  const hits = [];
  for (const b of allBouts) {
    const v = getValue(b);
    if (v === null || v === undefined) continue;
    if (/<!--|-->|<ref|<\/ref|<div|<span|<td|<tr|&nbsp;|&lt;|&gt;|&amp;/i.test(v)) {
      hits.push({ type: "HTMLコメント/refタグ残存", field: fieldName, fighter: b.fighterName, date: b.date, value: v });
    }
    if (/延長.{0,3}R.{0,3}延長|R\+.*R\+|延長延長/.test(v)) {
      hits.push({ type: "延長記号の壊れ(疑い)", field: fieldName, fighter: b.fighterName, date: b.date, value: v });
    }
    if (v.length > 60) {
      hits.push({ type: "異常に長い値(散文混入の疑い)", field: fieldName, fighter: b.fighterName, date: b.date, value: v.slice(0, 100) });
    }
    if (/undefined|null|NaN|\[object|TODO|TBD|FIXME|WIP|unresolved|pending/i.test(v) && !/nan[a-z]/i.test(v) && !/[a-z]nan/i.test(v)) {
      hits.push({ type: "内部保留ラベルの露出(疑い)", field: fieldName, fighter: b.fighterName, date: b.date, value: v });
    }
    if (/^(align|style|colspan|rowspan|valign|class|width|bgcolor)\s*=/i.test(v.trim())) {
      hits.push({ type: "wikitableセル属性の列ずれ(疑い)", field: fieldName, fighter: b.fighterName, date: b.date, value: v });
    }
    if (/^(NLD|JPN|USA|AUS|FRA|RUS|NZL|RSA|SAM|CZE|GBR|THA|BRA|CAN|GER|ITA|ESP|CHN|KOR|MAR|IRN|TUR|NED|NOR|SWE|POL|UKR|ARG|MEX)\s/.test(v.trim()) && fieldName === "opponentName") {
      hits.push({ type: "flagicon国コード漏出(疑い)", field: fieldName, fighter: b.fighterName, date: b.date, value: v });
    }
  }
  return hits;
}

const methodHits = scan("methodRaw", (b) => b.methodRaw);
const eventHits = scan("event", (b) => b.event);
const opponentHits = scan("opponentName", (b) => b.opponentName);

console.log("\nmethodRaw異常候補:", methodHits.length);
for (const h of methodHits) console.log(" ", h.type, "|", h.fighter, h.date, "|", h.value);
console.log("\nevent異常候補(長さ超過を除く実質的なもののみ表示):", eventHits.filter(h=>h.type!=="異常に長い値(散文混入の疑い)").length, "/ 全", eventHits.length);
for (const h of eventHits.filter(h=>h.type!=="異常に長い値(散文混入の疑い)")) console.log(" ", h.type, "|", h.fighter, h.date, "|", h.value);
console.log("\nopponentName異常候補(長さ超過を除く実質的なもののみ表示):", opponentHits.filter(h=>h.type!=="異常に長い値(散文混入の疑い)").length, "/ 全", opponentHits.length);
for (const h of opponentHits.filter(h=>h.type!=="異常に長い値(散文混入の疑い)")) console.log(" ", h.type, "|", h.fighter, h.date, "|", h.value);

const KEYWORDS = /腕ひしぎ|チョーク|パウンド|グラウンド|三角絞|一本(?!勝負)|判定なし|勝敗なし|エキシビション|エキシビジョン|ボクシング(?!グ)/;
const exhibitionHits = allBouts.filter((b) => b.methodRaw && KEYWORDS.test(b.methodRaw) && !/スタンディング/.test(b.methodRaw));
console.log("\nエキシビション/ルール混入(検査A)候補:", exhibitionHits.length);
for (const h of exhibitionHits) console.log(" ", h.fighterName, h.date, h.methodRaw, "|", h.promotion);
