// ヒーローの選手DB検索ボックス(mnews-homepage-instructions.md §2.2)。
// 第1段実装として、入力欄の見た目で/fighters(オートフォーカス付き)へ誘導する
// 方式を採用(仕様書が明示的に許容する簡易版。トップページ自体にインクリメンタル
// サーチを実装するのは別途)。実体は検索インデックス(/fighters側)と同じ
// FighterFilterGridを再利用するため、検索ロジックの二重実装を避けている。
export default function HeroFighterSearch({ fighterCount }: { fighterCount: number }) {
  return (
    <a href="/fighters?focus=1" className="hero-search-box" aria-label="選手名で戦績を検索">
      <span className="hero-search-placeholder">選手名で戦績を検索（例: 平本蓮）</span>
      <span className="hero-search-count">{fighterCount} FIGHTERS</span>
    </a>
  );
}
