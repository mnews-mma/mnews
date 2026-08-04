/**
 * ゼロ件ゲート: /fighters/[slug] の対戦テーブルから /results/ へ張られる
 * 内部リンクが、boutの試合日と一致しない別大会を指していないか検査する。
 *
 * findEventSlug() は大会名の文字列一致で候補を絞ってから開催日で確定する。
 * このゲートは「実際に張られるリンク」を全boutぶん再現し、日付の食い違いが
 * 1件でもあれば落とす(=日付確認をfindEventSlugから外すと落ちる)。
 * 併せて、名前は一致するが日付が合わずリンクを見送ったboutを参考出力する
 * (上流データの日付誤りの検知用。こちらは非致命)。
 */
import { EVENT_RESULTS } from "../src/lib/eventResults";
import { collectBoutRows, findEventNameMatches, findEventSlug, parseYmd } from "./lib/eventSlugLink";
import fighterRecords from "../data/fighterRecords.json";
import rizinRecords from "../data/rizinRecords.json";
import shootoRecords from "../data/shootoRecords.json";
import pancraseRecords from "../data/pancraseRecords.json";
import deepRecords from "../data/deepRecords.json";

const rows = collectBoutRows({ fighterRecords, rizinRecords, shootoRecords, pancraseRecords, deepRecords });
const eventBySlug = new Map(EVENT_RESULTS.map((e) => [e.slug, e]));

const violations: string[] = [];
const skipped = new Map<string, { slug: string; boutDate: string; fighter: string }>();
let linked = 0;

for (const r of rows) {
  const slug = findEventSlug(r.event, r.date);
  if (slug) {
    linked++;
    const ev = eventBySlug.get(slug)!;
    const boutAt = parseYmd(r.date);
    const eventAt = parseYmd(String(ev.date));
    if (boutAt !== null && eventAt !== null) {
      const diff = Math.abs(boutAt - eventAt) / 86400000;
      if (diff > 1) {
        violations.push(
          `  ${r.fighter} (${r.date}) "${r.event}" → /results/${slug} (${ev.date} ${ev.eventName}) : ${diff}日ズレ`,
        );
      }
    }
    continue;
  }
  // 名前は一致したのに日付が合わずリンクを見送ったケース(参考出力)
  const named = findEventNameMatches(r.event);
  if (named.length > 0 && !skipped.has(r.event)) {
    skipped.set(r.event, { slug: named[0].slug, boutDate: r.date, fighter: r.fighter });
  }
}

if (skipped.size > 0) {
  console.log(`ℹ 大会名は一致したが開催日が合わずリンクを見送ったbout: ${skipped.size}件`);
  for (const [event, s] of skipped) {
    const ev = eventBySlug.get(s.slug)!;
    console.log(`  ${s.fighter} (${s.boutDate}) "${event}" ↔ ${s.slug} (${ev.date} ${ev.eventName})`);
  }
}

if (violations.length > 0) {
  console.error(`✗ 対戦テーブルの/resultsリンクが別日程の大会を指しています (${violations.length}件)`);
  for (const v of violations) console.error(v);
  console.error("  src/app/fighters/[slug]/page.tsx の findEventSlug() を確認してください。");
  process.exit(1);
}

console.log(`✓ 対戦テーブルの/resultsリンク: 日付不一致 0件 (${rows.length}bout中${linked}件にリンク)`);
