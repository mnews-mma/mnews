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
//
// fights.length > 1(全カード予想など、複数試合をまとめた記事)は
// buildFullCardImage()の一覧レイアウトに分岐する。fights[0]の1試合だけを
// 表示すると、記事全体がその1試合だけの比較記事であるかのように誤って
// 伝わるため(2026-08-05、RIZIN.54全10試合予想記事で発覚)。
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

// weightClassの先頭に埋め込まれた試合番号ラベルのみ取り出す
// (例: "第10試合／フェザー級（66.0kg）" → "第10試合")。無ければ空文字。
function boutNumberLabel(weightClass: string | undefined): string {
  if (!weightClass) return "";
  return weightClass.split("／")[0] ?? "";
}

// 選手写真は使わない方針(選手画像ポリシー)。
// 2026-08-05の経緯: 当初の色帯(赤vsグレー、バー幅が%に比例)は参考画像
// [U-NEXT×RIZIN公式「私のガチ勝敗予想」形式]に寄りすぎているとの指摘で廃止し、
// 矢印(▶)+数字のみのオッズボード形式に変更した。その後の指示で「カードとして
// 見づらい」ため色帯自体は復活させるが、バー幅は%に比例させない
// (全行同一幅の固定50/50分割)。勝者側だけを赤で塗る(バーの長さで大小を表現しない)。
// 2026-08-06、選手の左右は公式カード表記どおり(fighterA=左/fighterB=右で固定、
// 勝者側で並べ替えない)に戻した。%列を赤にすると「勝者名(赤)+敗者(暗)+%(赤)」で
// 赤が敗者を挟むサンドイッチに見える指摘があったため、%列は赤ではなく背景と同じ
// 濃いグレー(COLORS.sumi)にして中立化。数字は白のまま。これで赤は各行の勝者側
// ブロックのみに出て分断されず、%は独立した固定列として全行同じ位置に立つ。
const ROW_HEIGHT = 100;
const GUTTER_WIDTH = 90;
const VS_CHIP_WIDTH = 64;
const PCT_WIDTH = 110;
const NAME_WIDTH = (1200 - GUTTER_WIDTH - PCT_WIDTH - VS_CHIP_WIDTH) / 2;
// 列見出し「AI予想」用の行(全行の先頭に1回だけ出す。凡例行を削除した代わり)。
const COLUMN_HEADER_HEIGHT = 30;
// ヘッダー/フッターと本体の間の余白(2026-08-06、上下端が詰まって見える指摘への対応。
// 14/16pxでは1200px幅・行高100pxのスケール感に対して視認できないほど小さかった
// ため、はっきり分かる値に引き上げた)。
const TOP_GAP = 26;
const BOTTOM_GAP = 32;
// 敗者側ブロックの背景色。背景(COLORS.sumi #131210)に対して十分な明度差を持たせ、
// 1行=1つの箱として輪郭が分かるようにする(旧#2E2A26は背景と近すぎて溶けていた)。
const LOSER_HALF_COLOR = "#3E3830";
// 行間の区切り線。敗者側背景(#3E3830)より明るくし、行の輪郭として視認できるようにする。
const ROW_DIVIDER_COLOR = "#524B42";

