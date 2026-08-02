// R-9: B型(NC考慮版)の残り不一致を、キャッシュ済みwikitext(out/wiki-raw/*.json)を
// 実際のパーサ(parseJaFightHistory/parseInfoboxJa/parseJaRecordTotals)にかけて
// data/fighterRecords.json側と突合する。read-only調査用の使い捨てスクリプト。
import fs from "fs";
import path from "path";
import { parseJaFightHistory } from "../src/lib/feeds/wikipedia";

const SLUGS = [
  "sato-shoko",
  "strasser-kiichi",
  "nakamura-daisuke",
  "kurobe-kazusa",
  "kitaoka-satoru",
  "lee-kaiwen",
  "uno-caol",
  "sugiyama",
];

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "fighterRecords.json"), "utf8"));

function extractField(wikitext: string, field: string): string | null {
  const m = wikitext.match(new RegExp(`\\|[ \\t]*${field}[ \\t]*=[ \\t]*([^\\n]*)`, "i"));
  if (!m) return null;
  const v = m[1].trim();
  return v || null;
}

for (const slug of SLUGS) {
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "out", "wiki-raw", `${slug}.json`), "utf8"));
  const wikitext: string = raw.parse.wikitext;
  const parsedHistory = parseJaFightHistory(wikitext);
  const storedHistory = data[slug]?.history ?? [];

  console.log(`\n===== ${slug} (wiki page: ${raw.parse.title}) =====`);
  console.log(
    `infobox: wins=${extractField(wikitext, "wins")} losses=${extractField(wikitext, "losses")} draws=${extractField(wikitext, "draws")} no_contests=${extractField(wikitext, "no contests")} total=${extractField(wikitext, "total")}`
  );
  console.log(`parsed(現在のパーサ再実行): ${parsedHistory.length}件 / stored(data/fighterRecords.json): ${storedHistory.length}件`);

  const key = (h: { date: string; opponent: string }) => `${h.date}|${h.opponent}`;
  const parsedKeys = new Set(parsedHistory.map(key));
  const storedKeys = new Set(storedHistory.map((h: { date: string; opponent: string }) => key(h)));

  const onlyInParsed = parsedHistory.filter((h) => !storedKeys.has(key(h)));
  const onlyInStored = storedHistory.filter((h: { date: string; opponent: string }) => !parsedKeys.has(key(h)));

  if (onlyInParsed.length) {
    console.log("再パースのみに存在(=storedに欠落 or 日付/相手名表記が違う):");
    for (const h of onlyInParsed) console.log(`  ${JSON.stringify(h)}`);
  }
  if (onlyInStored.length) {
    console.log("storedのみに存在(=再パースで消えた):");
    for (const h of onlyInStored) console.log(`  ${JSON.stringify(h)}`);
  }
  if (!onlyInParsed.length && !onlyInStored.length) {
    console.log("再パース結果とstoredは完全一致。");
  }
}
