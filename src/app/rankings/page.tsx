import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import RankingDelta from "@/components/RankingDelta";
import { FIGHTERS } from "@/lib/fighters";
import { fetchRankings } from "@/lib/mnewsRatingData";
import { getDivisionRankingView } from "@/lib/mnewsRating/divisionRankingView";
import { MNEWS_DIVISIONS, DIVISION_SLUG, PUBLISHED_DIVISIONS } from "@/lib/mnewsRating/divisions";
import { RATING_NAME } from "@/lib/mnewsRating/constants";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "RIZINランキング 階級別【毎日更新】| mnews",
  description:
    "RIZINには公式ランキングが存在しません。mnews.jpが独自アルゴリズム(mnewsレーティング)による自動算出で階級別ランキングを毎日更新して掲載します。算出方法は完全公開。",
  path: "/rankings",
});

const TOP_N_ON_HUB = 5;

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "RIZINに公式ランキングはある？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "ありません。RIZINは団体として公式のランキング(順位表)を発表していません。ここに掲載しているのはmnews.jpが独自に算出する非公式のランキングです。",
        },
      },
      {
        "@type": "Question",
        name: "このランキングの算出方法は？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RIZIN開催のMMAルール試合の結果のみをもとに、Eloレーティングという方式で自動算出しています。編集部による主観的な順位補正は一切行いません。算出方法の詳細はメソドロジーページで全て公開しています。",
        },
      },
      {
        "@type": "Question",
        name: "更新タイミングは？",
        acceptedAnswer: {
          "@type": "Answer",
          text: "RIZIN大会の翌日、日次バッチ処理で自動更新されます。",
        },
      },
    ],
  };
}

export default async function RankingsHubPage() {
  const rankings = await fetchRankings();
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

  const anyDivision = Object.values(rankings)[0];
  const updatedAt = anyDivision?.updatedAt ? anyDivision.updatedAt.slice(0, 10) : null;

  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "ランキング" }];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">RIZINランキング(階級別)</h1>
        {updatedAt && <div className="page-sub">最終更新: {updatedAt}</div>}
      </div>

      <div style={{ padding: "20px 24px 8px", maxWidth: 760 }}>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "16px 18px",
            fontSize: 13,
            lineHeight: 1.9,
            color: "var(--muted)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--fg)" }}>RIZINに公式ランキングは存在しません。</strong>
            {" "}
            ここに掲載しているのは、RIZIN開催のMMAルール試合の結果のみをもとにmnews.jpが独自算出する非公式のランキング
            (
            {RATING_NAME}
            )です。編集部による主観的な順位補正は一切行わず、算出方法はすべて
            <a href="/rankings/methodology" style={{ color: "var(--accent)" }}>
              メソドロジーページ
            </a>
            で公開しています。RIZIN大会の翌日に自動更新されます。
          </p>
        </div>
      </div>

      <div style={{ padding: "8px 24px 48px" }}>
        {MNEWS_DIVISIONS.map((division) => {
          const slug = DIVISION_SLUG[division];
          const published = PUBLISHED_DIVISIONS.includes(division);
          const data = rankings[slug];
          const view = getDivisionRankingView(data, TOP_N_ON_HUB);

          return (
            <section key={division} style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--fg)" }}>{division}</h2>
                {published && view.contenders.length > 0 && (
                  <a href={`/rankings/${slug}`} style={{ fontSize: 12, color: "var(--accent)" }}>
                    全順位を見る →
                  </a>
                )}
              </div>

              {!published || (view.contenders.length === 0 && !view.champion) ? (
                <p style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>準備中(算出は進行中、掲載は準備が整い次第)</p>
              ) : (
                <div className="table-outer">
                  <div className="table-scroll">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th style={{ width: 44 }}>順位</th>
                          <th>選手</th>
                          <th style={{ width: 80 }}>レート</th>
                          <th style={{ width: 60 }}>前回比</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.champion && (
                          <tr style={{ background: "rgba(194,154,75,0.1)" }}>
                            <td style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--gold, #c29a4b)" }}>王者</td>
                            <td className="col-opponent">
                              <a href={`/fighters/${view.champion.fighterId}`} className="opponent-link">
                                {nameBySlug.get(view.champion.fighterId) ?? view.champion.fighterId}
                              </a>
                            </td>
                            <td style={{ fontFamily: "var(--mono)", fontWeight: 800 }}>{view.champion.rating ?? "—"}</td>
                            <td>—</td>
                          </tr>
                        )}
                        {view.contenders.map((e) => (
                          <tr key={e.fighterId}>
                            <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{e.rank}</td>
                            <td className="col-opponent">
                              <a href={`/fighters/${e.fighterId}`} className="opponent-link">
                                {nameBySlug.get(e.fighterId) ?? e.fighterId}
                              </a>
                            </td>
                            <td style={{ fontFamily: "var(--mono)", fontWeight: 800 }}>{e.rating}</td>
                            <td>
                              <RankingDelta delta={e.delta} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}

        <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.8, marginTop: 24 }}>
          RIZIN非公式。mnews.jp独自算出({RATING_NAME})。算出方法・更新履歴は
          <a href="/rankings/methodology" style={{ color: "var(--accent)" }}>
            メソドロジーページ
          </a>
          で公開しています。
        </p>
      </div>
      <Footer />
    </>
  );
}
