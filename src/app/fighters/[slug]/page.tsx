import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { FIGHTERS, getFighter, calcFighterRates, findFighterSlugByName, fighterDisplayName, FightRecord } from "@/lib/fighters";
import { resolveOpponentSlug } from "@/lib/fighterLinkOverrides";
import { SOURCES } from "@/lib/sources";
import { resolveFighterCached, resolveFightersCached } from "@/lib/fighterRecordsCache";
import { getVisibleFighterSlugs } from "@/lib/visibleFighters";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";
import { LISTED_EVENT_RESULTS } from "@/lib/eventResults";
import { shiftDateStr } from "@/lib/eventCountdown";
import { findNextAppearance } from "@/lib/events";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { fetchOrgTagOverrides } from "@/lib/orgTagOverridesData";
import { computeFighterTags, OrgTagKey } from "@/lib/orgTags";
import { MethodButterfly, NextFightCompare } from "@/components/FighterVisuals";
import NextFightCardV2 from "@/components/matchup/NextFightCardV2";
import { resolveMatchupUiV2ForDynamicPage } from "@/lib/matchupUi";
import { fetchDivisionRankings } from "@/lib/mnewsRatingData";
import { PUBLISHED_DIVISIONS, DIVISION_SLUG } from "@/lib/mnewsRating/divisions";
import { getDisplayRank } from "@/lib/mnewsRating/divisionRankingView";
import { buildFighterTitle as buildFighterMetaTitle, buildFighterDescription } from "@/lib/seoTemplates";
import { MULTI_ORG_RECORD_LABEL, shouldPreferMultiOrgRecord, withMultiOrgRecord } from "@/lib/mnewsRating/multiOrgRecord";
import { getMultiOrgSummaryCached, resolveDisplayRecordCached } from "@/lib/mnewsRating/multiOrgRecordCache";
import { SHOW_MULTI_ORG_RECORD } from "@/lib/featureFlags";
import { normalizeDecisionScorePerspective } from "@/lib/decisionScorePerspective";
import { historyReconciles } from "@/lib/fighterRecordIntegrity";

// 選手DBとイベントデータで全角/半角スペースの有無が揺れることがある
// (例: "太田 忍" vs "太田忍")ため、次戦の「自分/相手」判定は正規化して比較する
// (events.tsのfindNextFight内部の判定と同じ基準に揃える)。
const normSpace = (s: string) => s.replace(/[\s　]/g, "");

// 団体タグから回遊先(ランキング/一覧)へのリンク。UFC/ONEは対応ページが無いためnull。
const TAG_LINK: Record<OrgTagKey, string | null> = {
  ufc: null,
  rizin: "/ranking/rizin",
  deep: "/deep-2026",
  pancrase: "/ranking/pancrase",
  shooto: "/ranking/shooto",
  one: null,
};

// Wikipediaから戦績テーブルを取得するためビルド時ではなくリクエスト時に取得する。
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const seed = getFighter(slug);
  if (!seed) return { title: "選手が見つかりません | Mニュース", robots: { index: false, follow: false } };
  // Xカードツールの手指定階級ラベル(?wc=)を og:image に反映(空欄なら付けない)。
  const wcRaw = (await searchParams).wc;
  const wc = (Array.isArray(wcRaw) ? wcRaw[0] : wcRaw ?? "").trim();
  const ogPath = `/api/og/fighter/${slug}${wc ? `?wc=${encodeURIComponent(wc)}` : ""}`;
  // Wikipedia から取得した実際の戦績を meta にも反映（seed と乖離させない）
  const fighter = await resolveFighterCached(seed);
  const orgLabel = SOURCES[fighter.org].label;
  // AI RIZINランキング掲載中の選手のみランク句を出す(本文のランクバッジと同じ判定・
  // 同じhidden除外を共有する。findRankingLinkはgetDisplayRank(表示ランクヘルパー)
  // 経由=ハードコード禁止・16位以下は非表示)。
  const rankingLink = seed.hidden ? null : await findRankingLink(slug);
  // 本文のsuppressNoRecordRow(下のFighterPage本体)と同じ判定をmetaにも適用する。
  // 1行目が抑制対象の選手は、meta descriptionも4団体合算(2行目)の数値を使う
  // (shouldPreferMultiOrgRecord/resolveDisplayRecord参照)。
  const metaFighter = SHOW_MULTI_ORG_RECORD ? await resolveDisplayRecordCached(fighter) : fighter;
  const metaInput = {
    nameJa: fighterDisplayName(fighter),
    nameEn: fighter.nameEn,
    orgLabel,
    noRecordData: !!metaFighter.noRecordData,
    wins: metaFighter.wins,
    losses: metaFighter.losses,
    draws: metaFighter.draws,
    historyLength: metaFighter.history.length,
    latestDate: metaFighter.history[0]?.date ?? null,
    latestEvent: metaFighter.history[0]?.event ?? null,
    rank: rankingLink ? { divisionName: rankingLink.divisionName, label: rankingLink.label } : null,
  };
  const meta = pageMetadata({
    title: buildFighterMetaTitle(metaInput),
    description: buildFighterDescription(metaInput),
    path: `/fighters/${fighter.slug}`,
    image: {
      url: ogImagePath(ogPath),
      width: 1200,
      height: 630,
      alt: `${fighterDisplayName(fighter)} 戦績カード`,
    },
  });
  // hidden 選手(Mレーティングが乗るまで伏せる新規投入ぶん)は noindex にする。
  if (seed.hidden) meta.robots = { index: false, follow: false };
  return meta;
}

