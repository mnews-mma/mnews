import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, calcFighterRates } from "@/lib/fighters";
import { resolveFighter } from "@/lib/feeds/resolveFighter";
import { SOURCES } from "@/lib/sources";
import {
  OG_COLORS as COLORS,
  SITE_URL,
  loadOgFonts,
  OG_FONT_FAMILIES,
  stripeTexture,
  fitFontSize,
} from "@/lib/ogShared";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, 307);
}

// 選手名の文字数に応じて段階的にサイズを縮める。中途半端なサイズを残さないため
// 4段階のみで刻む（大きい/やや大きい/中/最小、のいずれかに必ず寄せる）。
const NAME_STEPS = [
  { maxLen: 5, size: 148 },
  { maxLen: 8, size: 116 },
  { maxLen: 11, size: 92 },
  { maxLen: 20, size: 68 },
];

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
    const orgColor = SOURCES[fighter.org]?.color ?? COLORS.shu;
    const fonts = await loadOgFonts();
    const nameSize = fitFontSize(fighter.nameJa, NAME_STEPS);

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
          {/* 上部帯: 団体バッジ + 階級 + EN名 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "28px 56px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "20px",
                  color: "#FFFFFF",
                  background: orgColor,
                  padding: "5px 14px",
                  letterSpacing: "1px",
                }}
              >
                {orgLabel}
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "20px",
                  color: COLORS.ash,
                  letterSpacing: "1px",
                }}
              >
                {fighter.weightClass}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "26px",
                color: COLORS.ash,
                letterSpacing: "2px",
              }}
            >
              {fighter.nameEn}
            </div>
          </div>

          {/* ヒーロー: 選手名を最大限大きく */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              padding: "0 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: `${nameSize}px`,
                lineHeight: 1.05,
                color: "#FFFFFF",
              }}
            >
              {fighter.nameJa}
            </div>
            {nickname && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: "18px",
                  borderLeft: `5px solid ${COLORS.shu}`,
                  paddingLeft: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Noto Sans JP",
                    fontWeight: 900,
                    fontSize: "36px",
                    color: COLORS.gold,
                  }}
                >
                  {nickname}
                </div>
              </div>
            )}
          </div>

          {/* 下部: 戦績スタット + 内訳バー */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: COLORS.foot,
              padding: "26px 56px 22px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: "56px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Bebas Neue",
                    fontSize: "84px",
                    color: "#FFFFFF",
                    lineHeight: 1,
                  }}
                >
                  {wins}-{losses}
                  {draws > 0 ? `-${draws}` : ""}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Noto Sans JP",
                    fontSize: "15px",
                    color: COLORS.ash,
                    letterSpacing: "2px",
                    marginTop: "4px",
                  }}
                >
                  通算戦績
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Bebas Neue",
                    fontSize: "50px",
                    color: COLORS.gold,
                    lineHeight: 1,
                  }}
                >
                  {winRate !== null ? `${winRate}%` : "—"}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Noto Sans JP",
                    fontSize: "13px",
                    color: COLORS.ash,
                    letterSpacing: "1px",
                    marginTop: "4px",
                  }}
                >
                  勝率
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Bebas Neue",
                    fontSize: "50px",
                    color: COLORS.gold,
                    lineHeight: 1,
                  }}
                >
                  {finishRate !== null ? `${finishRate}%` : "—"}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Noto Sans JP",
                    fontSize: "13px",
                    color: COLORS.ash,
                    letterSpacing: "1px",
                    marginTop: "4px",
                  }}
                >
                  フィニッシュ率
                </div>
              </div>
            </div>

            {/* 内訳バー + 凡例 */}
            <div style={{ display: "flex", width: "100%", height: "16px", marginTop: "20px", borderRadius: "8px" }}>
              <div style={{ display: "flex", width: `${koPct}%`, backgroundColor: COLORS.shu, borderRadius: "8px 0 0 8px" }} />
              <div style={{ display: "flex", width: `${subPct}%`, backgroundColor: COLORS.gold }} />
              <div style={{ display: "flex", width: `${decPct}%`, backgroundColor: COLORS.indigo, borderRadius: "0 8px 8px 0" }} />
            </div>
            <div style={{ display: "flex", gap: "28px", marginTop: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", width: "12px", height: "12px", borderRadius: "3px", backgroundColor: COLORS.shu }} />
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "18px", color: "#FFFFFF" }}>
                  KO {ko}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", width: "12px", height: "12px", borderRadius: "3px", backgroundColor: COLORS.gold }} />
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "18px", color: "#FFFFFF" }}>
                  一本 {sub}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", width: "12px", height: "12px", borderRadius: "3px", backgroundColor: COLORS.indigo }} />
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "18px", color: "#FFFFFF" }}>
                  判定 {decision}
                </div>
              </div>
              <div style={{ display: "flex", flex: 1 }} />
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
