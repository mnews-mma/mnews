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

function paginate(articles: Article[], page: number) {
  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  return { items: articles.slice(start, start + PAGE_SIZE), current, totalPages };
}

function ArchiveColumn({
  title,
  headClass,
  articles,
  page,
  pageParamName,
  showBadge,
}: {
  title: string;
  headClass: string;
  articles: Article[];
  page: number;
  pageParamName: string;
  showBadge: boolean;
}) {
  const { items, current, totalPages } = paginate(articles, page);
  const otherParam = pageParamName === "newsPage" ? "officialPage" : "newsPage";

  return (
    <div className="archive-col">
      <div className={`split-col-head ${headClass}`}>
        <span className="fl-title">{title}</span>
        <span className="fl-count">{articles.length}件</span>
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
          <a
            href={`/archive?${pageParamName}=${current - 1}&${otherParam}=1`}
            className="archive-pager-link"
          >
            ← 新しい記事へ
          </a>
        ) : (
          <span />
        )}
        <span className="archive-pager-status">
          {current} / {totalPages}
        </span>
        {current < totalPages ? (
          <a
            href={`/archive?${pageParamName}=${current + 1}&${otherParam}=1`}
            className="archive-pager-link"
          >
            古い記事へ →
          </a>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ newsPage?: string; officialPage?: string }>;
}) {
  const { newsPage: newsPageParam, officialPage: officialPageParam } = await searchParams;
  const newsPage = parseInt(newsPageParam ?? "1", 10) || 1;
  const officialPage = parseInt(officialPageParam ?? "1", 10) || 1;

  const articles = await fetchArchive();
  const official = articles.filter((a) => OFFICIAL_ORGS.has(a.source));
  const news = articles.filter((a) => !OFFICIAL_ORGS.has(a.source));

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">過去のニュース</div>
        <div className="page-sub">公式発表・ニュースの蓄積アーカイブ</div>
      </div>

      <div className="archive-columns">
        <ArchiveColumn
          title="ニュース"
          headClass="split-col-head--news"
          articles={news}
          page={newsPage}
          pageParamName="newsPage"
          showBadge={false}
        />
        <ArchiveColumn
          title="公式発表"
          headClass="split-col-head--official"
          articles={official}
          page={officialPage}
          pageParamName="officialPage"
          showBadge
        />
      </div>

      <Footer />
    </>
  );
}
