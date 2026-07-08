import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getFighter, type Fighter } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { ogImagePath } from "@/lib/ogShared";
import { pageMetadata } from "@/lib/seo";
import { fetchFighterRecordsStrict, mergeFighterRecord } from "@/lib/fighterRecordsCache";
import type { ResolvedFighter } from "@/lib/feeds/resolveFighter";

const SITE_URL = "https://www.mnews.jp";

// OG画像(route.tsx)と同じマージ済み戦績を本体ページでも使う(以前は本体だけ
// getFighter()のシード値をそのまま描画しており、実戦績ではなく0-0-0が
// 出ていた=マージ漏れ)。fetchは1回に統合(片方だけ非対称に失敗する余地を
// 排除)。本体は自動投稿の対象ではないため、fetch失敗時は0-0を確定表示せず
// 「不明(—)」に倒す(フォールバック画像への切替はOGルート側のみで行う)。
async function resolveVsFighters(
  seedA: Fighter,
  seedB: Fighter
): Promise<{ fighterA: ResolvedFighter; fighterB: ResolvedFighter } | null> {
  const recordsResult = await fetchFighterRecordsStrict();
  if (!recordsResult.ok) return null;
  return {
    fighterA: mergeFighterRecord(seedA, recordsResult.records),
    fighterB: mergeFighterRecord(seedB, recordsResult.records),
  };
}

// Xカードツールの手指定階級ラベル(?wc=)・大会名(?ev=)を OG画像に反映するための共通ヘルパ。
function wcOf(searchParams: Record<string, string | string[] | undefined>): string {
  const raw = searchParams.wc;
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
}
function evOf(searchParams: Record<string, string | string[] | undefined>): string {
  const raw = searchParams.ev;
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
}
function vsQuery(wc: string, ev: string): string {
  const params = new URLSearchParams();
  if (wc) params.set("wc", wc);
  if (ev) params.set("ev", ev);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
function vsOgPath(slugA: string, slugB: string, wc: string, ev: string): string {
  return `/api/og/vs/${slugA}/${slugB}${vsQuery(wc, ev)}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slugA: string; slugB: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slugA, slugB } = await params;
  const fighterA = getFighter(slugA);
  const fighterB = getFighter(slugB);
  if (!fighterA || !fighterB) return { title: "対戦カード | Mニュース", robots: { index: false, follow: false } };

  const sp = await searchParams;
  const wc = wcOf(sp);
  const ev = evOf(sp);
  const title = `${fighterA.nameJa} vs ${fighterB.nameJa} | Mニュース`;
  // fetch失敗時はシードの0-0-0を誤って見せず、戦績部分を省いた安全な文言にする。
  const resolved = await resolveVsFighters(fighterA, fighterB);
  const description = resolved
    ? `${resolved.fighterA.nameJa}（${resolved.fighterA.wins}勝${resolved.fighterA.losses}敗）vs ${resolved.fighterB.nameJa}（${resolved.fighterB.wins}勝${resolved.fighterB.losses}敗）の対戦カード。`
    : `${fighterA.nameJa} vs ${fighterB.nameJa}の対戦カード。`;

  return pageMetadata({
    title,
    description,
    path: `/vs/${slugA}/${slugB}`,
    image: {
      url: ogImagePath(vsOgPath(slugA, slugB, wc, ev)),
      width: 1200,
      height: 630,
      alt: `${fighterA.nameJa} vs ${fighterB.nameJa}`,
    },
  });
}

export default async function VsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slugA: string; slugB: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slugA, slugB } = await params;
  const fighterA = getFighter(slugA);
  const fighterB = getFighter(slugB);
  if (!fighterA || !fighterB) notFound();
  const sp = await searchParams;
  const wc = wcOf(sp);
  const ev = evOf(sp);

  // OG画像と同じマージ済み戦績を使う。fetch失敗時はnull→各選手「不明」表示に倒す
  // (org/weightClassはFighter型のシード値のままでよい。mergeFighterRecordが
  // マージするのはFighterRecordEntry型のフィールド(wins/losses/history等)の
  // みで、orgはfighters.ts由来のまま=そもそもマージ対象外)。
  const resolved = await resolveVsFighters(fighterA, fighterB);
  const recordA = resolved?.fighterA;
  const recordB = resolved?.fighterB;

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
          src={ogImagePath(vsOgPath(slugA, slugB, wc, ev))}
          alt={`${fighterA.nameJa} vs ${fighterB.nameJa}`}
          style={{ width: "100%", border: "1px solid var(--border)", display: "block", marginBottom: 16 }}
        />

        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          <a
            href={`https://x.com/intent/post?url=${encodeURIComponent(`${SITE_URL}/vs/${slugA}/${slugB}${vsQuery(wc, ev)}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "10px 20px", background: "#000", color: "#fff", fontWeight: 700, borderRadius: 4, fontSize: 14, textDecoration: "none" }}
          >
            𝕏 に投稿
          </a>
        </div>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`/fighters/${slugA}`} className="fighter-card" style={{ borderLeftColor: SOURCES[fighterA.org]?.color, flex: 1, minWidth: 140 }}>
            <div className="fighter-org" style={{ color: SOURCES[fighterA.org]?.color }}>{orgA} / {fighterA.weightClass}</div>
            <div className="fighter-name">{fighterA.nameJa}</div>
            {!recordA ? (
              <div className="fighter-record" style={{ color: "var(--muted)" }}>—</div>
            ) : recordA.noRecordData ? (
              <div className="fighter-record" style={{ color: "var(--muted)", fontSize: 14 }}>データなし</div>
            ) : (
              <div className="fighter-record">{recordA.wins}-{recordA.losses}-{recordA.draws}</div>
            )}
          </a>
          <a href={`/fighters/${slugB}`} className="fighter-card" style={{ borderLeftColor: SOURCES[fighterB.org]?.color, flex: 1, minWidth: 140 }}>
            <div className="fighter-org" style={{ color: SOURCES[fighterB.org]?.color }}>{orgB} / {fighterB.weightClass}</div>
            <div className="fighter-name">{fighterB.nameJa}</div>
            {!recordB ? (
              <div className="fighter-record" style={{ color: "var(--muted)" }}>—</div>
            ) : recordB.noRecordData ? (
              <div className="fighter-record" style={{ color: "var(--muted)", fontSize: 14 }}>データなし</div>
            ) : (
              <div className="fighter-record">{recordB.wins}-{recordB.losses}-{recordB.draws}</div>
            )}
          </a>
        </div>
      </div>
      <Footer />
    </>
  );
}
