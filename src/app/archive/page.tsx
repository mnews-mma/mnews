import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { Article, relativeTimeJa } from "@/lib/articles";
import { SOURCES, SourceKey } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { ORIGINAL_ARTICLES, originalArticleToFeedArticle } from "@/lib/originalArticles";
import type { FeedArticle } from "@/lib/newsClassify";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "過去のニュース | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の公式発表とMMAニュースのアーカイブ。",
  path: "/archive",
});

const ARCHIVE_URL = "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/archive.json";
const PAGE_SIZE = 20;
const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);
const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "過去のニュース" }];

async function fetchArchive(): Promise<Article[]> {
  try {
    const res = await fetch(ARCHIVE_URL, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// トップ(UnifiedFeed)と同じ4タブ構成(すべて/公式/メディア/オリジナル)に統一する。
// 順序・ラベルともトップ側のCHIPS定義(UnifiedFeed.tsx)に合わせている。
type Tab = "all" | "official" | "media" | "original";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab: tabParam, page: pageParam } = await searchParams;
  const tab: Tab =
    tabParam === "official" || tabParam === "media" || tabParam === "original" ? tabParam : "all";
  const page = parseInt(pageParam ?? "1", 10) || 1;

  const rssArticles: FeedArticle[] = (await fetchArchive()).map((a) => ({
    ...a,
    kind: OFFICIAL_ORGS.has(a.source) ? "official" : "media",
    newsType: "article",
    flash: false,
  }));
  // オリジナル記事(数字で見る対戦カード等)もトップと同じ変換関数でマージし、
  // 「オリジナル」タブとして絞り込めるようにする(役割: 過去のニュース=全アーカイブ、
  // 重複表示は容認)。
  const originalArticles = ORIGINAL_ARTICLES.map(originalArticleToFeedArticle);
  const articles = [...rssArticles, ...originalArticles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const filtered =
    tab === "all"
      ? articles
      : tab === "original"
        ? articles.filter((a) => a.isOriginal)
        : articles.filter((a) => !a.isOriginal && a.kind === tab);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const items = filtered.slice(start, start + PAGE_SIZE);

  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "すべて" },
    { key: "official", label: "公式" },
    { key: "media", label: "メディア" },
    { key: "original", label: "オリジナル" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">過去のニュース</h1>
        <div className="page-sub">これまでの全記事をまとめたアーカイブです(新着はトップをご覧ください)</div>
      </div>

      <div className="uf">
        <div className="uf-chips" role="tablist" aria-label="アーカイブ絞り込み">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={t.key === "all" ? "/archive" : `/archive?tab=${t.key}`}
              role="tab"
              aria-selected={tab === t.key}
              className={`uf-chip${t.key === "original" ? " uf-chip--original" : ""}${tab === t.key ? " on" : ""}`}
            >
              {t.label}
            </a>
          ))}
        </div>

        <div className="uf-feed">
          {items.map((a) => {
            const isOfficialCard = !a.isOriginal && a.kind === "official";
            const linkProps = a.isOriginal ? {} : { target: "_blank", rel: "noopener noreferrer" };
            return (
              <a key={a.id} href={a.url} {...linkProps} className="uf-card">
                <div className="uf-meta">
                  {a.isOriginal ? (
                    <span className="article-original-badge">オリジナル</span>
                  ) : isOfficialCard ? (
                    <span className="uf-org" style={{ background: SOURCES[a.source].color, color: "#fff" }}>
                      {SOURCES[a.source].label}公式
                    </span>
                  ) : (
                    <span className="uf-b-media">メディア</span>
                  )}
                  <span className="uf-time">{relativeTimeJa(a.publishedAt)}</span>
                </div>
                <h3 className="uf-title">{a.title}</h3>
                {!a.isOriginal && !isOfficialCard && <div className="uf-src">via {a.origin}</div>}
              </a>
            );
          })}
          {items.length === 0 && (
            <p style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
              まだアーカイブされた記事がありません。
            </p>
          )}

          <div className="archive-pager">
            {current > 1 ? (
              <a href={`/archive?tab=${tab}&page=${current - 1}`} className="archive-pager-link">
                ← 前へ
              </a>
            ) : (
              <span />
            )}
            <span className="archive-pager-status">
              {current} / {totalPages}
            </span>
            {current < totalPages ? (
              <a href={`/archive?tab=${tab}&page=${current + 1}`} className="archive-pager-link">
                次へ →
              </a>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
