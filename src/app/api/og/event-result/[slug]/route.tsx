import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getEventResult } from "@/lib/eventResults";
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

// 引き分け/中止/NC等、勝敗が付かない結果ラベル
const NON_DECISIVE = new Set(["引き分け", "中止", "NC", "無効試合"]);

// 大会結果ページ(/results/[slug])のOG画像(1200×675)。
// event-card(対戦カード告知)のレイアウトを流用し、「VS」ではなく
// 勝者(白・強調)+ 決着方法 を並べた結果まとめカードにする。
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const event = getEventResult(slug);
    if (!event || event.fights.length === 0) return fallbackRedirect();

    // fights は「メイン先頭」順。上位10試合まで(告知カードと同じく判読性優先)。
    const fights = event.fights.slice(0, 10);
    const d = new Date(event.date);
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    const rowSize = fights.length <= 6 ? 34 : fights.length <= 8 ? 28 : 23;
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
              {event.eventName} 結果
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

          {/* 結果リスト */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              gap: `${Math.max(8, 20 - fights.length)}px`,
              padding: "16px 56px",
            }}
          >
            {fights.map((f, i) => {
              const decisive = !!f.winner && !NON_DECISIVE.has(f.winner);
              const winner = decisive ? f.winner! : null;
              const loser = decisive
                ? winner === f.fighterA
                  ? f.fighterB
                  : f.fighterA
                : null;
              return (
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
                    {f.weightClass}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Noto Sans JP",
                      fontWeight: 900,
                      fontSize: `${rowSize}px`,
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    {decisive ? (
                      <>
                        <span style={{ color: "#FFFFFF" }}>{winner}</span>
                        <span
                          style={{
                            fontFamily: "Bebas Neue",
                            fontSize: `${Math.round(rowSize * 0.62)}px`,
                            color: COLORS.shu,
                          }}
                        >
                          def.
                        </span>
                        <span style={{ color: COLORS.ash }}>{loser}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: COLORS.ash }}>{f.fighterA}</span>
                        <span
                          style={{
                            fontFamily: "Bebas Neue",
                            fontSize: `${Math.round(rowSize * 0.62)}px`,
                            color: COLORS.ash,
                          }}
                        >
                          VS
                        </span>
                        <span style={{ color: COLORS.ash }}>{f.fighterB}</span>
                      </>
                    )}
                    {(f.method || f.winner) && (
                      <span
                        style={{
                          fontFamily: "Noto Sans JP",
                          fontWeight: 900,
                          fontSize: `${Math.round(rowSize * 0.6)}px`,
                          color: COLORS.gold,
                        }}
                      >
                        {decisive ? f.method || "" : f.winner || ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
    console.error("OG event-result generation failed:", err);
    return fallbackRedirect();
  }
}
