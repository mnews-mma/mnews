import Link from "next/link";

export default function Nav() {
  return (
    <nav>
      <div className="nav-top">
        <Link href="/" className="logo">
          <span className="logo-news">Mニュース</span>
          <span className="logo-tagline">日本MMAニュース速報</span>
        </Link>
        <div className="nav-right">
          <Link href="/fighters" className="nav-fighters-link">
            👤 選手戦績
          </Link>
        </div>
      </div>
    </nav>
  );
}
