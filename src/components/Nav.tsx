"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

function DatabaseIcon() {
  return (
    <svg
      className="nav-fighters-icon"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  // 開閉でハンバーガー(三本線)↔×に切り替える(状態が見た目に出るようにする)。
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {open ? (
        <>
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </>
      ) : (
        <>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </>
      )}
    </svg>
  );
}

// メニュー項目は既存ルートのみ(未実装ページへのリンクを作らない)。
// 「選手データベース」はヘッダーの赤いボタン(nav-fighters-link)と導線が
// 重複するが、ハンバーガーメニュー内からも辿れるよう先頭に追加している
// (ヘッダー側のボタンは削除しない=導線二重化を維持)。
// 「RIZINランキング」は/rankings(全階級ハブ)の新設に伴い追加(mnewsレーティング)。
// mnews独自算出でありRIZIN公式ではない点はページ側で明記済みだが、メニュー
// ラベル自体もRIZIN限定であることが伝わるよう、また「RIZIN ランキング」検索
// クエリの内部アンカーテキスト最適化のため「RIZINランキング」表記にする
// (遷移先/rankingsは変更なし)。ニュース・選手データベースと同列の主要導線
// として先頭寄りに配置する。
const MENU_ITEMS = [
  { href: "/fighters", label: "選手データベース" },
  { href: "/rankings", label: "AI RIZINランキング" },
  { href: "/dream", label: "夢のカード" },
  { href: "/archive", label: "過去のニュース" },
  { href: "/events", label: "開催予定の大会" },
  { href: "/results", label: "大会結果一覧" },
];

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  // portalの描画先(document.body)はクライアントマウント後にしか存在しないため、
  // マウント完了までは使わない(SSR/ハイドレーション不一致を避ける)。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // メニュー展開中は背景スクロールをロックする。
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // オーバーレイ+メニューパネルはdocument.bodyへPortalで直接マウントする。
  // .site-navにbackdrop-filterが指定されており、これがCSSのcontaining block
  // (position:fixedの基準)になってしまうため、.site-nav配下に置くとオーバーレイが
  // ヘッダーの高さ分にしか広がらず、画面全体を覆えない不具合になる。
  const menuLayer =
    mounted && menuOpen
      ? createPortal(
          <>
            <button
              type="button"
              className="nav-menu-overlay"
              aria-label="メニューを閉じる"
              onClick={() => setMenuOpen(false)}
            />
            <div id="site-menu-panel" className="nav-menu-panel" role="menu">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-menu-item"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <nav className="site-nav">
      <div className="nav-top">
        <Link href="/" className="logo">
          <span className="logo-news">Mニュース</span>
          <span className="logo-tagline logo-tagline-full">JAPAN MMA NEWS &amp; DATABASE</span>
          <span className="logo-tagline logo-tagline-short">JAPAN MMA NEWS</span>
        </Link>
        <div className="nav-right">
          <Link href="/fighters" className="nav-fighters-link">
            <DatabaseIcon />
            選手データベース
          </Link>
          <button
            type="button"
            className="nav-menu-btn"
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={menuOpen}
            aria-controls="site-menu-panel"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon open={menuOpen} />
          </button>
        </div>
      </div>
      <div className="nav-subbar">
        RIZIN・DEEP・修斗・パンクラス — ニュースを、ひとつに
      </div>

      {menuLayer}
    </nav>
  );
}
