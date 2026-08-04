/**
 * 残件1(uchida-takeru / Lemino修斗.3 の日付誤り訂正)の検証。read-only。
 *
 * 重要: recordOverrides.ts は「リクエスト時に効くコード層」ではなく、日次バッチ
 * (scripts/update-fighter-records.ts ← .github/workflows/update-fighter-records.yml)
 * が data/fighterRecords.json を再生成するときにだけ適用される。したがって本PRを
 * マージしても、次のバッチが走るまでサイト上の日付は変わらない。
 *
 * そこでこのスクリプトは、バッチと同じ applyRecordOverrides() を現行の
 * data/fighterRecords.json に当てて「バッチ実行後の姿」をメモリ上で再現し、
 * その状態で受入条件1〜4を実測する(data/には一切書き込まない)。
 */
import fs from "fs";
import path from "path";
import { applyRecordOverrides } from "../src/lib/mnewsRating/recordOverrides";
import { collectBoutRows, findEventSlug, findEventNameMatches } from "./lib/eventSlugLink";
import type { FightRecord } from "../src/lib/fighters";

const DATA = path.join(process.cwd(), "data");
const readJson = (name: string) => JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));

const raw = readJson("fighterRecords") as Record<string, { history?: FightRecord[] }>;
// バッチ後の姿(全選手にオーバーライドを適用)
const patched: typeof raw = {};
for (const [slug, entry] of Object.entries(raw)) {
  patched[slug] = { ...entry, history: applyRecordOverrides(slug, entry.history ?? []) };
}

const others = {
  rizinRecords: readJson("rizinRecords"),
  shootoRecords: readJson("shootoRecords"),
  pancraseRecords: readJson("pancraseRecords"),
  deepRecords: readJson("deepRecords"),
};

const before = collectBoutRows({ fighterRecords: raw, ...others });
const after = collectBoutRows({ fighterRecords: patched, ...others });

const countLinks = (rows: ReturnType<typeof collectBoutRows>) =>
  rows.filter((r) => findEventSlug(r.event, r.date)).length;
const countDateMiss = (rows: ReturnType<typeof collectBoutRows>) =>
  rows.filter((r) => !findEventSlug(r.event, r.date) && findEventNameMatches(r.event).length > 0).length;

console.log("## 受入条件1: 当該boutの日付");
const show = (src: typeof raw, label: string) => {
  const h = (src["uchida-takeru"]?.history ?? []).filter((x) => String(x.event).includes("Lemino修斗.3"));
  for (const b of h) console.log(`  ${label}: ${b.date} / vs ${b.opponent} / ${b.result} / ${b.method} / ${b.event}`);
};
show(raw, "訂正前");
show(patched, "訂正後(バッチ適用後の姿)");

console.log("");
console.log("## 受入条件2: リンク総数");
console.log(`  訂正前: ${countLinks(before)}bout`);
console.log(`  訂正後: ${countLinks(after)}bout`);

console.log("");
console.log("## 受入条件3: 大会名は一致するが開催日がずれてリンクを見送ったbout");
console.log(`  訂正前: ${countDateMiss(before)}件`);
console.log(`  訂正後: ${countDateMiss(after)}件`);

console.log("");
console.log("## 副作用の確認: 訂正で変化したbout行");
const key = (r: { fighter: string; date: string; event: string; opponent: string }) =>
  `${r.fighter}|${r.date}|${r.event}|${r.opponent}`;
const beforeSet = new Set(before.map(key));
const afterSet = new Set(after.map(key));
const removed = before.filter((r) => !afterSet.has(key(r)));
const added = after.filter((r) => !beforeSet.has(key(r)));
console.log(`  消えた行 ${removed.length}件 / 増えた行 ${added.length}件`);
for (const r of removed) console.log(`   - ${r.fighter} ${r.date} ${r.event} vs ${r.opponent}`);
for (const r of added) console.log(`   + ${r.fighter} ${r.date} ${r.event} vs ${r.opponent}`);
console.log(`  bout総数: ${before.length} → ${after.length}`);
