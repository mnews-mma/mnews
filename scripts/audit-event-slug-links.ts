/**
 * /fighters/[slug] の対戦テーブル「大会名」列に張られる /results/ リンクの
 * 誤リンク監査(read-only)。修正前/修正後の判定を全boutに適用して差分を出す。
 *
 * 差分は性質の違う2バケットに分けて出す:
 *   A. 誤リンクの除去 — 旧実装が別大会を指していたもの(本修正の目的)
 *   B. 巻き添えで落ちたリンク — 大会名は正しく一致するのに、上流データの
 *      試合日が誤っているため日付ガードに引っかかったもの。リンクとしては
 *      正しかった。黙って消えると気づけない一方、上流の日付誤りの検出器に
 *      なる(DEEP 86 IMPACT群・DEEP JEWELS 43と同型)
 *
 * 出力: out/event-slug-link-audit.md
 */
import { EVENT_RESULTS } from "../src/lib/eventResults";
import { collectBoutRows, findEventNameMatches, findEventSlug, findEventSlugLegacy, normEventName } from "./lib/eventSlugLink";
import fighterRecords from "../data/fighterRecords.json";
import rizinRecords from "../data/rizinRecords.json";
import shootoRecords from "../data/shootoRecords.json";
import pancraseRecords from "../data/pancraseRecords.json";
import deepRecords from "../data/deepRecords.json";

const rows = collectBoutRows({ fighterRecords, rizinRecords, shootoRecords, pancraseRecords, deepRecords });
const eventBySlug = new Map(EVENT_RESULTS.map((e) => [e.slug, e]));

const out: string[] = [];
const p = (s = "") => out.push(s);
const label = (slug: string | null) =>
  slug ? `${slug} (${eventBySlug.get(slug)!.date} ${eventBySlug.get(slug)!.eventName})` : "リンク無し";

const evaluated = rows.map((r) => ({
  ...r,
  old: findEventSlugLegacy(r.event),
  next: findEventSlug(r.event, r.date),
}));
const changed = evaluated.filter((r) => r.old !== r.next);

// バケット分け: 旧リンク先の大会名が(正規化後に)表示名と一致していれば
// 「正しい大会を指していたのに日付ガードで落ちた」= 巻き添え。
const isCollateral = (r: (typeof changed)[number]) =>
  r.old !== null && r.next === null && normEventName(eventBySlug.get(r.old)!.eventName) === normEventName(r.event);
const wrongLinks = changed.filter((r) => !isCollateral(r));
const collateral = changed.filter(isCollateral);

const linkedOld = evaluated.filter((r) => r.old).length;
const linkedNew = evaluated.filter((r) => r.next).length;

p("# /fighters対戦テーブル → /results 誤リンク監査");
p();
p(`- 検査対象bout: ${rows.length}件(大会名ユニーク ${new Set(rows.map((r) => r.event)).size}件)`);
p(`- リンクが張られるbout: 旧 ${linkedOld}件 → 新 ${linkedNew}件`);
p(`- 判定が変わったbout: ${changed.length}件`);
p(`  - **A. 誤リンクの除去: ${wrongLinks.length}件**(別大会を指していた)`);
p(`  - **B. 巻き添えで落ちたリンク: ${collateral.length}件**(大会名は正しく一致。上流データの試合日が誤っている)`);
p();

const groupByEvent = (list: typeof changed) => {
  const m = new Map<string, typeof changed>();
  for (const c of list) {
    const k = `${c.event} ${c.old ?? ""}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(c);
  }
  return [...m.values()].sort((a, b) => a[0].event.localeCompare(b[0].event));
};

p("## A. 誤リンクの除去");
p();
p("| 表示される大会名 | 旧リンク先(誤) | 新リンク先 | 影響bout数 |");
p("|---|---|---|---|");
for (const list of groupByEvent(wrongLinks)) {
  p(`| ${list[0].event} | ${label(list[0].old)} | ${label(list[0].next)} | ${list.length} |`);
}
p();
for (const list of groupByEvent(wrongLinks)) {
  p(`### ${list[0].event}`);
  for (const r of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    p(`- ${r.fighter} / ${r.date} / vs ${r.opponent}`);
  }
  p();
}

p("## B. 巻き添えで落ちたリンク(上流データの日付誤り候補)");
p();
p("旧実装のリンク先は**正しい大会**だったが、bout側の試合日が結果ページの開催日と");
p("ずれているため日付ガードに引っかかり、リンクが消えたもの。リンクの消失としては");
p("回帰であり、同時に上流(Wikipedia等)の日付誤りの検出結果でもある。");
p("`npm run check:event-slug-links` が毎回この件数を報告する。");
p();
p("| 選手 | bout日付 | 表示される大会名 | 正しいリンク先(開催日) |");
p("|---|---|---|---|");
for (const r of [...collateral].sort((a, b) => a.date.localeCompare(b.date))) {
  p(`| ${r.fighter} | ${r.date} | ${r.event} | ${label(r.old)} |`);
}
p();

p("## 参考: unlisted(非公開)大会へのリンク");
p();
p("`unlisted: true` の大会は /results 一覧・sitemapから除外され個別ページもnoindexだが、");
p("選手ページの対戦テーブルからは現状リンクが張られている(残件2として別PRで除去予定)。");
p();
const unlisted = new Map<string, number>();
for (const r of evaluated) {
  if (!r.next) continue;
  if (!eventBySlug.get(r.next)!.unlisted) continue;
  unlisted.set(r.next, (unlisted.get(r.next) ?? 0) + 1);
}
p("| 大会 | 開催日 | リンク元bout数 |");
p("|---|---|---|");
for (const [slug, n] of [...unlisted].sort()) {
  const ev = eventBySlug.get(slug)!;
  p(`| ${slug} (${ev.eventName}) | ${ev.date} | ${n} |`);
}
p();
p(`合計 ${[...unlisted.values()].reduce((a, b) => a + b, 0)}bout`);
p();

p("## 参考: 部分一致でリンクしている大会名(alias表の中身)");
p();
const aliasCount = new Map<string, number>();
for (const r of evaluated) {
  if (!r.next) continue;
  if (normEventName(eventBySlug.get(r.next)!.eventName) === normEventName(r.event)) continue;
  aliasCount.set(`${r.event} => ${r.next}`, (aliasCount.get(`${r.event} => ${r.next}`) ?? 0) + 1);
}
p(`正規化後に完全一致しないリンク: ${[...aliasCount.values()].reduce((a, b) => a + b, 0)}bout / 大会名${aliasCount.size}件。`);
p("件数が多く(85件)、新規大会ごとに【階級タイトルマッチ】等の派生表記が増え続けるため、");
p("部分一致そのものを捨ててalias表だけで運用することはできない。代わりに");
p("`scripts/event-slug-alias-baseline.json` にレビュー済みの対応表として固定し、");
p("表に無い部分一致が新たに出たらビルドを落とす(check-event-slug-links.ts)。");
p();
p("| 表示される大会名 | リンク先 | bout数 |");
p("|---|---|---|");
for (const [k, n] of [...aliasCount].sort((a, b) => b[1] - a[1])) {
  const [event, slug] = k.split(" => ");
  p(`| ${event} | ${slug} | ${n} |`);
}

// findEventNameMatches は日付ガード前の候補確認用(バケットBの根拠)。
void findEventNameMatches;

console.log(out.join("\n"));
