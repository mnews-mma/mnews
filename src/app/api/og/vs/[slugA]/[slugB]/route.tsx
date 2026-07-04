import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, calcFighterRates, type Fighter } from "@/lib/fighters";
import { resolveFighter, type ResolvedFighter } from "@/lib/feeds/resolveFighter";
import { SOURCES } from "@/lib/sources";
import { findMatchupEvent } from "@/lib/events";
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

function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, 307);
}

// 名前ゾーンの寸法。本番カードの名前領域の実寸に合わせる
// (VS列140px・フッター等を除いた片側の実効幅474pxに対し、安全マージンを
// 見て460。高さは下の戦績/勝率/二つ名が収まる範囲で2行までを許容)。
const NAME_ZONE: FitOpts = { maxWidth: 460, maxHeight: 180, maxFont: 120, minFont: 32, maxLines: 2 };

function FighterSide({
  f,
  corner,
  fit,
}: {
  f: ResolvedFighter;
  corner: "left" | "right";
  fit: { fontSize: number; lines: string[] };
}) {
  const orgLabel = SOURCES[f.org]?.label ?? f.org.toUpperCase();
  const { winRate, finishRate } = calcFighterRates(f);
  const align = corner === "left" ? "flex-start" : "flex-end";
  const accent = corner === "left" ? COLORS.shu : COLORS.indigo;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: align, padding: "0 28px" }}>
      <div
        style={{
          display: "flex",
          fontFamily: "Noto Sans JP",
          fontWeight: 900,
          fontSize: "16px",
          color: "#FFFFFF",
          background: accent,
          padding: "4px 10px",
          letterSpacing: "1px",
        }}
      >
        {orgLabel} / {f.weightClass}
      </div>

      {/* 名前ゾーン: fitName()で事前確定した行を1行ずつ描画(satoriの自動折り返しに頼らない) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: `${NAME_ZONE.maxWidth}px`,
          maxHeight: `${NAME_ZONE.maxHeight}px`,
          justifyContent: "center",
          alignItems: align,
          marginTop: "16px",
        }}
      >
        {fit.lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              fontFamily: "Noto Sans JP",
              fontWeight: 900,
              fontSize: `${fit.fontSize}px`,
              lineHeight: 1.05,
              letterSpacing: "-1px",
              color: "#FFFFFF",
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          fontFamily: "Bebas Neue",
          fontSize: "20px",
          color: COLORS.ash,
          marginTop: "8px",
          letterSpacing: "1px",
        }}
      >
        {f.nameEn}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Bebas Neue",
          fontSize: "80px",
          color: COLORS.gold,
          lineHeight: 1,
          marginTop: "22px",
        }}
      >
        {f.wins}-{f.losses}
        {f.draws > 0 ? `-${f.draws}` : ""}
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "14px", color: COLORS.ash }}>
          勝率{winRate !== null ? `${winRate}%` : "—"}
        </div>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontSize: "14px", color: COLORS.ash }}>
          フィニッシュ{finishRate !== null ? `${finishRate}%` : "—"}
        </div>
      </div>
      {f.nickname && (
        <div
          style={{
            display: "flex",
            fontFamily: "Noto Sans JP",
            fontWeight: 900,
            fontSize: "26px",
            color: COLORS.gold,
            marginTop: "18px",
          }}
        >
          {f.nickname}
        </div>
      )}
    </div>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slugA: string; slugB: string }> }
) {
  try {
    const { slugA, slugB } = await params;
    const seedA = getFighter(slugA);
    const seedB = getFighter(slugB);
    if (!seedA || !seedB) return fallbackRedirect();

    const [fighterA, fighterB] = await Promise.all([
      resolveFighter(seedA as Fighter),
      resolveFighter(seedB as Fighter),
    ]);

    // 左右の選手名は必ず同一フォントサイズにする。各名を個別にfitNameし、
    // 小さい方のfontSizeを共有サイズとして採用、その上で両名の行分割を
    // 共有サイズ基準で再計算する(片側だけの縮小はしない)。
    const fitAOwn = fitName(fighterA.nameJa, NAME_ZONE);
    const fitBOwn = fitName(fighterB.nameJa, NAME_ZONE);
    const sharedFontSize = Math.min(fitAOwn.fontSize, fitBOwn.fontSize);
    const sharedZone: FitOpts = { ...NAME_ZONE, maxFont: sharedFontSize, minFont: sharedFontSize };
    const fitA = fitName(fighterA.nameJa, sharedZone);
    const fitB = fitName(fighterB.nameJa, sharedZone);

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
            backgroundColor: COLORS.sumi,
            backgroundImage: `${cornerVignette()}, ${stripeTexture()}`,
            position: "relative",
          }}
        >
          {/* 大会情報帯（紐付けデータがある場合のみ。ない場合は帯ごと非表示でレイアウトは自然に詰まる） */}
          {eventLabel && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: COLORS.washi,
                padding: "14px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "18px",
                  color: COLORS.sumi,
                  letterSpacing: "1px",
                }}
              >
                {eventLabel}
              </div>
            </div>
          )}

          {/* MATCH UP ラベル */}
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0 0" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "18px",
                color: COLORS.ash,
                letterSpacing: "8px",
              }}
            >
              MATCH UP
            </div>
          </div>

          {/* 両選手 + 中央VS + 斜め分割線 */}
          <div style={{ display: "flex", flex: 1, alignItems: "center", position: "relative" }}>
            {/* 斜め分割線（中央やや太め、金色） */}
            <div
              style={{
                display: "flex",
                position: "absolute",
                left: "50%",
                top: "-80px",
                width: "6px",
                height: "760px",
                backgroundColor: COLORS.gold,
                opacity: 0.55,
                transform: "rotate(14deg)",
              }}
            />

            <FighterSide f={fighterA} corner="left" fit={fitA} />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "140px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontFamily: "Bebas Neue",
                  fontSize: "112px",
                  color: "#FFFFFF",
                  letterSpacing: "0px",
                  textShadow: "0 0 34px rgba(0,0,0,0.7)",
                }}
              >
                VS
              </div>
            </div>

            <FighterSide f={fighterB} corner="right" fit={fitB} />
          </div>

          {/* フッター */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              backgroundColor: COLORS.foot,
              padding: "18px 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "20px",
                color: COLORS.ash,
                letterSpacing: "1px",
              }}
            >
              MNEWS.JP
            </div>
          </div>
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
