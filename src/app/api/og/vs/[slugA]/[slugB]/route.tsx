import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, calcFighterRates, type Fighter } from "@/lib/fighters";
import { resolveFighter, type ResolvedFighter } from "@/lib/feeds/resolveFighter";
import { SOURCES } from "@/lib/sources";
import { findMatchupEvent } from "@/lib/events";
import {
  OG_COLORS as COLORS,
  SITE_URL,
  loadOgFonts,
  OG_FONT_FAMILIES,
  stripeTexture,
  cornerVignette,
  fitFontSize,
} from "@/lib/ogShared";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, 307);
}

// 片側の表示幅が狭いため、個人カードより控えめな刻みでサイズを縮める。
const NAME_STEPS = [
  { maxLen: 4, size: 72 },
  { maxLen: 6, size: 58 },
  { maxLen: 9, size: 44 },
  { maxLen: 20, size: 34 },
];

function FighterSide({ f, corner }: { f: ResolvedFighter; corner: "left" | "right" }) {
  const orgLabel = SOURCES[f.org]?.label ?? f.org.toUpperCase();
  const { winRate, finishRate } = calcFighterRates(f);
  const align = corner === "left" ? "flex-start" : "flex-end";
  const textAlign = corner === "left" ? "left" : "right";
  const accent = corner === "left" ? COLORS.shu : COLORS.indigo;
  const nameSize = fitFontSize(f.nameJa, NAME_STEPS);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: align, padding: "0 34px" }}>
      <div
        style={{
          display: "flex",
          fontFamily: "Noto Sans JP",
          fontWeight: 900,
          fontSize: "16px",
          color: "#FFFFFF",
          background: accent,
          padding: "4px 10px",
          letterSpacing: "1px",
        }}
      >
        {orgLabel} / {f.weightClass}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Noto Sans JP",
          fontWeight: 900,
          fontSize: `${nameSize}px`,
          lineHeight: 1.05,
          color: "#FFFFFF",
          marginTop: "14px",
          textAlign,
        }}
      >
        {f.nameJa}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Bebas Neue",
          fontSize: "20px",
          color: COLORS.ash,
          marginTop: "6px",
          letterSpacing: "1px",
        }}
      >
        {f.nameEn}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Bebas Neue",
          fontSize: "52px",
          color: COLORS.gold,
          marginTop: "18px",
        }}
      >
        {f.wins}-{f.losses}
        {f.draws > 0 ? `-${f.draws}` : ""}
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "14px", color: COLORS.ash }}>
          勝率{winRate !== null ? `${winRate}%` : "—"}
        </div>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "14px", color: COLORS.ash }}>
          フィニッシュ{finishRate !== null ? `${finishRate}%` : "—"}
        </div>
      </div>
      {f.nickname && (
        <div
          style={{
            display: "flex",
            fontFamily: "Noto Sans JP",
            fontWeight: 900,
            fontSize: "18px",
            color: COLORS.gold,
            marginTop: "14px",
          }}
        >
          {f.nickname}
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

    const matchup = findMatchupEvent(fighterA.nameJa, fighterB.nameJa);
    const eventLabel = matchup
      ? `${matchup.event.eventName}　|　${matchup.event.date.replaceAll("-", ".")}${
          matchup.event.venue ? `　${matchup.event.venue}` : ""
        }`
      : null;

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
            backgroundImage: `${cornerVignette()}, ${stripeTexture()}`,
            position: "relative",
          }}
        >
          {/* 大会情報帯（紐付けデータがある場合のみ。ない場合は帯ごと非表示でレイアウトは自然に詰まる） */}
          {eventLabel && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: COLORS.washi,
                padding: "14px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "18px",
                  color: COLORS.sumi,
                  letterSpacing: "1px",
                }}
              >
                {eventLabel}
              </div>
            </div>
          )}

          {/* MATCH UP ラベル */}
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0 0" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "18px",
                color: COLORS.ash,
                letterSpacing: "8px",
              }}
            >
              MATCH UP
            </div>
          </div>

          {/* 両選手 + 中央VS + 斜め分割線 */}
          <div style={{ display: "flex", flex: 1, alignItems: "center", position: "relative" }}>
            {/* 斜め分割線（中央やや太め、金色） */}
            <div
              style={{
                display: "flex",
                position: "absolute",
                left: "50%",
                top: "-80px",
                width: "6px",
                height: "760px",
                backgroundColor: COLORS.gold,
                opacity: 0.55,
                transform: "rotate(14deg)",
              }}
            />

            <FighterSide f={fighterA} corner="left" />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "220px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "152px",
                  color: "#FFFFFF",
                  letterSpacing: "0px",
                  textShadow: "0 0 34px rgba(0,0,0,0.7)",
                }}
              >
                VS
              </div>
            </div>

            <FighterSide f={fighterB} corner="right" />
          </div>

          {/* フッター */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              backgroundColor: COLORS.foot,
              padding: "18px 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "20px",
                color: COLORS.ash,
                letterSpacing: "1px",
              }}
            >
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
    console.error("OG vs card generation failed:", err);
    return fallbackRedirect();
  }
}
