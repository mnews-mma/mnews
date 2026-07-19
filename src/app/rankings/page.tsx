import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import RankingDelta from "@/components/RankingDelta";
import { FIGHTERS } from "@/lib/fighters";
import { fetchRankings } from "@/lib/mnewsRatingData";
import { getDivisionRankingView, resolveDivisionRankingView } from "@/lib/mnewsRating/divisionRankingView";
import { MNEWS_DIVISIONS, DIVISION_SLUG, PUBLISHED_DIVISIONS } from "@/lib/mnewsRating/divisions";
import { RATING_NAME } from "@/lib/mnewsRating/constants";
import { pageMetadata } from "@/lib/seo";

// Next.jsのページセグメントconfig(revalidate)は静的解析のみでリテラル値しか
// 認識できず、importした定数を直接代入するとビルドエラーになる
// (「can't recognize the exported `config` field」)。mnewsRatingData.tsの
// RANKINGS_REVALIDATEと必ず同じ値を保つこと(データ層とページ層のキャッシュ窓を
// 揃えて新旧混在ゼロを担保する設計のため、値を変える際は両方を同時に変更する)。
export const revalidate = 900;

export const metadata = pageMetadata({
  title: "AI RIZINランキング 階級別｜RIZIN公式にない独自ランキングをAIが算出【mnews】",
  description:
    "RIZINに公式ランキングはありません。独自開発のAIが全試合結果を分析して算出する階級別ランキング「AI RIZINランキング」。RIZIN大会の結果を反映して更新します。",
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
          text: "RIZIN開催のMMAルール試合の結果のみをもとに、AIが総合評価して自動算出しています。編集部による主観的な順位補正は一切行いません。評価の考え方はランキングについてページで公開しています。",
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
        <h1 className="page-title">AI RIZINランキング(階級別)</h1>
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
            )です。編集部による主観的な順位補正は一切行わず、評価の考え方は
            <a href="/rankings/methodology" style={{ color: "var(--accent)" }}>
              ランキングについて
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
          // topNは解決・除外・繰り上げ後の件数に適用するため、getDivisionRankingViewは
          // 全件取得してからresolveDivisionRankingView側でTOP_N_ON_HUBを適用する
          // (スラッグ生表示フォールバック禁止・解決失敗時は行非表示+繰り上げ)。
          const view = resolveDivisionRankingView(getDivisionRankingView(data), nameBySlug, TOP_N_ON_HUB);

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
                          <th style={{ width: 60 }}>前回比</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.champion && (
                          <tr style={{ background: "rgba(194,154,75,0.1)" }}>
                            <td style={{ fontFamily: "var(--mono)", fontWeight: 800, color: "var(--gold, #c29a4b)" }}>王者</td>
                            <td className="col-opponent">
                              <a href={`/fighters/${view.champion.fighterId}`} className="opponent-link">
                                {view.champion.nameJa}
                              </a>
                            </td>
                            <td>—</td>
                          </tr>
                        )}
                        {view.contenders.map((e) => (
                          <tr key={e.fighterId}>
                            <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{e.displayRank}</td>
                            <td className="col-opponent">
                              <a href={`/fighters/${e.fighterId}`} className="opponent-link">
                                {e.nameJa}
                              </a>
                            </td>
                            <td>
                              <RankingDelta delta={e.delta} nr={e.rankPositionDelta?.kind === "nr"} />
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
          RIZIN非公式。mnews.jp独自算出({RATING_NAME})。評価の考え方は
          <a href="/rankings/methodology" style={{ color: "var(--accent)" }}>
            ランキングについて
          </a>
          で公開しています。
        </p>
        {updatedAt && (
          <p style={{ fontSize: 10, color: "var(--muted)", opacity: 0.7, marginTop: 4 }}>
            データ更新: {updatedAt}
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}
