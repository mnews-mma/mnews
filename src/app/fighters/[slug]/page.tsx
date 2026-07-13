import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { FIGHTERS, getFighter, calcFighterRates, findFighterSlugByName } from "@/lib/fighters";
import { resolveOpponentSlug } from "@/lib/fighterLinkOverrides";
import { SOURCES } from "@/lib/sources";
import { resolveFighterCached, resolveFightersCached, fetchFighterRecords } from "@/lib/fighterRecordsCache";
import { getVisibleFighterSlugs } from "@/lib/visibleFighters";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { findNextAppearance } from "@/lib/events";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { computeFighterTags, OrgTagKey } from "@/lib/orgTags";
import { fullWidthLength } from "@/lib/tweetDigest";
import { MethodButterfly, NextFightCompare } from "@/components/FighterVisuals";
import type { ResolvedFighter } from "@/lib/feeds/resolveFighter";
import { fetchDivisionRankings } from "@/lib/mnewsRatingData";
import { PUBLISHED_DIVISIONS, DIVISION_SLUG } from "@/lib/mnewsRating/divisions";

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

// 戦績クエリ(例「武田光司 戦績」)でSearch Console順位はあるのにCTRが低い
// 問題への対応。titleに通算戦績・直近結果を差し込んでクリックを拾う。
// 数字はfighterRecordsCache由来の値をそのまま使い、捏造・独自集計はしない
// (totalはwins+losses+drawsの合計。history.lengthは13人でズレるため使わない)。
const LATEST_RESULT_LABEL: Record<string, string> = {
  win: "直近◯勝利",
  loss: "直近●黒星",
  draw: "直近△引分",
  nc: "最新試合結果",
};

