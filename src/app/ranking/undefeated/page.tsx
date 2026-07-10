import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DataFreshness from "@/components/DataFreshness";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { FIGHTERS } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { fetchFighterRecords, fetchFighterRecordsGeneratedAt } from "@/lib/fighterRecordsCache";
import { computeFighterStripStats } from "@/lib/fighterStrip";
import { CONFIRMED_JAPANESE_SLUGS } from "@/lib/fighterNationality";
import { pageMetadata, SITE_URL } from "@/lib/seo";

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "無敗の日本人選手一覧" }];

// プロ戦績としてカウントする最低試合数(敗北0とあわせて「無敗」の対象条件)。
const MIN_FIGHTS = 3;

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "無敗の日本人MMA格闘家一覧｜戦績・所属団体つき - Mニュース",
  description:
    "fighterRecords.jsonのプロ公式戦績を基に、敗北0・通算3戦以上の無敗日本人MMA選手を戦績・所属団体・フィニッシュ率つきで一覧掲載。",
  path: "/ranking/undefeated",
});

export default async function UndefeatedRankingPage() {
  const records = await fetchFighterRecords();
  const generatedAt = await fetchFighterRecordsGeneratedAt();

  // ホワイトリスト方式: CONFIRMED_JAPANESE_SLUGSに無い選手は除外がデフォルト
  // (fighters.tsに国籍フィールドが無いため、未確認選手を推測で載せない)。
  const undefeated = FIGHTERS.filter((f) => {
    if (f.hidden) return false;
    if (!CONFIRMED_JAPANESE_SLUGS.has(f.slug)) return false;
    const rec = records[f.slug];
    if (!rec || rec.noRecordData) return false;
    const totalFights = rec.wins + rec.losses + rec.draws;
    return rec.losses === 0 && totalFights >= MIN_FIGHTS;
  })
    .map((f) => {
      const rec = records[f.slug];
      const stats = computeFighterStripStats(rec);
      return { fighter: f, rec, stats };
    })
    .sort((a, b) => b.rec.wins - a.rec.wins);

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "無敗の日本人MMA格闘家一覧",
    numberOfItems: undefeated.length,
    ...(generatedAt ? { dateModified: generatedAt } : {}),
    itemListElement: undefeated.map(({ fighter }, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "Person", name: fighter.nameJa, url: `${SITE_URL}/fighters/${fighter.slug}` },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">無敗の日本人MMA格闘家一覧</h1>
        <div className="page-sub" style={{ fontFamily: "var(--body)", fontSize: 13, letterSpacing: 0, color: "var(--text)", lineHeight: 1.8 }}>
          敗北0・通算{MIN_FIGHTS}戦以上の無敗日本人MMA選手を戦績・所属団体・フィニッシュ率つきで掲載。
        </div>
        <DataFreshness generatedAt={generatedAt} />
      </div>

      <div style={{ padding: "0 24px 8px" }}>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          ※ プロ公式戦績ベース(fighterRecords.jsonのデータに準拠。BreakingDown等のプロ興行外MMAルール戦は集計に含みません)
        </p>
      </div>

      {undefeated.length === 0 ? (
        <div style={{ padding: "0 24px 48px", color: "var(--muted)", fontSize: 13 }}>該当選手はいません。</div>
      ) : (
        <div className="results-list">
          {undefeated.map(({ fighter, rec, stats }) => (
            <a
              key={fighter.slug}
              href={`/fighters/${fighter.slug}`}
              className="results-list-item"
              style={{ borderLeftColor: SOURCES[fighter.org].color }}
            >
              <div className="org-tag" style={{ color: SOURCES[fighter.org].color }}>
                {SOURCES[fighter.org].label}
              </div>
              <div className="results-list-title">{fighter.nameJa}</div>
              <div className="results-list-meta">
                {stats.record}
                {stats.finishRate !== null && <span> ／ フィニッシュ率 {stats.finishRate}%</span>}
              </div>
            </a>
          ))}
        </div>
      )}

      <div style={{ padding: "24px" }}>
        <a href="/fighters" style={{ color: "var(--accent)", fontSize: 13 }}>
          → 選手戦績一覧へ戻る
        </a>
      </div>

      <Footer />
    </>
  );
}
