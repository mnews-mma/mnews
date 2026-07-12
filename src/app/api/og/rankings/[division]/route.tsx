import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { FIGHTERS } from "@/lib/fighters";
import { fetchDivisionRankingsEdge } from "@/lib/mnewsRatingDataEdge";
import { DIVISION_BY_SLUG, PUBLISHED_DIVISIONS } from "@/lib/mnewsRating/divisions";
import { RATING_NAME } from "@/lib/mnewsRating/constants";
import { OG_COLORS as COLORS, SITE_URL, loadOgFonts, OG_FONT_FAMILIES, stripeTexture } from "@/lib/ogShared";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ division: string }> }) {
  try {
    const { division: slug } = await params;
    const division = DIVISION_BY_SLUG[slug];
    if (!division || !PUBLISHED_DIVISIONS.includes(division)) return fallbackRedirect();

    const data = await fetchDivisionRankingsEdge(slug);
    if (!data || data.entries.length === 0) return fallbackRedirect();

    const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
    const top5 = data.entries.slice(0, 5);
    const updatedAt = data.updatedAt.slice(0, 10);
    const fonts = await loadOgFonts();

    const img = new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            backgroundColor: COLORS.sumi,
            backgroundImage: stripeTexture(),
            position: "relative",
          }}
        >
          {/* 上部帯: RIZIN非公式の明記 + 更新日 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "28px 56px 0",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "18px", color: COLORS.ash, letterSpacing: "1px" }}>
              RIZIN非公式・mnews.jp独自算出
            </div>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "22px", color: COLORS.ash, letterSpacing: "2px" }}>
              UPDATED {updatedAt}
            </div>
          </div>

          {/* タイトル */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 56px 0" }}>
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "56px", lineHeight: 1.1, color: "#FFFFFF" }}>
              RIZIN{division}ランキング
            </div>
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "18px", color: COLORS.gold, marginTop: "8px" }}>
              {RATING_NAME}
            </div>
          </div>

          {/* TOP5リスト */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "24px 56px 0", gap: "10px" }}>
            {top5.map((e) => (
              <div
                key={e.fighterId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.12)",
                  paddingBottom: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "56px",
                    fontFamily: "Bebas Neue",
                    fontSize: "34px",
                    color: e.rank <= 3 ? COLORS.shu : COLORS.ash,
                  }}
                >
                  {e.rank}
                </div>
                <div style={{ display: "flex", flex: 1, fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "30px", color: "#FFFFFF" }}>
                  {nameBySlug.get(e.fighterId) ?? e.fighterId}
                </div>
              </div>
            ))}
          </div>

          {/* フッター */}
          <div style={{ display: "flex", backgroundColor: COLORS.foot, padding: "18px 56px", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: COLORS.ash, letterSpacing: "1px" }}>
              MNEWS.JP
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: OG_FONT_FAMILIES(fonts),
      }
    );
    return new Response(img.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("OG rankings card generation failed:", err);
    return fallbackRedirect();
  }
}