function buildFighterTitle(fighter: ResolvedFighter, orgLabel: string): string {
  const fallback = `${fighter.nameJa}（${orgLabel}）の戦績・試合結果 | Mニュース`;
  // 戦績データが取れていない選手(81人)は現行titleのまま(捏造ゼロ)。
  if (fighter.noRecordData) return fallback;

  const total = fighter.wins + fighter.losses + fighter.draws;
  const drawsPart = fighter.draws > 0 ? `${fighter.draws}分` : "";
  const latestPart =
    fighter.history.length > 0 ? LATEST_RESULT_LABEL[fighter.history[0].result] : "最新試合結果";

  const full = `${fighter.nameJa}（${orgLabel}）の戦績・${total}戦${fighter.wins}勝${fighter.losses}敗${drawsPart}｜${latestPart} | Mニュース`;
  if (fullWidthLength(full) <= 60) return full;

  // 60字超過時は「｜{latestPart}」から先に削る(選手名・団体名・戦績数字は必ず残す)。
  const trimmed = `${fighter.nameJa}（${orgLabel}）の戦績・${total}戦${fighter.wins}勝${fighter.losses}敗${drawsPart} | Mニュース`;
  return trimmed;
}

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
  const appearance = findNextAppearance(fighter.nameJa);
  const nextFightDesc =
    appearance?.kind === "bout"
      ? `次戦は${appearance.event.date}『${appearance.event.eventName}』でvs${
          normSpace(appearance.bout.fighterA) === normSpace(fighter.nameJa) ? appearance.bout.fighterB : appearance.bout.fighterA
        }。`
      : appearance?.kind === "expected"
        ? `${appearance.event.date}『${appearance.event.eventName}』に参戦予定（対戦相手未定）。`
        : "";
  const orgLabel = SOURCES[fighter.org].label;
  const title = buildFighterTitle(fighter, orgLabel);
  const meta = pageMetadata({
    title,
    description: `${fighter.nameJa}の戦績、試合結果、プロフィールをまとめて掲載。${orgLabel}・${fighter.weightClass}所属、通算${fighter.wins}勝${fighter.losses}敗（KO${fighter.ko}・一本${fighter.sub}・判定${fighter.decision}）。RIZIN・DEEP・修斗・パンクラスなど日本MMAの選手情報。${nextFightDesc}`,
    path: `/fighters/${fighter.slug}`,
    image: {
      url: ogImagePath(ogPath),
      width: 1200,
      height: 630,
      alt: `${fighter.nameJa} 戦績カード`,
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

// 大会名（RIZIN.52など）からMニュース掲載の結果ページを探す。
// 表記揺れ（全角/半角・サブタイトル付き等）があるため、双方向の部分一致で見る。
function findEventSlug(eventName: string): string | null {
  // Wikipedia側の表記は "RIZIN 師走の超強者祭り" のようにスペースが
  // 入ることがあり、こちらのデータ（スペース無し）と食い違うため、
  // 比較時はスペースを除去して揃える。
  const norm = (s: string) => s.replace(/\s/g, "");
  const target = norm(eventName);
  // en.includes(target) は target が短い場合に誤マッチ（"修斗"→Lemino修斗TORAOなど）
  // が起きるため、8文字未満の target は完全一致・こちらを含む場合のみ許可する。
  const match = EVENT_RESULTS.find((e) => {
    const en = norm(e.eventName);
    if (en === target || target.includes(en)) return true;
    if (target.length >= 8 && en.includes(target)) return true;
    return false;
  });
  return match ? match.slug : null;
}

// 選手が公開中のAI RIZINランキングに掲載されているか(王者/ランカーいずれか)を
// 公開4階級ぶん確認し、最初に見つかった階級への内部リンク情報を返す(rank(順位)・
// delta(順位変動、algorithmVersion変更日等はnull)のみ使用し、rating/rawRatingは
// 一切参照しない=レート非公開方針を維持)。
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
    if (data.champion?.fighterId === slug) return { divisionSlug, divisionName: division, label: "王者", delta: null };
    const entry = data.entries.find((e) => e.fighterId === slug);
    if (entry) return { divisionSlug, divisionName: division, label: entry.rank, delta: entry.delta };
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

export default async function FighterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = getFighter(slug);
  if (!seed) notFound();

  const fighter = await resolveFighterCached(seed);
  const { history, wins, losses, draws, nickname, birthPlace, age, noRecordData } = fighter;
  // 戦績テーブルの対戦相手名リンク用(no-data/hiddenの選手はテキスト表示にする)。
  const visibleSlugs = await getVisibleFighterSlugs();
  // 団体タグ(導出・新規公開昇格分のみ)。既存公開選手は空。
  const orgRankings = await fetchOrgRankings();
  const orgTags = computeFighterTags(fighter, orgRankings);
  // AI RIZINランキング掲載中なら該当階級ページへ内部リンク(回遊性向上)。
  const rankingLink = seed.hidden ? null : await findRankingLink(slug);
  const appearance = findNextAppearance(fighter.nameJa);
  const nextFight = appearance?.kind === "bout" ? { event: appearance.event, bout: appearance.bout } : null;
  const { winRate, finishRate } = calcFighterRates(fighter);

  // 次戦の対戦相手情報(次戦プレビュー用)。相手がDB外/戦績データなしの場合は
  // entry=null になり、バナーのみ表示(比較・共通対戦相手は出さない=捏造ゼロ)。
  const records = await fetchFighterRecords();
  const nextOpp = nextFight
    ? (() => {
        const name =
          normSpace(nextFight.bout.fighterA) === normSpace(fighter.nameJa)
            ? nextFight.bout.fighterB
            : nextFight.bout.fighterA;
        const oppSlug = findFighterSlugByName(name, slug, visibleSlugs);
        const entry = oppSlug ? records[oppSlug] : undefined;
        return { name, slug: oppSlug, entry: entry && !entry.noRecordData ? entry : null };
      })()
    : null;

  // 同階級の選手: seed値(常に0-0-0)ではなく解決後の実戦績を使い、no-data(戦績実体なし)
  // は /fighters 一覧と同基準で除外する(0-0-0で出さない)。同階級候補だけ解決する(軽量)。
  const sameClassSeeds = FIGHTERS.filter(
    (f) => f.slug !== slug && f.weightClass === fighter.weightClass && !f.hidden
  );
  const sameWeightClass = (await resolveFightersCached(sameClassSeeds))
    .filter((f) => !f.noRecordData)
    .map((f) => ({ f, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 4)
    .map(({ f }) => f);

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
        <h1 className="fighter-page-name">{fighter.nameJa}</h1>
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

        {/* 次戦プレビュー: バナー行 + (相手がDB内なら)戦績比較・共通対戦相手 */}
        {nextFight && nextOpp && (
          <div className="fighter-next-fight" style={{ display: "block" }}>
            <div className="fighter-next-fight-row">
              <span className="fighter-next-fight-label">次戦</span>
              <a href={`/events/${nextFight.event.slug}`} className="fighter-next-fight-link">
                {nextFight.event.date} ／ {nextFight.event.eventName}
              </a>
              {" ／ vs "}
              {nextOpp.slug ? (
                <a href={`/fighters/${nextOpp.slug}`} className="fighter-next-fight-link">
                  {nextOpp.name}
                </a>
              ) : (
                nextOpp.name
              )}
              {" ／ "}
              {nextFight.bout.weightClass}
            </div>
            {!noRecordData && nextOpp.slug && nextOpp.entry && (
              <NextFightCompare
                selfName={fighter.nameJa}
                self={fighter}
                opponentName={nextOpp.name}
                opponentSlug={nextOpp.slug}
                opponent={nextOpp.entry}
                visibleSlugs={visibleSlugs}
              />
            )}
          </div>
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

        {/* 戦績スタットカード(生涯戦績が取れない選手は「データなし」を明示) */}
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

        {/* 勝ち方と負け方(バタフライ・CSSのみ)。historyのraw method再解析、
            noRecordData/履歴なしは非表示。 */}
        {!noRecordData && <MethodButterfly history={history} />}

        {/* X投稿カードボタン */}
        <a href={`/tools/fighter-card?fighter=${fighter.slug}`} className="fighter-card-btn">
          𝕏 投稿用カード作成
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
        {history.length === 0 ? (
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
                {history.map((h, i) => {
                  const opponentSlug = resolveOpponentSlug(h.opponent, slug, visibleSlugs, {
                    fighterSlug: slug,
                    date: h.date,
                  });
                  const eventSlug = findEventSlug(h.event);
                  return (
                    <tr key={i}>
                      <td>{h.date}</td>
                      <td className="col-opponent">
                        {opponentSlug ? (
                          <a href={`/fighters/${opponentSlug}`} className="opponent-link">
                            {breakAtDot(h.opponent)}
                          </a>
                        ) : (
                          breakAtDot(h.opponent)
                        )}
                      </td>
                      <td><span className={RESULT_CLASS[h.result]}>{RESULT_LABEL[h.result]}</span></td>
                      <td className="col-method">{h.method}</td>
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
