// recordFromResults選手のうち、現在data/fighterRecords.jsonでnoRecordData:true
// または未焼き込み(バッチが選手追加後まだ一度も回っていない)の全員について、
// resolveFighter.tsと同じロジック(ja/en-wiki既定タイトル解決→EVENT_RESULTS由来の
// 履歴とのoverlapガード)をライブ再実行し、「バッチが次回回れば解決するだけ」か
// 「ライブ判定でも記事が見つからない・ガードで棄却される」かを切り分ける
// 調査専用スクリプト(read-only、data/への書き込みはしない)。
//
// 実行: npx tsx scripts/audit-norecorddata-fighters.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { fetchJaWikiFighterRecord, fetchWikiFighterRecord } from "../src/lib/feeds/wikipedia";
import { deriveHistoryFromEventResults } from "../src/lib/fighterRecordFromResults";

const norm = (s: string) => s.replace(/[\s　・☆]/g, "");
function historiesOverlap(wikiHistory: { opponent: string }[], derived: { opponent: string }[]): boolean {
  if (derived.length === 0) return false;
  const wikiOpp = new Set(wikiHistory.map((h) => norm(h.opponent)));
  return derived.some((h) => wikiOpp.has(norm(h.opponent)));
}

async function main() {
  const recordsPath = path.join(process.cwd(), "data", "fighterRecords.json");
  const records = JSON.parse(fs.readFileSync(recordsPath, "utf8"));

  const targets = FIGHTERS.filter((f) => f.recordFromResults);
  console.log(`recordFromResults対象: ${targets.length}名`);

  // 現在fighterRecords.jsonでnoRecordData:trueまたは未焼き込み(キー無し)の選手だけを対象に、
  // ライブでresolveFighter相当のロジックを再実行し「今なら解決できるか」を判定する。
  const candidates = targets.filter((f) => {
    const rec = records[f.slug];
    return !rec || rec.noRecordData === true;
  });
  console.log(`現在noRecordData/未焼き込み: ${candidates.length}名\n`);

  const results: { slug: string; nameJa: string; status: string; detail: string }[] = [];

  for (const fighter of candidates) {
    const jaTitle = fighter.wikiTitleJa ?? fighter.nameJa.replace(/\s/g, "");
    const enTitle = fighter.wikiTitleEn ?? fighter.nameEn ?? null;
    const [jaWikiRaw, enWikiRaw] = await Promise.all([
      fetchJaWikiFighterRecord(jaTitle).catch(() => null),
      enTitle ? fetchWikiFighterRecord(enTitle).catch(() => null) : Promise.resolve(null),
    ]);

    const derived = deriveHistoryFromEventResults(fighter.nameJa, fighter.slug);

    let jaWiki = jaWikiRaw;
    if (jaWikiRaw && !fighter.wikiTitleJa && !historiesOverlap(jaWikiRaw.history, derived)) {
      jaWiki = null;
    }
    let enWiki = enWikiRaw;
    if (enWikiRaw && !fighter.wikiTitleEn && !historiesOverlap(enWikiRaw.history, derived)) {
      enWiki = null;
    }

    const jaHasTotals = !!jaWiki && jaWiki.wins + jaWiki.losses + jaWiki.draws > 0;
    const wiki = jaWiki && (jaWiki.history.length > 0 || jaHasTotals) ? jaWiki : enWiki;
    const wikiHasRecord = !!wiki && wiki.wins + wiki.losses + wiki.draws > 0;

    let status: string;
    let detail: string;
    if (wikiHasRecord && wiki) {
      status = "解決可能(バッチ待ちのみ)";
      detail = `${wiki.wins}-${wiki.losses}-${wiki.draws} (${wiki === jaWiki ? "ja" : "en"}, title=${wiki === jaWiki ? jaTitle : enTitle})`;
    } else if (jaWikiRaw && !jaWiki) {
      status = "記事はあるが同名別人ガードで棄却";
      detail = `jaWiki totals=${jaWikiRaw.wins}-${jaWikiRaw.losses}-${jaWikiRaw.draws}, derived件数=${derived.length}, overlap無し`;
    } else if (!jaWikiRaw && !enWikiRaw) {
      status = "記事自体が見つからない(既定タイトル不一致 or 未執筆)";
      detail = `jaTitle="${jaTitle}"`;
    } else {
      status = "記事はあるが戦績データなし(recordbox無し等)";
      detail = `jaTitle="${jaTitle}"`;
    }
    results.push({ slug: fighter.slug, nameJa: fighter.nameJa, status, detail });
    console.log(`${fighter.slug}(${fighter.nameJa}): ${status} — ${detail}`);
  }

  const outDir = path.join(process.cwd(), "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const lines: string[] = [];
  lines.push("# recordFromResults選手のnoRecordData/未焼き込み一覧(ライブ再判定)");
  lines.push("");
  lines.push(`recordFromResults対象: ${targets.length}名 / 現在noRecordData・未焼き込み: ${candidates.length}名`);
  lines.push("");
  const byStatus = new Map<string, number>();
  for (const r of results) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  lines.push("## 内訳");
  for (const [s, c] of byStatus) lines.push(`- ${s}: ${c}名`);
  lines.push("");
  lines.push("## 明細");
  lines.push("");
  lines.push("| slug | nameJa | 判定 | 詳細 |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    lines.push(`| ${r.slug} | ${r.nameJa} | ${r.status} | ${r.detail} |`);
  }
  fs.writeFileSync(path.join(outDir, "norecorddata-audit.md"), lines.join("\n") + "\n");
  console.log("\nレポート: out/norecorddata-audit.md");
}

main();
