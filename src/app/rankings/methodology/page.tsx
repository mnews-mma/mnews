import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { pageMetadata } from "@/lib/seo";
import { RATING_NAME } from "@/lib/mnewsRating/constants";

export const metadata = pageMetadata({
  title: `${RATING_NAME}について｜RIZINランキングの評価方針【mnews】`,
  description: `RIZINに公式ランキングはありません。独自開発のAIが総合評価して算出する「${RATING_NAME}」の評価方針を解説。RIZIN非公式・独自算出。`,
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
          <li>RIZINで一定以上の試合数があり、直近でも活動している選手を対象とします</li>
          <li>直近18ヶ月以内にRIZINでの試合がない選手は、ランキング対象外となります</li>
        </ul>

        <p>
          RIZIN公式が認定する現王者は、公式情報にもとづき事実として別掲載しています(番号付きランキングとは別枠)。
        </p>

        <p>
          直接対決の勝敗は評価材料のひとつとして順位に反映されますが、他の対戦成績も含めた総合評価の結果、
          特定の直接対決の結果と順位が一致しないことがあります。
        </p>

        <p className="prose-updated">RIZIN非公式。mnews.jp独自算出。</p>
      </div>
      <Footer />
    </>
  );
}
