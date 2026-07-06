import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { FIGHTERS } from "@/lib/fighters";
import { resolveFighters } from "@/lib/feeds/resolveFighter";
import { SOURCES } from "@/lib/sources";
import { isDeep2026, toFiveClass, FIVE_CLASSES, NEW_TAGGED_SLUGS } from "@/lib/orgTags";
import { pageMetadata } from "@/lib/seo";

// no-data(戦績なし)選手はDEEPの面に出さないため、戦績解決が要る=動的レンダ。
export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "DEEP 2026 出場選手一覧（階級別）| Mニュース",
  description:
    "DEEP 2026年以降のナンバーシリーズ本戦（DEEP.###）に出場した選手を階級別に一覧化。順位はつけず、出場の事実をまとめて掲載。",
  path: "/deep-2026",
});

export default async function Deep2026Page() {
  // 公開昇格済み(NEW_TAGGED_SLUGS)かつ DEEP2026ナンバー出場者を、5階級で中立に一覧化。
  // 順位はつけない(DEEPは公式ランキングを軸にしない)。5階級外はスキップ。
  // DEEPは戦績が唯一の載せる理由なので、no-data(ja/en記事なし)選手は面に出さない。
  const candidates = FIGHTERS.filter(
    (f) => !f.hidden && NEW_TAGGED_SLUGS.has(f.slug) && isDeep2026(f.nameJa)
  );
  const resolved = await resolveFighters(candidates);
  const members = resolved.filter((f) => !f.noRecordData);
  const byClass = new Map<string, typeof FIGHTERS>();
  for (const f of members) {
    const c = toFiveClass(f.weightClass);
    if (!c) continue; // 5階級外はスキップ
    if (!byClass.has(c)) byClass.set(c, []);
    byClass.get(c)!.push(f);
  }
  for (const [, arr] of byClass) arr.sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));

  const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "DEEP 2026 出場選手" }];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">DEEP 2026 出場選手</h1>
        <div className="page-sub">
          2026年以降のDEEPナンバーシリーズ本戦（DEEP.###）に出場した選手（階級別・順位なし）
        </div>
      </div>

      <div style={{ padding: "0 24px 48px" }}>
        {FIVE_CLASSES.filter((c) => byClass.get(c)?.length).map((c) => (
          <section key={c} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px", paddingBottom: 8, borderBottom: `2px solid ${SOURCES.deep.color}`, color: "var(--fg)" }}>
              {c}
            </h2>
            <div className="fighter-grid">
              {byClass.get(c)!.map((f) => (
                <a key={f.slug} href={`/fighters/${f.slug}`} className="fighter-card" style={{ borderLeftColor: SOURCES.deep.color }}>
                  <div className="fighter-org" style={{ color: SOURCES.deep.color }}>
                    DEEP / {f.weightClass}
                  </div>
                  <div className="fighter-name">{f.nameJa}</div>
                </a>
              ))}
            </div>
          </section>
        ))}
        <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.8, marginTop: 8 }}>
          ※ 出場の事実に基づく一覧です（順位づけはしません）。RIZIN等との交流は各選手ページの団体タグで確認できます。
        </p>
      </div>
      <Footer />
    </>
  );
}