function breakAtDot(name: string) {
  const parts = name.split("・");
  return parts.map((part, i) => (
    <span key={i}>{part}{i < parts.length - 1 && <>・<wbr /></>}</span>
  ));
}

const RESULT_LABEL: Record<string, string> = { win: "勝", loss: "敗", draw: "分", nc: "無効" };
const RESULT_CLASS: Record<string, string> = {
  win: "result-win",
  loss: "result-loss",
  draw: "result-draw",
  nc: "result-draw",
};

// Wikipedia由来(history)・3団体bout由来(computeMultiOrgBoutTable)のどちらから
// 来た行も同じ対戦テーブルで描画するための共通形。
interface DisplayBoutRow {
  date: string;
  opponentName: string;
  opponentSlug: string | null;
  result: "win" | "loss" | "draw" | "nc";
  method: string;
  event: string;
}

// data/の3団体boutが持つopponentSlugは、fighters.tsとのslug完全一致で
// 突合済みだが、hidden選手への内部リンクは張らない(既存のfindFighterSlugByName
// と同じ規則)ため、ここでも同様にhidden選手は非リンク(生表記)にする。
function resolveLinkableOpponentSlug(oppSlug: string | null): string | null {
  if (!oppSlug) return null;
  const opponent = getFighter(oppSlug);
  return opponent && !opponent.hidden ? oppSlug : null;
}

// 対戦テーブルの/resultsリンクの大会突合。掲載中の大会側の正規化(スペース除去・
// 大会番号の抽出)はモジュールスコープで1回だけ行い、リクエストごとに作り直さない。
// /fighters/[slug] は force-dynamic(リクエスト毎にSSR)で、1ページあたり
// bout行数ぶん突合が走るため、ここで毎回全大会を正規化し直すと
// CPU時間がページビューに比例して増える。
interface EventIndexEntry {
  slug: string;
  date: string;
  /** スペース除去済みの大会名。Wikipedia側は "RIZIN 師走の超強者祭り" のように
   *  スペースが入ることがあり、こちらのデータ(スペース無し)と食い違うため。 */
  normName: string;
  /** 大会番号(数字列)の並び。"DEEP JEWELS 4" と "DEEP JEWELS 48" のように
   *  数字の途中で切れた部分一致を、別大会として弾くための識別子。 */
  digitRuns: string;
  headIsDigit: boolean;
  tailIsDigit: boolean;
}

const normEventName = (s: string) => s.replace(/\s/g, "");
const isDigitChar = (c: string | undefined) => !!c && /[0-9０-９]/.test(c);
const eventDigitRuns = (s: string) => (s.match(/[0-9０-９]+/g) ?? []).join(",");

// 索引はLISTED_EVENT_RESULTS(unlisted除外済み)から作る。unlisted大会は
// /results一覧・sitemapから除外され個別ページもnoindexであり、選手ページから
// リンクを張らない。除外判定はeventResults.tsのisListedEvent()に集約しており、
// ここで条件式を書き直さない。
const EVENT_INDEX: EventIndexEntry[] = LISTED_EVENT_RESULTS.map((e) => {
  const normName = normEventName(e.eventName);
  return {
    slug: e.slug,
    date: e.date,
    normName,
    digitRuns: eventDigitRuns(normName),
    headIsDigit: isDigitChar(normName[0]),
    tailIsDigit: isDigitChar(normName[normName.length - 1]),
  };
});

// 正規化後の大会名が完全一致する場合の高速経路(リンクの大半がこちら)。
const EVENT_BY_NORM_NAME = new Map<string, EventIndexEntry[]>();
for (const e of EVENT_INDEX) {
  const list = EVENT_BY_NORM_NAME.get(e.normName);
  if (list) list.push(e);
  else EVENT_BY_NORM_NAME.set(e.normName, [e]);
}

// (大会名, 試合日) → slug の解決結果メモ。組み合わせはdata/由来で有限
// (約2,700通り)なので、同じ選手ページが繰り返しSSRされても再計算しない。
const eventSlugMemo = new Map<string, string | null>();

// 大会名（RIZIN.52など）からMニュース掲載の結果ページを探す。
// 表記揺れ（全角/半角・サブタイトル付き等）があるため双方向の部分一致で見るが、
// 文字列一致だけでは別大会を掴みうる("DEEP JEWELS 4"→"DEEP JEWELS 48")ため、
// 最後に開催日で同一性を確認する。日付比較はeventCountdown.tsのshiftDateStr
// (純粋な暦日算術)経由で行い、この場で日付文字列をパースしない。
function findEventSlug(eventName: string, boutDate?: string): string | null {
  const memoKey = `${eventName}\u0000${boutDate ?? ""}`;
  const memo = eventSlugMemo.get(memoKey);
  if (memo !== undefined) return memo;
  const resolved = resolveEventSlug(eventName, boutDate);
  eventSlugMemo.set(memoKey, resolved);
  return resolved;
}

