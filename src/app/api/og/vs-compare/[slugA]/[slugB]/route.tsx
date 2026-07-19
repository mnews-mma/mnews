// 対戦カード比較ビジュアル(共通対戦相手・直近5戦・相性)のOG画像生成。
// 公開の/api/og/vsと同じ「新カードUI」レンダラー部品(src/lib/og/vsCardBlocks.tsx)
// を共有し、見た目を1実装に一本化する(コーナーストリップ・赤/青選手名・
// 戦績/勝率/フィニッシュ率の3行・W/Lドット)。このルート固有の追加要素
// (共通対戦相手テーブル・複数アスペクト比)はこのファイル側で描画する。
//
// セキュリティ境界: このルートは/admin/drafts(管理画面)タブ④専用で、
// 公開ページからは一切リンクされない。そのため「大会名(任意)・階級(任意)」の
// クエリ文字列による自由入力を許可している。公開・非認証で誰でも到達する
// /api/og/vs側は同じ理由で任意文字列を一切受け付けない(そちらのコメント参照)。
//
// データは既存の純関数(computeFighterStripStats/computeCommonOpponents)を
// そのまま流用し、算出ロジックの二重実装はしない。
// 通称・AI RIZINランキングはカード画像には出さない(2026-07-19: 公開/api/og/vs・
// Web版MatchupTape/VsCardと同じ方針に統一。単一ソース化のため)。AIランキングは
// 引き続きXポスト本文側でのみ表示する(xPost.tsのwithRankPrefix、既存方針は維持)。
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, type Fighter } from "@/lib/fighters";
import { fetchFighterRecordsStrict, mergeFighterRecord } from "@/lib/fighterRecordsCache";
import type { FitOpts } from "@/lib/og/fitName";
import { computeCommonOpponents } from "@/lib/articleGenerator";
import { SITE_URL, loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";
import { VS_COLORS, CornerStrip, NameBlock, StatRow, MethodRow, FormDots, CardFooter, sharedNameFit, fighterVsStats } from "@/lib/og/vsCardBlocks";

export const runtime = "edge";

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}

// SNS向け3比率。指定なし/不正値は4:5(縦長)を既定にする(スクショ運用の置き換えが主目的のため)。
const RATIOS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "16:9": { width: 1200, height: 630 },
};
// 共通対戦相手テーブルの最大表示件数。16:9は縦寸が630pxしかなく他の要素
// (統計3行・内訳・W/Lドット)だけで大半を使うため、比率ごとに縦寸の余裕に
// 応じて件数を変える(はみ出し防止。全件はcommonsOverflowで「ほかN人」表記)。
// 16:9(630px)は事前計測でランキングバッジ+大会名+階級+統計3行+内訳+
// ドットだけで既に縦寸をほぼ使い切る(公開/api/og/vsの1200x630と同じ制約)
// ことを確認済みのため、共通対戦相手テーブルは0件(非表示)にする。
const MAX_COMMONS_ROWS: Record<string, number> = { "1:1": 5, "4:5": 6, "16:9": 0 };

