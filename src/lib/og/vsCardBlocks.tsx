// 公開VSカード(/api/og/vs)と管理画面のvs-compare(/api/og/vs-compare)が
// 共有する「新カードUI」レンダラー部品。ライト基調・赤/青コーナーストリップ・
// 3カラム統計(戦績/勝率/フィニッシュ率)・W/Lドット・fitName()ベースの
// 選手名折り返しを1実装に一本化し、Web版VsCard/MatchupTape.tsxの見た目と
// 揃える(#79参照)。
//
// セキュリティ境界の注記: このモジュール自体はJSXを組み立てるだけで、
// 呼び出し元(公開ルート/管理ルート)の判断は一切持たない。「大会名等の
// 任意文字列を受け付けてよいか」は各route.ts側の責務。公開の/api/og/vsは
// DB由来値(findMatchupEventで一致した実大会名)のみをこの部品に渡し、
// 管理画面専用の/api/og/vs-compare(公開ページから一切リンクされない
// admin限定ツール)だけがクエリ文字列由来の任意ラベルを渡してよい。
import type { ResolvedFighter } from "@/lib/feeds/resolveFighter";
import { calcFighterRates } from "@/lib/fighters";
import { computeFighterStripStats } from "@/lib/fighterStrip";
import { fitName, type FitOpts } from "@/lib/og/fitName";

// Webカード(matchup.module.css の .mv2 配下CSS変数)と同じ配色をリテラル値で
// 持つ(Satoriはcssカスタムプロパティを解決できないため)。ここが唯一のOG側
// 配色ソースで、Webのトークンが変わったらここも追随させる。
export const VS_COLORS = {
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

const LAST5_LABEL: Record<string, string> = { win: "W", loss: "L", draw: "D", nc: "D" };
const LAST5_COLOR: Record<string, { bg: string; fg: string }> = {
  win: { bg: VS_COLORS.win, fg: "#ffffff" },
  loss: { bg: VS_COLORS.loss, fg: VS_COLORS.lossInk },
  draw: { bg: VS_COLORS.draw, fg: "#ffffff" },
  nc: { bg: VS_COLORS.draw, fg: "#ffffff" },
};

// 選手名の行分割・フォントサイズ決定は、Satoriにライブなテキスト計測ができない
// (=DOMが無く、幅を測ってから折り返す通常のCSSレイアウトが使えない)ため、
// Web版(renderWrappableName + fighterNameSize、CSSのline-break:strictに依存)
// とは別の事前計算方式(fitName.ts)を使う。過去にSatori標準の自動折り返しに
// 委ねる実装を試みたが崩れの原因になり廃止した経緯がある(ogShared.ts参照)ため、
// 決定的な事前計算方式は維持する。ただし折り返し規則(「・」の直後でのみ改行し、
// カタカナ単語の途中では折らない)はWebと完全に同一のルールをfitName.ts側で
// 独立実装している(toUnits()参照)。呼び出し側(各route.ts)がカード幅に応じた
// NameZoneを渡す。
//
// 公開OGP(1200x630, /api/og/vs・/api/og/dream)の選手名フォントサイズ天井は
// src/lib/events.ts の OG_DREAM_VS_CEILING を単一ソースとして使う
// (2026-07-20、天井をここに固定値でベタ書きしていた版から変更。EVENTSの
// 最長名から逆算する方式にしたことで、短名が長名より大きく見える不揃いだけ
// でなく、天井以下の名前がカードごとに別サイズになる不揃いも解消し、
// 全カード単一サイズに揃う)。呼び出し側でmaxFontを個別に指定させず、
// sharedNameFitのmaxSize引数で天井を強制することで、値がカードごとに
// 分岐する再発を防ぐ。
export type NameZone = Omit<FitOpts, "maxFont">;

export function sharedNameFit(nameA: string, nameB: string, zone: NameZone, maxSize: number) {
  const fullZone: FitOpts = { ...zone, maxFont: maxSize };
  const fitAOwn = fitName(nameA, fullZone);
  const fitBOwn = fitName(nameB, fullZone);
  const sharedFontSize = Math.min(fitAOwn.fontSize, fitBOwn.fontSize);
  const sharedZone: FitOpts = { ...fullZone, maxFont: sharedFontSize, minFont: sharedFontSize };
  return { fitA: fitName(nameA, sharedZone), fitB: fitName(nameB, sharedZone) };
}

// コーナーストリップ(Web版.card::beforeと同じ、左半分赤/右半分青)。
export function CornerStrip({ height = 10 }: { height?: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: `${height}px`,
        backgroundImage: `linear-gradient(to right, ${VS_COLORS.red} 0%, ${VS_COLORS.red} 50%, ${VS_COLORS.blue} 50%, ${VS_COLORS.blue} 100%)`,
      }}
    />
  );
}

