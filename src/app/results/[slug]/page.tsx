import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { EVENT_RESULTS, getEventResult } from "@/lib/eventResults";
import { SOURCES } from "@/lib/sources";

export function generateStaticParams() {
  return EVENT_RESULTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventResult(slug);
  if (!event) return { title: "大会が見つかりません — Mニュース" };
  return { title: `${event.eventName} 全試合結果 | Mニュース` };
}

export default async function EventResultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventResult(slug);
  if (!event) notFound();

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="fighter-org" style={{ color: SOURCES[event.org].color }}>
          {SOURCES[event.org].label}
        </div>
        <div className="page-title" style={{ marginTop: 8 }}>
          {event.eventName}
        </div>
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
                  <th>階級</th>
                  <th>対戦カード</th>
                  <th>勝者</th>
                  <th>決着</th>
                  <th>ラウンド</th>
                </tr>
              </thead>
              <tbody>
                {[...event.fights].reverse().map((f, i) => (
                  <tr key={i}>
                    <td>{f.weightClass}</td>
                    <td>
                      {f.fighterA} vs {f.fighterB}
                    </td>
                    <td className={f.winner ? "result-win" : "result-draw"}>
                      {f.winner ?? "引き分け／中止"}
                    </td>
                    <td>{f.method}</td>
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
