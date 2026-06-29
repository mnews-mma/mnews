import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata = {
  title: "プライバシーポリシー — Mニュース",
  description: "Mニュースにおける個人情報・アクセス情報の取り扱いについて。",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">プライバシーポリシー</div>
      </div>
      <div className="prose">
        <h2>アクセス解析について</h2>
        <p>
          当サイトでは、サービス改善のためGoogle Analytics（GA4）を利用しています。Google
          Analyticsはトラフィックデータの収集のためにCookieを使用しますが、このデータは匿名で収集されており、個人を特定するものではありません。Google
          Analyticsの規約に関する詳細は
          <a href="https://marketingplatform.google.com/about/analytics/terms/jp/" target="_blank" rel="noopener noreferrer">
            Googleアナリティクス利用規約
          </a>
          、Googleによるデータの収集・処理については
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            Googleのサービスを使用するサイトやアプリから収集した情報をGoogleがどのように使用するか
          </a>
          をご覧ください。
        </p>

        <h2>Cookieの無効化</h2>
        <p>
          お使いのブラウザの設定でCookieを無効にすることで、これらのアクセス解析を無効にすることができます。詳しい設定方法は、お使いのブラウザの設定画面をご確認ください。
        </p>

        <h2>個人情報の収集について</h2>
        <p>
          当サイトでは、お問い合わせ等を通じて利用者から氏名・メールアドレス等の個人情報を直接収集することはありません。お問い合わせはX（Twitter）のDMを通じて行っていただく形式としています。
        </p>

        <h2>外部リンクについて</h2>
        <p>
          当サイトに掲載している記事カードは、RIZIN・DEEP・修斗・パンクラス各公式やゴング格闘技・MMAPLANET・イーファイトなど第三者のサイトへのリンクを含みます。これらのリンク先サイトにおける個人情報の取り扱いについては、各サイトのプライバシーポリシーをご確認ください。
        </p>

        <h2>免責事項</h2>
        <p>
          当サイトに掲載する情報の正確性には努めていますが、内容の正確性・完全性を保証するものではありません。当サイトの情報を用いて行う行為について、運営者は一切の責任を負いません。試合結果・選手戦績等は元記事・Wikipedia・各団体公式サイトの更新タイミングに依存します。
        </p>

        <h2>本ポリシーの変更について</h2>
        <p>
          当サイトは、本ポリシーの内容を予告なく変更することがあります。変更後のプライバシーポリシーは、当サイトに掲載したときから効力を生じるものとします。
        </p>

        <p className="prose-updated">最終更新日: 2026年6月29日</p>
      </div>
      <Footer />
    </>
  );
}
