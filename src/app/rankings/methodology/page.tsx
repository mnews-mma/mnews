import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { pageMetadata } from "@/lib/seo";
import { RATING_NAME } from "@/lib/mnewsRating/constants";

export const metadata = pageMetadata({
  title: `${RATING_NAME}について | mnews`,
  description: `mnews.jp独自のRIZINランキング「${RATING_NAME}」の評価方針。RIZIN非公式・独自算出。`,
  path: "/rankings/methodology",
});

export default function MethodologyPage() {
  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "ランキング", href: "/rankings" },
    { label: "ランキングについて" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">{RATING_NAME}について</h1>
      </div>

      <div className="prose">
        <p>
          RIZINには公式ランキングが存在しません。{RATING_NAME}はmnews.jpが独自に算出する非公式のランキングです。
          恣意的な編集判断を一切挟まず、AIが以下の原則にもとづいて総合評価し、順位を決定しています。
        </p>

        <ul style={{ color: "var(--muted)", lineHeight: 1.9 }}>
          <li>強い相手への勝利をより高く評価します</li>
          <li>フィニッシュ(KO/TKO・一本勝ち)を重視します</li>
          <li>直近の活動状況を評価に反映します</li>
          <li>一定の出場実績がある選手を評価の対象とします</li>
        </ul>

        <p>
          RIZIN公式が認定する現王者は、公式情報にもとづき事実として別掲載しています(番号付きランキングとは別枠)。
        </p>

        <p>
          直接対決の勝敗は原則として順位に反映されます。ただし、複数選手間で勝敗が循環する場合など、
          構造的にどう並べても矛盾が残る例外的なケースでは、直接対決の結果と順位が逆転したままになることがあります。
        </p>

        <p className="prose-updated">RIZIN非公式。mnews.jp独自算出。</p>
      </div>
      <Footer />
    </>
  );
}
