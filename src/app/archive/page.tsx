import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Article, relativeTimeJa } from "@/lib/articles";
import { SOURCES, SourceKey } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "過去のニュース | Mニュース",
  description: "RIZIN・DEEP・パンクラス・修斗の公式発表とMMAニュースのアーカイブ。",
  path: "/archive",
});

const ARCHIVE_URL = "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/archive.json";
const PAGE_SIZE = 20;
const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep", "shooto", "pancrase"]);

async function fetchArchive(): Promise<Article[]> {
  try {
    const res = await fetch(ARCHIVE_URL, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab: tabParam, page: pageParam } = await searchParams;
  const tab: "news" | "official" = tabParam === "news" ? "news" : "official";
  const page = parseInt(pageParam ?? "1", 10) || 1;

  const articles = await fetchArchive();
  const filtered =
    tab === "official"
      ? articles.filter((a) => OFFICIAL_ORGS.has(a.source))
      : articles.filter((a) => !OFFICIAL_ORGS.has(a.source));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const items = filtered.slice(start, start + PAGE_SIZE);
  const isOfficial = tab === "official";

  return (
    <>
      <Nav />
      <div className="page-head">
        <h1 className="page-title">過去のニュース</h1>
      </div>

      <div className="uf">
        <div className="uf-chips" role="tablist" aria-label="アーカイブ絞り込み">
          <a href="/archive?tab=official" role="tab" aria-selected={isOfficial} className={`uf-chip${isOfficial ? " on" : ""}`}>
            公式
          </a>
          <a href="/archive?tab=news" role="tab" aria-selected={!isOfficial} className={`uf-chip${!isOfficial ? " on" : ""}`}>
            メディア
          </a>
        </div>

        <div className="uf-feed">
          {items.map((a) => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="uf-card">
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
          ))}
          {items.length === 0 && (
            <p style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
              まだアーカイブされた記事がありません。
            </p>
          )}

          <div className="archive-pager">
            {current > 1 ? (
              <a href={`/archive?tab=${tab}&page=${current - 1}`} className="archive-pager-link">
                ← 新しい記事へ
              </a>
            ) : (
              <span />
            )}
            <span className="archive-pager-status">
              {current} / {totalPages}
            </span>
            {current < totalPages ? (
              <a href={`/archive?tab=${tab}&page=${current + 1}`} className="archive-pager-link">
                古い記事へ →
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
