import Link from "next/link";

export default function Nav() {
  return (
    <nav>
      <div className="nav-top">
        <Link href="/" className="logo">
          <span className="logo-news">Mニュース</span>
        </Link>
        <div className="nav-right">
          <Link href="/ranking/pancrase" className="nav-fighters-link">
            パンクラスランキング
          </Link>
          <Link href="/ranking/shooto" className="nav-fighters-link">
            修斗ランキング
          </Link>
          <Link href="/fighters" className="nav-fighters-link">
            選手データベース
          </Link>
        </div>
      </div>
    </nav>
  );
}
