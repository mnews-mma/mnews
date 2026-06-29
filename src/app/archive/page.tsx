import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Article, relativeTimeJa } from "@/lib/articles";
import { SOURCES, SourceKey } from "@/lib/sources";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "過去のニュース — Mニュース",
};

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
  const tab: "news" | "official" = tabParam === "official" ? "official" : "news";
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
  const showBadge = tab === "official";

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">過去のニュース</div>
        <div className="page-sub">{tab === "official" ? "公式発表" : "ニュース"}の蓄積アーカイブ</div>
      </div>

      <div className="split-tabs" style={{ display: "flex" }}>
        <a href="/archive?tab=news" className={`split-tab${tab === "news" ? " active" : ""}`}>
          ニュース
        </a>
        <a href="/archive?tab=official" className={`split-tab${tab === "official" ? " active" : ""}`}>
          公式発表
        </a>
      </div>

      <div className="card-grid">
        {items.map((a) => (
          <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className={`card ${a.source}-card`}>
            <div className="card-head">
              {showBadge && <span className={`source-badge sb-${a.source}`}>{SOURCES[a.source].label}</span>}
            </div>
            <div className="card-title">{a.title}</div>
            <div className="card-body">{a.summary ?? ""}</div>
            <div className="card-foot">
              <span className="card-origin">via {a.origin}</span>
              <span className="card-time">{relativeTimeJa(a.publishedAt)}</span>
            </div>
          </a>
        ))}
        {items.length === 0 && (
          <p style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>
            まだアーカイブされた記事がありません。
          </p>
        )}
      </div>

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

      <Footer />
    </>
  );
}
