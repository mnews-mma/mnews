import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { SITE_URL } from "@/lib/seo";

export const metadata = {
  title: "お問い合わせ | Mニュース",
  description: "Mニュースへのお問い合わせ方法。",
  alternates: { canonical: `${SITE_URL}/contact` },
};

const breadcrumbs = [{ label: "トップ", href: "/" }, { label: "お問い合わせ" }];

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <h1 className="page-title">お問い合わせ</h1>
      </div>
      <div className="prose">
        <p>
          掲載記事に関するご連絡、削除依頼、誤情報のご指摘、その他お問い合わせは、X（旧Twitter）の公式アカウントへDMにてご連絡ください。
        </p>
        <p>
          <a
            href="https://x.com/mnews_mma"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-x-link"
          >
            𝕏 @mnews_mma にDMを送る
          </a>
        </p>
        <p>内容を確認のうえ、できるだけ早く対応いたします。</p>
      </div>
      <Footer />
    </>
  );
}
