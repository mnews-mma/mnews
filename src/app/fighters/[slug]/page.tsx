import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { FIGHTERS, getFighter, calcFighterRates } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { resolveFighter } from "@/lib/feeds/resolveFighter";

// Wikipediaから戦績テーブルを取得するためビルド時ではなくリクエスト時に取得する。
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fighter = getFighter(slug);
  if (!fighter) return { title: "選手が見つかりません — Mニュース" };
  return { title: `${fighter.nameJa} 戦績 — Mニュース` };
}

const RESULT_LABEL: Record<string, string> = { win: "勝", loss: "敗", draw: "分" };
const RESULT_CLASS: Record<string, string> = {
  win: "result-win",
  loss: "result-loss",
  draw: "result-draw",
};

// 対戦相手がMニュース掲載選手の場合、その選手ページへのリンクを表示する
// （Wikipediaの戦績テーブルと同じ構造）。
function findOpponentSlug(opponent: string, currentSlug: string): string | null {
  const match = FIGHTERS.find(
    (f) =>
      f.slug !== currentSlug &&
      (f.nameJa === opponent || f.nameEn === opponent || opponent.includes(f.nameJa.replace(/\s/g, "")))
  );
  return match ? match.slug : null;
}

export default async function FighterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seed = getFighter(slug);
  if (!seed) notFound();

  const fighter = await resolveFighter(seed);
  const { history, wins, losses, draws, nickname, birthPlace, age } = fighter;
  const { winRate, finishRate } = calcFighterRates(fighter);

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="fighter-org" style={{ color: SOURCES[fighter.org].color }}>
          {SOURCES[fighter.org].label} / {fighter.weightClass}
        </div>
        <div className="page-title" style={{ marginTop: 8 }}>
          {fighter.nameJa}
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--muted)", marginLeft: 12 }}>
            {fighter.nameEn}
          </span>
        </div>
        {nickname && <div className="fighter-nickname">「{nickname}」</div>}
        <div className="page-sub">
          通算 {wins}-{losses}-{draws}
          {winRate !== null && <span> ／ 勝率 {winRate}%</span>}
          {finishRate !== null && <span> ／ フィニッシュ率 {finishRate}%</span>}
        </div>
        {(birthPlace || age) && (
          <div className="fighter-meta-row">
            {age && <span>{age}歳</span>}
            {birthPlace && <span>{birthPlace}出身</span>}
          </div>
        )}
      </div>

      <div style={{ padding: "0 24px 40px" }}>
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
                  <th>方法</th>
                  <th>大会名</th>
                  <th>ラウンド</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const opponentSlug = findOpponentSlug(h.opponent, slug);
                  return (
                    <tr key={i}>
                      <td>{h.date}</td>
                      <td>
                        {opponentSlug ? (
                          <a href={`/fighters/${opponentSlug}`} className="opponent-link">
                            {h.opponent}
                          </a>
                        ) : (
                          h.opponent
                        )}
                      </td>
                      <td className={RESULT_CLASS[h.result]}>{RESULT_LABEL[h.result]}</td>
                      <td>{h.method}</td>
                      <td>{h.event}</td>
                      <td>{h.round}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
