import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { SITE_URL } from "@/lib/seo";

export const metadata = {
  title: "運営者情報 | Mニュース",
  description: "Mニュースの運営者情報・サイトの理念について。",
  alternates: { canonical: `${SITE_URL}/about` },
};

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "運営者情報" }];

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">運営者情報</h1>
      </div>
      <div className="prose">
        <h2>Mニュースについて</h2>
        <p>
          Mニュースは、RIZIN・DEEP・修斗・パンクラスをはじめとする日本の総合格闘技（MMA）に関する公式発表とニュースを一か所にまとめて届ける、個人運営のニュースキュレーションメディアです。広告は一切掲載していません。
        </p>

        <h2>運営者</h2>
        <p>
          個人にて企画・開発・運営しています。お問い合わせは
          <a href="/contact">お問い合わせページ</a>
          またはX（<a href="https://x.com/mnews_mma" target="_blank" rel="noopener noreferrer">@mnews_mma</a>）よりご連絡ください。
        </p>

        <h2>掲載記事について</h2>
        <p>
          各記事は見出しと100文字程度の要約のみを掲載し、全文転載は行いません。記事の詳細は各カードに表示している配信元（RIZIN・DEEP・修斗・パンクラス各公式、ゴング格闘技・MMAPLANET・イーファイトなど）の元記事へ遷移してご覧いただく形式です。選手戦績データはWikipedia・UFC公式サイトの情報を基に表示しています。
        </p>

        <h2>サイトの理念</h2>
        <p>
          日本のMMAニュースは複数の団体・メディアに分散しており、ファンが情報を追うのは簡単ではありません。Mニュースは、その情報を一か所に集約し、ファンが見たい情報にすぐアクセスできる場所を目指しています。
        </p>
      </div>
      <Footer />
    </>
  );
}
