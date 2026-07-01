import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, calcFighterRates, type Fighter } from "@/lib/fighters";
import { resolveFighter, type ResolvedFighter } from "@/lib/feeds/resolveFighter";
import { SOURCES } from "@/lib/sources";
import { OG_COLORS as COLORS, SITE_URL, loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, 307);
}

function FighterSide({ f, align }: { f: ResolvedFighter; align: "left" | "right" }) {
  const orgLabel = SOURCES[f.org]?.label ?? f.org.toUpperCase();
  const { winRate, finishRate } = calcFighterRates(f);
  const items = align === "left" ? "flex-start" : "flex-end";
  const textAlign = align === "left" ? "left" : "right";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: items, padding: "0 48px" }}>
      <div
        style={{
          display: "flex",
          fontFamily: "Noto Sans JP",
          fontWeight: 900,
          fontSize: "18px",
          color: COLORS.shu,
          letterSpacing: "2px",
        }}
      >
        {orgLabel} / {f.weightClass}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Noto Sans JP",
          fontWeight: 900,
          fontSize: "52px",
          color: "#FFFFFF",
          marginTop: "10px",
          textAlign,
        }}
      >
        {f.nameJa}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Bebas Neue",
          fontSize: "24px",
          color: COLORS.ash,
          marginTop: "4px",
          letterSpacing: "1px",
        }}
      >
        {f.nameEn}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Bebas Neue",
          fontSize: "44px",
          color: COLORS.gold,
          marginTop: "20px",
        }}
      >
        {f.wins}勝{f.losses}敗{f.draws > 0 ? `${f.draws}分` : ""}
      </div>
      <div style={{ display: "flex", gap: "20px", marginTop: "10px" }}>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "16px", color: COLORS.ash }}>
          勝率 {winRate !== null ? `${winRate}%` : "—"}
        </div>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "16px", color: COLORS.ash }}>
          フィニッシュ率 {finishRate !== null ? `${finishRate}%` : "—"}
        </div>
      </div>
      {f.nickname && (
        <div
          style={{
            display: "flex",
            fontFamily: "Noto Sans JP",
            fontWeight: 900,
            fontSize: "22px",
            color: COLORS.gold,
            marginTop: "18px",
          }}
        >
          「{f.nickname}」
        </div>
      )}
    </div>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slugA: string; slugB: string }> }
) {
  try {
    const { slugA, slugB } = await params;
    const seedA = getFighter(slugA);
    const seedB = getFighter(slugB);
    if (!seedA || !seedB) return fallbackRedirect();

    const [fighterA, fighterB] = await Promise.all([
      resolveFighter(seedA as Fighter),
      resolveFighter(seedB as Fighter),
    ]);

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
          {/* 行1: ヘッダーストリップ */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: COLORS.washi,
              padding: "12px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "20px",
                color: COLORS.sumi,
                letterSpacing: "6px",
              }}
            >
              MATCH UP
            </div>
          </div>

          {/* 行2: 両選手 + 中央VS */}
          <div style={{ display: "flex", flex: 1, alignItems: "center", position: "relative" }}>
            <FighterSide f={fighterA} align="left" />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "160px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "76px",
                  color: COLORS.shu,
                  letterSpacing: "2px",
                }}
              >
                VS
              </div>
            </div>

            <FighterSide f={fighterB} align="right" />
          </div>

          {/* 行3: フッターストリップ */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              backgroundColor: COLORS.foot,
              padding: "20px 56px",
            }}
          >
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
    console.error("OG vs card generation failed:", err);
    return fallbackRedirect();
  }
}
