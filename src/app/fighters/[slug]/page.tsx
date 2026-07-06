import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { FIGHTERS, getFighter, calcFighterRates, findFighterSlugByName } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { resolveFighter } from "@/lib/feeds/resolveFighter";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { findNextAppearance } from "@/lib/events";
import { fetchOrgRankings } from "@/lib/orgRankingsData";
import { computeFighterTags, OrgTagKey } from "@/lib/orgTags";

// 団体タグから回遊先(ランキング/一覧)へのリンク。RIZINは順位ページを持たない。
const TAG_LINK: Record<OrgTagKey, string | null> = {
  ufc: null,
  rizin: null,
  deep: "/deep-2026",
  pancrase: "/ranking/pancrase",
  shooto: "/ranking/shooto",
};

// Wikipediaから戦績テーブルを取得するためビルド時ではなくリクエスト時に取得する。
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = getFighter(slug);
  if (!seed) return { title: "選手が見つかりません | Mニュース" };
  // Wikipedia から取得した実際の戦績を meta にも反映（seed と乖離させない）
  const fighter = await resolveFighter(seed);
  const appearance = findNextAppearance(fighter.nameJa);
  const nextFightDesc =
    appearance?.kind === "bout"
      ? `次戦は${appearance.event.date}『${appearance.event.eventName}』でvs${
          appearance.bout.fighterA === fighter.nameJa ? appearance.bout.fighterB : appearance.bout.fighterA
        }。`
      : appearance?.kind === "expected"
        ? `${appearance.event.date}『${appearance.event.eventName}』に参戦予定（対戦相手未定）。`
        : "";
  const meta = pageMetadata({
    title: `${fighter.nameJa} 戦績・試合結果 | Mニュース`,
    description: `${nextFightDesc}${fighter.nameJa}の最新試合結果・戦績データ。${fighter.wins}勝${fighter.losses}敗（${SOURCES[fighter.org].label}・${fighter.weightClass}）。KO・一本・判定の内訳や過去の対戦相手も掲載。`,
    path: `/fighters/${fighter.slug}`,
    image: {
      url: ogImagePath(`/api/og/fighter/${fighter.slug}`),
      width: 1200,
      height: 630,
      alt: `${fighter.nameJa} 戦績カード`,
    },
  });
  // hidden 選手(Mレーティングが乗るまで伏せる新規投入ぶん)は noindex にする。
  if (seed.hidden) meta.robots = { index: false, follow: false };
  return meta;
}

function breakAtDot(name: string) {
  const parts = name.split("・");
  return parts.map((part, i) => (
    <span key={i}>{part}{i < parts.length - 1 && <>・<wbr /></>}</span>
  ));
}

const RESULT_LABEL: Record<string, string> = { win: "勝", loss: "敗", draw: "分", nc: "無効" };
const RESULT_CLASS: Record<string, string> = {
  win: "result-win",
  loss: "result-loss",
  draw: "result-draw",
  nc: "result-draw",
};

// 大会名（RIZIN.52など）からMニュース掲載の結果ページを探す。
// 表記揺れ（全角/半角・サブタイトル付き等）があるため、双方向の部分一致で見る。
function findEventSlug(eventName: string): string | null {
  // Wikipedia側の表記は "RIZIN 師走の超強者祭り" のようにスペースが
  // 入ることがあり、こちらのデータ（スペース無し）と食い違うため、
  // 比較時はスペースを除去して揃える。
  const norm = (s: string) => s.replace(/\s/g, "");
  const target = norm(eventName);
  // en.includes(target) は target が短い場合に誤マッチ（"修斗"→Lemino修斗TORAOなど）
  // が起きるため、8文字未満の target は完全一致・こちらを含む場合のみ許可する。
  const match = EVENT_RESULTS.find((e) => {
    const en = norm(e.eventName);
    if (en === target || target.includes(en)) return true;
    if (target.length >= 8 && en.includes(target)) return true;
    return false;
  });
  return match ? match.slug : null;
}

