import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { fetchArticlesForJstDay } from "@/lib/archiveDayFeed";
import { SITE_URL, loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";

// ブランドカード(public/og-default.png)と同じ赤。ダイジェストカードは
// この静的カードの意匠を踏襲する
const BRAND_RED = "#E8002D";

// 他のOGルートと違いedgeではなくnodejsで動かす。このルートだけが
// archive.json(30分ごとに更新されるバッチ出力)を読むためで、Edge runtime側の
// fetch層は`next: { revalidate: 300 }`を指定しても古いコピーが固定されたままに
// なる実測がある(2026-08-13: 同じ`fetchArticlesForJstDay()`・同じURL・同じ
// revalidateで、Node/ISRの/archive/[date]が8/12=29件を返す一方、edgeだった
// このルートは22件=約19時間前のコピーを返し続けた。キャッシュバスターを
// 付けてx-vercel-cache: MISSにしても変わらなかった)。当日分の記事が
// 見えずフォールバック307になるため、鮮度が実証されているNode側に寄せる。
export const runtime = "nodejs";

// fetch(archive.json)失敗・データ不備時のフォールバック。成功時の長期
// キャッシュと違い、no-storeを明示しないとCDN/Xのクローラーが307自体を
// 長期キャッシュし、原因解消後もフォールバック画像に固定され続ける事故に
// なる(このルート自体は自動投稿経路を持たないが、他OGルートと挙動を
// 統一する)。
function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}

// 朝の「昨日のまとめ」ポスト用カード(1200×675)。
// 静的ブランドカード(og-default.png)の意匠に「DAILY DIGEST / 日付 / 件数」
// だけを足したもの。個別ニュースの見出し・団体タグは載せない(どの記事が
// 選ばれたかで絵柄が変わらないようにするため)。
// 下端左はX側がタイトルのオーバーレイを重ねるため、情報を置かない。
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fallbackRedirect();

    const articles = await fetchArticlesForJstDay(dateStr);
    if (articles.length === 0) return fallbackRedirect();

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
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: BRAND_RED,
          }}
        >
          {/* DAILY DIGEST | 日付(ブランドカードのタグライン位置) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "22px",
              marginBottom: "34px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "38px",
                color: "#FFFFFF",
                letterSpacing: "8px",
              }}
            >
              DAILY DIGEST
            </div>
            <div style={{ display: "flex", width: "2px", height: "30px", backgroundColor: "rgba(255,255,255,0.55)" }} />
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "38px",
                color: "#FFFFFF",
                letterSpacing: "3px",
              }}
            >
              {dateLabel}
            </div>
          </div>

          {/* ブランドロゴ(og-default.pngと同じ構成) */}
          <div
            style={{
              display: "flex",
              fontFamily: "Noto Sans JP",
              fontWeight: 900,
              fontSize: "108px",
              color: "#FFFFFF",
              borderBottom: "9px solid #FFFFFF",
              paddingBottom: "18px",
            }}
          >
            Mニュース
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Noto Sans JP",
              fontWeight: 900,
              fontSize: "42px",
              color: "#FFFFFF",
              marginTop: "20px",
            }}
          >
            RIZIN / DEEP / パンクラス / 修斗
          </div>

          {/* 件数(どの記事が選ばれたかには依存しない) */}
          <div
            style={{
              display: "flex",
              fontFamily: "Noto Sans JP",
              fontWeight: 900,
              fontSize: "32px",
              color: "rgba(255,255,255,0.92)",
              marginTop: "44px",
            }}
          >
            昨日のMMAニュースまとめ（全{articles.length}件）
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