// 名前ゾーン: fitName()で事前確定した行を1行ずつ描画する(赤/青コーナーの
// 色分けはWebの.cornerRed/.cornerBlueと同じ)。
export function NameBlock({
  nickname,
  fit,
  zone,
  side,
  nicknameSize = 16,
}: {
  nickname?: string;
  fit: { fontSize: number; lines: string[] };
  zone: NameZone;
  side: "left" | "right";
  nicknameSize?: number;
}) {
  const align = side === "left" ? "flex-start" : "flex-end";
  const color = side === "left" ? VS_COLORS.redInk : VS_COLORS.blueInk;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: align }}>
      {nickname && (
        <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 700, fontSize: `${nicknameSize}px`, color: VS_COLORS.muted, marginBottom: "6px" }}>
          {nickname}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: `${zone.maxWidth}px`,
          height: `${zone.maxHeight}px`,
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
export function StatRow({
  label,
  displayA,
  displayB,
  valueSize = 32,
  labelSize = 18,
  sidePadding = 56,
}: {
  label: string;
  displayA: string;
  displayB: string;
  valueSize?: number;
  labelSize?: number;
  sidePadding?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", width: "100%", padding: `6px ${sidePadding}px` }}>
      <div style={{ display: "flex", flex: 1, justifyContent: "flex-start", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: `${valueSize}px`, color: VS_COLORS.redInk }}>
        {displayA}
      </div>
      <div style={{ display: "flex", fontFamily: "Noto Sans JP", fontWeight: 700, fontSize: `${labelSize}px`, color: VS_COLORS.muted, padding: "0 24px", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", fontFamily: "Noto Sans JP", fontWeight: 800, fontSize: `${valueSize}px`, color: VS_COLORS.blueInk }}>
        {displayB}
      </div>
    </div>
  );
}

// KO/一本/判定の内訳(Web版MatchupTape.tsxのMethodCountsLineと同じ、ムード地の
// 数字のみのテキスト行。左右で3カラムの外側2列だけ使う=中央は空)。
export function MethodRow({ f, side, size = 16 }: { f: ResolvedFighter; side: "left" | "right"; size?: number }) {
  const justify = side === "left" ? "flex-start" : "flex-end";
  return (
    <div style={{ display: "flex", flex: 1, justifyContent: justify, fontFamily: "Noto Sans JP", fontWeight: 600, fontSize: `${size}px`, color: VS_COLORS.muted }}>
      KO {f.ko} / 一本 {f.sub} / 判定 {f.decision}
    </div>
  );
}

// 直近5戦のW/L/Dドット(Web版MatchupTape.tsxのFormChipsと同じ配色・記号)。
export function FormDots({ results, side, dot = 26 }: { results: string[]; side: "left" | "right"; dot?: number }) {
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
              width: `${dot}px`,
              height: `${dot}px`,
              borderRadius: `${Math.round(dot * 0.23)}px`,
              backgroundColor: c.bg,
              color: c.fg,
              fontFamily: "Noto Sans JP",
              fontWeight: 800,
              fontSize: `${Math.round(dot * 0.5)}px`,
            }}
          >
            {LAST5_LABEL[r] ?? "D"}
          </div>
        );
      })}
    </div>
  );
}

export function CardFooter({ sidePadding = 56 }: { sidePadding?: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-end",
        backgroundColor: VS_COLORS.panel,
        borderTop: `1px solid ${VS_COLORS.lineSoft}`,
        padding: `16px ${sidePadding}px`,
      }}
    >
      <div style={{ display: "flex", fontFamily: "Bebas Neue", fontSize: "20px", color: VS_COLORS.muted, letterSpacing: "1px" }}>
        MNEWS.JP
      </div>
    </div>
  );
}

// 通算戦績・勝率・フィニッシュ率をまとめて計算する(呼び出し側の重複を防ぐ)。
export function fighterVsStats(f: ResolvedFighter) {
  const rates = calcFighterRates(f);
  const strip = computeFighterStripStats(f);
  const record = `${f.wins}-${f.losses}${f.draws > 0 ? `-${f.draws}` : ""}`;
  return { record, winRate: rates.winRate, finishRate: rates.finishRate, last5: strip.last5 };
}
