// パンクラス/修斗の公式ランキングHTMLをパースして順位データにする(純粋ロジック)。
// 序列はmnewsが作らず団体公式の値をそのまま転載。対象は男子(ストロー〜ミドル)+
// 女子の該当階級のみ(修斗の環太平洋ランキングのような重複/対象外区分はスキップ)。
import { FIGHTERS } from "./fighters";
import { rankSortKey } from "./weightClasses";

export interface RankEntry {
  rank: string; // "王者" / "暫定王者" / "1" 等、団体公式の値そのまま
  officialName: string; // 公式表記の選手名(日本語)
  slug: string | null; // DB内選手にマッチすれば slug(選手ページリンク用)
}
export interface RankedClass {
  // パンクラス/修斗/RIZIN/DEEPとも階級ラベルは多岐にわたるため string で受ける
  // (weightSortKeyで並び順を統一するため、型を特定の列挙に絞らない)。
  weightClass: string;
  entries: RankEntry[];
}
export interface OrgRankingData {
  org: "pancrase" | "shooto" | "rizin" | "deep";
  source: string; // 出典表示名
  sourceUrl: string;
  fetchedDate: string; // 取得日 YYYY-MM-DD
  rankingLabel: string; // 公式ページ上の版(発表日等)
  classes: RankedClass[];
}

const norm = (s: string) => s.replace(/[\s　・☆]/g, "").replace(/（.*?）|\(.*?\)/g, "");
const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// 全FIGHTERS(hidden含む)から名前一致で slug を引く。findFighterSlugByName は hidden を
// 除外するため使わない(ランカーは大半 hidden なので独自照合が必要)。
const nameIndex = (() => {
  const m = new Map<string, string>();
  for (const f of FIGHTERS) {
    if (!m.has(norm(f.nameJa))) m.set(norm(f.nameJa), f.slug);
  }
  return m;
})();
function matchSlug(name: string): string | null {
  return nameIndex.get(norm(name)) ?? null;
}

// 階級ブロックをRankedClassに仕上げ、階級内の順位(王者→暫定→番号)で整列する。
function finalizeClasses(
  raw: { weightClass: string; entries: { rank: string; officialName: string }[] }[]
): RankedClass[] {
  const classes: RankedClass[] = [];
  for (const c of raw) {
    const entries = c.entries
      .filter((e) => e.officialName)
      .map((e) => ({ rank: e.rank, officialName: e.officialName, slug: matchSlug(e.officialName) }))
      .sort((a, b) => rankSortKey(a.rank) - rankSortKey(b.rank));
    if (entries.length > 0) classes.push({ weightClass: c.weightClass, entries });
  }
  return classes;
}

// 見出し文字列から階級名(ストロー級・フライ級…)だけを抜き出す(女子接頭辞や
// 「世界」「環太平洋」等の前置き・(kg…)の注記は呼び出し側で処理済み/別途判定する)。
function extractClassBase(heading: string): string | null {
  const m = heading.match(/(ストロー|フライ|バンタム|フェザー|ライト|ウェルター|ミドル|ライトヘビー|ヘビー|アトム|スーパーアトム)級/);
  return m ? m[0] : null;
}

