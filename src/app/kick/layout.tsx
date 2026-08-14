import Link from "next/link";
import "./kick.css";

/**
 * /kick は立ち技(キックボクシング)専用のセクション。
 * mnews本体(MMA)のNav/Footerは使わず、独自のマストヘッドとナビを持たせて
 * 「MMAサイトの1コーナー」に見えないようにする。
 */
export default function KickLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kick">
      <header className="kick-masthead">
        <div className="kick-masthead__inner">
          <Link href="/kick" className="kick-wordmark">
            立ち技名鑑
            <span>KICKBOXING DATABASE</span>
          </Link>
          <div className="kick-masthead__note">
            <a href="/">Mニュース</a>（MMA）とは別セクションです
          </div>
        </div>
      </header>
      <nav className="kick-nav" aria-label="立ち技名鑑">
        <div className="kick-nav__inner">
          <Link href="/kick">このデータについて</Link>
          <Link href="/kick/fighters">選手一覧</Link>
        </div>
      </nav>
      <main className="kick-main">{children}</main>
      <footer className="kick-foot">
        立ち技名鑑は、各団体公式サイトとWikipediaの公開情報から機械的に収集した選手名簿・戦績データです。
        すべてのレコードに取得元URLを併記しています。誤りを見つけた場合は{" "}
        <a href="https://x.com/mnews_mma" target="_blank" rel="noopener noreferrer">
          𝕏 @mnews_mma
        </a>{" "}
        のDMへご連絡ください。
      </footer>
    </div>
  );
}
