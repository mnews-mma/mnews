// 指示書D: パンクラスクロスorg監査(131名/54名候補)。
// #420(funada-denchi)で判明した「全365名をパンクラス公式名簿1,683件
// (指示書H成果物、out/pancrase_name_reconciliation_table.json)と名前一致
// させると131名、うちorg!=="pancrase"が54名」という母集団について、
// 公式プロフィール戦績表とmnewsのパンクラスboutを①データに無い
// ②データにあるがslug未解決 ③既に反映済み の3分類で突合する。
// read-only(data/・fighters.tsへの書き込みは一切行わない)。
//
// 実行: npx tsx scripts/investigate-pancrase-crossorg-audit-131.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { assertAllowedByRobots } from "./lib/robotsGate";
import { normalize as bfNormalize } from "./lib/fighterNameBackfill";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_PROFILE_FETCH = 200;
const BASE = "https://www.pancrase.co.jp/data";

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

function normName(s: string | null | undefined): string {
  return (s || "").replace(/[\s　]/g, "");
}

function basenameOfUrl(u: string | null): string | null {
  if (!u) return null;
  const parts = u.split("/");
  return parts[parts.length - 1] || null;
}

const LIST_SOURCE_TO_DIR: Record<string, string> = {
  japanese: "prfl2",
  foreign: "prfl-e",
  "women(mixed nationality)": "prfl-a",
};

interface ReconEntry {
  urlStem: string;
  href: string;
  displayName: string;
  listSource: string;
}

interface MatchResult {
  slug: string;
  nameJa: string;
  org: string;
  matched: boolean;
  ambiguous: boolean;
  highCollisionRisk: boolean;
  matchAxis: "nameJa" | "alias" | null;
  matchedRaw: string | null;
  href: string | null;
  listSource: string | null;
  ambiguousHrefs: string[];
}

function isHighCollisionRiskName(name: string): boolean {
  return bfNormalize(name).length <= 3;
}

