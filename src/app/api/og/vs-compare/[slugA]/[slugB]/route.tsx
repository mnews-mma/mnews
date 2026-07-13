// 対戦カード比較ビジュアル(共通対戦相手・直近5戦・相性)のOG画像生成。
// 既存の /api/og/vs (通算戦績のみのVSカード)を拡張し、管理画面
// (/admin/drafts タブ④)向けに「共通対戦相手テーブル・直近5戦」を追加した
// 縦長SNS向けカードを生成する。既存 /api/og/vs 自体は他の呼び出し元
// (/vs/[slugA]/[slugB]、/tools/fighter-card、記事下書き)がそのまま使い続ける
// ため変更しない(このルートは完全に新規・独立)。
//
// データは既存の純関数(computeFighterStripStats/computeCommonOpponents)を
// そのまま流用し、算出ロジックの二重実装はしない。レート数値(mnewsRating)は
// 一切出さない。ランキング順位バッジは2026-07-14、実際の生成画像を見た運用側の
// 判断で「ノイズになる」として廃止した(情報量よりカードの読みやすさを優先)。
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, type Fighter } from "@/lib/fighters";
import { fetchFighterRecordsStrict, mergeFighterRecord } from "@/lib/fighterRecordsCache";
import { fitName, type FitOpts } from "@/lib/og/fitName";
import { computeFighterStripStats, LAST5_SYMBOL } from "@/lib/fighterStrip";
import { computeCommonOpponents } from "@/lib/articleGenerator";
import {
  OG_COLORS as COLORS,
  SITE_URL,
  loadOgFonts,
  OG_FONT_FAMILIES,
  stripeTexture,
  cornerVignette,
} from "@/lib/ogShared";

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

