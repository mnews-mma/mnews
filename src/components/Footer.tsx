export default function Footer() {
  return (
    <footer>
      <div className="footer-brand">
        <div className="logo">
          <span className="logo-mix">M</span>
          <span className="logo-news">ニュース</span>
          <span className="logo-dot">·</span>
        </div>
        <p className="footer-desc">
          RIZIN・UFC・修斗・DEEP・ONE FCのニュースを一か所に。日本MMA特化のニュースキュレーション。
        </p>
      </div>
      <div>
        <div className="footer-col-title">カテゴリ</div>
        <div className="footer-links">
          <a href="#">RIZIN ニュース</a>
          <a href="#">UFC 日本人選手</a>
          <a href="#">修斗 最新情報</a>
          <a href="#">DEEP 試合結果</a>
          <a href="#">ONE FC</a>
        </div>
      </div>
      <div>
        <div className="footer-col-title">Mニュースについて</div>
        <div className="footer-links">
          <a href="#">このサービスの理念</a>
          <a href="#">配信元メディア一覧</a>
          <a href="#">記事の掲載申請</a>
          <a href="#">お問い合わせ</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Mニュース</span>
        <span>日本MMAニュースを全部ここで</span>
      </div>
    </footer>
  );
}
