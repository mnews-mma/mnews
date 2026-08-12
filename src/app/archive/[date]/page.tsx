import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { relativeTimeJa } from "@/lib/articles";
import { SOURCES, SourceKey } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";
import { fetchArticlesForJstDay } from "@/lib/archiveDayFeed";
import { buildDigestTopics } from "@/lib/tweetDigest";
import { formatDateJa, formatEventDateJa, toJstDateStr, shiftDateStr } from "@/lib/eventCountdown";

// このページはXの日次ダイジェスト投稿(daily-digest)の「全件はこちら👇」
// リンク先。以前はここが `/?d=YYYY-MM-DD` (トップページに未使用のダミー
// クエリを付けただけ)になっており、日付が変わってもOGP/canonicalがトップと
// 完全に同一という問題があった(xPost.ts/DigestPicker.tsxのdigestLinkを
// このルートに向け直した)。og:imageは/api/og/digest(既存・edge runtime)を
// そのまま再利用し、新規のOG画像ロジックは作らない。
export const revalidate = 300;

// generateStaticParamsを持たない動的segmentはrevalidateを指定しても実際には
// force-dynamic相当(毎リクエストSSR、レスポンスもno-store)になることを
// next start実測で確認済み(/fighters/[slug]等の既存ISRページと違いx-nextjs-cache
// がHITしない)。デジェスト投稿は毎回「昨日(JST)」を指すため、その1件だけでも
// generateStaticParamsに含めてISR経路に載せる(他の日付はdynamicParams既定値
// (true)によりオンデマンドで生成される)。
export async function generateStaticParams() {
  return [{ date: shiftDateStr(toJstDateStr(), -1) }];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);
const breadcrumbs = (date: string) => [
  { label: "トップ", href: "/" },
  { label: "ニュース一覧", href: "/archive" },
  { label: formatDateJa(date) },
];

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) {
    return { title: "ニュース一覧 | Mニュース", robots: { index: false, follow: false } };
  }

  const articles = await fetchArticlesForJstDay(date);
  const topics = buildDigestTopics(articles, 4);
  const topicList = topics.slice(0, 3).map((t) => t.text).join("、");
  const description =
    articles.length > 0
      ? `${formatDateJa(date)}のMMAニュース${articles.length}件。${topicList}${articles.length > 3 ? "など。" : "。"}`
      : `${formatDateJa(date)}のMMAニュースはまだありません。`;

  const meta = pageMetadata({
    title: `${formatDateJa(date)}のMMAニュースまとめ | Mニュース`,
    description,
    path: `/archive/${date}`,
    // /api/og/digestの画像サイズは1200×675(他OGルートの1200×630とは異なる)。
    image: {
      url: ogImagePath(`/api/og/digest?date=${date}`),
      width: 1200,
      height: 675,
      alt: `${formatDateJa(date)}のMMAニュースまとめ`,
    },
  });
  // 記事が0件の日(未来日・データ欠落等)は薄いページとして索引対象から外す
  // (/vsページの薄いプログラマティックページと同じnoindex,follow方針)。
  if (articles.length === 0) meta.robots = { index: false, follow: true };
  return meta;
}

export default async function ArchiveDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const articles = await fetchArticlesForJstDay(date);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs(date))) }}
      />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">{formatEventDateJa(date)}のMMAニュース</h1>
      </div>

      <div className="uf">
        <div className="uf-feed">
          {articles.map((a) => {
            const isOfficial = OFFICIAL_ORGS.has(a.source);
            const linkProps = { target: "_blank", rel: "noopener noreferrer" };
            return (
              <a key={a.id} href={a.url} {...linkProps} className="uf-card">
                <div className="uf-meta">
                  {isOfficial ? (
                    <span className="uf-org" style={{ background: SOURCES[a.source].color, color: "#fff" }}>
                      {SOURCES[a.source].label}公式
                    </span>
                  ) : (
                    <span className="uf-b-media">メディア</span>
                  )}
                  <span className="uf-time">{relativeTimeJa(a.publishedAt)}</span>
                </div>
                <h3 className="uf-title">{a.title}</h3>
                {!isOfficial && <div className="uf-src">via {a.origin}</div>}
              </a>
            );
          })}
          {articles.length === 0 && (
            <p style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
              この日のニュースはありません。
            </p>
          )}
          <a href="/archive" className="uf-more">
            ニュース一覧を見る →
          </a>
        </div>
      </div>

      <Footer />
    </>
  );
}