async function buildFullCardImage(
  article: NonNullable<ReturnType<typeof getOriginalArticle>>,
  eventName: string | null
) {
  const fights = article.fights;
  const headerHeight = 170;
  const footerHeight = 60;
  // 画像高さの式。generateMetadata()側のimageHeight計算と必ず値を同期させること。
  const totalHeight =
    headerHeight + TOP_GAP + COLUMN_HEADER_HEIGHT + fights.length * ROW_HEIGHT + BOTTOM_GAP + footerHeight;
  const fonts = await loadOgFonts();

  // 2026-08-06、装飾用のcornerVignette/stripeTextureは外枠全体ではなくヘッダー
  // ブロックにのみ付ける。外枠全体に付けていた際、各行の勝者/敗者/%セルの
  // 不透明backgroundColorが下の縞模様を完全に覆いきれず、行ごとに明度が
  // ばらついて見える(縞が透ける)不具合があったため。行リスト側はこの外枠の
  // 単色backgroundColorだけを背景にする(重ね合わせ自体を発生させない)。
  const img = new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: `${totalHeight}px`,
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLORS.sumi,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            height: `${headerHeight}px`,
            backgroundImage: `${cornerVignette()}, ${stripeTexture()}`,
          }}
        >
          {eventName ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "44px",
                  color: COLORS.gold,
                  letterSpacing: "2px",
                }}
              >
                {eventName}
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 700,
                  fontSize: "20px",
                  color: COLORS.washi,
                }}
              >
                全{fights.length}試合 AI予想
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                fontFamily: "Noto Sans JP",
                fontWeight: 900,
                fontSize: "32px",
                color: COLORS.gold,
                letterSpacing: "2px",
              }}
            >
              全{fights.length}試合 AI予想
            </div>
          )}
        </div>

        <div style={{ display: "flex", width: "1200px", height: `${TOP_GAP}px`, backgroundColor: COLORS.sumi }} />

        <div style={{ display: "flex", width: "1200px", height: `${COLUMN_HEADER_HEIGHT}px`, alignItems: "center" }}>
          <div style={{ display: "flex", width: `${GUTTER_WIDTH}px`, flexShrink: 0 }} />
          <div style={{ display: "flex", width: `${NAME_WIDTH}px`, flexShrink: 0 }} />
          <div style={{ display: "flex", width: `${VS_CHIP_WIDTH}px`, flexShrink: 0 }} />
          <div style={{ display: "flex", width: `${NAME_WIDTH}px`, flexShrink: 0 }} />
          <div style={{ display: "flex", width: `${PCT_WIDTH}px`, flexShrink: 0, alignItems: "center", justifyContent: "center" }}>
            <span style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 700, fontSize: "14px", color: COLORS.washi, letterSpacing: "1px" }}>
              AI予想
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {fights.map((f, i) => {
            const aColor = f.predictedWinner === "A" ? COLORS.shu : LOSER_HALF_COLOR;
            const bColor = f.predictedWinner === "B" ? COLORS.shu : LOSER_HALF_COLOR;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  height: `${ROW_HEIGHT}px`,
                  width: "1200px",
                  overflow: "hidden",
                  borderTop: i === 0 ? "none" : `1px solid ${ROW_DIVIDER_COLOR}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: `${GUTTER_WIDTH}px`,
                    flexShrink: 0,
                    backgroundColor: COLORS.foot,
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Noto Sans JP",
                    fontWeight: 700,
                    fontSize: "15px",
                    color: COLORS.washi,
                    textAlign: "center",
                  }}
                >
                  {boutNumberLabel(f.weightClass)}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: `${NAME_WIDTH}px`,
                    flexShrink: 0,
                    backgroundColor: aColor,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 16px",
                  }}
                >
                  <span style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "26px", color: COLORS.washi }}>
                    {f.fighterA.nameJa}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    width: `${VS_CHIP_WIDTH}px`,
                    flexShrink: 0,
                    backgroundColor: COLORS.sumi,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: COLORS.gold }}>VS</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    width: `${NAME_WIDTH}px`,
                    flexShrink: 0,
                    backgroundColor: bColor,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 16px",
                  }}
                >
                  <span style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "26px", color: COLORS.washi }}>
                    {f.fighterB.nameJa}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    width: `${PCT_WIDTH}px`,
                    flexShrink: 0,
                    backgroundColor: COLORS.sumi,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {typeof f.confidencePct === "number" && (
                    <span style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "38px", color: "#FFFFFF" }}>
                      {f.confidencePct}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", width: "1200px", height: `${BOTTOM_GAP}px`, backgroundColor: COLORS.sumi }} />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            flex: 1,
            backgroundColor: COLORS.foot,
            padding: "0 56px",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "24px", color: COLORS.washi, letterSpacing: "1px" }}>
            MNEWS.JP
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: totalHeight, fonts: OG_FONT_FAMILIES(fonts) }
  );
  return new Response(img.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const article = getOriginalArticle(slug);
    if (!article) return fallbackRedirect();
    if (article.fights.length > 1) {
      return await buildFullCardImage(article, resolveEventName(article.eventSlug));
    }
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
