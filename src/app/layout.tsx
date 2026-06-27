import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mニュース — 日本MMAニュースを全部ここで",
  description:
    "RIZIN・UFC・修斗・DEEP・ONE FCのニュースを一か所にまとめて届けるMMA特化キュレーションメディア。",
  icons: { icon: "/logo.png" },
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
    </html>
  );
}
