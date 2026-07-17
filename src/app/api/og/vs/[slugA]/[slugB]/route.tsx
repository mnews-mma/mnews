import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getFighter, calcFighterRates, type Fighter } from "@/lib/fighters";
import { type ResolvedFighter } from "@/lib/feeds/resolveFighter";
import { fetchFighterRecordsStrict, mergeFighterRecord } from "@/lib/fighterRecordsCache";
import { findMatchupEvent } from "@/lib/events";
import { fitName, type FitOpts } from "@/lib/og/fitName";
import { computeFighterStripStats } from "@/lib/fighterStrip";
import { SITE_URL, loadOgFonts, OG_FONT_FAMILIES } from "@/lib/ogShared";

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

// Webカード(matchup.module.css の .mv2 配下CSS変数)と同じ配色をリテラル値で
// 持つ(Satoriはcssカスタムプロパティを解決できないため)。ここが唯一のOG側
// 配色ソースで、Webのトークンが変わったらここも追随させる。
const COLORS = {
  card: "#ffffff",
  panel: "#fbfaf6",
  line: "#e7e3db",
  lineSoft: "#efebe3",
  ink: "#1b1b20",
  muted: "#8b887e",
  dim: "#b7b3a8",
  red: "#e60028",
  redInk: "#cc0025",
  blue: "#1f5fe0",
  blueInk: "#1a4fbf",
  gold: "#a9812b",
  win: "#1f9e4d",
  loss: "#d9d5cc",
  lossInk: "#9a968c",
  draw: "#cfcabf",
};

// 選手名の行分割・フォントサイズ決定は、Satoriにライブなテキスト計測ができない
// (=DOMが無く、幅を測ってから折り返す通常のCSSレイアウトが使えない)ため、
// Web版(renderWrappableName + fighterNameSize、CSSのline-break:strictに依存)
// とは別の事前計算方式(fitName.ts)を使う。過去にSatori標準の自動折り返しに
// 委ねる実装を試みたが崩れの原因になり廃止した経緯がある(ogShared.ts参照)ため、
// 決定的な事前計算方式は維持する。ただし折り返し規則(「・」の直後でのみ改行し、
// カタカナ単語の途中では折らない)はWebと完全に同一のルールをfitName.ts側で
// 独立実装している(toUnits()参照)。
const NAME_ZONE: FitOpts = { maxWidth: 460, maxHeight: 150, maxFont: 108, minFont: 30, maxLines: 2 };

const LAST5_LABEL: Record<string, string> = { win: "W", loss: "L", draw: "D", nc: "D" };
const LAST5_COLOR: Record<string, { bg: string; fg: string }> = {
  win: { bg: COLORS.win, fg: "#ffffff" },
  loss: { bg: COLORS.loss, fg: COLORS.lossInk },
  draw: { bg: COLORS.draw, fg: "#ffffff" },
  nc: { bg: COLORS.draw, fg: "#ffffff" },
};

// 名前ゾーン: fitName()で事前確定した行を1行ずつ描画する(赤/青コーナーの
// 色分けはWebの.cornerRed/.cornerBlueと同じ)。
function NameBlock({
  nickname,
  fit,
  side,
}: {
  nickname?: string;
  fit: { fontSize: number; lines: string[] };
  side: "left" | "right";
}) {
  const align = side === "left" ? "flex-start" : "flex-end";
  const color = side === "left" ? COLORS.redInk : COLORS.blueInk;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: align }}>
      {nickname && (
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 700, fontSize: "16px", color: COLORS.muted, marginBottom: "6px" }}>
          {nickname}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: `${NAME_ZONE.maxWidth}px`,
          height: `${NAME_ZONE.maxHeight}px`,
          overflow: "hidden",
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
              lineHeight: 1.15,
              letterSpacing: "-1px",
              color,
              whiteSpace: "nowrap",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// 戦績・勝率・フィニッシュ率の3行。Web版TugBar.tsx(綱引きバー廃止後の
// 3カラムグリッド: 左=赤値左端/中央=ラベル固定中央/右=青値右端)と同じ構成を
// flexboxで再現する(flex:1を両端に置くとgrid-template-columns:1fr auto 1fr
// と同じ挙動になり、値の文字数に関わらずラベルが常に中央に来る)。
function StatRow({ label, displayA, displayB }: { label: string; displayA: string; displayB: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", width: "100%", padding: "6px 56px" }}>
      <div style={{ display: "flex", flex: 1, justifyContent: "flex-start", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "32px", color: COLORS.redInk }}>
        {displayA}
      </div>
      <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 700, fontSize: "18px", color: COLORS.muted, padding: "0 24px", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "32px", color: COLORS.blueInk }}>
        {displayB}
      </div>
    </div>
  );
}

