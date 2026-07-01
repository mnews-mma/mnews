import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, calcFighterRates } from "@/lib/fighters";
import { resolveFighter } from "@/lib/feeds/resolveFighter";
import { SOURCES } from "@/lib/sources";
import { OG_COLORS as COLORS, SITE_URL, loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, 307);
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const seed = getFighter(slug);
    if (!seed) return fallbackRedirect();

    const fighter = await resolveFighter(seed);
    const { wins, losses, draws, ko, sub, decision, nickname } = fighter;
    const { winRate, finishRate } = calcFighterRates(fighter);

    const total = ko + sub + decision || 1;
    const koPct = (ko / total) * 100;
    const subPct = (sub / total) * 100;
    const decPct = (decision / total) * 100;

    const orgLabel = SOURCES[fighter.org]?.label ?? fighter.org.toUpperCase();
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
          }}
        >
          {/* 行1: 名前バー */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: COLORS.washi,
              padding: "40px 56px 28px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "22px",
                  color: COLORS.shu,
                  letterSpacing: "2px",
                }}
              >
                {orgLabel} / {fighter.weightClass}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Bebas Neue",
                    fontSize: "34px",
                    color: COLORS.ash,
                    letterSpacing: "1px",
                  }}
                >
                  {fighter.nameEn}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Bebas Neue",
                    fontSize: "18px",
                    color: COLORS.sumi,
                    backgroundColor: COLORS.gold,
                    padding: "4px 10px",
                    letterSpacing: "1px",
                  }}
                >
                  JPN
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: "64px",
                color: COLORS.sumi,
                marginTop: "8px",
              }}
            >
              {fighter.nameJa}
            </div>
          </div>

          {/* 行2: 戦績セル（4分割） */}
          <div style={{ display: "flex", flex: 1, backgroundColor: COLORS.sumi }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1,
                padding: "0 40px",
                borderRight: `1px solid ${COLORS.gold}`,
              }}
            >
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "16px", color: COLORS.ash, letterSpacing: "2px" }}>
                MMA戦績
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "56px",
                  color: "#FFFFFF",
                  marginTop: "6px",
                }}
              >
                {wins}勝{losses}敗{draws > 0 ? `${draws}分` : ""}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1,
                padding: "0 40px",
                borderRight: `1px solid ${COLORS.gold}`,
              }}
            >
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "16px", color: COLORS.ash, letterSpacing: "2px" }}>
                勝率
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "56px",
                  color: COLORS.gold,
                  marginTop: "6px",
                }}
              >
                {winRate !== null ? `${winRate}%` : "—"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1,
                padding: "0 40px",
                borderRight: `1px solid ${COLORS.gold}`,
              }}
            >
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "16px", color: COLORS.ash, letterSpacing: "2px" }}>
                フィニッシュ率
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "56px",
                  color: COLORS.gold,
                  marginTop: "6px",
                }}
              >
                {finishRate !== null ? `${finishRate}%` : "—"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1.2,
                padding: "0 40px",
              }}
            >
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "16px", color: COLORS.ash, letterSpacing: "2px" }}>
                内訳
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "20px",
                  color: "#FFFFFF",
                  marginTop: "10px",
                }}
              >
                KO{ko}・一本{sub}・判定{decision}
              </div>
              <div style={{ display: "flex", width: "100%", height: "10px", marginTop: "12px" }}>
                <div style={{ display: "flex", width: `${koPct}%`, backgroundColor: COLORS.shu }} />
                <div style={{ display: "flex", width: `${subPct}%`, backgroundColor: COLORS.gold }} />
                <div style={{ display: "flex", width: `${decPct}%`, backgroundColor: COLORS.indigo }} />
              </div>
            </div>
          </div>

          {/* 行3: 異名ストリップ */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.foot,
              padding: "20px 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: "28px",
                color: COLORS.gold,
              }}
            >
              {nickname ? `「${nickname}」` : ""}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "22px",
                  color: "#FFFFFF",
                }}
              >
                mnews.jp
              </div>
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
    console.error("OG fighter card generation failed:", err);
    return fallbackRedirect();
  }
}
