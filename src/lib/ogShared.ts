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