// KO/一本/判定の内訳(Web版MatchupTape.tsxのMethodCountsLineと同じ、ムード地の
// 数字のみのテキスト行。左右で3カラムの外側2列だけ使う=中央は空)。
function MethodRow({ f, side }: { f: ResolvedFighter; side: "left" | "right" }) {
  const justify = side === "left" ? "flex-start" : "flex-end";
  return (
    <div style={{ display: "flex", flex: 1, justifyContent: justify, fontFamily: "Noto Sans JP", fontWeight: 600, fontSize: "16px", color: COLORS.muted }}>
      KO {f.ko} / 一本 {f.sub} / 判定 {f.decision}
    </div>
  );
}

// 直近5戦のW/L/Dドット(Web版MatchupTape.tsxのFormChipsと同じ配色・記号)。
function FormDots({ results, side }: { results: string[]; side: "left" | "right" }) {
  const justify = side === "left" ? "flex-start" : "flex-end";
  return (
    <div style={{ display: "flex", flex: 1, justifyContent: justify, gap: "6px" }}>
      {results.map((r, i) => {
        const c = LAST5_COLOR[r] ?? LAST5_COLOR.draw;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              backgroundColor: c.bg,
              color: c.fg,
              fontFamily: "Noto Sans JP",
              fontWeight: 800,
              fontSize: "13px",
            }}
          >
            {LAST5_LABEL[r] ?? "D"}
          </div>
        );
      })}
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
    // 最上部の帯)とは別物で、自動紐付けが無い対戦(夢のカード等)でも
    // 軽量なサブラインとして表示できるようにする。空欄なら行ごと出さない。
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

    const ratesA = calcFighterRates(fighterA);
    const ratesB = calcFighterRates(fighterB);
    const statsA = computeFighterStripStats(fighterA);
    const statsB = computeFighterStripStats(fighterB);

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
            backgroundColor: COLORS.card,
            position: "relative",
          }}
        >
          {/* コーナーストリップ(Web版.card::beforeと同じ、左半分赤/右半分青) */}
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "10px",
              backgroundImage: `linear-gradient(to right, ${COLORS.red} 0%, ${COLORS.red} 50%, ${COLORS.blue} 50%, ${COLORS.blue} 100%)`,
            }}
          />

          {/* 大会情報帯(findMatchupEventで紐付いた場合のみ。無ければ帯ごと省略) */}
          {eventLabel && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: COLORS.panel,
                borderBottom: `1px solid ${COLORS.lineSoft}`,
                padding: "12px 0",
              }}
            >
              <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "16px", color: COLORS.ink }}>
                {eventLabel}
              </div>
            </div>
          )}

          {/* 手指定の大会名(任意)+階級ラベル(任意)。空欄ならそれぞれ非表示 */}
          {(evLabel !== "" || wcLabel !== "") && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "14px 0 0" }}>
              {evLabel !== "" && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "18px", color: COLORS.ink }}>
                  {evLabel}
                </div>
              )}
              {wcLabel !== "" && (
                <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: "16px", color: COLORS.gold }}>
                  {wcLabel}
                </div>
              )}
            </div>
          )}

          {/* 選手名 + 中央VS */}
          <div style={{ display: "flex", alignItems: "center", padding: "28px 56px 0" }}>
            <NameBlock nickname={fighterA.nickname} fit={fitA} side="left" />
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "44px", color: COLORS.dim, letterSpacing: "2px", padding: "0 24px" }}>
              VS
            </div>
            <NameBlock nickname={fighterB.nickname} fit={fitB} side="right" />
          </div>

          {/* 戦績・勝率・フィニッシュ率(Web版と同じ3行構成・3カラム配置) */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "20px" }}>
            <StatRow label="戦績" displayA={`${fighterA.wins}-${fighterA.losses}${fighterA.draws > 0 ? `-${fighterA.draws}` : ""}`} displayB={`${fighterB.wins}-${fighterB.losses}${fighterB.draws > 0 ? `-${fighterB.draws}` : ""}`} />
            <StatRow label="勝率" displayA={ratesA.winRate !== null ? `${ratesA.winRate}%` : "—"} displayB={ratesB.winRate !== null ? `${ratesB.winRate}%` : "—"} />
            <StatRow label="フィニッシュ率" displayA={ratesA.finishRate !== null ? `${ratesA.finishRate}%` : "—"} displayB={ratesB.finishRate !== null ? `${ratesB.finishRate}%` : "—"} />
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

          {/* フッター */}
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "flex-end",
              alignItems: "flex-end",
              backgroundColor: COLORS.panel,
              borderTop: `1px solid ${COLORS.lineSoft}`,
              padding: "16px 56px",
              marginTop: "20px",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: COLORS.muted, letterSpacing: "1px" }}>
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
