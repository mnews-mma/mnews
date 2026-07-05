import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const isProduction = process.env.NODE_ENV === "production";

const SITE_URL = "https://www.mnews.jp";
const DEFAULT_TITLE = "Mニュース | 日本MMAニュース速報";
const DEFAULT_DESCRIPTION =
  "RIZIN・DEEP・パンクラスの公式発表とMMAニュースを一か所にまとめて届けるMMA特化キュレーションメディア。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  icons: { icon: "/logo.png" },
  verification: {
    google: "27FkFBIjjBO1gprFMpi5nX-aMEOwVWuv_vOtWC_Udoo",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: "Mニュース",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: `${SITE_URL}/og-default.png?v=2`, width: 1200, height: 630, type: "image/png", alt: "Mニュース" }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [`${SITE_URL}/og-default.png?v=2`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
      {isProduction && GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
