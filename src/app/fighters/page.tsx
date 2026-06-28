import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { FIGHTERS } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { resolveFighters } from "@/lib/feeds/resolveFighter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "選手戦績一覧 — Mニュース",
};

export default async function FightersPage() {
  const fighters = await resolveFighters(FIGHTERS);

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">選手戦績一覧</div>
        <div className="page-sub">日本人MMA選手の戦績データ（Wikipediaより取得・更新）</div>
      </div>
      <div className="fighter-grid">
        {fighters.map((f) => (
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
            <div className="fighter-breakdown">
              KO {f.ko} / 一本 {f.sub} / 判定 {f.decision}
            </div>
          </a>
        ))}
      </div>
      <Footer />
    </>
  );
}
