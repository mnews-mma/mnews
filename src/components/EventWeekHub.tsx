import { findFighterSlugByName } from "@/lib/fighters";
import type { FighterRecordsFile } from "@/lib/fighterRecordsCache";
import type { EventWeekHub as EventWeekHubData } from "@/lib/eventWeekHub";
import type { FeedArticle } from "@/lib/newsClassify";
import { SOURCES } from "@/lib/sources";
import BoutCard from "@/components/BoutCard";

// トップページ一等地の「大会週ハブ」(RIZIN限定)。既存コンポーネント
// (BoutCard・rail-panel系CSS・page-title/event-countdown等)の出し分けのみで
// 組み立てる(新規デザインなし)。呼び出し側(page.tsx)が
// getActiveRizinEventWeek()の判定結果に応じてこのコンポーネントを
// 差し込むかどうかを決める(window外は完全に描画されない=平時レイアウトへの
// 自動復帰)。
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function EventWeekHub({
  hub,
  visibleSlugs,
  records,
  relatedArticles,
}: {
  hub: EventWeekHubData;
  visibleSlugs: Set<string>;
  records: FighterRecordsFile;
  relatedArticles: FeedArticle[];
}) {
  const srcColor = SOURCES.rizin.color;
  const srcLabel = SOURCES.rizin.label;

  return (
    <section className="rail-panel event-week-hub">
      <div className="rail-head" style={{ color: srcColor }}>
        {hub.phase === "resultsReady" ? "大会結果" : "開催間近"}・{srcLabel}
      </div>
      <div className="page-sub" style={{ marginTop: 0 }}>
        <a href={`/${hub.phase === "resultsReady" ? "results" : "events"}/${hub.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
          <strong style={{ fontSize: 18 }}>{hub.eventName}</strong>
        </a>
      </div>
      <div className="page-sub" style={{ fontSize: 13 }}>
        {hub.date}
        {hub.venue && <span> ／ {hub.venue}</span>}
      </div>
      {hub.phase === "scheduled" && daysUntil(hub.date) >= 0 && (
        <div className="event-countdown">
          {daysUntil(hub.date) === 0 ? "本日開催" : `開催まであと ${daysUntil(hub.date)} 日`}
        </div>
      )}

      {hub.phase === "scheduled" && hub.scheduledEvent && hub.scheduledEvent.bouts.length > 0 && (
        <div className="bout-list" style={{ marginTop: 16 }}>
          {hub.scheduledEvent.bouts.map((b, i) => {
            const slugA = findFighterSlugByName(b.fighterA, undefined, visibleSlugs);
            const slugB = findFighterSlugByName(b.fighterB, undefined, visibleSlugs);
            const entryA = slugA ? (records[slugA] ?? null) : null;
            const entryB = slugB ? (records[slugB] ?? null) : null;
            return (
              <BoutCard
                key={i}
                nameA={b.fighterA}
                nameB={b.fighterB}
                slugA={slugA}
                slugB={slugB}
                entryA={entryA}
                entryB={entryB}
                visibleSlugs={visibleSlugs}
                weightClass={b.weightClass}
                rule={b.rule}
                isTitleMatch={b.isTitleMatch}
                cancelled={b.cancelled}
                note={b.note}
              />
            );
          })}
        </div>
      )}

      {hub.phase === "resultsReady" && hub.resultsEvent && hub.resultsEvent.fights.length > 0 && (
        <div className="table-outer" style={{ marginTop: 16 }}>
          <div className="table-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  <th>階級</th>
                  <th>対戦カード</th>
                  <th>勝者</th>
                  <th>決着</th>
                </tr>
              </thead>
              <tbody>
                {hub.resultsEvent.fights.slice(0, 6).map((f, i) => {
                  const isWin = f.winner && !["引き分け", "中止", "NC"].includes(f.winner);
                  return (
                    <tr key={i}>
                      <td className="col-weight">{f.weightClass}</td>
                      <td className="col-matchup">
                        <span className="matchup-name">{f.fighterA}</span>
                        <span className="matchup-vs">vs</span>
                        <span className="matchup-name">{f.fighterB}</span>
                      </td>
                      <td className="col-winner">
                        {f.winner ? <span className={isWin ? "winner-pill" : "draw-pill"}>{f.winner}</span> : "—"}
                      </td>
                      <td className="col-method-r">{f.method}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <a href={`/${hub.phase === "resultsReady" ? "results" : "events"}/${hub.slug}`} className="rail-more">
        {hub.phase === "resultsReady" ? "全試合結果を見る →" : "対戦カード全体を見る →"}
      </a>

      {relatedArticles.length > 0 && (
        <div className="rail-list" style={{ marginTop: 16 }}>
          {relatedArticles.slice(0, 6).map((a) => (
            <a
              key={a.url}
              href={a.url}
              className="rail-item"
              style={{ borderLeftColor: SOURCES[a.source].color }}
              {...(a.isOriginal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
            >
              <div className="rail-item-org" style={{ color: SOURCES[a.source].color }}>
                {a.isOriginal ? "オリジナル" : SOURCES[a.source].label}
              </div>
              <div className="rail-item-title">{a.title}</div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
