import Link from "next/link";

// ヒーローの選手DB検索ボックス(mnews-homepage-instructions.md §2.2)。
// 実体は/fighters(オートフォーカス付き)への入口リンク。タップしても
// その場では入力できない(検索ロジックは/fighters側のFighterFilterGridを
// 再利用、二重実装を避ける)ため、見た目も「入力欄」ではなく正直に
// 「押せるボタン」として見せる(入力待ちに見えるグレー塗り+プレースホルダー
// 文言は誤誘導になるため廃止、2026-07-18)。
function SearchGlyphIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export default function HeroFighterSearch() {
  return (
    <Link href="/fighters?focus=1" className="hero-search-box" aria-label="選手名で戦績を検索する">
      <span className="hero-search-label">
        <SearchGlyphIcon />
        選手名で戦績を検索
      </span>
      <span className="hero-search-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