function resolveEventSlug(eventName: string, boutDate?: string): string | null {
  const target = normEventName(eventName);
  const nameMatches =
    EVENT_BY_NORM_NAME.get(target) ?? EVENT_INDEX.filter((e) => matchesEventName(target, e));
  if (nameMatches.length === 0) return null;

  // 2部制・日跨ぎ表記のブレを吸収するため前後1日まで許容する。
  const candidates = boutDate
    ? nameMatches.filter((e) =>
        [boutDate, shiftDateStr(boutDate, 1), shiftDateStr(boutDate, -1)].includes(e.date),
      )
    : nameMatches;

  // 候補が1件に絞れない場合はリンクしない(fail-closed)。同じ日に紛らわしい
  // 大会名が2つ以上ある(修斗の昼夜開催、DEEPとDEEP JEWELSの同日開催など)と
  // 部分一致+日付だけでは特定できず、先頭を採ると誤リンクになる。このページは
  // force-dynamicでリクエスト時にdata/を取りに行くため、ビルド時ゲートが見て
  // いないデータでも同じ判断が要る。
  if (candidates.length !== 1) return null;
  return candidates[0].slug;
}

function matchesEventName(target: string, e: EventIndexEntry): boolean {
  const en = e.normName;
  if (en === target) return true;

  // (A) 表示名のほうが長いケース(掲載大会名 + 【階級タイトルマッチ】等の装飾)。
  //     掲載大会名がそのまま含まれていればよいが、"RIZIN.5" が
  //     "RIZIN.51【…】" にマッチするような、大会番号の途中で切れた一致は除く
  //     (掲載大会名の端が数字で、その続きも数字になっている場合のみ弾く。
  //      "DEEP 131 IMPACT" + "25th Anniversary" のように数字列が分断されて
  //      いないケースは通す)。
  for (let i = target.indexOf(en); i !== -1; i = target.indexOf(en, i + 1)) {
    if (e.headIsDigit && isDigitChar(target[i - 1])) continue;
    if (e.tailIsDigit && isDigitChar(target[i + en.length])) continue;
    return true;
  }

  // (B) 掲載大会名のほうが長いケース(会場名・サブタイトル付き)。
  //     "DEEP JEWELS 4"→"DEEP JEWELS 48"、"DEEP OSAKA IMPACT"→
  //     "DEEP OSAKA IMPACT 2026 3rd ROUND" のような別大会への誤リンクを防ぐ
  //     ため、大会番号(数字列)が両者で完全一致する場合のみ許可する。
  //     大会番号を持たない表示名("プロフェッショナル修斗公式戦"等)は
  //     大会を特定できないため、この方向ではリンクしない。
  if (target.length >= 8 && en.includes(target)) {
    const runs = eventDigitRuns(target);
    if (runs !== "" && runs === e.digitRuns) return true;
  }
  return false;
}

// 選手が公開中のAI RIZINランキングに掲載されているか(王者/表示ランク内の
// ランカーいずれか)を公開4階級ぶん確認し、最初に見つかった階級への内部リンク
// 情報を返す(rank(順位)・delta(順位変動、algorithmVersion変更日等はnull)の
// み使用し、rating/rawRatingは一切参照しない=レート非公開方針を維持)。
// getDisplayRank(RANKING_DISPLAY_CAP=15)経由で判定するため、16位以下は
// バッジ非表示(表示上は未ランク扱い)。/rankings各階級一覧・X投稿のランキング
// 注入と同じキャップ・同じ単一ヘルパーを共有する。
interface RankingLinkInfo {
  divisionSlug: string;
  divisionName: string;
  label: "王者" | number;
  delta: number | null;
}
async function findRankingLink(slug: string): Promise<RankingLinkInfo | null> {
  for (const division of PUBLISHED_DIVISIONS) {
    const divisionSlug = DIVISION_SLUG[division];
    const data = await fetchDivisionRankings(divisionSlug);
    if (!data) continue;
    const displayRank = getDisplayRank(data, slug);
    if (displayRank === null) continue;
    if (displayRank === "champion") return { divisionSlug, divisionName: division, label: "王者", delta: null };
    const entry = data.entries.find((e) => e.fighterId === slug)!;
    return { divisionSlug, divisionName: division, label: displayRank, delta: entry.delta };
  }
  return null;
}

// バッジカードの外枠(赤枠・角丸12px・白背景ブロック+赤背景ブロック+chevron)を
// ランカー用/王者用で共通化する。中身(左ブロックの表示・リンク先)だけ呼び出し側で変える。
function BadgeCardShell({
  href,
  leftBlock,
  eyebrow,
  title,
}: {
  href: string;
  leftBlock: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        display: "flex",
        alignItems: "stretch",
        maxWidth: 340,
        margin: "2px 0 10px",
        borderRadius: 12,
        border: "1px solid var(--accent)",
        overflow: "hidden",
        textDecoration: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          minWidth: 60,
          padding: "8px 12px",
          background: "var(--accent)",
          color: "#fff",
        }}
      >
        {leftBlock}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          minWidth: 0,
          padding: "8px 12px",
          background: "var(--s1)",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", color: "var(--accent)" }}>{eyebrow}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "0 10px", color: "var(--muted)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </div>
    </a>
  );
}

