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
  { maxLen: 5, size: 160 },
  { maxLen: 8, size: 118 },
  { maxLen: 11, size: 90 },
  { maxLen: 16, size: 66 },
  { maxLen: 24, size: 54 },
];

// 決着方法も長さに応じて段階縮小(「一本（リアネイキッドチョーク）」等の長文対策)
const METHOD_STEPS = [
  { maxLen: 6, size: 76 },
  { maxLen: 10, size: 58 },
  { maxLen: 16, size: 46 },
  { maxLen: 30, size: 36 },
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
    const methodText = method || (isDraw ? "引き分け" : "");
    const methodSize = fitFontSize(methodText, METHOD_STEPS);
    const rt = [round, time].filter(Boolean).join(" ");
    // 右側余白に敷くゴーストテキスト(結果種別)
    const ghost = isDraw ? (method.includes("ノーコンテスト") ? "NC" : "DRAW") : "WIN";

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
            position: "relative",
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
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "32px", color: COLORS.sumi }}>
              {event.eventName}
            </div>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "28px", color: COLORS.shu, letterSpacing: "1px" }}>
              {dateLabel}
            </div>
          </div>

          {/* 右側余白のゴースト(結果種別を薄く敷く) */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              right: "20px",
              top: "120px",
              fontFamily: "Bebas Neue",
              fontSize: "340px",
              lineHeight: 1,
              color: "rgba(197, 164, 90, 0.09)",
              letterSpacing: "6px",
            }}
          >
            {ghost}
          </div>

          {/* 本体: 縦をspace-betweenで使い切る(中央寄せの上下帯を作らない) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "space-between",
              padding: "30px 56px 34px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "46px",
                  color: COLORS.sumi,
                  backgroundColor: isDraw ? COLORS.ash : COLORS.gold,
                  padding: "6px 24px",
                  letterSpacing: "3px",
                }}
              >
                {isDraw ? "DRAW" : "WIN"}
              </div>
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "27px", color: COLORS.ash }}>
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
              }}
            >
              {winner}
            </div>

            {/* 決着方法 + R/タイム(大きく) */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "28px" }}>
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: `${methodSize}px`, color: COLORS.shu }}>
                {methodText}
              </div>
              {rt && (
                <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "60px", color: COLORS.gold }}>
                  {rt}
                </div>
              )}
            </div>

            {/* 敗者(グレーダウン) */}
            {!isDraw && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "30px", color: COLORS.ash, letterSpacing: "2px" }}>
                  DEF.
                </div>
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "44px", color: COLORS.ash }}>
                  {loser}
                </div>
              </div>
            )}
            {isDraw && (
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "44px", color: COLORS.ash }}>
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