const RESULT_COLOR: Record<string, string> = {
  win: "#22C55E",
  loss: "#EF4444",
  draw: COLORS.ash,
  nc: COLORS.ash,
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
    // computeCommonOpponents/computeFighterStripStats は history 全量を要る
    // (mergeFighterRecordが返すResolvedFighterはFighterRecordEntryの上位互換)。
    const entryA = { ...fighterA, history: recordsResult.records[slugA]?.history ?? [] };
    const entryB = { ...fighterB, history: recordsResult.records[slugB]?.history ?? [] };

    const searchParams = new URL(req.url).searchParams;
    const wcLabel = (searchParams.get("wc") ?? "").trim();
    const evLabel = (searchParams.get("ev") ?? "").trim();
    const ratioKey = (searchParams.get("ratio") ?? "4:5").trim();
    const { width, height } = RATIOS[ratioKey] ?? RATIOS["4:5"];

    const nameZone: FitOpts = { maxWidth: (width - 120) / 2, maxHeight: 100, maxFont: 52, minFont: 24, maxLines: 2 };
    const fitAOwn = fitName(fighterA.nameJa, nameZone);
    const fitBOwn = fitName(fighterB.nameJa, nameZone);
    const sharedFontSize = Math.min(fitAOwn.fontSize, fitBOwn.fontSize);
    const sharedZone: FitOpts = { ...nameZone, maxFont: sharedFontSize, minFont: sharedFontSize };
    const fitA = fitName(fighterA.nameJa, sharedZone);
    const fitB = fitName(fighterB.nameJa, sharedZone);

    const statsA = computeFighterStripStats(entryA);
    const statsB = computeFighterStripStats(entryB);
    // 画像内に収まる範囲(最大6件)に絞る。データ自体は既存の.slice(0,8)慣習と
    // 同じcomputeCommonOpponentsをそのまま使い、表示側だけ画像の縦寸に合わせて絞る。
    const commonsAllRaw = computeCommonOpponents(entryA, entryB);
    // 同一相手との複数回対戦は行分割されているため、2回目以降は「(2戦目)」等の
    // ラベルを付けて区別する(既存のCommonOpponentRows・FighterVisuals.tsxと同じ表記)。
    const nameSeenCount = new Map<string, number>();
    const commonsAll = commonsAllRaw.map((c) => {
      const seenBefore = nameSeenCount.get(c.name) ?? 0;
      nameSeenCount.set(c.name, seenBefore + 1);
      return { ...c, label: seenBefore > 0 ? `${c.name}（${seenBefore + 1}戦目）` : c.name };
    });
    const commons = commonsAll.slice(0, 6);
    const commonsOverflow = commonsAll.length - commons.length;

    // 共通対戦相手テーブルの列見出し。「A」「B」等の記号表記はどちらの選手か
    // 直感的に分からず分かりにくいというフィードバックを受け、実際の選手名
    // (短い列幅に収まるよう個別にfitName)に変更した(2026-07-14)。
    const tableColZone: FitOpts = { maxWidth: 108, maxHeight: 40, maxFont: 15, minFont: 10, maxLines: 2 };
    const tableFitA = fitName(fighterA.nameJa, tableColZone);
    const tableFitB = fitName(fighterB.nameJa, tableColZone);

    const fonts = await loadOgFonts();

    const img = new ImageResponse(
      (
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            display: "flex",
            flexDirection: "column",
            backgroundColor: COLORS.sumi,
            backgroundImage: `${cornerVignette()}, ${stripeTexture()}`,
            position: "relative",
          }}
        >
          {/* 大会情報帯(任意) */}
          {evLabel !== "" && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: COLORS.washi,
                padding: "16px 0",
              }}
            >
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "22px", color: COLORS.sumi, letterSpacing: "1px" }}>
                {evLabel}
              </div>
            </div>
          )}

          {/* MATCH UP + 階級ラベル */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "24px 0 0" }}>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "26px", color: COLORS.ash, letterSpacing: "10px", paddingLeft: "10px" }}>
              MATCH UP
            </div>
            {wcLabel !== "" && (
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "26px", color: COLORS.gold, letterSpacing: "1px" }}>
                {wcLabel}
              </div>
            )}
          </div>

          {/* 両者名 + VS */}
          <div style={{ display: "flex", alignItems: "center", padding: "18px 24px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {fitA.lines.map((line, i) => (
                  <div key={i} style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: `${fitA.fontSize}px`, lineHeight: 1.1, color: "#FFFFFF" }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "48px", color: COLORS.shu, padding: "0 16px" }}>VS</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                {fitB.lines.map((line, i) => (
                  <div key={i} style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: `${fitB.fontSize}px`, lineHeight: 1.1, color: "#FFFFFF" }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 通算戦績・直近5戦・フィニッシュ率(左右対称) */}
          <div style={{ display: "flex", alignItems: "center", padding: "20px 24px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-start" }}>
              <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "56px", color: COLORS.gold, lineHeight: 1 }}>
                {statsA.record}
              </div>
              {statsA.last5.length > 0 && (
                <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
                  <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "15px", color: COLORS.ash }}>
                    直近{statsA.last5.length}戦
                  </div>
                  <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "20px", letterSpacing: "2px" }}>
                    {statsA.last5.map((r, i) => (
                      <span key={i} style={{ color: RESULT_COLOR[r] }}>{RESULT_MARK[r]}</span>
                    ))}
                  </div>
                </div>
              )}
              {statsA.finishRate !== null && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "15px", color: COLORS.ash, marginTop: "6px" }}>
                  フィニッシュ率{statsA.finishRate}%
                </div>
              )}
            </div>
            <div style={{ display: "flex", width: "40px" }} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-end" }}>
              <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "56px", color: COLORS.gold, lineHeight: 1 }}>
                {statsB.record}
              </div>
              {statsB.last5.length > 0 && (
                <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
                  <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "20px", letterSpacing: "2px" }}>
                    {statsB.last5.map((r, i) => (
                      <span key={i} style={{ color: RESULT_COLOR[r] }}>{RESULT_MARK[r]}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "15px", color: COLORS.ash }}>
                    直近{statsB.last5.length}戦
                  </div>
                </div>
              )}
              {statsB.finishRate !== null && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "15px", color: COLORS.ash, marginTop: "6px" }}>
                  フィニッシュ率{statsB.finishRate}%
                </div>
              )}
            </div>
          </div>

          {/* 共通対戦相手テーブル(0件ならこのブロック自体を省略) */}
          {commons.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "28px 24px 0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "16px",
                  color: COLORS.ash,
                  borderBottom: `1px solid rgba(255,255,255,0.18)`,
                  paddingBottom: "10px",
                }}
              >
                <div style={{ display: "flex" }}>共通対戦相手</div>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", width: "108px", alignItems: "center" }}>
                    {tableFitA.lines.map((line, i) => (
                      <div key={i} style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: `${tableFitA.fontSize}px`, lineHeight: 1.2, color: COLORS.gold }}>
                        {line}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", width: "108px", alignItems: "center" }}>
                    {tableFitB.lines.map((line, i) => (
                      <div key={i} style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: `${tableFitB.fontSize}px`, lineHeight: 1.2, color: COLORS.gold }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {commons.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: i < commons.length - 1 ? `1px solid rgba(255,255,255,0.08)` : "none",
                  }}
                >
                  <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "18px", color: "#FFFFFF" }}>
                    {c.label}
                  </div>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ display: "flex", width: "108px", justifyContent: "center", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "22px", color: c.resultA ? RESULT_COLOR[c.resultA] : COLORS.ash }}>
                      {c.resultA ? RESULT_MARK[c.resultA] : "-"}
                    </div>
                    <div style={{ display: "flex", width: "108px", justifyContent: "center", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "22px", color: c.resultB ? RESULT_COLOR[c.resultB] : COLORS.ash }}>
                      {c.resultB ? RESULT_MARK[c.resultB] : "-"}
                    </div>
                  </div>
                </div>
              ))}
              {commonsOverflow > 0 && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "13px", color: COLORS.ash, marginTop: "8px" }}>
                  ほか{commonsOverflow}人
                </div>
              )}
            </div>
          )}

          {/* フッター */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", backgroundColor: COLORS.foot, padding: "18px 32px", marginTop: "auto" }}>
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: COLORS.ash, letterSpacing: "1px" }}>
              MNEWS.JP
            </div>
          </div>
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
