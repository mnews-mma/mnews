// パンクラス/修斗の公式ランキングHTMLをパースして、Mニュース5階級に絞った
// 順位データにする(純粋ロジック)。序列はmnewsが作らず団体公式の値をそのまま転載。
// 対象は フライ/バンタム/フェザー/ライト の4区分のみ(パンクラス/修斗にヘビーは無い)。
// ストロー・ウェルター・ミドル等の5階級外は「その階級ごと」スキップする。
import { FIGHTERS } from "./fighters";

// 掲載対象クラス(RIZIN準拠ラベル)。パンクラス/修斗の上限はミドルだが対象は4区分。
export const ORG_RANK_CLASSES = ["フライ級", "バンタム級", "フェザー級", "ライト級"] as const;
export type OrgRankClass = (typeof ORG_RANK_CLASSES)[number];
const IN_SCOPE = new Set<string>(ORG_RANK_CLASSES);

export interface RankEntry {
  rank: string; // "王者" / "暫定王者" / "1" 等、団体公式の値そのまま
  officialName: string; // 公式表記の選手名(日本語)
  slug: string | null; // DB内選手にマッチすれば slug(選手ページリンク用)
}
export interface RankedClass {
  weightClass: OrgRankClass;
  entries: RankEntry[];
}
export interface OrgRankingData {
  org: "pancrase" | "shooto";
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

// 5階級外を落とし、対象クラスだけ返す共通仕上げ。
function finalize(
  org: "pancrase" | "shooto",
  source: string,
  sourceUrl: string,
  rankingLabel: string,
  raw: { weightClass: string; entries: { rank: string; officialName: string }[] }[]
): OrgRankingData {
  const classes: RankedClass[] = [];
  const seenClass = new Set<string>();
  for (const c of raw) {
    if (!IN_SCOPE.has(c.weightClass)) continue; // 5階級外はスキップ
    if (seenClass.has(c.weightClass)) continue; // 初出のみ採用(男子KOP/世界が先。女子QUEEN・環太平洋の重複を落とす)
    seenClass.add(c.weightClass);
    const entries = c.entries
      .filter((e) => e.officialName)
      .map((e) => ({ rank: e.rank, officialName: e.officialName, slug: matchSlug(e.officialName) }));
    if (entries.length > 0) classes.push({ weightClass: c.weightClass as OrgRankClass, entries });
  }
  return {
    org,
    source,
    sourceUrl,
    fetchedDate: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10),
    rankingLabel,
    classes,
  };
}

// クラス見出し文字列を RIZIN5階級ラベルへ(例「世界フェザー級ランキング」「フェザー級(65.8kg…)」)。
function toClassLabel(heading: string): string {
  // 女子は今回対象外。修斗の環太平洋(Pacific Rim)ランキングも使わない(世界ランキングのみ)。
  if (/女子|QUEEN|クイーン|JEWELS|WOMEN|環太平洋/i.test(heading)) return "";
  const m = heading.match(/(ストロー|フライ|バンタム|フェザー|ライト|ウェルター|ミドル|ヘビー)級/);
  return m ? m[0] : "";
}

// ── パンクラス公式ランキング(https://www.pancrase.co.jp/rls/ranking.html) ──
// <h4>フェザー級(…)</h4> ... <td class="rankingno|rankingnokop">1|王者|暫定王者</td> … <a>名前</a>
export function parsePancrase(html: string): OrgRankingData {
  const labelM = html.match(/(\d{1,2}月\d{1,2}日発表)/);
  const rankingLabel = labelM ? labelM[1] : "";
  const blocks = html.split(/<h4>/).slice(1);
  const raw: { weightClass: string; entries: { rank: string; officialName: string }[] }[] = [];
  for (const b of blocks) {
    const head = b.slice(0, b.indexOf("</h4>"));
    const cls = toClassLabel(head);
    if (!cls) continue;
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
  return finalize(
    "pancrase",
    "パンクラス公式ランキング",
    "https://www.pancrase.co.jp/rls/ranking.html",
    rankingLabel,
    raw
  );
}

// ── 修斗公式ランキング(https://www.shooto-mma.com/ranking/) ──
// <h4 id="世界フェザー級">…</h4> … <table class="champion">…chmp-name…</table>
// … <table class="ranking table"…> <tr><td>1</td>…<a class="fighter-mdl">名前 / ROMA</a> …
export function parseShooto(html: string): OrgRankingData {
  const labelM = html.match(/委員会（([^）]+)）/);
  const rankingLabel = labelM ? labelM[1].split("／")[0] : "";
  const blocks = html.split(/<h4 id="/).slice(1);
  const raw: { weightClass: string; entries: { rank: string; officialName: string }[] }[] = [];
  for (const b of blocks) {
    const head = b.slice(0, b.indexOf(">"));
    const cls = toClassLabel(head);
    if (!cls) continue;
    // 環太平洋など2つ目以降のブロックに引きずられないよう、次のh4想定範囲までに限定
    const seg = b;
    const entries: { rank: string; officialName: string }[] = [];
    // 王者
    const champ = seg.match(/<table class="champion">[\s\S]*?<span class="chmp-name">\s*<a[^>]*>([^<]+)<\/a>/);
    if (champ) {
      const nm = champ[1].split("/")[0].replace(/\s+/g, " ").trim();
      if (nm) entries.push({ rank: "王者", officialName: nm });
    }
    // ランカー(ranking table 内の各行: 先頭td=順位, fighter-mdl の a テキスト先頭=日本語名)
    const tbl = seg.match(/<table class="ranking table"[\s\S]*?<\/table>/);
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
  return finalize(
    "shooto",
    "修斗公式ランキング",
    "https://www.shooto-mma.com/ranking/",
    rankingLabel,
    raw
  );
}
