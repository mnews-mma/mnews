import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import type { Article } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { selectTopNews, summarizeTitle } from "@/lib/tweetDigest";
import {
  OG_COLORS as COLORS,
  SITE_URL,
  loadOgFonts,
  OG_FONT_FAMILIES,
  stripeTexture,
} from "@/lib/ogShared";

export const runtime = "edge";

const ARCHIVE_URL =
  "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/archive.json";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, 307);
}

// 指定日(JST)に公開された記事を archive.json から取得
async function fetchArticlesForDay(dateStr: string): Promise<Article[]> {
  const res = await fetch(ARCHIVE_URL, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const all: Article[] = await res.json();
  const dayStart = new Date(`${dateStr}T00:00:00+09:00`).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return all.filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return t >= dayStart && t < dayEnd;
  });
}

// 朝の「昨日のまとめ」ポスト用カード(1200×675)。
// 上部帯「DAILY DIGEST | {日付}」+ ニュース見出し最大4件(1件1行・20字要約)。
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fallbackRedirect();

    const articles = await fetchArticlesForDay(dateStr);
    if (articles.length === 0) return fallbackRedirect();
    // 5件以上ある日は重要度スコア上位4件のみ
    const top = selectTopNews(articles, 4);

    const d = new Date(dateStr);
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
          {/* 上部帯 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.washi,
              padding: "22px 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "40px",
                color: COLORS.sumi,
                letterSpacing: "4px",
              }}
            >
              DAILY DIGEST
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "36px",
                color: COLORS.shu,
                letterSpacing: "2px",
              }}
            >
              {dateLabel}
            </div>
          </div>

          {/* 見出しリスト(最大4件) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              gap: "30px",
              padding: "0 56px",
            }}
          >
            {top.map((a, i) => {
              const label = SOURCES[a.source]?.label ?? a.source.toUpperCase();
              const color = SOURCES[a.source]?.color ?? COLORS.gold;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Noto Sans JP",
                      fontWeight: 900,
                      fontSize: "18px",
                      color: "#FFFFFF",
                      backgroundColor: color,
                      padding: "5px 14px",
                      minWidth: "120px",
                      justifyContent: "center",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Noto Sans JP",
                      fontWeight: 900,
                      fontSize: "40px",
                      color: "#FFFFFF",
                    }}
                  >
                    {summarizeTitle(a.title, 20)}
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
              padding: "18px 56px",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "18px", color: COLORS.ash }}>
              昨日のMMAニュースまとめ（全{articles.length}件）
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
    console.error("OG digest card generation failed:", err);
    return fallbackRedirect();
  }
}