async function main() {
  const reconPath = path.join(process.cwd(), "out", "pancrase_name_reconciliation_table.json");
  const reconEntries: ReconEntry[] = JSON.parse(fs.readFileSync(reconPath, "utf8"));

  // 正規化displayName -> エントリ[](複数あれば同名衝突=ambiguous。既知1件: 泰斗)
  const nameIndex = new Map<string, ReconEntry[]>();
  for (const e of reconEntries) {
    const n = bfNormalize(e.displayName);
    if (!n) continue;
    const arr = nameIndex.get(n) ?? [];
    arr.push(e);
    nameIndex.set(n, arr);
  }

  // ── a) 母数確定: 全365名を公式名簿と突合 ──
  const matches: MatchResult[] = [];
  for (const f of FIGHTERS) {
    const highCollisionRisk = isHighCollisionRiskName(f.nameJa);
    let matchAxis: "nameJa" | "alias" | null = null;
    let matchedRaw: string | null = null;
    let rowsFound: ReconEntry[] = [];

    const nameJaKey = bfNormalize(f.nameJa);
    if (nameJaKey && nameIndex.has(nameJaKey)) {
      rowsFound = nameIndex.get(nameJaKey)!;
      matchAxis = "nameJa";
      matchedRaw = f.nameJa;
    } else {
      for (const alias of f.aliases ?? []) {
        const aliasKey = bfNormalize(alias);
        if (aliasKey && nameIndex.has(aliasKey)) {
          rowsFound = nameIndex.get(aliasKey)!;
          matchAxis = "alias";
          matchedRaw = alias;
          break;
        }
      }
    }

    if (rowsFound.length === 0) {
      matches.push({
        slug: f.slug,
        nameJa: f.nameJa,
        org: f.org,
        matched: false,
        ambiguous: false,
        highCollisionRisk,
        matchAxis: null,
        matchedRaw: null,
        href: null,
        listSource: null,
        ambiguousHrefs: [],
      });
    } else if (rowsFound.length > 1) {
      matches.push({
        slug: f.slug,
        nameJa: f.nameJa,
        org: f.org,
        matched: false,
        ambiguous: true,
        highCollisionRisk: true,
        matchAxis,
        matchedRaw,
        href: null,
        listSource: null,
        ambiguousHrefs: rowsFound.map((r) => r.href),
      });
    } else {
      matches.push({
        slug: f.slug,
        nameJa: f.nameJa,
        org: f.org,
        matched: true,
        ambiguous: false,
        highCollisionRisk,
        matchAxis,
        matchedRaw,
        href: rowsFound[0].href,
        listSource: rowsFound[0].listSource,
        ambiguousHrefs: [],
      });
    }
  }

  fs.writeFileSync(
    path.join(process.cwd(), "out", "pancrase-crossorg-id-matches.json"),
    JSON.stringify(matches, null, 2) + "\n"
  );

  const matchedTargets = matches.filter((m) => m.matched && m.href);
  const matchedNonPancraseOrg = matchedTargets.filter((m) => m.org !== "pancrase");
  const unmatched = matches.filter((m) => !m.matched && !m.ambiguous);
  const ambiguous = matches.filter((m) => m.ambiguous);
  const aliasAxisMatches = matchedTargets.filter((m) => m.matchAxis === "alias");

  console.log(`FIGHTERS総数: ${FIGHTERS.length}`);
  console.log(`公式名簿1,683件と一致: ${matchedTargets.length} (うちorg!=="pancrase": ${matchedNonPancraseOrg.length})`);
  console.log(`うちaliasesで一致(名寄せ軸): ${aliasAxisMatches.length}`);
  console.log(`未特定: ${unmatched.length} / ambiguous: ${ambiguous.length}`);

  if (matchedTargets.length > MAX_PROFILE_FETCH) {
    console.log(`\n[STOP] 一致${matchedTargets.length}名がfetch上限${MAX_PROFILE_FETCH}件を超過。分割が必要なため停止する。`);
    fs.writeFileSync(
      path.join(process.cwd(), "out", "pancrase-crossorg-audit-summary.json"),
      JSON.stringify(
        {
          fightersTotal: FIGHTERS.length,
          matchedCount: matchedTargets.length,
          matchedNonPancraseOrgCount: matchedNonPancraseOrg.length,
          stoppedForFetchCap: true,
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  // ── b) 既存data/pancraseRecords.jsonをurlKey(プロフィールhref basename)で索引 ──
  const recordsPath = path.join(process.cwd(), "data", "pancraseRecords.json");
  const pancraseRecords: any[] = JSON.parse(fs.readFileSync(recordsPath, "utf8"));

  interface ExistingBoutRef {
    date: string;
    eventName: string;
    opponentName: string;
    opponentNorm: string;
    slugAtThisSide: string | null;
    resultType: string;
    isWin: boolean | null;
  }

  const urlKeyIndex = new Map<string, ExistingBoutRef[]>(); // href basename -> bouts
  // slug -> bouts(date|opponentNorm)。leftUrl/rightUrlが無いbout(実測4573件中322件、
  // 約7%)はurlKeyIndexに載らないため、fighterASlug/fighterBSlugが既に解決済みの
  // bout(=本来「反映済み」のはず)を見落として偽陽性の「missing」を出す不具合が
  // あった(kindaichi-kosuke 2018-07-15で発覚)。URLの有無に関わらずslug自体で
  // 直接引けるこの索引を主経路にする。
  const slugKeyIndex = new Map<string, ExistingBoutRef[]>(); // `${slug}|${date}|${opponentNorm}` -> bouts

  for (const ev of pancraseRecords) {
    if (!ev.date) continue;
    for (const b of ev.bouts) {
      const leftKey = basenameOfUrl(b.leftUrl);
      const rightKey = basenameOfUrl(b.rightUrl);
      const isWinA = b.resultType === "decisive" ? b.winnerSlug === b.fighterASlug || (b.winnerName && b.winnerName === b.fighterAName) : null;
      if (leftKey) {
        const arr = urlKeyIndex.get(leftKey) ?? [];
        arr.push({
          date: ev.date,
          eventName: ev.eventName,
          opponentName: b.fighterBName,
          opponentNorm: bfNormalize(b.fighterBName),
          slugAtThisSide: b.fighterASlug,
          resultType: b.resultType,
          isWin: b.resultType === "decisive" ? isWinA : null,
        });
        urlKeyIndex.set(leftKey, arr);
      }
      if (rightKey) {
        const arr = urlKeyIndex.get(rightKey) ?? [];
        const isWinB = b.resultType === "decisive" ? !isWinA : null;
        arr.push({
          date: ev.date,
          eventName: ev.eventName,
          opponentName: b.fighterAName,
          opponentNorm: bfNormalize(b.fighterAName),
          slugAtThisSide: b.fighterBSlug,
          resultType: b.resultType,
          isWin: isWinB,
        });
        urlKeyIndex.set(rightKey, arr);
      }
      if (b.fighterASlug) {
        const key = `${b.fighterASlug}|${ev.date}|${bfNormalize(b.fighterBName)}`;
        const arr = slugKeyIndex.get(key) ?? [];
        arr.push({
          date: ev.date,
          eventName: ev.eventName,
          opponentName: b.fighterBName,
          opponentNorm: bfNormalize(b.fighterBName),
          slugAtThisSide: b.fighterASlug,
          resultType: b.resultType,
          isWin: b.resultType === "decisive" ? isWinA : null,
        });
        slugKeyIndex.set(key, arr);
      }
      if (b.fighterBSlug) {
        const isWinB = b.resultType === "decisive" ? !isWinA : null;
        const key = `${b.fighterBSlug}|${ev.date}|${bfNormalize(b.fighterAName)}`;
        const arr = slugKeyIndex.get(key) ?? [];
        arr.push({
          date: ev.date,
          eventName: ev.eventName,
          opponentName: b.fighterAName,
          opponentNorm: bfNormalize(b.fighterAName),
          slugAtThisSide: b.fighterBSlug,
          resultType: b.resultType,
          isWin: isWinB,
        });
        slugKeyIndex.set(key, arr);
      }
    }
  }

  const fighterBySlug = new Map(FIGHTERS.map((f) => [f.slug, f]));

  // ── c) プロフィールページ取得・解析 ──
  interface ProfileBout {
    date: string;
    opponentNameRaw: string;
    opponentHrefBasename: string | null;
    method: string;
    symbol: string;
    result: "win" | "loss" | "draw" | "unknown";
  }

  function resultFromSymbol(sym: string): ProfileBout["result"] {
    if (sym === "○" || sym === "◯" || sym === "〇") return "win";
    if (sym === "×") return "loss";
    if (sym === "△") return "draw";
    return "unknown";
  }

  // プロフィールページの戦績テーブル1行:
  // <tr><td class="td1"><a href="...">MM.DD　会場</a></td>
  // <td class="td2"><a href="REL_HREF">対戦相手名</a></td>
  // <td class="td3">ラウンド情報</td><td class="td4">方式</td><td class="td5">記号</td></tr>
  // 年は直前の <tr><td colspan="5" class="td0 yaerttl">YYYY</td></tr> から補完する。
  const YEAR_RE = /<tr><td colspan="5" class="td0 yaerttl">(\d{4})<\/td><\/tr>/g;
  const ROW_RE =
    /<tr>\s*<td class="td1"><a href="[^"]*">(\d{2})\.(\d{2})[^<]*<\/a><\/td>\s*<td class="td2"><a href="([^"]*)">([^<]*)<\/a><\/td>\s*<td class="td3">([^<]*)<\/td>\s*<td class="td4">([^<]*)<\/td>\s*<td class="td5">([^<]*)<\/td><\/tr>/g;

  function parseProfilePage(html: string): ProfileBout[] {
    // <table>本文だけを対象にする(ページ内の他のtableを誤って拾わないため)。
    const tableMatch = html.match(/<table>([\s\S]*?)<\/table>/);
    const body = tableMatch ? tableMatch[1] : html;

    // 行の出現順に沿って年を補完するため、コロン付きの位置情報を使い
    // 「直前に出現した年ヘッダ」を各boutに割り当てる。
    const yearMarkers: { index: number; year: string }[] = [];
    let ym: RegExpExecArray | null;
    YEAR_RE.lastIndex = 0;
    while ((ym = YEAR_RE.exec(body))) {
      yearMarkers.push({ index: ym.index, year: ym[1] });
    }
    function yearAt(idx: number): string {
      let y = yearMarkers.length > 0 ? yearMarkers[0].year : "0000";
      for (const marker of yearMarkers) {
        if (marker.index <= idx) y = marker.year;
        else break;
      }
      return y;
    }

    const bouts: ProfileBout[] = [];
    let rowM: RegExpExecArray | null;
    ROW_RE.lastIndex = 0;
    while ((rowM = ROW_RE.exec(body))) {
      const [, mm, dd, oppHref, oppName, , method, symbol] = rowM;
      const year = yearAt(rowM.index);
      bouts.push({
        date: `${year}-${mm}-${dd}`,
        opponentNameRaw: oppName.trim(),
        opponentHrefBasename: basenameOfUrl(oppHref),
        method: method.trim(),
        symbol: symbol.trim(),
        result: resultFromSymbol(symbol.trim()),
      });
    }
    return bouts;
  }

  type Category = "reflected" | "slug_unresolved" | "missing_from_data";

  interface FighterAuditResult {
    slug: string;
    nameJa: string;
    org: string;
    matchAxis: "nameJa" | "alias" | null;
    highCollisionRisk: boolean;
    href: string;
    profileBoutCount: number;
    reflectedCount: number;
    slugUnresolvedCount: number;
    missingCount: number;
    slugUnresolvedDetail: { date: string; opponentNameRaw: string }[];
    missingDetail: { date: string; opponentNameRaw: string }[];
  }

  const results: FighterAuditResult[] = [];
  const unreachable: { slug: string; nameJa: string; href: string; error: string }[] = [];
  let fetchedCount = 0;

  for (const t of matchedTargets) {
    const dir = LIST_SOURCE_TO_DIR[t.listSource!];
    // hrefは通常ベア filename("xxx.html")だが、一部(例: kitaoka-satoru)は
    // listSourceのディレクトリと異なる相対パス("../prfl/xxx.html")を含む。
    // URL解決で正しいディレクトリに着地させ、urlKeyIndex側のbasename
    // (pancraseRecords.jsonのleftUrl/rightUrlから抽出したもの)と一致する
    // キーを使う(素のhref文字列をそのままキーにすると、この種のケースで
    // 突合キーがずれて偽陽性の「missing」を生む)。
    const url = new URL(t.href!, `${BASE}/${dir}/`).toString();
    const urlKey = basenameOfUrl(url)!;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      unreachable.push({ slug: t.slug, nameJa: t.nameJa, href: t.href!, error: String(err) });
      await sleep(DELAY_MS);
      continue;
    }
    fetchedCount++;
    await sleep(DELAY_MS);

    const bouts = parseProfilePage(html);
    const myUrlBouts = urlKeyIndex.get(urlKey) ?? [];
    const myUrlByKey = new Map<string, ExistingBoutRef[]>();
    for (const b of myUrlBouts) {
      const key = `${b.date}|${b.opponentNorm}`;
      const arr = myUrlByKey.get(key) ?? [];
      arr.push(b);
      myUrlByKey.set(key, arr);
    }

    // fighters.ts historyも「既にDB反映済み」の補助ソースとして見る。
    const fighter = fighterBySlug.get(t.slug);
    const historyByKey = new Map<string, boolean>();
    if (fighter && Array.isArray((fighter as any).history)) {
      for (const h of (fighter as any).history as any[]) {
        historyByKey.set(`${h.date}|${bfNormalize(h.opponent)}`, true);
      }
    }

    let reflectedCount = 0;
    let slugUnresolvedCount = 0;
    let missingCount = 0;
    const slugUnresolvedDetail: { date: string; opponentNameRaw: string }[] = [];
    const missingDetail: { date: string; opponentNameRaw: string }[] = [];

    for (const b of bouts) {
      const key = `${b.date}|${bfNormalize(b.opponentNameRaw)}`;
      if (historyByKey.has(key)) {
        reflectedCount++;
        continue;
      }
      // 最優先: slug自体が既にこの相手・日付で解決済みか(URLの有無に依存しない)。
      const slugKey = `${t.slug}|${key}`;
      if ((slugKeyIndex.get(slugKey) ?? []).length > 0) {
        reflectedCount++;
        continue;
      }
      // 次点: プロフィールのhrefがpancraseRecords.json側のleftUrl/rightUrlと
      // 一致するが、その側のslugが自分ではない(=データにはあるがslug未解決)。
      const candidatesAtKey = myUrlByKey.get(key) ?? [];
      if (candidatesAtKey.length === 0) {
        missingCount++;
        missingDetail.push({ date: b.date, opponentNameRaw: b.opponentNameRaw });
        continue;
      }
      const cand = candidatesAtKey[0];
      if (cand.slugAtThisSide === t.slug) {
        reflectedCount++;
      } else {
        slugUnresolvedCount++;
        slugUnresolvedDetail.push({ date: b.date, opponentNameRaw: b.opponentNameRaw });
      }
    }

    results.push({
      slug: t.slug,
      nameJa: t.nameJa,
      org: t.org,
      matchAxis: t.matchAxis,
      highCollisionRisk: t.highCollisionRisk,
      href: t.href!,
      profileBoutCount: bouts.length,
      reflectedCount,
      slugUnresolvedCount,
      missingCount,
      slugUnresolvedDetail,
      missingDetail,
    });
  }

  fs.writeFileSync(
    path.join(process.cwd(), "out", "pancrase-crossorg-per-fighter.json"),
    JSON.stringify(results, null, 2) + "\n"
  );

  const totalProfileBouts = results.reduce((s, r) => s + r.profileBoutCount, 0);
  const totalReflected = results.reduce((s, r) => s + r.reflectedCount, 0);
  const totalSlugUnresolved = results.reduce((s, r) => s + r.slugUnresolvedCount, 0);
  const totalMissing = results.reduce((s, r) => s + r.missingCount, 0);

  const summary = {
    fightersTotal: FIGHTERS.length,
    matchedCount: matchedTargets.length,
    matchedNonPancraseOrgCount: matchedNonPancraseOrg.length,
    aliasAxisMatchCount: aliasAxisMatches.length,
    aliasAxisMatches: aliasAxisMatches.map((m) => ({ slug: m.slug, nameJa: m.nameJa, matchedRaw: m.matchedRaw, href: m.href })),
    unmatchedCount: unmatched.length,
    ambiguousCount: ambiguous.length,
    ambiguous: ambiguous.map((m) => ({ slug: m.slug, nameJa: m.nameJa, ambiguousHrefs: m.ambiguousHrefs })),
    fetchedCount,
    unreachableCount: unreachable.length,
    unreachable,
    highCollisionRiskMatchedCount: matchedTargets.filter((m) => m.highCollisionRisk).length,
    totalProfileBouts,
    totalReflected,
    totalSlugUnresolved,
    totalMissing,
    fightersWithSlugUnresolvedCount: results.filter((r) => r.slugUnresolvedCount > 0).length,
    fightersWithMissingCount: results.filter((r) => r.missingCount > 0).length,
  };
  fs.writeFileSync(
    path.join(process.cwd(), "out", "pancrase-crossorg-audit-summary.json"),
    JSON.stringify(summary, null, 2) + "\n"
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
