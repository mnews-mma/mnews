import Link from "next/link";
import { getKickIndex, KICK_PROMOTIONS, KICK_ROSTER_SOURCES } from "@/lib/kick/data";
import { pageMetadata } from "@/lib/seo";
import { formatDateJa, toJstDateStr } from "@/lib/eventCountdown";

export function generateMetadata() {
  const { stats } = getKickIndex();
  return pageMetadata({
    title: "立ち技名鑑｜キックボクシング選手データベース - Mニュース",
    description: `対象${stats.promotions.length}団体（K-1・RISE・SHOOT BOXING・KNOCK OUT・RIZIN・ONE Championship等）の公式サイトとWikipedia全団体から収集したキックボクシング選手${stats.fighters.toLocaleString(
      "ja-JP",
    )}人・戦績${stats.boutRows.toLocaleString("ja-JP")}件のデータベース。全レコードに取得元URLを併記。`,
    path: "/kick",
  });
}

export default function KickTopPage() {
  const { stats, sourceUpdatedAt } = getKickIndex();
  const nf = (n: number) => n.toLocaleString("ja-JP");
  const updatedAtJa = formatDateJa(toJstDateStr(Date.parse(sourceUpdatedAt)));

  return (
    <>
      <h1 className="kick-h1">立ち技名鑑</h1>
      <p className="kick-lead">
        キックボクシング（立ち技）の選手名簿と戦績のデータベースです。各団体の公式サイトとWikipediaの公開情報だけを機械的に収集し、
        <strong>全レコードに取得元URLを併記</strong>しています。読みが取得できなかった選手は空欄のままにし、推測で埋めていません。
      </p>

      <div className="kick-stats">
        <div className="kick-stat">
          <div className="kick-stat__n">{nf(stats.fighters)}</div>
          <div className="kick-stat__l">収録選手</div>
        </div>
        <div className="kick-stat">
          <div className="kick-stat__n">{nf(stats.boutRowsCompleted)}</div>
          <div className="kick-stat__l">戦績（実施済み）</div>
        </div>
        <div className="kick-stat">
          <div className="kick-stat__n">{nf(stats.kanaFilled)}</div>
          <div className="kick-stat__l">読み取得済み</div>
        </div>
        <div className="kick-stat">
          <div className="kick-stat__n">{nf(stats.kanaMissing)}</div>
          <div className="kick-stat__l">読み未取得（空欄で表示）</div>
        </div>
      </div>
      <p className="kick-updated-at">データ取得時点：{updatedAtJa}</p>

      <Link href="/kick/fighters" className="kick-cta">
        選手一覧を見る →
      </Link>

      <h2 className="kick-section-title">収録範囲</h2>
      <p className="kick-lead">
        名簿は次の6ソースから作成しました。名簿{nf(stats.fighters)}人のうち、公式サイトまたはWikipediaのいずれかから
        戦績を1件以上収集できた選手は{nf(stats.fightersWithBouts)}人です。
        戦績は下記{stats.promotions.length}団体の公式サイトに加え、Wikipediaの個別選手記事からは団体を問わず収集して収録しています。
      </p>
      <p className="kick-lead" style={{ fontSize: 12.5, color: "#555" }}>
        件数の内訳：各団体の公式サイトおよびWikipediaから取得した {nf(stats.boutRowsRaw)} 件のうち、複数団体に重複掲載されていた{" "}
        {nf(stats.mergedDuplicateRows)} 件を1行に統合し、名簿に該当者がいない {nf(stats.unmatchedBouts)} 件と、
        総合格闘技・エキシビジョンマッチ・アマチュア戦・ボクシングルールの試合など個別に事実確認のうえキックボクシングの戦績として
        掲載すべきでないと判定した {nf(stats.manualExclusionCount)} 件を除いた {nf(stats.boutRows)} 件を掲載しています
        （{nf(stats.boutRowsRaw)} − {nf(stats.mergedDuplicateRows)} − {nf(stats.unmatchedBouts)} − {nf(stats.manualExclusionCount)}{" "}
        = {nf(stats.boutRows)}）。うち {stats.boutRowsScheduled} 件は開催前の予定試合のため、
        「戦績（実施済み）」の {nf(stats.boutRowsCompleted)} 件には含めていません。
        取得元の内訳は公式サイト {nf(stats.boutRowsOfficial)} 件・Wikipedia {nf(stats.boutRowsWikipedia)} 件です。
      </p>
      <p className="kick-lead" style={{ fontSize: 12.5, color: "#555" }}>
        <strong>K-1 / Krush / Krush-EXとKNOCK OUT</strong>は、現在の選手一覧ページに掲載されていない過去の出場選手も、
        個別の選手ページ(K-1はfighter ID空間の走査、KNOCK OUTは大会結果ページの収集による)から収録しています。
        他{KICK_ROSTER_SOURCES.length - 2}ソース（Wikipedia男子/女子一覧・RISE・SHOOT BOXING）は、各サイトに現行掲載されている選手のみが対象です。
      </p>
      <ul className="kick-list">
        {KICK_ROSTER_SOURCES.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <h2 className="kick-section-title">戦績の取得元（対象{stats.promotions.length}団体の公式サイト＋Wikipedia全団体）</h2>
      <p className="kick-lead" style={{ fontSize: 12.5, color: "#555" }}>
        下記{stats.promotions.length}団体それぞれについて、公式サイトの選手ページから戦績を収集しています。
        Wikipediaの個別選手記事は、これら{stats.promotions.length}団体に限らず、キックボクシング・ムエタイの戦績であれば団体を問わず収集対象にしています
        （GLORY・ルンピニー・ラジャダムナン・WAKO SuperLeague・J-NETWORK・全日本キックボクシング連盟など、公式サイト側の対象外団体を含む）。
        なお収集対象は「男子/女子キックボクサー一覧」ページから辿れる選手だけに限定していません。一覧ページからは辿れなくても
        個別記事が実在する選手は記事の実在を個別に確認したうえで収集対象に加えており、この方式で一覧ページ経由では見つからなかった
        選手の戦績データが後から追加で収録できた実績があります(PR-16時点の調査実測: 177人)。
      </p>
      <ul className="kick-list">
        {KICK_PROMOTIONS.map((p) => (
          <li key={p.label}>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {p.label}
            </a>
          </li>
        ))}
        <li>
          Wikipedia（各選手の個別記事。総合格闘技・ボクシング・エキシビションマッチ等の非キックボクシング戦績は除外して収集）
        </li>
      </ul>

      <h2 className="kick-section-title">データの扱いについて</h2>
      <ul className="kick-list">
        <li>
          <strong>読みは推測で埋めていません。</strong>公式に読みの記載がない{nf(stats.kanaMissing)}人は空欄のまま掲載しています。
        </li>
        <li>
          出典に読み(カナ)の記載がなく<strong>公式のローマ字表記のみ</strong>ある{nf(stats.kanaConverted)}人は、
          出典のあるローマ字表記を機械的にカナへ変換して掲載しています(読みそのものを推測しているわけではありません)。
          判断材料として<strong>ローマ字も併記</strong>しています。
        </li>
        <li>
          同姓同名の別人がいて相手を一意に特定できない場合は、<strong>選手ページへリンクせずテキストのまま</strong>表示します（誤った人物へ飛ばさないため）。
        </li>
        <li>名簿に収録がない対戦相手も、表記名をそのまま掲載しています。</li>
        <li>
          複数団体の公式サイトに同じ試合が載っている場合は1行にまとめ、出典は両方を残しています（{nf(stats.mergedDuplicateRows)}件）。
        </li>
        <li>
          決着の表記（「3R 判定」「3R判定」など）は出典サイトごとに揺れがあります。<strong>元データは原文のまま保持</strong>し、
          表示のみ決着方法に揃えています（ラウンドは「R」列に分離）。各行にカーソルを合わせると原文を確認できます。
        </li>
        <li>
          タイトルマッチ・王座決定戦・挑戦者決定戦は、出典に<strong>明記されている場合のみ</strong>バッジ表示しています（
          {nf(stats.titleTypeCount)}件）。書かれていない試合には付けていません。
        </li>
        <li>
          出典側に勝敗の記載がない試合は「不明」として掲載し、<strong>勝敗としては数えていません</strong>（
          {nf(stats.resultUnknownCount)}件）。
        </li>
      </ul>

      <h2 className="kick-section-title">収録していないもの</h2>
      <ul className="kick-list">
        <li>勝率・KO率などの算出指標</li>
        <li>選手のランキング</li>
        <li>
          J-NETWORK・GLORY・ルンピニー等の非対象{stats.promotions.length}団体は、当該団体の公式サイトを直接の取得元とはしていません（Wikipediaに掲載がある分のみ収録）
        </li>
        <li>MA日本（公式に勝敗記録が存在しないため）</li>
        <li>各団体の2000年代以前の戦績の一部（公式サイト・Wikipediaいずれにも掲載がないため）</li>
      </ul>
    </>
  );
}
