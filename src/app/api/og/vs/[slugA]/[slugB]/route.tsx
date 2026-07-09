import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, calcFighterRates, type Fighter } from "@/lib/fighters";
import { type ResolvedFighter } from "@/lib/feeds/resolveFighter";
import { fetchFighterRecordsStrict, mergeFighterRecord } from "@/lib/fighterRecordsCache";
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

// fetch失敗・データ不備時のフォールバック。成功時(Cache-Control: public,
// max-age=3600)と違い、no-storeを明示しないとCDN/Xのクローラーが307自体を
// 長期キャッシュしてしまい、原因解消後もフォールバック画像に固定され続ける
// 事故になる(一時的な障害のはずが恒久的な表示崩れになる)。
function fallbackRedirect() {
  return NextResponse.redirect(`${SITE_URL}/og-image.png`, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
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
  const { winRate, finishRate } = calcFighterRates(f);
  const align = corner === "left" ? "flex-start" : "flex-end";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: align, padding: "0 28px" }}>
      {/* 団体表示・選手DB階級は出さない(夢のカード対応)。階級ラベルは中央に1つだけ。 */}
      {/* 名前ゾーン: fitName()で事前確定した行を1行ずつ描画(satoriの自動折り返しに頼らない) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: `${NAME_ZONE.maxWidth}px`,
          maxHeight: `${NAME_ZONE.maxHeight}px`,
          justifyContent: "center",
          alignItems: align,
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
      <div style={{ display: "flex", gap: "18px", marginTop: "12px" }}>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "19px", color: COLORS.ash }}>
          勝率{winRate !== null ? `${winRate}%` : "—"}
        </div>
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "19px", color: COLORS.ash }}>
          フィニッシュ{finishRate !== null ? `${finishRate}%` : "—"}
        </div>
      </div>
      {/* フィニッシュ内訳(KO/一本/判定)。個人OGカードと同じ resolveFighter 由来の
          ko/sub/decision をそのまま表示するだけで、算出ロジックは再実装しない。
          メソッド不明の試合は既存の classifyMethod によりどのカテゴリにも入らず
          合計が戦績と一致しないことがあるが、数値は捏造せずそのまま出す。 */}
      <div style={{ display: "flex", gap: "18px", marginTop: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", width: "11px", height: "11px", borderRadius: "2px", backgroundColor: COLORS.shu }} />
          <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "16px", color: "#FFFFFF" }}>
            KO {f.ko}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", width: "11px", height: "11px", borderRadius: "2px", backgroundColor: COLORS.gold }} />
          <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "16px", color: "#FFFFFF" }}>
            一本 {f.sub}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", width: "11px", height: "11px", borderRadius: "2px", backgroundColor: COLORS.indigo }} />
          <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 900, fontSize: "16px", color: "#FFFFFF" }}>
            判定 {f.decision}
          </div>
        </div>
      </div>
      {/* 通称はVSカードでは非表示(片側だけにあると要素数がズレて名前・戦績の縦位置が
          左右非対称になるため)。個人OGカードでは引き続き表示する。 */}
    </div>
  );
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

    // fetchは1回だけ行い、両選手のマージに使い回す(片方だけ一時失敗して
    // 非対称な結果になる事故を防ぐ)。fetch自体が失敗した場合は0-0の
    // シード値で確定カードを生成せず、フォールバック画像にリダイレクトする
    // (実在選手の戦績を誤った0-0のまま画像化・拡散させないため)。
    const recordsResult = await fetchFighterRecordsStrict();
    if (!recordsResult.ok) return fallbackRedirect();

    const fighterA = mergeFighterRecord(seedA as Fighter, recordsResult.records);
    const fighterB = mergeFighterRecord(seedB as Fighter, recordsResult.records);

    // カードに乗せる階級は対戦全体の手指定ラベル(?wc=)を1つだけ中央に表示する。
    // 選手固有の団体表示・選手DB階級は出さない(夢のカード/団体またぎで邪魔なため)。
    // 空欄なら階級ラベル行を出さない。
    const searchParams = new URL(req.url).searchParams;
    const wcLabel = (searchParams.get("wc") ?? "").trim();
    // 大会名(手指定・任意)。findMatchupEventによる自動紐付け(eventLabel、
    // 最上部の白帯)とは別物で、自動紐付けが無い対戦(夢のカード等)でも
    // MATCH UPラベルのすぐ上に軽量なサブラインとして表示できるようにする。
    // 空欄なら行ごと出さず従来レイアウトを維持する。
    const evLabel = (searchParams.get("ev") ?? "").trim();

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

          {/* 手指定の大会名(任意) + MATCH UP ラベル + 手指定の階級ラベル
              (対戦全体で1つずつ・空欄ならそれぞれ非表示) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              padding: "20px 0 0",
            }}
          >
            {evLabel !== "" && (
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "24px",
                  color: "#FFFFFF",
                  letterSpacing: "1px",
                }}
              >
                {evLabel}
              </div>
            )}
            <div
              style={{
                display: "flex",
                fontFamily: "Bebas Neue",
                fontSize: "26px",
                color: COLORS.ash,
                letterSpacing: "10px",
                // letterSpacingは文字の後ろに余白を作るため、末尾の1文字分
                // (10px)だけ右側に余分な幅が残り、alignItems:centerでの
                // 中央寄せがglyph基準でletterSpacingの半分(≒5px)左に
                // ズレる(実測−4.5px)。paddingLeftをletterSpacingと同値
                // 付与し、trailingの余白を相殺する(glyph幅に依存せず
                // letterSpacing値だけで補正量が確定するため逆算不要)。
                paddingLeft: "10px",
              }}
            >
              MATCH UP
            </div>
            {wcLabel !== "" && (
              <div
                style={{
                  display: "flex",
                  fontFamily: "Noto Sans JP",
                  fontWeight: 900,
                  fontSize: "30px",
                  color: COLORS.gold,
                  letterSpacing: "1px",
                }}
              >
                {wcLabel}
              </div>
            )}
          </div>

          {/* 両選手 + 中央VS(中央の区切りはVSテキストと背景グラデの見切りで成立) */}
          <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
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
