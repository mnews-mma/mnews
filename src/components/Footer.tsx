function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer>
      <div className="footer-brand">
        <div className="logo footer-logo">
          <span className="logo-news">Mニュース</span>
        </div>
        <p className="footer-desc">
          RIZIN・DEEP・パンクラス・修斗のニュースを一か所に。
        </p>
        <a
          href="https://x.com/mnews_mma"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-x-link"
        >
          <span className="footer-x-logo">𝕏</span>
          <span>@mnews_mma をフォロー</span>
          <ArrowRightIcon />
        </a>
        <p className="footer-x-caption">試合結果・最新ニュースをお届け</p>
      </div>
      <div>
        <div className="footer-col-title">コンテンツ</div>
        <div className="footer-links">
          <a href="/fighters">選手戦績一覧</a>
          <a href="/ranking/undefeated">無敗の日本人選手一覧</a>
        </div>
      </div>
      <div>
        <div className="footer-col-title">ABOUT</div>
        <div className="footer-links">
          <a href="/about">運営者情報</a>
          <a href="/privacy">プライバシーポリシー</a>
          <a href="/contact">お問い合わせ</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Mニュース</span>
        <span>日本MMAニュースを全部ここで</span>
      </div>
    </footer>
  );
}
