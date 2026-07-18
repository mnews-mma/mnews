import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { EVENTS, getEvent, GLOBAL_FIGHTER_NAME_SIZE } from "@/lib/events";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";
import { findFighterSlugByName } from "@/lib/fighters";
import { getVisibleFighterSlugs } from "@/lib/visibleFighters";
import { fetchFighterRecords } from "@/lib/fighterRecordsCache";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import BoutCard, { FighterName } from "@/components/BoutCard";
import EventBoutCardV2 from "@/components/matchup/EventBoutCardV2";
import matchupStyles from "@/styles/matchup.module.css";
import { isNewMatchupUiEnabledByEnv } from "@/lib/matchupUi";
import { buildSportsEventLd, eventOgImageUrl } from "@/lib/eventJsonLd";
import { findArticlesForEvent } from "@/lib/originalArticles";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }));
}

// SSG(generateStaticParams)を維持するため dynamic export は付けず、
// searchParamsにも一切触れない。v2出し分けはビルド時環境変数
// (NEXT_PUBLIC_NEW_MATCHUP_UI)のみで行う(?ui=newクエリはこのページでは非対応。
// route segment configの値をビルド環境ごとに出し分けようとしたが、Next.jsが
// リテラル以外を拒否するため断念し、env var一本化に切り替えた)。

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) return { title: "大会が見つかりません | Mニュース", robots: { index: false, follow: false } };

  const isCompleted = event.status === "completed";
  const title = isCompleted
    ? `${event.eventName} 全試合結果 | Mニュース`
    : `${event.eventName} 対戦カード・開催情報 | Mニュース`;
  const description = isCompleted
    ? `${event.eventName}（${event.date}${event.venue ? " ／ " + event.venue : ""}）全${event.bouts.length}試合の勝敗・決着方法を掲載。`
    : `${event.eventName}（${event.date}${event.venue ? " ／ " + event.venue : ""}）の対戦カード・開催情報。${event.bouts[0] ? event.bouts[0].fighterA + " vs " + event.bouts[0].fighterB + "など" : ""}全カード掲載。`;

  return pageMetadata({
    title,
    description,
    path: `/events/${event.slug}`,
    image: {
      url: eventOgImageUrl(event.slug, event.bouts.length > 0),
      width: 1200,
      height: 630,
      alt: `${event.eventName} 対戦カード`,
    },
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDateJa(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEvent(slug);
  if (!event) notFound();
  const isV2 = isNewMatchupUiEnabledByEnv();
  const visibleSlugs = await getVisibleFighterSlugs();
  const records = await fetchFighterRecords();

  const days = daysUntil(event.date);
  const srcColor = SOURCES[event.org].color;
  const srcLabel = SOURCES[event.org].label;

  // 関連大会を解決
  const relatedEvents = (event.relatedEventSlugs ?? [])
    .map((s) => getEvent(s))
    .filter(Boolean) as NonNullable<ReturnType<typeof getEvent>>[];

  // この大会についての「数字で見る対戦カード」記事(存在する場合のみリンクを出す)
  const relatedArticles = findArticlesForEvent(event.slug);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "大会情報", href: "/" },
    { label: event.eventName },
  ];

  // JSON-LD structured data(共通ビルダー経由。推奨項目を全て埋める)
  const isCompleted = event.status === "completed";
  const jsonLd = buildSportsEventLd({
    name: event.eventName,
    date: event.date,
    startTime: event.startTime,
    venue: event.venue,
    org: event.org,
    path: `/events/${event.slug}`,
    status: event.status,
    fighters: [
      ...event.bouts.flatMap((b) => [b.fighterA, b.fighterB]),
      ...(event.expectedFighters ?? []),
    ],
    description: isCompleted
      ? `${event.eventName}（${event.date}${event.venue ? "・" + event.venue : ""}）全${event.bouts.length}試合の結果。`
      : `${event.eventName}（${event.date}${event.venue ? "・" + event.venue : ""}）の対戦カード・開催情報`,
    imageUrl: eventOgImageUrl(event.slug, event.bouts.length > 0),
    ticketUrl: event.ticketUrl,
  });

  // エキシビ/特別マッチは試合番号を持たないため、末尾送りせず主催掲載に合わせ
  // メインイベントの直上(先頭)に表示する。本戦の並び順(配列順)は維持。
  const orderedBouts = [
    ...event.bouts.filter((b) => b.isExhibition),
    ...event.bouts.filter((b) => !b.isExhibition),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <Nav />

      {/* ステータスバー */}
      {event.status === "live" && (
        <div className="event-live-bar">
          <span className="event-live-dot" />
          開催中
        </div>
      )}

      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <div className="org-tag" style={{ color: srcColor }}>
          {srcLabel}
        </div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {event.eventName}
        </h1>
        <div className="page-sub">
          {formatDateJa(event.date)}
          {event.openTime && event.startTime && (
            <span> ／ 開場 {event.openTime} ／ 開始 {event.startTime}</span>
          )}
        </div>
        {event.scheduleNote && (
          <div className="page-sub" style={{ fontSize: 12, color: "var(--muted)" }}>
            ※ {event.scheduleNote}
          </div>
        )}
        {event.venue && (
          <div className="page-sub" style={{ fontSize: 13 }}>
            {event.venue}
          </div>
        )}

        {/* カウントダウン (upcoming/live のみ) */}
        {event.status !== "completed" && days >= 0 && (
          <div className="event-countdown">
            {days === 0 ? "本日開催" : `開催まであと ${days} 日`}
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        {/* 同日開催の関連大会 */}
        {relatedEvents.length > 0 && (
          <div className="event-related">
            <div className="event-section-label">同日開催</div>
            <div className="event-related-links">
              {relatedEvents.map((r) => (
                <a key={r.slug} href={`/events/${r.slug}`} className="event-related-link"
                  style={{ borderLeftColor: SOURCES[r.org].color }}>
                  <span className="org-tag" style={{ color: SOURCES[r.org].color, fontSize: 11 }}>
                    {SOURCES[r.org].label}
                  </span>
                  <span>{r.eventName}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.venue}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* この大会の「数字で見る対戦カード」記事(存在する場合のみ) */}
        {relatedArticles.length > 0 && (
          <div className="event-related">
            <div className="event-section-label">関連記事</div>
            <div className="event-related-links">
              {relatedArticles.map((a) => (
                <a key={a.slug} href={`/articles/${a.slug}`} className="event-related-link" style={{ borderLeftColor: "var(--accent)" }}>
                  <span className="article-original-badge">オリジナル</span>
                  <span style={{ minWidth: 0 }}>{a.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 放送・配信情報 */}
        {event.broadcast && event.broadcast.length > 0 && (
          <div className="event-broadcast">
            <div className="event-section-label">放送・配信</div>
            <ul className="event-broadcast-list">
              {event.broadcast.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 対戦カード / 試合結果 */}
        <h2 className="event-section-label" style={{ marginTop: 24, marginBottom: 16 }}>
          {event.status === "completed" ? "試合結果" : "対戦カード"}
        </h2>

        {event.bouts.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            対戦カードは準備中です。
          </p>
        ) : event.status === "upcoming" || event.status === "live" ? (
          isV2 ? (
            /* v2: 大会の全対戦カードを新デザインで表示する(旧BoutCardとの新旧混在・
               クリック展開は廃止。上位3試合固定+折りたたみ運用はやめ、最初から
               全カードを新デザインで出す)。 */
            (() => {
              // ページ内の全カード(戦績あり・戦績なし簡易表示問わず)で選手名
              // サイズを統一する。カードの種類によって名前描画コンポーネントが
              // 分岐しても(MatchupTape/EventBoutCardV2の簡易フォールバック)、
              // サイズ自体は必ずこのページ単位の値(nameSizeOverride)を使う
              // (コンポーネント側で独自にfighterNameSize()を計算し直さない)。
              // サイズの値自体はページ内最長名ではなく全イベント横断の最長名
              // (GLOBAL_FIGHTER_NAME_SIZE、events.tsでEVENTS全体から算出)を
              // 使う。イベントをまたいで選手名の絶対サイズが変わらないようにする
              // ための意図的な仕様(#76の再発防止テストがこの一致を検査する)。
              const pageNameSize = GLOBAL_FIGHTER_NAME_SIZE;
              const resolvedBouts = orderedBouts.map((b) => {
                const slugA = findFighterSlugByName(b.fighterA, undefined, visibleSlugs);
                const slugB = findFighterSlugByName(b.fighterB, undefined, visibleSlugs);
                const entryA = slugA ? (records[slugA] ?? null) : null;
                const entryB = slugB ? (records[slugB] ?? null) : null;
                return { b, slugA, slugB, entryA, entryB };
              });
              return (
                <div className={matchupStyles.mv2}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                    {resolvedBouts.map(({ b, slugA, slugB, entryA, entryB }, i) => (
                      <EventBoutCardV2
                        key={i}
                        nameA={b.fighterA}
                        nameB={b.fighterB}
                        slugA={slugA}
                        slugB={slugB}
                        entryA={entryA}
                        entryB={entryB}
                        visibleSlugs={visibleSlugs}
                        weightClass={b.weightClass}
                        isTitleMatch={b.isTitleMatch}
                        cancelled={b.cancelled}
                        note={b.note}
                        result={b.result}
                        isEventLive={event.status === "live"}
                        nameSizeOverride={pageNameSize}
                      />
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            /* upcoming / live: カード表示(旧デザイン) */
            <div className="bout-list">
              {orderedBouts.map((b, i) => {
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
                    resultLine={
                      b.result && event.status === "live" ? (
                        <>
                          {b.result.winner ?? "引き分け"} ／ {b.result.method}
                          {b.result.round && <span> ／ {b.result.round}</span>}
                        </>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )
        ) : (
          /* completed: テーブル表示 */
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
                {orderedBouts.map((b, i) => (
                  <tr key={i}>
                    <td className="col-wrap">{b.weightClass}</td>
                    <td>
                      <FighterName name={b.fighterA} visibleSlugs={visibleSlugs} /> vs{" "}
                      <FighterName name={b.fighterB} visibleSlugs={visibleSlugs} />
                    </td>
                    <td
                      className={
                        b.result?.winner && !["引き分け", "中止", "NC"].includes(b.result.winner)
                          ? "result-win"
                          : "result-draw"
                      }
                    >
                      {b.result?.winner ?? "—"}
                    </td>
                    <td className="col-wrap">{b.result?.method ?? "—"}</td>
                    <td>{b.result?.round ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 参戦予定（対戦相手未定）— RIZIN定番の先行発表パターン用の汎用表示 */}
        {event.status !== "completed" &&
          event.expectedFighters &&
          event.expectedFighters.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2 className="event-section-label" style={{ marginBottom: 4 }}>
                参戦予定
              </h2>
              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                以下の選手は参戦が発表済みで、対戦カードは未定です（決定次第更新）
              </p>
              <div className="bout-list">
                {event.expectedFighters.map((name) => (
                  <div key={name} className="bout-card">
                    <div className="bout-card-meta">
                      <span className="bout-note">対戦相手未定</span>
                    </div>
                    <div className="bout-fighters">
                      <span className="bout-fighter-a">
                        <FighterName name={name} visibleSlugs={visibleSlugs} />
                      </span>
                      <span className="bout-vs" style={{ color: "var(--dim)" }}>
                        VS
                      </span>
                      <span
                        className="bout-fighter-b"
                        style={{ color: "var(--muted)", fontStyle: "italic" }}
                      >
                        未定
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {event.sourceUrl && (
          <p style={{ marginTop: 24, fontSize: 12 }}>
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--muted)" }}
            >
              出典: {srcLabel} 公式サイト
            </a>
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}
