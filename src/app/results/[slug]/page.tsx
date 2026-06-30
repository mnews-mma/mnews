import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { EVENT_RESULTS, getEventResult } from "@/lib/eventResults";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { findFighterSlugByName } from "@/lib/fighters";

function FighterCardName({ name }: { name: string }) {
  const slug = findFighterSlugByName(name);
  return slug ? (
    <a href={`/fighters/${slug}`} className="opponent-link">
      {name}
    </a>
  ) : (
    <>{name}</>
  );
}

export function generateStaticParams() {
  return EVENT_RESULTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventResult(slug);
  if (!event) return { title: "大会が見つかりません — Mニュース" };
  return pageMetadata({
    title: `${event.eventName} 全試合結果 | Mニュース`,
    description: `${event.eventName}（${event.date}${event.venue ? " ／ " + event.venue : ""}）の全試合結果・決着方法を掲載。`,
    path: `/results/${event.slug}`,
  });
}

export default async function EventResultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventResult(slug);
  if (!event) notFound();

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="org-tag" style={{ color: SOURCES[event.org].color }}>
          {SOURCES[event.org].label}
        </div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {event.eventName}
        </h1>
        <div className="page-sub">
          {event.date}
          {event.venue && <span> ／ {event.venue}</span>}
        </div>
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        {event.fights.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            試合結果データは準備中です。
          </p>
        ) : (
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th className="col-wrap">階級</th>
                  <th>対戦カード</th>
                  <th>勝者</th>
                  <th className="col-wrap">決着</th>
                  <th>ラウンド</th>
                </tr>
              </thead>
              <tbody>
                {event.fights.map((f, i) => (
                  <tr key={i}>
                    <td className="col-wrap">{f.weightClass}</td>
                    <td>
                      <FighterCardName name={f.fighterA} /> vs <FighterCardName name={f.fighterB} />
                    </td>
                    <td className={f.winner && !["引き分け", "中止", "NC"].includes(f.winner) ? "result-win" : "result-draw"}>
                      {f.winner ?? "—"}
                    </td>
                    <td className="col-wrap">{f.method}</td>
                    <td>{f.round ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {event.sourceUrl && (
          <p style={{ marginTop: 24, fontSize: 12 }}>
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted)" }}>
              出典: {event.sourceUrl}
            </a>
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}
