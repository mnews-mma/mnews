import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getFighter } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { pageMetadata } from "@/lib/seo";

const SITE_URL = "https://www.mnews.jp";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slugA: string; slugB: string }>;
}) {
  const { slugA, slugB } = await params;
  const fighterA = getFighter(slugA);
  const fighterB = getFighter(slugB);
  if (!fighterA || !fighterB) return { title: "対戦カード | Mニュース" };

  const title = `${fighterA.nameJa} vs ${fighterB.nameJa} | Mニュース`;
  const description = `${fighterA.nameJa}（${fighterA.wins}勝${fighterA.losses}敗）vs ${fighterB.nameJa}（${fighterB.wins}勝${fighterB.losses}敗）の対戦カード。`;

  return pageMetadata({
    title,
    description,
    path: `/vs/${slugA}/${slugB}`,
    image: {
      url: `/api/og/vs/${slugA}/${slugB}`,
      width: 1200,
      height: 630,
      alt: `${fighterA.nameJa} vs ${fighterB.nameJa}`,
    },
  });
}

export default async function VsPage({
  params,
}: {
  params: Promise<{ slugA: string; slugB: string }>;
}) {
  const { slugA, slugB } = await params;
  const fighterA = getFighter(slugA);
  const fighterB = getFighter(slugB);
  if (!fighterA || !fighterB) notFound();

  const orgA = SOURCES[fighterA.org]?.label ?? fighterA.org;
  const orgB = SOURCES[fighterB.org]?.label ?? fighterB.org;

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">対戦カード</div>
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 800 }}>
        <img
          src={`/api/og/vs/${slugA}/${slugB}`}
          alt={`${fighterA.nameJa} vs ${fighterB.nameJa}`}
          style={{ width: "100%", border: "1px solid var(--border)", display: "block", marginBottom: 32 }}
        />

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`/fighters/${slugA}`} className="fighter-card" style={{ borderLeftColor: SOURCES[fighterA.org]?.color, flex: 1, minWidth: 140 }}>
            <div className="fighter-org" style={{ color: SOURCES[fighterA.org]?.color }}>{orgA} / {fighterA.weightClass}</div>
            <div className="fighter-name">{fighterA.nameJa}</div>
            <div className="fighter-record">{fighterA.wins}-{fighterA.losses}-{fighterA.draws}</div>
          </a>
          <a href={`/fighters/${slugB}`} className="fighter-card" style={{ borderLeftColor: SOURCES[fighterB.org]?.color, flex: 1, minWidth: 140 }}>
            <div className="fighter-org" style={{ color: SOURCES[fighterB.org]?.color }}>{orgB} / {fighterB.weightClass}</div>
            <div className="fighter-name">{fighterB.nameJa}</div>
            <div className="fighter-record">{fighterB.wins}-{fighterB.losses}-{fighterB.draws}</div>
          </a>
        </div>
      </div>
      <Footer />
    </>
  );
}
