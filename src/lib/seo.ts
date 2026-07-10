import type { Metadata } from "next";

export const SITE_URL = "https://www.mnews.jp";
const OG_IMAGE = { url: `${SITE_URL}/og-default.png?v=3`, width: 1200, height: 630, type: "image/png", alt: "Mニュース" };

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
    alternates: { canonical: url },
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

/** BreadcrumbList JSON-LD を生成する */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[]
): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** datePublished / dateModified を <time> 要素用に整形 */
export function isoDate(dateStr: string): string {
  return `${dateStr}T00:00:00+09:00`;
}
