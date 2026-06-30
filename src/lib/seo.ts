import type { Metadata } from "next";

const SITE_URL = "https://www.mnews.jp";
const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "Mニュース" };

// ページ単位の openGraph/twitter は Next.js が親(layout)の値とディープマージしない
// （指定したフィールドのオブジェクトごと丸ごと置き換わる）ため、image/siteName等を
// 毎回明示しないと og:image が消える。各ページの generateMetadata/metadata から
// このヘルパー経由で組み立てることで取りこぼしを防ぐ。
export function pageMetadata(params: {
  title: string;
  description: string;
  path: string;
  image?: { url: string; width: number; height: number; alt: string };
}): Metadata {
  const { title, description, path, image } = params;
  const url = `${SITE_URL}${path}`;
  const ogImage = image ?? OG_IMAGE;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "ja_JP",
      siteName: "Mニュース",
      url,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}