// ランクバッジカード(A案): 数字を主役にしたUFC風の「格を示すバッジ」。
// AI RIZINランキングに順位付きで掲載されているランカー専用(王者はfindRankingLink
// 側でlabel="王者"として区別され、下のChampionBadgeCardで別デザイン表示する。
// AIの看板の下に事実データの王者を出すと「AIが王者を決めた」と誤読されるため、
// この2つは意図的に分離している)。レート数値はここでも一切参照しない
// (rank/delta以外のフィールドを受け取らない型なので構造的に混入しない)。
function RankBadgeCard({ info }: { info: RankingLinkInfo & { label: number } }) {
  const deltaMark = info.delta ? (info.delta > 0 ? "▲" : info.delta < 0 ? "▼" : null) : null;
  return (
    <BadgeCardShell
      href={`/rankings/${info.divisionSlug}`}
      leftBlock={
        <>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1px" }}>RANK</div>
          <div style={{ fontSize: 22, fontWeight: 500, lineHeight: 1, whiteSpace: "nowrap" }}>#{info.label}</div>
        </>
      }
      eyebrow="AI RIZIN RANKING"
      title={
        <>
          {info.divisionName}
          {deltaMark && <span style={{ marginLeft: 6, color: info.delta! > 0 ? "#16a34a" : "#dc2626" }}>{deltaMark}</span>}
        </>
      }
    />
  );
}

// 王者バッジカード: champions.ts由来の事実データ(RIZIN公式認定)専用の別デザイン。
// 「AI RIZIN RANKING」の看板・番号は一切出さない(AI算出のランキングとは出所が
// 別であることを見た目でも区別する)。リンク先もAIランキングページではなく、
// 事実としての王者を示す公式ランキング・王者ページにする。
function ChampionBadgeCard({ divisionName }: { divisionName: string }) {
  return (
    <BadgeCardShell
      href="/ranking/rizin"
      leftBlock={
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M9 13.5 7 22l5-3 5 3-2-8.5" />
        </svg>
      }
      eyebrow="RIZIN 王者"
      title={divisionName}
    />
  );
}

