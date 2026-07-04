import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import type { Article } from "@/lib/articles";
import { SOURCES } from "@/lib/sources";
import { buildDigestTopics } from "@/lib/tweetDigest";
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
    // 要約済みトピック(1項目=1トピック・35字以内・低価値除外・同一大会圧縮)。
    // 5件以上ある日は重要度スコア上位4件のみ
    const topics = buildDigestTopics(articles, 4);
    if (topics.length === 0) return fallbackRedirect();
    // 最長トピックが使用可能幅(約930px)に収まるサイズを計算し、全行同じ
    // サイズで1件1行を維持する。Noto Sans JPの欧文グリフは半角0.5emより
    // 広いため0.62em換算で見積もる
    const estWidth = (s: string) => {
      let w = 0;
      for (const ch of s) w += ch.charCodeAt(0) <= 0xff ? 0.62 : 1;
      return w;
    };
    const maxW = Math.max(...topics.map((t) => estWidth(t.text)), 1);
    const rowSize = Math.min(36, Math.floor(930 / maxW));

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
            {topics.map((t, i) => {
              // 団体タグの配色: 公式団体はブランド色、なければ金
              const color =
                t.org !== "other" && SOURCES[t.org]
                  ? SOURCES[t.org].color
                  : COLORS.gold;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Noto Sans JP",
                      fontWeight: 900,
                      fontSize: "17px",
                      color: "#FFFFFF",
                      backgroundColor: color,
                      padding: "5px 12px",
                      minWidth: "110px",
                      justifyContent: "center",
                    }}
                  >
                    {t.tag || "MMA"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "Noto Sans JP",
                      fontWeight: 900,
                      fontSize: `${rowSize}px`,
                      color: "#FFFFFF",
                    }}
                  >
                    {t.text}
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
