import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Breadcrumb, { breadcrumbJsonLd } from "@/components/Breadcrumb";
import { pageMetadata } from "@/lib/seo";
import {
  RATING_NAME,
  ALGORITHM_VERSION,
  INITIAL_RATING,
  K_BASE,
  K_FINISH,
  DECAY_PERIOD_DAYS,
  DECAY_PER_PERIOD,
  DECAY_FLOOR,
  ELIGIBILITY_MIN_FIGHTS,
  ELIGIBILITY_MIN_WINS,
  ELIGIBILITY_MAX_INACTIVE_MONTHS,
} from "@/lib/mnewsRating/constants";

export const metadata = pageMetadata({
  title: `${RATING_NAME}とは | 算出方法の完全公開 | mnews`,
  description: `mnews.jp独自のRIZINランキング「${RATING_NAME}」の算出方法をすべて公開。Eloレーティングの仕組み・K値・フィニッシュボーナス・不活性ディケイ・掲載資格・更新タイミング・アルゴリズム変更履歴。`,
  path: "/rankings/methodology",
});

export default function MethodologyPage() {
  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: "ランキング", href: "/rankings" },
    { label: "メソドロジー" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }} />
      <Nav />
      <div className="page-head">
        <Breadcrumb items={breadcrumbs} />
        <h1 className="page-title">{RATING_NAME} メソドロジー</h1>
        <div className="page-sub">算出方法の完全公開(現行アルゴリズム v{ALGORITHM_VERSION})</div>
      </div>

      <div className="prose">
        <p>
          RIZINには公式ランキングが存在しません。{RATING_NAME}はmnews.jpが独自に算出する非公式のランキングです。
          恣意的な編集判断を一切挟まない「アルゴリズムのみ」で順位を決めることが、機関としての信頼の源泉だと考えています。
          そのため、算出方法をこのページで隠さずすべて公開します。
        </p>

        <h2>基本の仕組み: Eloレーティング</h2>
        <p>
          チェスの実力評価などで使われるEloレーティングを、RIZIN開催のMMAルール試合(キックルール・エキシビションは除く)にのみ適用しています。
          全選手は初期レート{INITIAL_RATING}からスタートし、対戦結果に応じてレートが増減します。実力が近い相手に勝つと大きく増え、
          格下と見なされる相手に勝っても増分は小さくなります(逆に格上に負けても減少は小さくなります)。
        </p>

        <h2>K値とフィニッシュボーナス</h2>
        <p>
          1試合ごとのレート変動幅を決める係数(K値)は、判定勝ち・ドローで{K_BASE}、KO/TKOまたは一本勝ちでは{K_FINISH}
          (フィニッシュボーナス)です。ノーコンテスト・無効試合はレート変動なしとして扱います。
        </p>

        <h2>不活性ディケイ(直近性の反映)</h2>
        <p>
          最終試合から{DECAY_PERIOD_DAYS / 30}ヶ月経過するごとに、表示用レートから{DECAY_PER_PERIOD}pt減衰します(下限{DECAY_FLOOR}
          )。長期間試合をしていない選手のレートが実力以上に高いまま固定されるのを防ぐためです。ディケイは表示用レートにのみ適用し、
          実際の対戦結果によるレート計算(次に試合をした際の起点)には影響しません。復帰して試合をすれば通常のElo計算に戻ります。
        </p>

        <h2>対戦相手の扱い: 自社データベース圏外の相手</h2>
        <p>
          対戦相手が自社データベースに存在しない(戦績を追えていない)場合、その相手も初期レート{INITIAL_RATING}からスタートする内部レートとして継続的に追跡します。
          同じ相手が別の選手の対戦相手として複数回登場した場合、2回目以降は「初回の結果を反映した後のレート」を相手の実力の目安として使います。
          「毎回まっさらな初期レートの相手を狩って得点を稼げる」という歪みを避けるための設計です。ただし、ランキングに掲載・公開するのは
          自社データベースに登録されている選手(fighterRecords.jsonに戦績データがある選手)のみです。
        </p>

        <h2>少数試合の選手について(信頼区間の開示)</h2>
        <p>
          RIZIN内での対戦数が少ない選手ほど、レートの推定精度は低くなります。特に、対戦相手自体がデータベース外で他に対戦記録が一切ない
          「一発勝負」の相手に勝った場合、その一戦だけでは相手の実力を正確に見積もる材料がなく、レートが実力以上に振れる可能性があります。
          これはアルゴリズムの欠陥ではなく、公開されているデータの限界です。mnewsはこれを人力で補正することはしません
          (機関としての「アルゴリズムのみ」という立場を守るためです)。対戦数が増えるほど自然に実力へ収束していきます。
        </p>

        <h2>一次ソース間で結果が矛盾する試合の扱い</h2>
        <p>
          データベース内の2選手が同じ一戦について異なる勝敗を記録している(例: 双方が「自分が勝った」と記録している)場合、
          どちらが正しいか自動では判定せず、その一戦を計算から除外します。実例として、RIZIN LANDMARK 6の高木凌 vs
          ビクター・コレスニック戦は、双方の記録で勝敗が食い違っていたため、一次ソースでの確認が取れるまでレーティング計算から除外しています。
          推測でどちらかを正解として扱うことはしません(捏造ゼロポリシー)。
        </p>

        <h2>MMAルール外の試合の扱い</h2>
        <p>
          RIZIN開催であっても、キックルール・エキシビション・スタンディングバウト特別ルール(ボクシング準拠)などMMAルール以外の試合はレーティング対象外です。
          例えば平本蓮は2026年5月10日のRIZIN.53で皇治と対戦していますが、この一戦はスタンディングバウト特別ルール(ボクシング準拠)であり
          MMAルールの試合ではないため、レーティングには反映されません。平本蓮のレーティング上の最終試合は2024年7月28日の朝倉未来戦のままです。
        </p>

        <h2>掲載資格</h2>
        <p>以下すべてを満たす選手のみ、ランキングに順位を付与して掲載します。</p>
        <ul style={{ color: "var(--muted)", lineHeight: 1.9, marginTop: -4 }}>
          <li>RIZINで通算{ELIGIBILITY_MIN_FIGHTS}試合以上(MMAルール)</li>
          <li>直近{ELIGIBILITY_MAX_INACTIVE_MONTHS}ヶ月以内にRIZINで試合がある</li>
          <li>RIZINで{ELIGIBILITY_MIN_WINS}勝以上</li>
        </ul>
        <p>
          資格を満たさない選手も、レート自体は選手詳細ページに「参考レート」として表示する場合があります(ランキング上の順位は付与しません)。
        </p>

        <h2>更新タイミング</h2>
        <p>
          RIZIN大会の翌日、日次バッチ処理(JST 2:30、選手戦績データの更新直後)で自動更新されます。人手による更新作業や公開タイミングの調整は行いません。
        </p>

        <h2>データソースと対象</h2>
        <p>
          算出に使うデータは自社戦績データベース(fighterRecords.json)のみです。外部データの推測・補完は行いません。
          対象はRIZIN開催のMMAルール試合のみで、選手のレートは階級をまたいで1本のレートとして管理します(掲載階級は選手の現在の主戦階級で決まります)。
        </p>

        <h2>アルゴリズム変更履歴</h2>
        <ul style={{ color: "var(--muted)", lineHeight: 1.9, marginTop: -4 }}>
          <li>
            <strong style={{ color: "var(--fg)" }}>v1</strong> — 初回公開。フェザー級のみランキング掲載開始
            (他階級は算出済みだが未公開)。
          </li>
        </ul>

        <p className="prose-updated">RIZIN非公式。mnews.jp独自算出。本ページの内容はアルゴリズム変更時に更新します。</p>
      </div>
      <Footer />
    </>
  );
}
