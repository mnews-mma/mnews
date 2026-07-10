import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getOriginalArticle } from "@/lib/originalArticles";
import { fetchFighterRecordsStrict } from "@/lib/fighterRecordsCache";
import { getEvent } from "@/lib/events";
import { getEventResult } from "@/lib/eventResults";
import { fitName, type FitOpts } from "@/lib/og/fitName";
import {
  OG_COLORS as COLORS,
  SITE_URL,
  loadOgFonts,
  OG_FONT_FAMILIES,
  stripeTexture,
  cornerVignette,
} from "@/lib/ogShared";

export const runtime = "edge";

// 「数字で見る対戦カード」記事(/articles/[slug])のOG画像(1200×630)。
// 両選手名+大会名+戦績のみ。選手写真は使わない(方針通り)。他OGルートと同様、
// fetch失敗・データ不備時は静的フォールバック(og-image.png)へno-store 307する。
function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}

function resolveEventName(eventSlug: string): string | null {
  return getEvent(eventSlug)?.eventName ?? getEventResult(eventSlug)?.eventName ?? null;
}

const NAME_ZONE: FitOpts = { maxWidth: 440, maxHeight: 140, maxFont: 84, minFont: 32, maxLines: 2 };

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const article = getOriginalArticle(slug);
    if (!article) return fallbackRedirect();
    const fight = article.fights[0];
    if (!fight) return fallbackRedirect();

    const recordsResult = await fetchFighterRecordsStrict();
    if (!recordsResult.ok) return fallbackRedirect();
    const entryA = recordsResult.records[fight.fighterA.slug];
    const entryB = recordsResult.records[fight.fighterB.slug];
    if (!entryA || !entryB) return fallbackRedirect();

    const fitAOwn = fitName(fight.fighterA.nameJa, NAME_ZONE);
    const fitBOwn = fitName(fight.fighterB.nameJa, NAME_ZONE);
    const sharedFontSize = Math.min(fitAOwn.fontSize, fitBOwn.fontSize);
    const sharedZone: FitOpts = { ...NAME_ZONE, maxFont: sharedFontSize, minFont: sharedFontSize };
    const fitA = fitName(fight.fighterA.nameJa, sharedZone);
    const fitB = fitName(fight.fighterB.nameJa, sharedZone);

    const eventName = resolveEventName(article.eventSlug);
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
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "30px 0 0" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: "24px",
                color: COLORS.gold,
                letterSpacing: "4px",
              }}
            >
              数字で見る対戦カード
            </div>
            {eventName && (
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "20px",
                  color: "#FFFFFF",
                }}
              >
                {eventName}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-start", padding: "0 32px" }}>
              <div style={{ display: "flex", flexDirection: "column", width: `${NAME_ZONE.maxWidth}px` }}>
                {fitA.lines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      fontFamily: "Noto Sans JP",
                      fontWeight: 900,
                      fontSize: `${fitA.fontSize}px`,
                      color: "#FFFFFF",
                      lineHeight: 1.1,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "68px", color: COLORS.gold, marginTop: "18px" }}>
                {entryA.wins}-{entryA.losses}
                {entryA.draws > 0 ? `-${entryA.draws}` : ""}
              </div>
            </div>

            <div style={{ display: "flex", width: "120px", flexShrink: 0, justifyContent: "center" }}>
              <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "88px", color: "#FFFFFF" }}>VS</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-end", padding: "0 32px" }}>
              <div style={{ display: "flex", flexDirection: "column", width: `${NAME_ZONE.maxWidth}px`, alignItems: "flex-end" }}>
                {fitB.lines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      fontFamily: "Noto Sans JP",
                      fontWeight: 900,
                      fontSize: `${fitB.fontSize}px`,
                      color: "#FFFFFF",
                      lineHeight: 1.1,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "68px", color: COLORS.gold, marginTop: "18px" }}>
                {entryB.wins}-{entryB.losses}
                {entryB.draws > 0 ? `-${entryB.draws}` : ""}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              backgroundColor: COLORS.foot,
              padding: "18px 56px",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: COLORS.ash, letterSpacing: "1px" }}>
              MNEWS.JP
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts: OG_FONT_FAMILIES(fonts) }
    );
    return new Response(img.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("OG article card generation failed:", err);
    return fallbackRedirect();
  }
}