// ── パンクラス公式ランキング(https://www.pancrase.co.jp/rls/ranking.html) ──
// <h4>フェザー級(…)</h4> ... <td class="rankingno|rankingnokop">1|王者|暫定王者</td> … <a>名前</a>
// 女子は見出しに「女子」の表記が無く、男子と同じ階級名(フライ級・ストロー級)が
// ページ後半で再度現れる形+女子専用の「アトム級」で構成される。そのため階級名の
// 出現回数で男子(初出)/女子(再出・またはアトム級)を判定する。
export function parsePancrase(html: string): OrgRankingData {
  const labelM = html.match(/(\d{1,2}月\d{1,2}日発表)/);
  const rankingLabel = labelM ? labelM[1] : "";
  const blocks = html.split(/<h4>/).slice(1);
  const raw: { weightClass: string; entries: { rank: string; officialName: string }[] }[] = [];
  const seenBase = new Set<string>();
  for (const b of blocks) {
    const head = b.slice(0, b.indexOf("</h4>"));
    const base = extractClassBase(head);
    if (!base) continue;
    // 「アトム級」は男子に存在しないため常に女子。それ以外は初出=男子・再出=女子。
    const isFemale = base === "アトム級" || seenBase.has(base);
    seenBase.add(base);
    const cls = isFemale ? `女子${base}` : base;

    const entries: { rank: string; officialName: string }[] = [];
    const rowRe = /<td class="(rankingno|rankingnokop)">([\s\S]*?)<\/td>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(b))) {
      const rank = stripTags(m[2]).replace(/\s/g, "");
      const officialName = m[3].replace(/\s+/g, " ").trim();
      if (rank && officialName) entries.push({ rank, officialName });
    }
    raw.push({ weightClass: cls, entries });
  }
  return {
    org: "pancrase",
    source: "パンクラス公式ランキング",
    sourceUrl: "https://www.pancrase.co.jp/rls/ranking.html",
    fetchedDate: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10),
    rankingLabel,
    classes: finalizeClasses(raw),
  };
}

// ── 修斗公式ランキング(https://www.shooto-mma.com/ranking/) ──
// <h4 id="世界フェザー級">…</h4> … <table class="champion">…chmp-name…</table>
// … <table class="ranking table"…> <tr><td>1</td>…<a class="fighter-mdl">名前 / ROMA</a> …
// 見出しIDには「世界」「環太平洋」「女子」等の接頭辞がそのまま付く。世界ランキングの
// みを対象にし(環太平洋は不使用)、女子は接頭辞をそのままMニュース表記(女子○○級)に使う。
export function parseShooto(html: string): OrgRankingData {
  const labelM = html.match(/委員会（([^）]+)）/);
  const rankingLabel = labelM ? labelM[1].split("／")[0] : "";
  const blocks = html.split(/<h4 id="/).slice(1);
  const raw: { weightClass: string; entries: { rank: string; officialName: string }[] }[] = [];
  for (const b of blocks) {
    const head = b.slice(0, b.indexOf(">"));
    if (/環太平洋/.test(head)) continue; // 環太平洋ランキングは対象外(世界ランキングのみ採用)
    const base = extractClassBase(head);
    if (!base) continue;
    const cls = /女子/.test(head) ? `女子${base}` : base;

    const entries: { rank: string; officialName: string }[] = [];
    // 王者
    const champ = b.match(/<table class="champion">[\s\S]*?<span class="chmp-name">\s*<a[^>]*>([^<]+)<\/a>/);
    if (champ) {
      const nm = champ[1].split("/")[0].replace(/\s+/g, " ").trim();
      if (nm) entries.push({ rank: "王者", officialName: nm });
    }
    // ランカー(ranking table 内の各行: 先頭td=順位, fighter-mdl の a テキスト先頭=日本語名)
    const tbl = b.match(/<table class="ranking table"[\s\S]*?<\/table>/);
    if (tbl) {
      const rowRe = /<tr>\s*<td>(\d+)<\/td>[\s\S]*?<a[^>]*class="fighter-mdl"[^>]*>([^<]+?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = rowRe.exec(tbl[0]))) {
        const nm = m[2].split("/")[0].replace(/\s+/g, " ").trim();
        if (nm) entries.push({ rank: m[1], officialName: nm });
      }
    }
    raw.push({ weightClass: cls, entries });
  }
  return {
    org: "shooto",
    source: "修斗公式ランキング",
    sourceUrl: "https://www.shooto-mma.com/ranking/",
    fetchedDate: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10),
    rankingLabel,
    classes: finalizeClasses(raw),
  };
}
