// 指示書H: #428で確定した`extractBoutTables()`(scripts/build-pancrase-records.ts)の
// `<table id="...">`(id属性付き)bout表取りこぼしバグについて、全パンクラス大会
// (data/pancraseRecords.json記載の全418大会)を走査し、取りこぼされているbout数を
// 数える。read-only(data/は一切書き換えない)。
//
// 実行: npx tsx scripts/scan-pancrase-table-id-gap.ts
import fs from "fs";
import path from "path";
import { assertAllowedByRobots } from "./lib/robotsGate";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 30_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    process.stderr.write(`[fetch] ${url} (試行${attempt + 1}/${retries + 1})\n`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTPステータス${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`[fetch] 取得に失敗しました(${retries + 1}回試行): ${url} (${String(lastError)})`);
}

// extractBoutTables()と同じ「bout表かどうか」の判定(class="crdl"を含むか)を、
// id属性付きテーブルにも適用する。
const ID_TABLE_RE = /<table id="([^"]*)">([\s\S]*?)<\/table>/g;

// crdl/crdrセル内の<a href="...">名前</a>から選手名だけを取り出す簡易版
// (build-pancrase-records.tsのparseCorner()の主要ケースのみ再現。マーカー文字
// 判定は不要=名寄せの重複チェック用途のため)。
function extractCornerName(cellHtml: string): string | null {
  const withoutSmDivs = cellHtml.replace(/<div class="sm">[\s\S]*?<\/div>/g, "");
  const linkMatch = withoutSmDivs.match(/<a href="([^"]+)">([^<]*)<\/a>/);
  if (linkMatch) return linkMatch[2].trim();
  const text = withoutSmDivs.replace(/<[^>]+>/g, "").trim();
  return text.replace(/[○◯〇×△-]/g, "").trim() || null;
}

interface IdTaggedBout {
  id: string;
  headingText: string | null;
  fighterAName: string | null;
  fighterBName: string | null;
}

function extractIdTaggedBoutTables(html: string): IdTaggedBout[] {
  const out: IdTaggedBout[] = [];
  let m: RegExpExecArray | null;
  ID_TABLE_RE.lastIndex = 0;
  while ((m = ID_TABLE_RE.exec(html))) {
    const [, id, chunk] = m;
    if (!chunk.includes('class="crdl"')) continue; // 既存のbout表判定基準と同じ
    const headingMatch = chunk.match(/<td colspan="5" class="rdcube">([\s\S]*?)<\/td>/);
    const crdlMatch = chunk.match(/<td class="crdl">([\s\S]*?)<\/td>/);
    const crdrMatch = chunk.match(/<td class="crdr">([\s\S]*?)<\/td>/);
    out.push({
      id,
      headingText: headingMatch ? headingMatch[1].replace(/<[^>]+>/g, "").trim() : null,
      fighterAName: crdlMatch ? extractCornerName(crdlMatch[1]) : null,
      fighterBName: crdrMatch ? extractCornerName(crdrMatch[1]) : null,
    });
  }
  return out;
}

// #428等で既に個別回収済みのboutを再度「取りこぼし」として数えないための
// 重複チェック。同一(fighterAName, fighterBName)の組が既存bouts配列に
// 既にあれば「解決済み」とみなす(name抽出に失敗した場合は安全側に倒し
// 「未解決」として残す=見逃しよりは重複報告の方が安全)。
function alreadyResolved(ev: any, bout: IdTaggedBout): boolean {
  if (!bout.fighterAName || !bout.fighterBName) return false;
  return ev.bouts.some((b: any) => b.fighterAName === bout.fighterAName && b.fighterBName === bout.fighterBName);
}

// 418大会は1回のバッチ上限200件を超えるため、コマンドライン引数で
// 対象範囲を指定して分割実行する: npx tsx scripts/scan-pancrase-table-id-gap.ts <start> <end>
// (endは含まない、省略時は全件=既存の挙動)。バッチ間は呼び出し側で間隔を空ける。
const BATCH_START = process.argv[2] ? Number(process.argv[2]) : 0;
const BATCH_END = process.argv[3] ? Number(process.argv[3]) : Infinity;
const OUT_SUFFIX = process.argv[2] ? `-${process.argv[2]}-${process.argv[3]}` : "";

async function main() {
  const allEvents: any[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "pancraseRecords.json"), "utf8"));
  const events = allEvents.filter((e) => !!e.sourceUrl).slice(BATCH_START, BATCH_END);
  console.log(`バッチ範囲: [${BATCH_START}, ${BATCH_END}) / 対象: ${events.length}件`);

  let fetchedCount = 0;
  const unreachable: { eventName: string; sourceUrl: string; error: string }[] = [];
  const results: { eventName: string; date: string | null; sourceUrl: string; existingBoutCount: number; idTaggedBoutCount: number; idTaggedHeadings: (string | null)[]; idTaggedBouts: IdTaggedBout[] }[] = [];

  for (const ev of events) {
    if (!ev.sourceUrl) continue;
    let html: string;
    try {
      html = await fetchHtml(ev.sourceUrl);
    } catch (err) {
      unreachable.push({ eventName: ev.eventName, sourceUrl: ev.sourceUrl, error: String(err) });
      await sleep(DELAY_MS);
      continue;
    }
    fetchedCount++;
    await sleep(DELAY_MS);

    const idTagged = extractIdTaggedBoutTables(html).filter((b) => !alreadyResolved(ev, b));
    if (idTagged.length > 0) {
      results.push({
        eventName: ev.eventName,
        date: ev.date,
        sourceUrl: ev.sourceUrl,
        existingBoutCount: ev.bouts.length,
        idTaggedBoutCount: idTagged.length,
        idTaggedHeadings: idTagged.map((t) => t.headingText),
        idTaggedBouts: idTagged,
      });
    }
  }

  const totalIdTagged = results.reduce((s, r) => s + r.idTaggedBoutCount, 0);
  console.log(`大会総数: ${events.length} / fetch成功: ${fetchedCount} / unreachable: ${unreachable.length}`);
  console.log(`table id取りこぼしが検出された大会数: ${results.length}`);
  console.log(`取りこぼしbout総数: ${totalIdTagged}`);
  console.log("\n=== 詳細 ===");
  for (const r of results) {
    console.log(`${r.eventName} (${r.date}) 既存${r.existingBoutCount}件 + 取りこぼし${r.idTaggedBoutCount}件: ${r.idTaggedHeadings.join(" / ")}`);
  }
  if (unreachable.length > 0) console.log("\n[unreachable]", JSON.stringify(unreachable, null, 2));

  fs.writeFileSync(
    path.join(process.cwd(), "out", `pancrase-table-id-gap-scan${OUT_SUFFIX}.json`),
    JSON.stringify({ batchStart: BATCH_START, batchEnd: BATCH_END, eventsTotal: events.length, fetchedCount, unreachable, totalIdTagged, results }, null, 2) + "\n"
  );
  console.log(`\n書き出し: out/pancrase-table-id-gap-scan${OUT_SUFFIX}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
