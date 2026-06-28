import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Article, relativeTimeJa } from "@/lib/articles";
import { SOURCES, SourceKey } from "@/lib/sources";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "過去のニュース — Mニュース",
};

const ARCHIVE_URL =
  "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/archive.json";
const PAGE_SIZE = 20;
const OFFICIAL_ORGS = new Set<SourceKey>(["rizin", "deep"]);

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
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const articles = await fetchArchive();
  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const items = articles.slice(start, start + PAGE_SIZE);

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">過去のニュース</div>
        <div className="page-sub">
          公式発表・ニュースの蓄積アーカイブ（{articles.length}件中 {start + 1}–
          {Math.min(start + PAGE_SIZE, articles.length)}件目）
        </div>
      </div>

      <div className="card-grid">
        {items.map((a) => {
          const showBadge = OFFICIAL_ORGS.has(a.source);
          return (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className={`card ${a.source}-card`}>
              <div className="card-head">
                {showBadge && (
                  <span className={`source-badge sb-${a.source}`}>{SOURCES[a.source].label}</span>
                )}
              </div>
              <div className="card-title">{a.title}</div>
              <div className="card-body">{a.summary ?? ""}</div>
              <div className="card-foot">
                <span className="card-origin">via {a.origin}</span>
                <span className="card-time">{relativeTimeJa(a.publishedAt)}</span>
              </div>
            </a>
          );
        })}
      </div>

      {items.length === 0 && (
        <p style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
          まだアーカイブされた記事がありません。
        </p>
      )}

      <div className="archive-pager">
        {current > 1 ? (
          <a href={`/archive?page=${current - 1}`} className="archive-pager-link">
            ← 新しい記事へ
          </a>
        ) : (
          <span />
        )}
        <span className="archive-pager-status">
          {current} / {totalPages}
        </span>
        {current < totalPages ? (
          <a href={`/archive?page=${current + 1}`} className="archive-pager-link">
            古い記事へ →
          </a>
        ) : (
          <span />
        )}
      </div>

      <Footer />
    </>
  );
}
