import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getEvent } from "@/lib/events";
import {
  OG_COLORS as COLORS,
  SITE_URL,
  loadOgFonts,
  OG_FONT_FAMILIES,
  stripeTexture,
} from "@/lib/ogShared";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, 307);
}

// 大会前日カウントダウンポスト用: 全対戦カード一覧画像(1200×675)。
// 結果まとめ画像のレイアウトを流用できるようリスト型で組む。
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = getEvent(slug);
    if (!event || event.bouts.length === 0) return fallbackRedirect();

    const bouts = event.bouts.filter((b) => !b.cancelled).slice(0, 12);
    const d = new Date(event.date);
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}${event.startTime ? ` ${event.startTime}〜` : ""}`;
    // 件数に応じて行の文字サイズを自動調整(縮小時の判読性優先で3段階のみ)
    const rowSize = bouts.length <= 6 ? 34 : bouts.length <= 9 ? 28 : 23;
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
          {/* ヘッダー帯 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.washi,
              padding: "18px 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: "34px",
                color: COLORS.sumi,
              }}
            >
              {event.eventName}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "30px",
                color: COLORS.shu,
                letterSpacing: "1px",
              }}
            >
              {dateLabel}
            </div>
          </div>

          {/* 対戦カードリスト */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              gap: `${Math.max(8, 20 - bouts.length)}px`,
              padding: "16px 56px",
            }}
          >
            {bouts.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Noto Sans JP",
                    fontWeight: 900,
                    fontSize: `${Math.round(rowSize * 0.55)}px`,
                    color: COLORS.ash,
                    minWidth: "190px",
                  }}
                >
                  {b.weightClass}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Noto Sans JP",
                    fontWeight: 900,
                    fontSize: `${rowSize}px`,
                    color: "#FFFFFF",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <span>{b.fighterA}</span>
                  <span
                    style={{
                      fontFamily: "Bebas Neue",
                      fontSize: `${Math.round(rowSize * 0.7)}px`,
                      color: COLORS.shu,
                    }}
                  >
                    VS
                  </span>
                  <span>{b.fighterB}</span>
                  {b.isTitleMatch && (
                    <span
                      style={{
                        fontFamily: "Bebas Neue",
                        fontSize: `${Math.round(rowSize * 0.55)}px`,
                        color: COLORS.sumi,
                        backgroundColor: COLORS.gold,
                        padding: "2px 8px",
                      }}
                    >
                      TITLE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* フッター */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.foot,
              padding: "14px 56px",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "16px", color: COLORS.ash }}>
              {event.venue ?? ""}
              {event.broadcast?.[0] ? `　視聴: ${event.broadcast[0]}` : ""}
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
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("OG event-card generation failed:", err);
    return fallbackRedirect();
  }
}
