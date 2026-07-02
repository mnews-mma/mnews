// OG画像生成（/api/og/*）共通のデザイントークン・フォント読み込み。
// Edge Runtimeから呼ばれる前提（Node固有APIは使わない）。

export const OG_COLORS = {
  sumi: "#131210",
  washi: "#EDE6D6",
  shu: "#C8262C",
  gold: "#C29A4B",
  indigo: "#2B3A55",
  ash: "#8A8478",
  foot: "#0C0B0A",
};

export const SITE_URL = "https://www.mnews.jp";

// 斜めストライプのごく薄いテクスチャ（単色黒の安っぽさを消すため）。
// Satori は repeating-linear-gradient 非対応のため、ストップを手動生成して疑似的に再現する。
export function stripeTexture(
  count = 28,
  color = "rgba(255,255,255,0.035)",
  angle = 135
): string {
  const stops: string[] = [];
  const step = 100 / count;
  for (let i = 0; i < count; i++) {
    const start = i * step;
    const mid = start + step * 0.5;
    const end = start + step;
    stops.push(`transparent ${start}%`, `${color} ${mid}%`, `transparent ${end}%`);
  }
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
}

// 左=赤(shu)/右=indigo のコーナー色みを薄く効かせるビネット。MATCH UP系カードの背景に重ねる。
export function cornerVignette(): string {
  return [
    "radial-gradient(circle at 0% 45%, rgba(200,38,44,0.22) 0%, rgba(200,38,44,0) 55%)",
    "radial-gradient(circle at 100% 55%, rgba(43,58,85,0.28) 0%, rgba(43,58,85,0) 55%)",
  ].join(", ");
}

// 選手名など可変長テキストを、文字数に応じて自動縮小するフォントサイズを返す。
// 「縮小時に読めない中途半端なサイズを残さない」方針のため段階的に大きく刻む。
export function fitFontSize(
  text: string,
  steps: { maxLen: number; size: number }[]
): number {
  for (const s of steps) {
    if (text.length <= s.maxLen) return s.size;
  }
  return steps[steps.length - 1].size;
}

let fontCache: { bebas: ArrayBuffer; notoBlack: ArrayBuffer } | null = null;

export async function loadOgFonts() {
  if (fontCache) return fontCache;
  const oldUA =
    "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.34 (KHTML, like Gecko) PhantomJS/1.9.7 Safari/534.34";

  const [bebasCss, notoCss] = await Promise.all([
    fetch("https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap", {
      headers: { "User-Agent": oldUA },
    }).then((r) => r.text()),
    fetch("https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@900&display=swap", {
      headers: { "User-Agent": oldUA },
    }).then((r) => r.text()),
  ]);

  const bebasUrl = bebasCss.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/)?.[1];
  const notoUrl = notoCss.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/)?.[1];
  if (!bebasUrl || !notoUrl) throw new Error("font URL extraction failed");

  const [bebas, notoBlack] = await Promise.all([
    fetch(bebasUrl).then((r) => r.arrayBuffer()),
    fetch(notoUrl).then((r) => r.arrayBuffer()),
  ]);

  fontCache = { bebas, notoBlack };
  return fontCache;
}

export const OG_FONT_FAMILIES = (fonts: { bebas: ArrayBuffer; notoBlack: ArrayBuffer }) => [
  { name: "Bebas Neue", data: fonts.bebas, weight: 400 as const, style: "normal" as const },
  { name: "Noto Sans JP", data: fonts.notoBlack, weight: 900 as const, style: "normal" as const },
];
