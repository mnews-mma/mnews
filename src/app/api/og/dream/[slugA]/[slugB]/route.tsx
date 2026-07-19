// /dream(夢のカード)専用OGP画像。公開・非認証のルートだが、/api/og/vsと違い
// event/weight のクエリ自由入力を許可する。理由: /dreamはそもそも「実現したら」の
// 仮定(妄想)機能であり、ユーザーが任意の大会名を入れること自体が想定用途。
// ただし実カード(【対戦決定】)との混同=偽の公式発表に見えることを防ぐため、
// 「夢のカード / もし実現したら」マーカーを最上部に常時・固定表示し、
// クエリでは消せないようにする(/api/og/vsが自由入力eventを禁止する設計思想と対になる
// 安全策)。/api/og/vs・/api/og/vs-compareと同じvsCardBlocks.tsxの共有部品を使い、
// 見た目のベースは1実装に揃える。通称は表示しない(公開/vs・vs-compareと同じ方針)。
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, type Fighter } from "@/lib/fighters";
import { fetchFighterRecordsStrict, mergeFighterRecord } from "@/lib/fighterRecordsCache";
import type { FitOpts } from "@/lib/og/fitName";
import { SITE_URL, loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";
import { VS_COLORS, CornerStrip, NameBlock, StatRow, MethodRow, FormDots, CardFooter, sharedNameFit, fighterVsStats } from "@/lib/og/vsCardBlocks";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}

const NAME_ZONE: FitOpts = { maxWidth: 460, maxHeight: 150, maxFont: 108, minFont: 30, maxLines: 2 };

// 改行除去・トリム・長さ上限で自由入力を無害化する(捏造防止ではなく表示崩れ・
// レイアウト破壊対策。marker自体は別途常時表示するため実カードに見える心配はない)。
function sanitizeLabel(raw: string | null, maxLen: number): string {
  return (raw ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slugA: string; slugB: string }> }
) {
  try {
    const { slugA, slugB } = await params;
    const seedA = getFighter(slugA);
    const seedB = getFighter(slugB);
    if (!seedA || !seedB) return fallbackRedirect();

    const recordsResult = await fetchFighterRecordsStrict();
    if (!recordsResult.ok) return fallbackRedirect();

    const fighterA = mergeFighterRecord(seedA as Fighter, recordsResult.records);
    const fighterB = mergeFighterRecord(seedB as Fighter, recordsResult.records);

    const searchParams = new URL(req.url).searchParams;
    const eventLabel = sanitizeLabel(searchParams.get("event"), 60);
    const weightLabel = sanitizeLabel(searchParams.get("weight"), 20);

    const { fitA, fitB } = sharedNameFit(fighterA.nameJa, fighterB.nameJa, NAME_ZONE);
    const statsA = fighterVsStats(fighterA);
    const statsB = fighterVsStats(fighterB);

    const fonts = await loadOgFonts();

    const img = new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            backgroundColor: VS_COLORS.card,
            position: "relative",
          }}
        >
          <CornerStrip />

          {/* 夢のカードマーカー: 常時表示・パラメータで消せない(偽の対戦決定カードに
              見えないようにする安全策)。大会名・階級はあれば併記する。 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              backgroundColor: VS_COLORS.panel,
              borderBottom: `1px solid ${VS_COLORS.lineSoft}`,
              padding: "12px 0",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "16px", color: VS_COLORS.gold }}>
              夢のカード / もし実現したら
            </div>
            {(eventLabel || weightLabel) && (
              <div style={{ display: "flex", gap: "10px", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "14px", color: VS_COLORS.ink }}>
                {eventLabel && <div style={{ display: "flex" }}>{eventLabel}</div>}
                {weightLabel && <div style={{ display: "flex" }}>{weightLabel}</div>}
              </div>
            )}
          </div>

          {/* 選手名 + 中央VS(通称は表示しない。公開/vs・vs-compareと同じ方針) */}
          <div style={{ display: "flex", alignItems: "center", padding: "20px 56px 0" }}>
            <NameBlock fit={fitA} zone={NAME_ZONE} side="left" />
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "44px", color: VS_COLORS.dim, letterSpacing: "2px", padding: "0 24px" }}>
              VS
            </div>
            <NameBlock fit={fitB} zone={NAME_ZONE} side="right" />
          </div>

          {/* 戦績・勝率・フィニッシュ率(公開/api/og/vsと同じ3行構成) */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "20px" }}>
            <StatRow label="戦績" displayA={statsA.record} displayB={statsB.record} />
            <StatRow label="勝率" displayA={statsA.winRate !== null ? `${statsA.winRate}%` : "—"} displayB={statsB.winRate !== null ? `${statsB.winRate}%` : "—"} />
            <StatRow label="フィニッシュ率" displayA={statsA.finishRate !== null ? `${statsA.finishRate}%` : "—"} displayB={statsB.finishRate !== null ? `${statsB.finishRate}%` : "—"} />
          </div>

          {/* KO/一本/判定の内訳 */}
          <div style={{ display: "flex", padding: "10px 56px 0" }}>
            <MethodRow f={fighterA} side="left" />
            <MethodRow f={fighterB} side="right" />
          </div>

          {/* 直近5戦のW/L/Dドット */}
          <div style={{ display: "flex", padding: "14px 56px 0" }}>
            <FormDots results={statsA.last5} side="left" />
            <FormDots results={statsB.last5} side="right" />
          </div>

          <div style={{ display: "flex", flex: 1 }} />
          <CardFooter />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: OG_FONT_FAMILIES(fonts),
      }
    );
    return new Response(img.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("OG dream card generation failed:", err);
    return fallbackRedirect();
  }
}