export default async function FighterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = getFighter(slug);
  if (!seed) notFound();

  const fighter = await resolveFighter(seed);
  const { history, wins, losses, draws, nickname, birthPlace, age, noRecordData } = fighter;
  // 団体タグ(導出・新規公開昇格分のみ)。既存公開選手は空。
  const orgRankings = await fetchOrgRankings();
  const orgTags = computeFighterTags(fighter, orgRankings);
  const appearance = findNextAppearance(fighter.nameJa);
  const nextFight = appearance?.kind === "bout" ? { event: appearance.event, bout: appearance.bout } : null;
  const { winRate, finishRate } = calcFighterRates(fighter);

  // フィニッシュ内訳バー用
  const finishBase = Math.max(wins, fighter.ko + fighter.sub + fighter.decision) || 1;
  const koW = Math.round((fighter.ko / finishBase) * 100);
  const subW = Math.round((fighter.sub / finishBase) * 100);
  const decW = Math.round((fighter.decision / finishBase) * 100);

  const sameWeightClass = FIGHTERS.filter(
    (f) => f.slug !== slug && f.weightClass === fighter.weightClass && !f.hidden
  )
    .map((f) => ({ f, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 4)
    .map(({ f }) => f);

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "選手戦績一覧", href: "/fighters" },
    { label: fighter.nameJa },
  ];

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: fighter.nameJa,
    alternateName: [fighter.nameEn, ...(nickname ? [nickname] : [])],
    url: `${SITE_URL}/fighters/${fighter.slug}`,
    ...(birthPlace ? { birthPlace: { "@type": "Place", name: birthPlace } } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />

        {/* 団体バッジ + 階級 */}
        <div className="fighter-org-row">
          <span
            className="fighter-org-badge"
            style={{ color: SOURCES[fighter.org].color, borderColor: SOURCES[fighter.org].color }}
          >
            {SOURCES[fighter.org].label}
          </span>
          <span className="fighter-org-class">{fighter.weightClass}</span>
        </div>

        {/* 選手名 */}
        <h1 className="fighter-page-name">{fighter.nameJa}</h1>
        {fighter.nameEn && <div className="fighter-name-en">{fighter.nameEn}</div>}

        {/* ニックネーム */}
        {nickname && <div className="fighter-page-nickname">{nickname}</div>}

        {/* 団体タグ(現ランカー/2026出場の実態。パンクラス/修斗は順位つき→公式ランキングへ) */}
        {orgTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 2px" }}>
            {orgTags.map((t) => {
              const chip = (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 5,
                    color: "#fff",
                    background: SOURCES[t.key].color,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                  {t.weightClass ? ` ${t.weightClass}` : ""}
                  {t.rank ? ` ${/^\d+$/.test(t.rank) ? t.rank + "位" : t.rank}` : ""}
                </span>
              );
              return TAG_LINK[t.key] ? (
                <a key={t.key} href={TAG_LINK[t.key]!} style={{ textDecoration: "none" }}>
                  {chip}
                </a>
              ) : (
                <span key={t.key}>{chip}</span>
              );
            })}
          </div>
        )}

        {/* 次戦バナー */}
        {nextFight && (() => {
          const opponentName =
            nextFight.bout.fighterA === fighter.nameJa
              ? nextFight.bout.fighterB
              : nextFight.bout.fighterA;
          const opponentSlug = findFighterSlugByName(opponentName, slug);
          return (
            <div className="fighter-next-fight">
              <span className="fighter-next-fight-label">次戦</span>
              <a href={`/events/${nextFight.event.slug}`} className="fighter-next-fight-link">
                {nextFight.event.date} ／ {nextFight.event.eventName}
              </a>
              {" ／ vs "}
              {opponentSlug ? (
                <a href={`/fighters/${opponentSlug}`} className="fighter-next-fight-link">
                  {opponentName}
                </a>
              ) : (
                opponentName
              )}
              {" ／ "}
              {nextFight.bout.weightClass}
            </div>
          );
        })()}

        {/* 参戦予定バナー（対戦カード未定。カード確定後は上の次戦表示に自動で切替） */}
        {appearance?.kind === "expected" && (
          <div className="fighter-next-fight">
            <span className="fighter-next-fight-label">参戦予定</span>
            <a href={`/events/${appearance.event.slug}`} className="fighter-next-fight-link">
              {appearance.event.date} ／ {appearance.event.eventName}
            </a>
            {appearance.event.venue && <> ／ {appearance.event.venue}</>}
            {" ／ 対戦相手未定"}
          </div>
        )}

        {/* 戦績スタットカード(生涯戦績が取れない選手は「データなし」を明示) */}
        <div className="fighter-stats-grid">
          <div className="fighter-stat-card">
            <div className="fighter-stat-num" style={noRecordData ? { fontSize: 20, color: "var(--muted)" } : undefined}>
              {noRecordData ? "データなし" : `${wins}-${losses}-${draws}`}
            </div>
            <div className="fighter-stat-label">通算戦績</div>
          </div>
          {!noRecordData && winRate !== null && (
            <div className="fighter-stat-card">
              <div className="fighter-stat-num">{winRate}%</div>
              <div className="fighter-stat-label">勝率</div>
            </div>
          )}
          {finishRate !== null && (
            <div className="fighter-stat-card">
              <div className="fighter-stat-num">{finishRate}%</div>
              <div className="fighter-stat-label">フィニッシュ率</div>
            </div>
          )}
        </div>

        {/* KO/一本/判定 内訳バー */}
        {wins > 0 && (
          <div className="fighter-finish-block">
            <div className="fighter-finish-bar">
              {koW > 0 && <div className="fbar-ko" style={{ width: `${koW}%` }} />}
              {subW > 0 && <div className="fbar-sub" style={{ width: `${subW}%` }} />}
              {decW > 0 && <div className="fbar-dec" style={{ width: `${decW}%` }} />}
            </div>
            <div className="fighter-finish-labels">
              <span className="flabel-ko">KO <b>{fighter.ko}</b></span>
              <span className="flabel-sub">一本 <b>{fighter.sub}</b></span>
              <span className="flabel-dec">判定 <b>{fighter.decision}</b></span>
            </div>
          </div>
        )}

        {/* X投稿カードボタン */}
        <a href={`/tools/fighter-card?fighter=${fighter.slug}`} className="fighter-card-btn">
          𝕏 投稿用カード作成
        </a>

        {/* 出身・年齢 */}
        {(birthPlace || age) && (
          <div className="fighter-meta-row">
            {age && <span>🎂 {age}歳</span>}
            {birthPlace && <span>📍 {birthPlace}出身</span>}
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--fg)" }}>
          {fighter.nameJa}の最新試合結果・戦績
        </h2>
        {history.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            {noRecordData
              ? "戦績データがありません（公式・Wikipediaの生涯戦績が確認でき次第、掲載します）。"
              : "試合履歴データは準備中です。"}
          </p>
        ) : (
          <div className="table-outer">
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>対戦相手</th>
                  <th>結果</th>
                  <th className="col-method">決着</th>
                  <th className="col-wrap">大会名</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const opponentSlug = findFighterSlugByName(h.opponent, slug);
                  const eventSlug = findEventSlug(h.event);
                  return (
                    <tr key={i}>
                      <td>{h.date}</td>
                      <td className="col-opponent">
                        {opponentSlug ? (
                          <a href={`/fighters/${opponentSlug}`} className="opponent-link">
                            {breakAtDot(h.opponent)}
                          </a>
                        ) : (
                          breakAtDot(h.opponent)
                        )}
                      </td>
                      <td><span className={RESULT_CLASS[h.result]}>{RESULT_LABEL[h.result]}</span></td>
                      <td className="col-method">{h.method}</td>
                      <td className="col-wrap">
                        {eventSlug ? (
                          <a href={`/results/${eventSlug}`} className="opponent-link">
                            {h.event}
                          </a>
                        ) : (
                          h.event
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {sameWeightClass.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 2, color: "var(--muted)", marginBottom: 12 }}>
              同階級の選手
            </div>
            <div className="fighter-grid">
              {sameWeightClass.map((f) => (
                <a
                  key={f.slug}
                  href={`/fighters/${f.slug}`}
                  className="fighter-card"
                  style={{ borderLeftColor: SOURCES[f.org].color }}
                >
                  <div className="fighter-org" style={{ color: SOURCES[f.org].color }}>
                    {SOURCES[f.org].label} / {f.weightClass}
                  </div>
                  <div className="fighter-name">{f.nameJa}</div>
                  <div className="fighter-record">
                    {f.wins}-{f.losses}-{f.draws}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
