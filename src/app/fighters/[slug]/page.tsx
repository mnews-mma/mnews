import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { FIGHTERS, getFighter, calcFighterRates, findFighterSlugByName } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { resolveFighter } from "@/lib/feeds/resolveFighter";
import { pageMetadata } from "@/lib/seo";
import { EVENT_RESULTS } from "@/lib/eventResults";
import { findNextFight } from "@/lib/events";

// Wikipediaから戦績テーブルを取得するためビルド時ではなくリクエスト時に取得する。
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fighter = getFighter(slug);
  if (!fighter) return { title: "選手が見つかりません — Mニュース" };
  return pageMetadata({
    title: `${fighter.nameJa} 戦績・試合結果 | Mニュース`,
    description: `${fighter.nameJa}の最新試合結果・戦績データ。${fighter.wins}勝${fighter.losses}敗（${fighter.org.toUpperCase()}・${fighter.weightClass}）。KO・一本・判定の内訳や過去の対戦相手も掲載。`,
    path: `/fighters/${fighter.slug}`,
    image: {
      url: `/api/og/fighter/${fighter.slug}`,
      width: 1200,
      height: 630,
      alt: `${fighter.nameJa} 戦績カード`,
    },
  });
}

function breakAtDot(name: string) {
  const parts = name.split("・");
  return parts.map((part, i) => (
    <span key={i}>{part}{i < parts.length - 1 && <>・<wbr /></>}</span>
  ));
}

const RESULT_LABEL: Record<string, string> = { win: "勝", loss: "敗", draw: "分" };
const RESULT_CLASS: Record<string, string> = {
  win: "result-win",
  loss: "result-loss",
  draw: "result-draw",
};

// 大会名（RIZIN.52など）からMニュース掲載の結果ページを探す。
// 表記揺れ（全角/半角・サブタイトル付き等）があるため、双方向の部分一致で見る。
function findEventSlug(eventName: string): string | null {
  // Wikipedia側の表記は "RIZIN 師走の超強者祭り" のようにスペースが
  // 入ることがあり、こちらのデータ（スペース無し）と食い違うため、
  // 比較時はスペースを除去して揃える。
  const norm = (s: string) => s.replace(/\s/g, "");
  const target = norm(eventName);
  const match = EVENT_RESULTS.find((e) => {
    const en = norm(e.eventName);
    return en === target || target.includes(en) || en.includes(target);
  });
  return match ? match.slug : null;
}

export default async function FighterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = getFighter(slug);
  if (!seed) notFound();

  const fighter = await resolveFighter(seed);
  const { history, wins, losses, draws, nickname, birthPlace, age } = fighter;
  const nextFight = findNextFight(fighter.nameJa);
  const { winRate, finishRate } = calcFighterRates(fighter);

  // サイト回遊を狙い、同階級の他選手をランダムに4人下部に表示する
  // （4列グリッドの隙間を防ぐため4人固定、毎回表示順を変える）。
  const sameWeightClass = FIGHTERS.filter(
    (f) => f.slug !== slug && f.weightClass === fighter.weightClass
  )
    .map((f) => ({ f, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 4)
    .map(({ f }) => f);

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="fighter-org" style={{ color: SOURCES[fighter.org].color }}>
          {SOURCES[fighter.org].label} / {fighter.weightClass}
        </div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {fighter.nameJa}
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--muted)", marginLeft: 12 }}>
            {fighter.nameEn}
          </span>
        </h1>
        {nickname && <div className="fighter-nickname">「{nickname}」</div>}
        <div className="page-sub">
          通算 {wins}-{losses}-{draws}
          {winRate !== null && <span> ／ 勝率 {winRate}%</span>}
          {finishRate !== null && <span> ／ フィニッシュ率 {finishRate}%</span>}
        </div>
        <div className="page-sub" style={{ fontSize: 13, color: "var(--muted)" }}>
          KO {fighter.ko} ／ 一本 {fighter.sub} ／ 判定 {fighter.decision}
          <a href={`/tools/fighter-card?fighter=${fighter.slug}`} style={{ marginLeft: 12, color: "var(--accent)", fontSize: 13 }}>
            → X投稿用カード作成
          </a>
        </div>
        {nextFight && (
          <a href={`/events/${nextFight.event.slug}`} className="fighter-next-fight">
            <span className="fighter-next-fight-label">次戦</span>
            {nextFight.event.date} ／ {nextFight.event.eventName} ／ vs{" "}
            {nextFight.bout.fighterA === fighter.nameJa
              ? nextFight.bout.fighterB
              : nextFight.bout.fighterA}
          </a>
        )}
        {(birthPlace || age) && (
          <div className="fighter-meta-row">
            {age && <span>{age}歳</span>}
            {birthPlace && <span>{birthPlace}出身</span>}
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "var(--fg)" }}>
          {fighter.nameJa}の最新試合結果・戦績
        </h2>
        {history.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            試合履歴データは準備中です。
          </p>
        ) : (
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
                      <td className={RESULT_CLASS[h.result]}>{RESULT_LABEL[h.result]}</td>
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
