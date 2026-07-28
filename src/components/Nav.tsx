"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

// メニュー項目は既存ルートのみ(未実装ページへのリンクを作らない)。トップの
// 序列(ニュース→データ資産→大会)に合わせ、ニュースを先頭ブロックにする
// (mnews-homepage-instructions.md §3.2、フッターとも思想を揃える)。
// 3ブロック構成(ニュース→データ資産→大会)は維持し、ブロック間はdividerで
// 区切る。「AI RIZINランキング」はmnews独自算出でありRIZIN公式ではない点は
// ページ側で明記済みだが、メニューラベル自体もRIZIN限定であることが伝わる
// よう、また「RIZIN ランキング」検索クエリの内部アンカーテキスト最適化の
// ためこの表記にする(遷移先/rankingsは変更なし)。
const MENU_ITEMS: { href: string; label: string; dividerBefore?: boolean }[] = [
  { href: "/archive", label: "ニュース一覧" },
  { href: "/rankings", label: "AI RIZINランキング", dividerBefore: true },
  { href: "/fighters", label: "選手データベース" },
  { href: "/dream", label: "夢のカード" },
  { href: "/events", label: "大会日程", dividerBefore: true },
  { href: "/results", label: "大会結果" },
];

// 全ページで常時表示するサブナビ(ランキング/選手/大会)。
// .nav-subbar(旧タグライン行)と同じ枠を流用し、NAV総高さ80px
// (nav-top 52px + nav-subbar 28px、UnifiedFeedの.uf-chips等がsticky top:80pxで
// 依存している)を崩さないようにする。
const SUBNAV_ITEMS: { href: string; label: string; isActive: (pathname: string) => boolean }[] = [
  {
    href: "/rankings",
    label: "ランキング",
    isActive: (p) => p === "/rankings" || p.startsWith("/rankings/"),
  },
  {
    href: "/fighters",
    label: "選手",
    isActive: (p) => p === "/fighters" || p.startsWith("/fighters/"),
  },
  {
    href: "/events",
    label: "大会",
    isActive: (p) => p === "/events" || p.startsWith("/events/"),
  },
];

export default function Nav() {
  const pathname = usePathname();
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
                <div key={item.href}>
                  {item.dividerBefore && <div className="nav-menu-divider" role="separator" />}
                  <Link href={item.href} className="nav-menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </Link>
                </div>
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
      <div className="nav-subbar nav-subnav" role="navigation" aria-label="主要セクション">
        {SUBNAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-subnav-item${item.isActive(pathname ?? "") ? " active" : ""}`}
            aria-current={item.isActive(pathname ?? "") ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {menuLayer}
    </nav>
  );
}
