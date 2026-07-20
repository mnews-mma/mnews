import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, type Fighter } from "@/lib/fighters";
import { fetchFighterRecordsStrict, mergeFighterRecord } from "@/lib/fighterRecordsCache";
import { findMatchupEvent } from "@/lib/events";
import type { NameZone } from "@/lib/og/vsCardBlocks";
import { SITE_URL, loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";
import { VS_COLORS, CornerStrip, NameBlock, StatRow, MethodRow, FormDots, CardFooter, sharedNameFit, fighterVsStats, CEILING_OG } from "@/lib/og/vsCardBlocks";

export const runtime = "edge";

// これは公開・非認証のルート(このURLは/vs/[slugA]/[slugB]のog:imageとして
// 誰でも取得できる)。任意文字列をクエリで受け付けて画像に描画すると、
// 実在選手の写真"を伴った"公式風の偽カード画像を第三者が自由に量産できて
// しまう(第三者がURLに任意の大会名・タイトルマッチ表記を注入できる穴に
// なる)。そのため、このルートに表示する大会名は
// findMatchupEvent()(自社EVENTデータとの名前一致)で確定した値のみを使い、
// クエリパラメータからの任意文字列は一切受け付けない。任意の大会名・階級を
// 指定したい場合は管理画面限定の/api/og/vs-compareを使うこと(公開ページから
// 一切リンクされないadmin専用ツールのため、その用途に限り許容する)。
function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}

const NAME_ZONE: NameZone = { maxWidth: 460, maxHeight: 150, minFont: 30, maxLines: 2 };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slugA: string; slugB: string }> }
) {
  try {
    const { slugA, slugB } = await params;
    const seedA = getFighter(slugA);
    const seedB = getFighter(slugB);
    if (!seedA || !seedB) return fallbackRedirect();

    // fetchは1回だけ行い、両選手のマージに使い回す(片方だけ一時失敗して
    // 非対称な結果になる事故を防ぐ)。fetch自体が失敗した場合は0-0の
    // シード値で確定カードを生成せず、フォールバック画像にリダイレクトする
    // (実在選手の戦績を誤った0-0のまま画像化・拡散させないため)。
    const recordsResult = await fetchFighterRecordsStrict();
    if (!recordsResult.ok) return fallbackRedirect();

    const fighterA = mergeFighterRecord(seedA as Fighter, recordsResult.records);
    const fighterB = mergeFighterRecord(seedB as Fighter, recordsResult.records);

    const { fitA, fitB } = sharedNameFit(fighterA.nameJa, fighterB.nameJa, NAME_ZONE, CEILING_OG);
    const statsA = fighterVsStats(fighterA);
    const statsB = fighterVsStats(fighterB);

    // 大会名は自社EVENTデータとの名前一致(findMatchupEvent)で確定した場合の
    // みDB由来の値として表示する。クエリからの任意文字列は使わない。
    const matchup = findMatchupEvent(fighterA.nameJa, fighterB.nameJa);
    const eventLabel = matchup
      ? `${matchup.event.eventName}　|　${matchup.event.date.replaceAll("-", ".")}${
          matchup.event.venue ? `　${matchup.event.venue}` : ""
        }`
      : null;

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

          {/* 大会情報帯(findMatchupEventで紐付いた場合のみ。無ければ帯ごと省略) */}
          {eventLabel && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: VS_COLORS.panel,
                borderBottom: `1px solid ${VS_COLORS.lineSoft}`,
                padding: "12px 0",
              }}
            >
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "16px", color: VS_COLORS.ink }}>
                {eventLabel}
              </div>
            </div>
          )}

          {/* 選手名 + 中央VS。通称はWebカード側(MatchupTape)で対戦カードから
              廃止済み(選手個別ページのみ表示、対戦カード系は選手名のみ)の方針に
              揃え、ここでも表示しない(2026-07-18: OG側が追随しておらず旧デザイン
              のまま通称が残っていたのを修正)。 */}
          <div style={{ display: "flex", alignItems: "center", padding: "28px 56px 0" }}>
            <NameBlock fit={fitA} zone={NAME_ZONE} side="left" />
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "44px", color: VS_COLORS.dim, letterSpacing: "2px", padding: "0 24px" }}>
              VS
            </div>
            <NameBlock fit={fitB} zone={NAME_ZONE} side="right" />
          </div>

          {/* 戦績・勝率・フィニッシュ率(Web版と同じ3行構成・3カラム配置) */}
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

          {/* 直近5戦のW/L/Dドット(綱引きバーは廃止済みのため出さない) */}
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
    console.error("OG vs card generation failed:", err);
    return fallbackRedirect();
  }
}
