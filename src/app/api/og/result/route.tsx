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
// 赤/青コーナー色は既存のVSカード配色(vsCardBlocks.tsx)のトークンをそのまま使う
// (このファイルで独自に赤/青の値を定義しない=配色ソースを1本化する)。
import { VS_COLORS } from "@/lib/og/vsCardBlocks";

export const runtime = "edge";

// 勝者コーナー色。fighterA=赤コーナー/fighterB=青コーナーの割当ては
// サイト既存のVSカード配色(vsCardBlocks.tsx CornerStrip)と同じ規約に揃える。
// ドロー/NCは勝者コーナーが定まらないため中立グレー(OG_COLORS.ash)。
const CORNER_RED = VS_COLORS.redInk;
const CORNER_BLUE = VS_COLORS.blueInk;
const CORNER_NEUTRAL = COLORS.ash;

// 日付・イベント名・「RESULT」ラベルは勝敗コーナー色と紛れないよう固定色
// (クローム)にする。勝者コーナーの赤/青と衝突しない専用トーンを使う。
const CHROME_INK = "#1b1b1d";
const CHROME_GOLD = "#b8912f";

// 敗者名: 現状のOG_COLORS.ashより一段明るいグレー(強調)
const LOSER_GRAY = "#b0aa9c";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// URLパラメータ不正・フォント取得失敗等のフォールバック。no-storeを明示せず
// 307自体がCDN/Xに長期キャッシュされると、原因解消後もフォールバック画像に
// 固定され続ける(このルートは管理画面のLiveResultTool手動UI専用で自動投稿
// 経路は無いが、他OGルートと挙動を統一する)。
function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
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
    // 勝者コーナー色: A=赤コーナー/B=青コーナー、ドロー/NCは中立グレー
    const cornerColor = isDraw ? CORNER_NEUTRAL : winnerSide === "B" ? CORNER_BLUE : CORNER_RED;

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
          {/* 左端の縦帯(勝者コーナー色) */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              left: 0,
              top: 0,
              width: "14px",
              height: "675px",
              backgroundColor: cornerColor,
            }}
          />

          {/* 右側背景の薄いアクセント・ウェッジ(勝者コーナー色、opacity 0.13〜0.15相当) */}
          <div
            style={{
              position: "absolute",
              display: "flex",
              right: 0,
              top: 0,
              width: "620px",
              height: "675px",
              backgroundImage: `linear-gradient(112deg, transparent 0%, transparent 58%, ${hexToRgba(
                cornerColor,
                0.14
              )} 58%, ${hexToRgba(cornerColor, 0.14)} 100%)`,
            }}
          />

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
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "32px", color: CHROME_INK }}>
              {event.eventName}
            </div>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "28px", color: CHROME_INK, letterSpacing: "1px" }}>
              {dateLabel}
            </div>
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
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: `${methodSize}px`, color: cornerColor }}>
                {methodText}
              </div>
              {rt && (
                <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "60px", color: COLORS.gold }}>
                  {rt}
                </div>
              )}
            </div>

            {/* 敗者(明るめグレーで強調) */}
            {!isDraw && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "30px", color: COLORS.ash, letterSpacing: "2px" }}>
                  DEF.
                </div>
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "52px", color: LOSER_GRAY }}>
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
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: CHROME_GOLD, letterSpacing: "3px" }}>
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
