import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import RankPositionDeltaBadge from "@/components/RankPositionDeltaBadge";
import { FIGHTERS } from "@/lib/fighters";
import { fetchP4PRankings } from "@/lib/mnewsRatingData";
import { RANKING_DISPLAY_CAP } from "@/lib/mnewsRating/divisionRankingView";
import { RATING_NAME } from "@/lib/mnewsRating/constants";
import { pageMetadata, SITE_URL } from "@/lib/seo";

// data/rankings.jsonと同じキャッシュ窓を使う(mnewsRatingData.tsのRANKINGS_REVALIDATE
// と必ず同じ値。Next.jsのrevalidateはリテラル値しか静的解析できないため、
// 値を変える際は両方を同時に変更すること)。
export const revalidate = 900;

export const metadata = pageMetadata({
  title: "AI RIZINパウンドフォーパウンド(P4P)ランキング｜階級を超えた強さをAIが算出【mnews】",
  description: `RIZINに公式のパウンドフォーパウンド(P4P)ランキングはありません。独自開発のAIが階級別ランキング(${RATING_NAME})をもとに、階級を超えた強さの序列を算出する非公式P4Pランキング。`,
  path: "/rankings/pound-for-pound",
});

// fighters.tsに存在しないfighterIdを画面にスラッグのまま出さない(既存の
// /rankings/[division]と同じ「生スラッグ表示フォールバック禁止」方針)。
// 除外後は表示順位を1から振り直す(繰り上げ)。topN(RANKING_DISPLAY_CAP)は
// 除外・繰り上げ後の件数に適用する。
interface ResolvedP4PEntry {
  fighterId: string;
  nameJa: string;
  displayRank: number;
  division: string;
  record: { wins: number; losses: number; draws: number };
  lastFight: string | null;
  // P4Pはrating点数(内部非公開のzスコア)の概念を持たないため、「前回比」は
  // 既存のRankingDelta(レート差分)ではなく、順位番号だけの差分
  // (RankPositionDeltaBadge)を使う。
  rankPositionDelta: { kind: "up" | "down" | "same" | "new"; positions: number } | null;
}

export default async function PoundForPoundRankingPage() {
  const data = await fetchP4PRankings();
  const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

  const resolved: ResolvedP4PEntry[] = [];
  if (data) {
    for (const e of data.entries) {
      const nameJa = nameBySlug.get(e.fighterId);
      if (!nameJa) continue;
      resolved.push({
        fighterId: e.fighterId,
        nameJa,
        displayRank: resolved.length + 1,
        division: e.division,
        record: e.record,
        lastFight: e.lastFight,
        rankPositionDelta: e.rankPositionDelta,
      });
    }
  }
  const view = resolved.slice(0, RANKING_DISPLAY_CAP);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "ランキング", href: "/rankings" },
    { label: "パウンドフォーパウンド" },
  ];

  const itemListLd =
    view.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "RIZIN パウンドフォーパウンド(P4P)ランキング",
          numberOfItems: view.length,
          itemListElement: view.map((e) => ({
            "@type": "ListItem",
            position: e.displayRank,
            item: {
              "@type": "Person",
              name: e.nameJa,
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
        <h1 className="page-title">AI RIZINパウンドフォーパウンド(P4P)ランキング</h1>
        {data && <div className="page-sub">最終更新: {data.updatedAt.slice(0, 10)}</div>}
      </div>

      <div style={{ padding: "16px 24px 8px", maxWidth: 760, fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
        RIZIN非公式。mnews.jp独自算出。RIZINに公式のP4Pランキングはありません。階級別ランキング({RATING_NAME})の元になっている
        レート(rawRating)をそのまま使い、階級の壁を取り払って全選手を横並びにした参考指標です。
        階級別ランキングとは順位が食い違うことがあります(下記の注記を参照)。
        評価の考え方は<a href="/rankings/methodology" style={{ color: "var(--accent)" }}>ランキングについて</a>で公開しています。
        {data && (
          <span style={{ display: "block", fontSize: 10, opacity: 0.7, marginTop: 4 }}>
            データ更新: {data.updatedAt.slice(0, 10)}
          </span>
        )}
      </div>

      <div style={{ padding: "8px 24px 48px" }}>
        {view.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)", padding: "8px 0" }}>掲載可能な選手が揃い次第、順位を公開します。</p>
        ) : (
          <div className="table-outer">
            <div className="table-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>順位</th>
                    <th>選手</th>
                    <th style={{ width: 72 }}>階級</th>
                    <th style={{ width: 64 }}>前回比</th>
                    <th style={{ width: 96 }}>RIZIN通算</th>
                    <th style={{ width: 100 }}>直近試合</th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((e) => (
                    <tr key={e.fighterId}>
                      <td
                        style={{
                          fontFamily: "var(--mono)",
                          fontWeight: 800,
                          color: e.displayRank <= 3 ? "var(--accent)" : "var(--fg)",
                        }}
                      >
                        {e.displayRank}
                      </td>
                      <td className="col-opponent">
                        <a href={`/fighters/${e.fighterId}`} className="opponent-link">
                          {e.nameJa}
                        </a>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {e.division}
                      </td>
                      <td>
                        <RankPositionDeltaBadge delta={e.rankPositionDelta} />
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
          王座の有無を問わず、階級を超えた強さ(rawRatingの絶対値)だけで一本に並べています。戦績は階級を問わないRIZIN通算です
          (階級別ランキングの戦績は、階級を移った選手についてはその階級での戦績に絞っているため、数字が異なることがあります)。
        </p>
        <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.8, marginTop: 8 }}>
          <strong style={{ color: "var(--fg)" }}>階級別ランキングとの違い:</strong>{" "}
          <a href="/rankings" style={{ color: "var(--accent)" }}>階級別ランキング</a>
          は「その階級の中で誰が強いか」を、直接対決の結果を優先して決めています。P4Pは「階級を問わず誰が強いか」を、
          対戦相手を問わず積み上げたレートの絶対値だけで決めています。このため両者で順位が食い違うことがあります。
        </p>
        <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.8, marginTop: 8 }}>
          P4Pは主観的・参考指標であり、階級別ランキングの正式な代替ではありません。
        </p>
      </div>
      <Footer />
    </>
  );
}
