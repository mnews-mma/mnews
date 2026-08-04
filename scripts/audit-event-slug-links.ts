/**
 * /fighters/[slug] の対戦テーブル「大会名」列に張られる /results/ リンクの
 * 誤リンク監査(read-only)。修正前/修正後の判定を全boutに適用して差分を出す。
 *
 * 旧実装は素朴な双方向の部分一致だったため、"DEEP JEWELS 4" が
 * "DEEP JEWELS 48" にマッチする等、別大会への誤リンクが起きていた。
 * 出力: out/event-slug-link-audit.md
 */
import { EVENT_RESULTS } from "../src/lib/eventResults";
import { collectBoutRows, findEventSlug, findEventSlugLegacy } from "./lib/eventSlugLink";
import fighterRecords from "../data/fighterRecords.json";
import rizinRecords from "../data/rizinRecords.json";
import shootoRecords from "../data/shootoRecords.json";
import pancraseRecords from "../data/pancraseRecords.json";
import deepRecords from "../data/deepRecords.json";

const rows = collectBoutRows({ fighterRecords, rizinRecords, shootoRecords, pancraseRecords, deepRecords });
const eventBySlug = new Map(EVENT_RESULTS.map((e) => [e.slug, e]));

const out: string[] = [];
const p = (s = "") => out.push(s);

const changed = rows
  .map((r) => ({ ...r, old: findEventSlugLegacy(r.event), next: findEventSlug(r.event, r.date) }))
  .filter((r) => r.old !== r.next);

const linkedOld = rows.filter((r) => findEventSlugLegacy(r.event)).length;
const linkedNew = rows.filter((r) => findEventSlug(r.event, r.date)).length;

p("# /fighters対戦テーブル → /results 誤リンク監査");
p();
p(`- 検査対象bout: ${rows.length}件(大会名ユニーク ${new Set(rows.map((r) => r.event)).size}件)`);
p(`- リンクが張られるbout: 旧 ${linkedOld}件 → 新 ${linkedNew}件`);
p(`- 判定が変わったbout: ${changed.length}件`);
p();
p("## 大会名ごとの変化");
p();
p("| 表示される大会名 | 旧リンク先 | 新リンク先 | 影響bout数 |");
p("|---|---|---|---|");
const byEvent = new Map<string, typeof changed>();
for (const c of changed) {
  if (!byEvent.has(c.event)) byEvent.set(c.event, []);
  byEvent.get(c.event)!.push(c);
}
const label = (slug: string | null) =>
  slug ? `${slug} (${eventBySlug.get(slug)!.date} ${eventBySlug.get(slug)!.eventName})` : "リンク無し";
for (const [event, list] of [...byEvent].sort()) {
  p(`| ${event} | ${label(list[0].old)} | ${label(list[0].next)} | ${list.length} |`);
}
p();
p("## bout内訳");
p();
for (const [event, list] of [...byEvent].sort()) {
  p(`### ${event}`);
  for (const r of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    p(`- ${r.fighter} / ${r.date} / vs ${r.opponent}`);
  }
  p();
}
p("## 参考: unlisted(非公開)大会へのリンク");
p();
p("`unlisted: true` の大会は /results 一覧・sitemapから除外され個別ページもnoindexだが、");
p("選手ページの対戦テーブルからは現状リンクが張られている(本PRでは変更していない)。");
p();
const unlisted = new Map<string, number>();
for (const r of rows) {
  const slug = findEventSlug(r.event, r.date);
  if (!slug) continue;
  if (!eventBySlug.get(slug)!.unlisted) continue;
  unlisted.set(slug, (unlisted.get(slug) ?? 0) + 1);
}
p("| 大会 | 開催日 | リンク元bout数 |");
p("|---|---|---|");
for (const [slug, n] of [...unlisted].sort()) {
  const ev = eventBySlug.get(slug)!;
  p(`| ${slug} (${ev.eventName}) | ${ev.date} | ${n} |`);
}

console.log(out.join("\n"));
