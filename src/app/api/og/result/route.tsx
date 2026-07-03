import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getEvent } from "@/lib/events";
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

// 勝者名は最大サイズ。文字数に応じ段階縮小(中途半端なサイズを残さない)
const WINNER_STEPS = [
  { maxLen: 5, size: 132 },
  { maxLen: 8, size: 100 },
  { maxLen: 11, size: 76 },
  { maxLen: 24, size: 56 },
];

// 試合結果カード(1200×675)。URLパラメータ完結でストレージ不要:
//   /api/og/result?e=<eventSlug>&b=<boutIndex>&w=<A|B>&m=<決着方法>&r=<R>&t=<タイム>
// ライブモード(管理画面)から生成し、Xへは手動/自動で添付する。
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventSlug = searchParams.get("e") ?? "";
    const boutIndex = parseInt(searchParams.get("b") ?? "", 10);
    const winnerSide = searchParams.get("w"); // "A" | "B" | "draw"
    const method = searchParams.get("m") ?? "";
    const round = searchParams.get("r") ?? "";
    const time = searchParams.get("t") ?? "";

    const event = getEvent(eventSlug);
    if (!event || isNaN(boutIndex) || !event.bouts[boutIndex]) return fallbackRedirect();
    const bout = event.bouts[boutIndex];

    const isDraw = winnerSide !== "A" && winnerSide !== "B";
    const winner = winnerSide === "B" ? bout.fighterB : bout.fighterA;
    const loser = winnerSide === "B" ? bout.fighterA : bout.fighterB;
    const winnerSize = fitFontSize(winner, WINNER_STEPS);
    const rt = [round, time].filter(Boolean).join(" ");

    const d = new Date(event.date);
    const dateLabel = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    const fonts = await loadOgFonts();

    const img = new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "675px",
            display: "flex",
            flexDirection: "column",
            backgroundColor: COLORS.sumi,
            backgroundImage: stripeTexture(),
          }}
        >
          {/* 大会名帯 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.washi,
              padding: "16px 56px",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "30px", color: COLORS.sumi }}>
              {event.eventName}
            </div>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "26px", color: COLORS.shu, letterSpacing: "1px" }}>
              {dateLabel}
            </div>
          </div>

          {/* 本体 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              padding: "0 56px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "40px",
                  color: COLORS.sumi,
                  backgroundColor: isDraw ? COLORS.ash : COLORS.gold,
                  padding: "4px 20px",
                  letterSpacing: "3px",
                }}
              >
                {isDraw ? "DRAW" : "WIN"}
              </div>
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "20px", color: COLORS.ash }}>
                {bout.weightClass}
                {bout.isTitleMatch ? "　タイトルマッチ" : ""}
              </div>
            </div>

            {/* 勝者名(最大) */}
            <div
              style={{
                display: "flex",
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: `${winnerSize}px`,
                lineHeight: 1.05,
                color: "#FFFFFF",
                marginTop: "18px",
              }}
            >
              {winner}
            </div>

            {/* 決着方法 + R/タイム(大きく) */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "24px", marginTop: "22px" }}>
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "54px", color: COLORS.shu }}>
                {method || (isDraw ? "引き分け" : "")}
              </div>
              {rt && (
                <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "48px", color: COLORS.gold }}>
                  {rt}
                </div>
              )}
            </div>

            {/* 敗者(グレーダウン) */}
            {!isDraw && (
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "26px" }}>
                <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "24px", color: COLORS.ash, letterSpacing: "2px" }}>
                  DEF.
                </div>
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "34px", color: COLORS.ash }}>
                  {loser}
                </div>
              </div>
            )}
            {isDraw && (
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "34px", color: COLORS.ash, marginTop: "26px" }}>
                {bout.fighterA} × {bout.fighterB}
              </div>
            )}
          </div>

          {/* フッター */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.foot,
              padding: "16px 56px",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: COLORS.shu, letterSpacing: "3px" }}>
              RESULT
            </div>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "22px", color: COLORS.ash, letterSpacing: "1px" }}>
              MNEWS.JP
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 675, fonts: OG_FONT_FAMILIES(fonts) }
    );
    return new Response(img.body, {
      headers: {
        "Content-Type": "image/png",
        // 結果は即時性重視・同URL再生成の可能性があるため短キャッシュ
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("OG result card generation failed:", err);
    return fallbackRedirect();
  }
}
