import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import RankingDelta from "@/components/RankingDelta";
import { FIGHTERS } from "@/lib/fighters";
import { fetchDivisionRankings } from "@/lib/mnewsRatingData";
import { DIVISION_BY_SLUG, PUBLISHED_DIVISIONS, DIVISION_SLUG } from "@/lib/mnewsRating/divisions";
import { RATING_NAME } from "@/lib/mnewsRating/constants";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

// 公開階級のみ静的生成する(第一弾はフェザー級のみ)。他階級は算出済みでも
// ページとしては未公開のため、このルートへ来ても後段のnotFound()で弾く。
export function generateStaticParams() {
  return PUBLISHED_DIVISIONS.map((d) => ({ division: DIVISION_SLUG[d] }));
}

export async function generateMetadata({ params }: { params: Promise<{ division: string }> }) {
  const { division: slug } = await params;
  const division = DIVISION_BY_SLUG[slug];
  if (!division || !PUBLISHED_DIVISIONS.includes(division)) {
    return pageMetadata({ title: "ページが見つかりません | mnews", description: "", path: `/rankings/${slug}` });
  }
  return pageMetadata({
    title: `RIZIN${division}ランキング【毎日更新】| mnews`,
    description: `RIZIN${division}の非公式ランキング。mnews.jp独自アルゴリズム(${RATING_NAME})による自動算出・毎日更新。算出方法は完全公開。`,
    path: `/rankings/${slug}`,
    image: { url: `${SITE_URL}/api/og/rankings/${slug}`, width: 1200, height: 630, alt: `RIZIN${division}ランキング` },
  });
}

export default async function DivisionRankingPage({ params }: { params: Promise<{ division: string }> }) {
  const { division: slug } = await params;
  const division = DIVISION_BY_SLUG[slug];
  if (!division || !PUBLISHED_DIVISIONS.includes(division)) notFound();

  const data = await fetchDivisionRankings(slug);
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "ランキング", href: "/rankings" },
    { label: division },
  ];

  const itemListLd =
    data && data.entries.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `RIZIN${division}ランキング`,
          numberOfItems: data.entries.length,
          itemListElement: data.entries.map((e) => ({
            "@type": "ListItem",
            position: e.rank,
            item: {
              "@type": "Person",
              name: nameBySlug.get(e.fighterId) ?? e.fighterId,
              url: `${SITE_URL}/fighters/${e.fighterId}`,
            },
          })),
        }
      : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">RIZIN{division}ランキング</h1>
        {data && (
          <div className="page-sub">
            最終更新: {data.updatedAt.slice(0, 10)}(アルゴリズムv{data.algorithmVersion})
          </div>
        )}
      </div>

      <div style={{ padding: "16px 24px 8px", maxWidth: 760, fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
        RIZIN非公式。mnews.jp独自算出({RATING_NAME})。RIZIN開催のMMAルール試合の結果のみを対象に自動算出しています。
        算出方法・掲載資格・更新履歴は<a href="/rankings/methodology" style={{ color: "var(--accent)" }}>メソドロジーページ</a>で公開しています。
      </div>

      <div style={{ padding: "8px 24px 48px" }}>
        {!data || (data.entries.length === 0 && !data.champion) ? (
          <p style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>掲載可能な選手が揃い次第、順位を公開します。</p>
        ) : (
          <div className="table-outer">
            <div className="table-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>順位</th>
                    <th>選手</th>
                    <th style={{ width: 80 }}>レート</th>
                    <th style={{ width: 64 }}>前回比</th>
                    <th style={{ width: 96 }}>戦績</th>
                    <th style={{ width: 100 }}>直近試合</th>
                  </tr>
                </thead>
                <tbody>
                  {data.champion && (
                    <tr style={{ background: "rgba(194,154,75,0.1)" }}>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--gold, #c29a4b)" }}>王者</td>
                      <td className="col-opponent">
                        <a href={`/fighters/${data.champion.fighterId}`} className="opponent-link">
                          {nameBySlug.get(data.champion.fighterId) ?? data.champion.fighterId}
                        </a>
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 800 }}>{data.champion.rating ?? "—"}</td>
                      <td>—</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {data.champion.record
                          ? `${data.champion.record.wins}-${data.champion.record.losses}${data.champion.record.draws > 0 ? `-${data.champion.record.draws}` : ""}`
                          : "—"}
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}>{data.champion.lastFight ?? "-"}</td>
                    </tr>
                  )}
                  {data.entries.map((e) => (
                    <tr key={e.fighterId}>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: e.rank <= 3 ? "var(--accent)" : "var(--fg)" }}>
                        {e.rank}
                      </td>
                      <td className="col-opponent">
                        <a href={`/fighters/${e.fighterId}`} className="opponent-link">
                          {nameBySlug.get(e.fighterId) ?? e.fighterId}
                        </a>
                        {e.weighInMiss && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)" }} title="直近試合で計量オーバー">
                            計量超過
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 800 }}>{e.rating}</td>
                      <td>
                        <RankingDelta delta={e.delta} />
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {e.record.wins}-{e.record.losses}
                        {e.record.draws > 0 ? `-${e.record.draws}` : ""}
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}>{e.lastFight ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.8, marginTop: 12 }}>
          掲載はRIZINで通算3試合以上・直近18ヶ月以内に試合あり・1勝以上の選手に限ります。戦績はRIZIN(MMAルール)のみの集計です。
          {data?.champion && (
            <>
              王者(RIZIN公式が認定する現王者)は番号付きランキングの対象外とし、事実として別掲載しています(Elo掲載資格の有無にかかわらず表示)。
            </>
          )}
        </p>
      </div>
      <Footer />
    </>
  );
}
