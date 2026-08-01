// 指示書R-3c(2026-08-01, read-only調査専用): findFighterSlugByName(src/lib/
// fighters.ts)の英名一致パス(f.nameEn.toLowerCase() === name.toLowerCase()、
// AMBIGUOUS_NAMES衝突ガードの対象外)経由でしか説明がつかない解決が、4団体
// 生データ全体で実際に何件あるかを実測する。
//
// 判定方法: 各bout側の現在のfighterXSlugについて、scripts/lib/
// fighterNameBackfill.tsのresolveSlug()(nameJa/alias側の正規化、nameEnは
// 見ない)で同じslugが説明できるかを先に確認する。説明できない場合のみ、
// 対象選手のnameEnと生表記が大文字小文字無視で一致するかを見て、一致すれば
// 「英名一致でのみ説明がつく解決」としてカウントする。data/・src/への
// 書き込みは一切行わない(read-only)。
//
// 実行: npx tsx scripts/investigate-nameen-bypass-exposure.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { buildNameIndex, resolveSlug } from "./lib/fighterNameBackfill";

const DATA_DIR = path.join(process.cwd(), "data");

// --- 1. FIGHTERS内でnameEnが(大文字小文字無視で)重複している選手を検出。
// findFighterSlugByNameのbyNameEnパスは`.find()`で最初にマッチした1件を返す
// だけなので、重複がある時点で常に「後の選手には絶対到達しない」構造的リスク。
const nameEnGroups = new Map<string, string[]>();
for (const f of FIGHTERS) {
  const key = f.nameEn.toLowerCase();
  if (!nameEnGroups.has(key)) nameEnGroups.set(key, []);
  nameEnGroups.get(key)!.push(f.slug);
}
const dupNameEn = [...nameEnGroups.entries()].filter(([, slugs]) => slugs.length > 1);
console.log(`=== FIGHTERS内でnameEnが重複しているグループ: ${dupNameEn.length}件 ===`);
for (const [nameEn, slugs] of dupNameEn) {
  console.log(`  "${nameEn}": ${slugs.join(", ")}`);
}

// --- 2. 全4団体データの全bout側について、現在のfighterXSlugが
// backfillの正規化(nameJa/alias, normalize+quoted-insert-strip)だけで
// 説明できるかを確認。説明できず、かつnameEn大文字小文字無視一致でのみ
// 説明できる場合を「nameEn経由でしか説明がつかない解決」としてカウントする。
const index = buildNameIndex();
const bySlug = new Map(FIGHTERS.map((f) => [f.slug, f]));

interface RawBout {
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
}
interface RawEvent {
  eventName: string;
  date: string | null;
  bouts: RawBout[];
}
function loadEvents(file: string): RawEvent[] {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as RawEvent[];
}

const files: Array<[string, RawEvent[]]> = [
  ["rizinRecords.json", loadEvents("rizinRecords.json")],
  ["shootoRecords.json", loadEvents("shootoRecords.json")],
  ["pancraseRecords.json", loadEvents("pancraseRecords.json")],
  ["deepRecords.json", loadEvents("deepRecords.json")],
];

interface NameEnOnlyRow {
  file: string;
  event: string;
  date: string | null;
  rawName: string;
  resolvedSlug: string;
  nameEn: string;
}
const nameEnOnlyRows: NameEnOnlyRow[] = [];
let totalResolvedSlots = 0;

for (const [file, events] of files) {
  for (const ev of events) {
    for (const b of ev.bouts) {
      for (const [nameField, slugField] of [
        ["fighterAName", "fighterASlug"],
        ["fighterBName", "fighterBSlug"],
      ] as const) {
        const raw = (b as unknown as Record<string, string>)[nameField];
        const slug = (b as unknown as Record<string, string | null>)[slugField];
        if (!slug) continue;
        totalResolvedSlots++;
        const viaBackfill = resolveSlug(raw, index);
        if (viaBackfill === slug) continue; // nameJa/alias側の正規化で説明可能(安全)
        const fighter = bySlug.get(slug);
        if (!fighter) continue;
        if (fighter.nameEn.toLowerCase() === raw.toLowerCase()) {
          nameEnOnlyRows.push({ file, event: ev.eventName, date: ev.date, rawName: raw, resolvedSlug: slug, nameEn: fighter.nameEn });
        }
        // else: backfillでも英名でも説明がつかない(=現在のnormalize仕様には無い
        // 別ロジックで解決された可能性。ここでは対象外、単にログしない)。
      }
    }
  }
}

console.log(`\n=== 全4団体データの解決済みbout側スロット総数: ${totalResolvedSlots} ===`);
console.log(`=== うちnameJa/alias系の正規化では説明がつかず、英名一致でのみ説明がつくもの: ${nameEnOnlyRows.length}件 ===\n`);
for (const r of nameEnOnlyRows) {
  console.log(`[${r.file}] ${r.date} "${r.rawName}" -> slug=${r.resolvedSlug} (nameEn="${r.nameEn}") @ ${r.event}`);
}

fs.writeFileSync(
  path.join(process.cwd(), "out", "multiorg-discrepancy-nameEn-only-matches.json"),
  JSON.stringify({ dupNameEnGroups: dupNameEn, totalResolvedSlots, nameEnOnlyRows }, null, 2)
);
