export default function Footer() {
  return (
    <footer>
      <div className="footer-brand">
        <div className="logo">
          <span className="logo-news">Mニュース</span>
        </div>
        <p className="footer-desc">
          RIZIN・DEEP・パンクラス・修斗のニュースを一か所に。日本MMA特化のニュースキュレーション。
        </p>
        <a
          href="https://x.com/mnews_mma"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-x-link"
        >
          𝕏 @mnews_mma をフォロー
        </a>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Mニュース</span>
        <span>日本MMAニュースを全部ここで</span>
      </div>
    </footer>
  );
}