const RESULT_COLOR: Record<string, string> = {
  win: VS_COLORS.win,
  loss: VS_COLORS.redInk,
  draw: VS_COLORS.muted,
  nc: VS_COLORS.muted,
};
const RESULT_MARK: Record<string, string> = { win: "○", loss: "●", draw: "△", nc: "△" };

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
    // computeCommonOpponents は history 全量を要る(mergeFighterRecordが返す
    // ResolvedFighterはFighterRecordEntryの上位互換)。
    const entryA = { ...fighterA, history: recordsResult.records[slugA]?.history ?? [] };
    const entryB = { ...fighterB, history: recordsResult.records[slugB]?.history ?? [] };

    // 管理画面限定ルートのため、大会名・階級はクエリからの自由入力を許可する
    // (ファイル冒頭のセキュリティ境界コメント参照)。
    const searchParams = new URL(req.url).searchParams;
    const wcLabel = (searchParams.get("wc") ?? "").trim();
    const evLabel = (searchParams.get("ev") ?? "").trim();
    const ratioKey = (searchParams.get("ratio") ?? "4:5").trim();
    const { width, height } = RATIOS[ratioKey] ?? RATIOS["4:5"];
    const maxCommonsRows = MAX_COMMONS_ROWS[ratioKey] ?? MAX_COMMONS_ROWS["4:5"];

    const nameZone: FitOpts = { maxWidth: (width - 200) / 2, maxHeight: 110, maxFont: 56, minFont: 26, maxLines: 2 };
    const { fitA, fitB } = sharedNameFit(fighterA.nameJa, fighterB.nameJa, nameZone);

    const statsA = fighterVsStats(fighterA);
    const statsB = fighterVsStats(fighterB);

    // 共通対戦相手は1相手=1行に集約する(Web版CommonOpponentsList.tsxと同じ、
    // #75で導入したgroupCommonOpponents相当。ここでは複数対戦を「(N戦目)」で
    // 縦に並べず、最新の結果のみ1行に代表させる=画像という縦寸制約のある
    // フォーマットでの簡略表示とする)。
    const commonsAllRaw = computeCommonOpponents(entryA, entryB);
    const seen = new Set<string>();
    const commonsAll = commonsAllRaw.filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });
    const commons = commonsAll.slice(0, maxCommonsRows);
    const commonsOverflow = commonsAll.length - commons.length;

    const fonts = await loadOgFonts();

    const img = new ImageResponse(
      (
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            display: "flex",
            flexDirection: "column",
            backgroundColor: VS_COLORS.card,
          }}
        >
          <CornerStrip />

          {/* 大会名(任意)+階級(任意)。管理画面での手指定のみ(空欄ならそれぞれ非表示) */}
          {(evLabel !== "" || wcLabel !== "") && (
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
              {evLabel !== "" && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "18px", color: VS_COLORS.ink }}>
                  {evLabel}
                </div>
              )}
              {wcLabel !== "" && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "15px", color: VS_COLORS.gold }}>
                  {wcLabel}
                </div>
              )}
            </div>
          )}

          {/* 選手名 + 中央VS */}
          <div style={{ display: "flex", alignItems: "center", padding: "20px 56px 0" }}>
            <NameBlock fit={fitA} zone={nameZone} side="left" />
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "36px", color: VS_COLORS.dim, letterSpacing: "2px", padding: "0 16px" }}>
              VS
            </div>
            <NameBlock fit={fitB} zone={nameZone} side="right" />
          </div>

          {/* 戦績・勝率・フィニッシュ率(公開/api/og/vsと同じ3行構成・3カラム配置) */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "16px" }}>
            <StatRow label="戦績" displayA={statsA.record} displayB={statsB.record} valueSize={28} labelSize={15} sidePadding={56} />
            <StatRow label="勝率" displayA={statsA.winRate !== null ? `${statsA.winRate}%` : "—"} displayB={statsB.winRate !== null ? `${statsB.winRate}%` : "—"} valueSize={28} labelSize={15} sidePadding={56} />
            <StatRow label="フィニッシュ率" displayA={statsA.finishRate !== null ? `${statsA.finishRate}%` : "—"} displayB={statsB.finishRate !== null ? `${statsB.finishRate}%` : "—"} valueSize={28} labelSize={15} sidePadding={56} />
          </div>

          {/* KO/一本/判定の内訳 */}
          <div style={{ display: "flex", padding: "8px 56px 0" }}>
            <MethodRow f={fighterA} side="left" size={14} />
            <MethodRow f={fighterB} side="right" size={14} />
          </div>

          {/* 直近5戦のW/L/Dドット */}
          <div style={{ display: "flex", padding: "10px 56px 0" }}>
            <FormDots results={statsA.last5} side="left" dot={22} />
            <FormDots results={statsB.last5} side="right" dot={22} />
          </div>

          {/* 共通対戦相手テーブル(0件ならこのブロック自体を省略) */}
          {commons.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "18px 56px 0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 800,
                  fontSize: "13px",
                  color: VS_COLORS.muted,
                  borderBottom: `1px solid ${VS_COLORS.lineSoft}`,
                  paddingBottom: "8px",
                }}
              >
                <div style={{ display: "flex" }}>共通対戦相手</div>
                <div style={{ display: "flex", gap: "30px" }}>
                  <div style={{ display: "flex", width: "30px", justifyContent: "center" }}>A</div>
                  <div style={{ display: "flex", width: "30px", justifyContent: "center" }}>B</div>
                </div>
              </div>
              {commons.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "9px 0",
                    borderBottom: i < commons.length - 1 ? `1px solid ${VS_COLORS.lineSoft}` : "none",
                  }}
                >
                  <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "16px", color: VS_COLORS.ink }}>
                    {c.name}
                  </div>
                  <div style={{ display: "flex", gap: "30px" }}>
                    <div style={{ display: "flex", width: "30px", justifyContent: "center", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "18px", color: c.resultA ? RESULT_COLOR[c.resultA] : VS_COLORS.dim }}>
                      {c.resultA ? RESULT_MARK[c.resultA] : "-"}
                    </div>
                    <div style={{ display: "flex", width: "30px", justifyContent: "center", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "18px", color: c.resultB ? RESULT_COLOR[c.resultB] : VS_COLORS.dim }}>
                      {c.resultB ? RESULT_MARK[c.resultB] : "-"}
                    </div>
                  </div>
                </div>
              ))}
              {commonsOverflow > 0 && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 700, fontSize: "12px", color: VS_COLORS.muted, marginTop: "6px" }}>
                  ほか{commonsOverflow}人
                </div>
              )}
            </div>
          )}

          {commons.length === 0 && <div style={{ display: "flex", flex: 1 }} />}
          <CardFooter />
        </div>
      ),
      { width, height, fonts: OG_FONT_FAMILIES(fonts) }
    );
    return new Response(img.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("OG vs-compare card generation failed:", err);
    return fallbackRedirect();
  }
}
