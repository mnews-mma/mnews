export default function Footer() {
  return (
    <footer>
      <div className="footer-brand">
        <div className="logo">
          <span className="logo-news">ニュース</span>
        </div>
        <p className="footer-desc">
          RIZIN・UFC・修斗・DEEP・ONEのニュースを一か所に。日本MMA特化のニュースキュレーション。
        </p>
      </div>
      <div>
        <div className="footer-col-title">カテゴリ</div>
        <div className="footer-links">
          <a href="#">RIZIN ニュース</a>
          <a href="#">UFC 日本人選手</a>
          <a href="#">修斗 最新情報</a>
          <a href="#">DEEP 試合結果</a>
          <a href="#">ONE</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Mニュース</span>
        <span>日本MMAニュースを全部ここで</span>
      </div>
    </footer>
  );
}