export default async function FighterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const seed = getFighter(slug);
  if (!seed) notFound();
  const isV2 = await resolveMatchupUiV2ForDynamicPage(searchParams);

  const fighter = await resolveFighterCached(seed);
  const { history, wins, losses, draws, nickname, birthPlace, age, noRecordData } = fighter;
  // 戦績テーブルの対戦相手名リンク用(no-data/hiddenの選手はテキスト表示にする)。
  const visibleSlugs = await getVisibleFighterSlugs();
  // 団体タグ(導出・新規公開昇格分のみ)。既存公開選手は空。
  const [orgRankings, orgTagOverrides] = await Promise.all([fetchOrgRankings(), fetchOrgTagOverrides()]);
  const orgTags = computeFighterTags(fighter, orgRankings, orgTagOverrides);
  // AI RIZINランキング掲載中なら該当階級ページへ内部リンク(回遊性向上)。
  const rankingLink = seed.hidden ? null : await findRankingLink(slug);
  const appearance = findNextAppearance(fighter.nameJa);
  const nextFight = appearance?.kind === "bout" ? { event: appearance.event, bout: appearance.bout } : null;
  const { winRate, finishRate } = calcFighterRates(fighter);

  // 戦績スタットカード2行目用: RIZIN+修斗+パンクラス+DEEPの4団体公式データを
  // 毎回合算する(fighters.tsのwins/losses/historyは参照しない。詳細は
  // src/lib/mnewsRating/multiOrgRecord.tsのコメント参照)。
  const multiOrgSummary = await getMultiOrgSummaryCached(fighter.slug);
  const multiOrgRecord = multiOrgSummary.record;
  const hasMultiOrgRecord =
    multiOrgRecord.wins > 0 || multiOrgRecord.losses > 0 || multiOrgRecord.draws > 0;
  // 指示書A(2026-08-01): 2行目(4団体集計)にも1行目(Wikipedia通算)と同じ
  // KO/一本/判定の内訳・勝率・フィニッシュ率を出す(出典で情報量が割れるのを防ぐ)。
  // bout table自体はdisplayHistory(下)とも共有し、二重に計算しない。
  const multiOrgBoutRows = SHOW_MULTI_ORG_RECORD ? multiOrgSummary.rows : [];
  const multiOrgRates = hasMultiOrgRecord ? multiOrgSummary.rates : null;
  // Wikipedia通算が無い(noRecordData)が4団体合算(2行目)は取れている選手
  // (Wikiを持たない修斗・パンクラス・DEEP選手が該当)は、「通算戦績 データなし」を
  // 出さず2行目のみを表示する。両方無い場合のみ従来どおり「データなし」。
  //
  // 指示書R-2(2026-08-01): 1行目にデータはあるが単一ソース由来で限定的な選手
  // (needsReview/recordFromResults。詳細は指示書R-1bの調査参照)は、2行目(4団体
  // 合算)の総試合数が1行目を上回る場合に限り1行目を出さない。判定ロジックは
  // src/lib/mnewsRating/multiOrgRecord.tsのshouldPreferMultiOrgRecordに集約している
  // (次戦カード・同階級選手カード・meta descriptionもこの1関数を経由する)。
  const limitedSourceRow1Exceeded = shouldPreferMultiOrgRecord(fighter, wins, losses, draws, multiOrgRecord);
  const suppressNoRecordRow =
    (noRecordData || limitedSourceRow1Exceeded) && SHOW_MULTI_ORG_RECORD && hasMultiOrgRecord;
  // 次戦カード(NextFightCardV2/NextFightCompare)の自分側データ。上のsuppressNoRecordRow
  // (=1行目を出さず2行目のみ表示)と矛盾しないよう、抑制対象の選手は次戦カードの
  // 「自分」側も2行目(4団体合算)の値・historyに差し替える(同じ判定・同じ集計結果を
  // 再利用、新規の数値生成はしない)。
  const nextFightSelf =
    suppressNoRecordRow && multiOrgRates
      ? withMultiOrgRecord(fighter, multiOrgRecord, multiOrgRates, multiOrgBoutRows)
      : fighter;

  // 対戦テーブル: ヘッダー(通算戦績スタットカード)と同じ判定基準
  // (suppressNoRecordRow)で参照元を選ぶ。suppressNoRecordRow中は2行目
  // (4団体合算)がヘッダーの正であり、テーブルも同じmultiOrgBoutRowsを使う
  // (指示書R-9: ヘッダーとテーブルが別ソースを見ていた食い違いの解消。
  // out/header-table-row-mismatch-summary.md参照)。それ以外(通常の
  // Wikipedia選手)はhistoryを使い、historyも無い選手(noRecordData)は
  // 従来どおり4団体boutにフォールバックする。
  const toDisplayFromMultiOrg = (): DisplayBoutRow[] =>
    multiOrgBoutRows.map((b) => ({
      date: b.date,
      opponentName: b.opponentName,
      opponentSlug: resolveLinkableOpponentSlug(b.opponentSlug),
      result: b.result,
      method: b.method,
      event: b.event,
    }));
  const displayHistory: DisplayBoutRow[] = suppressNoRecordRow
    ? toDisplayFromMultiOrg()
    : history.length > 0
      ? history.map((h) => ({
          date: h.date,
          opponentName: h.opponent,
          opponentSlug: resolveOpponentSlug(h.opponent, slug, visibleSlugs, { fighterSlug: slug, date: h.date }),
          result: h.result,
          method: h.method,
          event: h.event,
        }))
      : SHOW_MULTI_ORG_RECORD
        ? toDisplayFromMultiOrg()
        : [];
  // 指示書N(2026-08-04): ヘッダーは1行目(Wikipedia等の通算戦績)由来なのに、
  // その選手自身のhistoryが空でテーブルだけ4団体合算にフォールバックしている
  // 状態を検出する(住村竜市朗が該当。Wikipedia記事にinfobox集計値はあるが
  // {{Fight-cont}}の個別試合節が無く、historyが空のまま)。この場合ヘッダーの
  // 総数(1行目)とテーブルの行数(4団体分のみ)が一致しないのは「ヘッダーが
  // 誤り」ではなく「テーブルがRIZIN/DEEP/パンクラス/修斗の試合しか
  // 持っていない」ことの表れなので、対応方針はヘッダー/テーブルの数値を
  // 揃えることではなく、テーブル側にその旨を注記することにした
  // (shouldPreferMultiOrgRecordは変更しない・対象選手を名指ししない一般条件)。
  const tableIsMultiOrgFallbackUnderRowOneHeader =
    !suppressNoRecordRow && history.length === 0 && SHOW_MULTI_ORG_RECORD && displayHistory.length > 0;
  // 勝ち方/負け方バタフライ図(MethodButterfly)用。ヘッダー・対戦テーブルと
  // 同じdisplayHistory(suppressNoRecordRow基準で1行目/4団体合算のどちらかに
  // 揃え済み)をFightRecord互換の形に詰め替えるだけで、新規の集計呼び出しは
  // 増やさない(指示書R-9のヘッダー/テーブル食い違い解消と同じ考え方をここにも
  // 適用。out/hoshuyama-card-bar-mismatch-summary.md参照)。
  const methodButterflyHistory: FightRecord[] = displayHistory.map((h) => ({
    date: h.date,
    opponent: h.opponentName,
    result: h.result,
    method: h.method,
    event: h.event,
    round: "",
  }));
  // チャートの見出し(N勝/N敗)は直上のカード(1行目/2行目のどちらが表示中か
  // =suppressNoRecordRowで判定)と必ず同じ集計値を使う。historyReconciles=false
  // (history再集計の件数がその集計値と食い違う。Wikipedia記事側の内部不整合等)の
  // 場合はチャート自体を非表示にする(指示書①、2026-08-03: 内訳を推測で
  // 埋め合わせる=捏造になるため、揃わない選手は出さない一択)。
  const chartTotals = suppressNoRecordRow
    ? { wins: multiOrgRecord.wins, losses: multiOrgRecord.losses, draws: multiOrgRecord.draws }
    : { wins, losses, draws };
  const chartReliable = historyReconciles({ ...chartTotals, history: methodButterflyHistory });

  // 次戦の対戦相手情報(次戦プレビュー用)。相手がDB外/戦績データなしの場合は
  // entry=null になり、バナーのみ表示(比較・共通対戦相手は出さない=捏造ゼロ)。
  // 指示書(2026-08-03、対戦カード相手側ソース混在バグ): 自分側(nextFightSelf)は
  // resolveDisplayRecordCached相当の補正(shouldPreferMultiOrgRecord判定→
  // 4団体合算への差し替え)を経由するのに対し、相手側だけfetchFighterRecords()の
  // 生値を直接引いていたため、同一選手でもページによって戦績が食い違っていた
  // (例: sarami/motonomikiで相手として参照される数字がヘッダーと不一致)。
  // sameWeightClass(下)と同じ経路(getFighter→resolveFighterCached→
  // resolveDisplayRecordCached)に揃え、自分側と同じ判定・同じ集計結果を使う。
  const nextOpp = nextFight
    ? await (async () => {
        const name =
          normSpace(nextFight.bout.fighterA) === normSpace(fighter.nameJa)
            ? nextFight.bout.fighterB
            : nextFight.bout.fighterA;
        const oppSlug = findFighterSlugByName(name, slug, visibleSlugs);
        const oppSeed = oppSlug ? getFighter(oppSlug) : undefined;
        if (!oppSeed) return { name, slug: oppSlug, entry: null };
        const oppFighter = await resolveFighterCached(oppSeed);
        if (oppFighter.noRecordData) return { name, slug: oppSlug, entry: null };
        const entry = SHOW_MULTI_ORG_RECORD ? await resolveDisplayRecordCached(oppFighter) : oppFighter;
        return { name, slug: oppSlug, entry };
      })()
    : null;

  // 同階級の選手: seed値(常に0-0-0)ではなく解決後の実戦績を使い、no-data(戦績実体なし)
  // は /fighters 一覧と同基準で除外する(0-0-0で出さない)。同階級候補だけ解決する(軽量)。
  const sameClassSeeds = FIGHTERS.filter(
    (f) => f.slug !== slug && f.weightClass === fighter.weightClass && !f.hidden
  );
  // 表示直前にshouldPreferMultiOrgRecord判定を適用し、1行目が限定的な選手
  // (needsReview/recordFromResults超過)のカードも自分のページと矛盾しない
  // 数値(4団体合算)にする(次戦カードと同じ判定・選手ごとにキャッシュされた
  // 集計結果を再利用する)。ランダム抽出(slice(0,4))は解決前に確定させ、
  // 選ばれた4名分だけ計算する(既存の挙動を維持)。
  const sameWeightClassCandidates = (await resolveFightersCached(sameClassSeeds))
    .filter((f) => !f.noRecordData)
    .map((f) => ({ f, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 4)
    .map(({ f }) => f);
  const sameWeightClass = SHOW_MULTI_ORG_RECORD
    ? await Promise.all(sameWeightClassCandidates.map((f) => resolveDisplayRecordCached(f)))
    : sameWeightClassCandidates;

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "選手戦績一覧", href: "/fighters" },
    { label: fighter.nameJa },
  ];

  // sameAs: Wikipedia記事へのエンティティ紐づけ(Knowledge Graph連携)。
  // データがある選手のみ。捏造せず wikiTitle があるものだけ URL 化する。
  const sameAs = [
    fighter.wikiTitleJa
      ? `https://ja.wikipedia.org/wiki/${encodeURIComponent(fighter.wikiTitleJa.replace(/ /g, "_"))}`
      : null,
    fighter.wikiTitleEn
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(fighter.wikiTitleEn.replace(/ /g, "_"))}`
      : null,
  ].filter((u): u is string => !!u);

  // affiliation: 所属団体。fighter.org は必須フィールド(未設定選手は存在しない)ため
  // 常に値を持つ。既存の SOURCES 定義(ランキングページ等と共通)から団体名・URLを取得。
  const orgDef = SOURCES[fighter.org];

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: fighter.nameJa,
    alternateName: [fighter.nameEn, ...(nickname ? [nickname] : [])],
    jobTitle: "総合格闘家",
    url: `${SITE_URL}/fighters/${fighter.slug}`,
    ...(birthPlace ? { birthPlace: { "@type": "Place", name: birthPlace } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    affiliation: { "@type": "SportsOrganization", name: orgDef.label, url: orgDef.url },
  };

  // ProfilePage: 選手ページ自体が「その選手のプロフィールページである」ことを
  // 明示するラッパー(mainEntity=Person)。レート数値は一切含めない。
  const profilePageLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${fighter.nameJa}（${orgDef.label}）の戦績・試合結果`,
    url: `${SITE_URL}/fighters/${fighter.slug}`,
    mainEntity: personLd,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageLd) }}
      />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />

        {/* 選手名 */}
        <h1 className="fighter-page-name">{fighterDisplayName(fighter)}</h1>
        {fighter.nameEn && <div className="fighter-name-en">{fighter.nameEn}</div>}

        {/* ニックネーム */}
        {nickname && <div className="fighter-page-nickname">{nickname}</div>}

        {/* 団体タグ＋階級をチップ体裁で統一(区切り"/"や細字添字は廃止・/fighters カードと同体裁)。
            タグ無しでも階級チップは常に表示。org由来のフォールバックバッジは出さない。 */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: "10px 0 2px" }}>
          {orgTags.map((t) => {
            const chip = (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 5,
                  color: "#fff",
                  background: SOURCES[t.key].color,
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
                {t.rank ? ` ${/^\d+$/.test(t.rank) ? t.rank + "位" : t.rank}` : ""}
              </span>
            );
            return TAG_LINK[t.key] ? (
              <a key={t.key} href={TAG_LINK[t.key]!} style={{ textDecoration: "none" }}>
                {chip}
              </a>
            ) : (
              <span key={t.key}>{chip}</span>
            );
          })}
          {/* 階級チップ(中立色・org と区別) */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 5,
              color: "var(--muted)",
              background: "transparent",
              border: "1px solid var(--border)",
              whiteSpace: "nowrap",
            }}
          >
            {fighter.weightClass}
          </span>
        </div>

        {/* AI RIZINランキング掲載中の選手のみ、ランクバッジカードで該当階級ページへ
            リンク(レート数値は出さない。rank/deltaのみ使うRankingLinkInfo型のため
            構造的にレートが混入しない)。 */}
        {rankingLink &&
          (rankingLink.label === "王者" ? (
            <ChampionBadgeCard divisionName={rankingLink.divisionName} />
          ) : (
            <RankBadgeCard info={rankingLink as RankingLinkInfo & { label: number }} />
          ))}

        {/* 次戦プレビュー: バナー行 + (相手がDB内なら)戦績比較・共通対戦相手。
            v2プレビュー(?ui=new)では、相手の実データが揃っている場合のみ新デザイン
            (NextFightCardV2)に差し替える。データが無い場合は旧来のバナーのみ表示に
            フォールバックする(捏造ゼロ・タペを描けない状態で無理に新デザインを出さない)。 */}
        {nextFight && nextOpp && isV2 && !noRecordData && nextOpp.slug && nextOpp.entry ? (
          <NextFightCardV2
            selfName={fighterDisplayName(fighter)}
            self={nextFightSelf}
            eventSlug={nextFight.event.slug}
            eventDate={nextFight.event.date}
            eventName={nextFight.event.eventName}
            weightClass={nextFight.bout.weightClass}
            opponentName={nextOpp.name}
            opponentSlug={nextOpp.slug}
            opponent={nextOpp.entry}
            visibleSlugs={visibleSlugs}
          />
        ) : (
          nextFight &&
          nextOpp && (
            <div className="fighter-next-fight" style={{ display: "block" }}>
              <div className="fighter-next-fight-row">
                <span className="fighter-next-fight-label">次戦</span>
                <a href={`/events/${nextFight.event.slug}`} className="fighter-next-fight-link">
                  {nextFight.event.date} {nextFight.event.eventName}
                </a>
                <span className="fighter-next-fight-vs">vs</span>
                {nextOpp.slug ? (
                  <a href={`/fighters/${nextOpp.slug}`} className="fighter-next-fight-link">
                    {nextOpp.name}
                  </a>
                ) : (
                  <span>{nextOpp.name}</span>
                )}
                <span className="fighter-next-fight-weight">{nextFight.bout.weightClass}</span>
              </div>
              {!noRecordData && nextOpp.slug && nextOpp.entry && (
                <NextFightCompare
                  selfName={fighterDisplayName(fighter)}
                  self={nextFightSelf}
                  opponentName={nextOpp.name}
                  opponentSlug={nextOpp.slug}
                  opponent={nextOpp.entry}
                  visibleSlugs={visibleSlugs}
                />
              )}
            </div>
          )
        )}

        {/* 参戦予定バナー（対戦カード未定。カード確定後は上の次戦表示に自動で切替） */}
        {appearance?.kind === "expected" && (
          <div className="fighter-next-fight">
            <span className="fighter-next-fight-label">参戦予定</span>
            <a href={`/events/${appearance.event.slug}`} className="fighter-next-fight-link">
              {appearance.event.date} ／ {appearance.event.eventName}
            </a>
            {appearance.event.venue && <> ／ {appearance.event.venue}</>}
            {" ／ 対戦相手未定"}
          </div>
        )}

        {/* 戦績スタットカード(生涯戦績が取れない選手は「データなし」を明示)。
            ただしWikipedia通算が無くても3団体合算(2行目)が取れている選手は
            この1行目自体を出さず、下の2行目のみを表示する(suppressNoRecordRow)。 */}
        {!suppressNoRecordRow && (
          <div className="fighter-stats-grid">
            <div className="fighter-stat-card">
              <div className="fighter-stat-num" style={noRecordData ? { fontSize: 20, color: "var(--muted)" } : undefined}>
                {noRecordData ? "データなし" : `${wins}-${losses}-${draws}`}
              </div>
              <div className="fighter-stat-label">通算戦績</div>
            </div>
            {!noRecordData && winRate !== null && (
              <div className="fighter-stat-card">
                <div className="fighter-stat-num">{winRate}%</div>
                <div className="fighter-stat-label">勝率</div>
              </div>
            )}
            {finishRate !== null && (
              <div className="fighter-stat-card">
                <div className="fighter-stat-num">{finishRate}%</div>
                <div className="fighter-stat-label">フィニッシュ率</div>
              </div>
            )}
          </div>
        )}

        {/* 戦績スタットカード2行目: RIZIN+DEEP+パンクラス+修斗の4団体公式データ
            (data/rizinRecords.json・data/shootoRecords.json・
            data/pancraseRecords.json・data/deepRecords.json)を毎回合算した戦績。
            1行目(Wikipedia通算)とは集計元・集計ロジックが別。fighters.tsの
            wins/losses/history(PR #252投入値)は参照しない(#258で誤りが
            見つかっており信頼できないため)。4団体とも0件(該当bout無し)の
            場合はブロックごと非表示にする。指示書A(2026-08-01): 出典によって
            情報量が割れないよう、1行目と同じ内訳(KO/一本/判定)・勝率・
            フィニッシュ率をこちらにも出す(classifyMethodJa経由、
            computeMultiOrgRates参照)。
            指示書I(2026-08-03): suppressNoRecordRowを条件に追加し1行目と
            完全排他にする。旧条件はhasMultiOrgRecordさえ真なら常に表示して
            いたため、Wikipedia通算(1行目)と4団体合算(2行目)の両方を持つ
            選手で両方の行が同時表示されるバグがあった(1選手1ソース違反)。 */}
        {SHOW_MULTI_ORG_RECORD && suppressNoRecordRow && hasMultiOrgRecord && multiOrgRates && (
          <>
            <div className="fighter-stats-grid">
              <div className="fighter-stat-card">
                <div className="fighter-stat-num">
                  {multiOrgRecord.wins}-{multiOrgRecord.losses}-{multiOrgRecord.draws}
                </div>
                <div className="fighter-stat-label">{MULTI_ORG_RECORD_LABEL}</div>
              </div>
              {multiOrgRates.winRate !== null && (
                <div className="fighter-stat-card">
                  <div className="fighter-stat-num">{multiOrgRates.winRate}%</div>
                  <div className="fighter-stat-label">勝率</div>
                </div>
              )}
              {multiOrgRates.finishRate !== null && (
                <div className="fighter-stat-card">
                  <div className="fighter-stat-num">{multiOrgRates.finishRate}%</div>
                  <div className="fighter-stat-label">フィニッシュ率</div>
                </div>
              )}
            </div>
            {/* 指示書I(2026-08-03): 「集計について」リンクは.fighter-stat-card
                (flex:1の狭いセル・font-size:9px)の中に置くと折り返して崩れて
                いたため枠の外に出す。1行目(通算戦績)が無く2行目のみの選手向けの
                注記(旧:2026-08-01追加)と1行にまとめ、数字のすぐ下・Xボタンより
                前に表示する(常時suppressNoRecordRow=trueなのでこのブロック内では
                無条件表示でよい)。 */}
            <p className="fighter-stat-note">
              他団体・海外での試合は含みません ／{" "}
              <a href="/methodology/records">集計について</a>
            </p>
          </>
        )}

        {/* 勝ち方と負け方(バタフライ・CSSのみ)。ヘッダー・対戦テーブルと同じ
            displayHistory由来(methodButterflyHistory)のmethod再解析、
            noRecordData/履歴なし/chartReliable=false(直上カードの集計値と
            history再集計が食い違う)は非表示。 */}
        {!noRecordData && chartReliable && (
          <MethodButterfly history={methodButterflyHistory} winsTotal={chartTotals.wins} lossesTotal={chartTotals.losses} />
        )}

        {/* X投稿カードボタン(/tools/fighter-card廃止・/dreamへ統合、2026-07-17) */}
        <a href={`/dream?a=${fighter.slug}`} className="fighter-card-btn">
          𝕏 この選手で対戦カードを作る
        </a>

        {/* 出身・年齢 */}
        {(birthPlace || age) && (
          <div className="fighter-meta-row">
            {age && <span>🎂 {age}歳</span>}
            {birthPlace && <span>📍 {birthPlace}出身</span>}
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--fg)" }}>
          {fighter.nameJa}の最新試合結果・戦績
        </h2>
        {tableIsMultiOrgFallbackUnderRowOneHeader && (
          <p className="fighter-stat-note">
            対戦表はRIZIN・DEEP・パンクラス・修斗の試合のみ表示しています ／{" "}
            <a href="/methodology/records">集計について</a>
          </p>
        )}
        {displayHistory.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            {noRecordData
              ? "戦績データがありません（公式・Wikipediaの生涯戦績が確認でき次第、掲載します）。"
              : "試合履歴データは準備中です。"}
          </p>
        ) : (
          <div className="table-outer">
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>対戦相手</th>
                  <th>結果</th>
                  <th className="col-method">決着</th>
                  <th className="col-wrap">大会名</th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((h, i) => {
                  const eventSlug = findEventSlug(h.event, h.date);
                  return (
                    <tr key={i}>
                      <td>{h.date}</td>
                      <td className="col-opponent">
                        {h.opponentSlug ? (
                          <a href={`/fighters/${h.opponentSlug}`} className="opponent-link">
                            {breakAtDot(h.opponentName)}
                          </a>
                        ) : (
                          breakAtDot(h.opponentName)
                        )}
                      </td>
                      <td><span className={RESULT_CLASS[h.result]}>{RESULT_LABEL[h.result]}</span></td>
                      <td className="col-method">{normalizeDecisionScorePerspective(h.method, h.result)}</td>
                      <td className="col-wrap">
                        {eventSlug ? (
                          <a href={`/results/${eventSlug}`} className="opponent-link">
                            {h.event}
                          </a>
                        ) : (
                          h.event
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {sameWeightClass.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2, color: "var(--muted)", marginBottom: 12 }}>
              同階級の選手
            </div>
            <div className="fighter-grid">
              {sameWeightClass.map((f) => (
                <a
                  key={f.slug}
                  href={`/fighters/${f.slug}`}
                  className="fighter-card"
                  style={{ borderLeftColor: SOURCES[f.org].color }}
                >
                  <div className="fighter-org" style={{ color: SOURCES[f.org].color }}>
                    {SOURCES[f.org].label} / {f.weightClass}
                  </div>
                  <div className="fighter-name">{f.nameJa}</div>
                  <div className="fighter-record">
                    {f.wins}-{f.losses}-{f.draws}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
