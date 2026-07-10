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

export default function Nav() {
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
        </div>
      </div>
      <div className="nav-subbar">
        RIZIN・DEEP・修斗・パンクラス — ニュースを、ひとつに
      </div>
    </nav>
  );
}
