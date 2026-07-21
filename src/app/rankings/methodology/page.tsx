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
          直接対決の勝敗は、原則として順位に反映されます。複数選手間で勝敗が循環する場合、
          より新しい対戦結果を優先して順位付けします。
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 32 }}>
          パウンドフォーパウンド(P4P)ランキングについて
        </h2>
        <p>
          <a href="/rankings/pound-for-pound" style={{ color: "var(--accent)" }}>P4Pランキング</a>
          は、上記の階級別ランキングをもとに、階級を超えた強さの序列を示す参考指標です。RIZINに公式のP4Pランキングは
          ありません。統計的な純度よりも、見て違和感のない順位になることを優先した設計です。
        </p>
        <ul style={{ color: "var(--muted)", lineHeight: 1.9 }}>
          <li>公開している4階級の現王者は、必ずP4Pの上位に固定表示します。王者どうしの順序はタイトル防衛回数(多い方が上位)で決め、同数の場合は通算勝率で決めます。</li>
          <li>王者以外の選手(挑戦者)は、それぞれの階級での強さが平均よりどれだけ突出しているか(ドミナンス)で階級を横断して並べます。</li>
          <li>同じ階級内での順序は、階級別ランキングの順位を絶対に逆転しません(自階級の1位より2位がP4Pで上に来ることはありません)。</li>
        </ul>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          P4Pは主観的・興行的な色合いの強い参考指標であり、階級別ランキングのような算出根拠の厳密さを備えたものではありません。
        </p>

        <p className="prose-updated">RIZIN非公式。mnews.jp独自算出。</p>
      </div>
      <Footer />
    </>
  );
}
