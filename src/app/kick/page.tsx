import Link from "next/link";
import { getKickIndex, KICK_PROMOTIONS, KICK_ROSTER_SOURCES } from "@/lib/kick/data";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "立ち技名鑑｜キックボクシング選手データベース - Mニュース",
  description:
    "K-1・Krush・RISE・SHOOT BOXING・KNOCK OUTの公式サイトとWikipediaから収集したキックボクシング選手2,484人の名簿と戦績データベース。全レコードに取得元URLを併記。",
  path: "/kick",
});

export default function KickTopPage() {
  const { stats } = getKickIndex();
  const nf = (n: number) => n.toLocaleString("ja-JP");

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
          <div className="kick-stat__n">{nf(stats.boutRows)}</div>
          <div className="kick-stat__l">戦績（bout）</div>
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

      <Link href="/kick/fighters" className="kick-cta">
        選手一覧を見る →
      </Link>

      <h2 className="kick-section-title">収録範囲</h2>
      <p className="kick-lead">
        名簿は次の6ソースから作成しました。戦績は下記4団体の公式サイトに掲載されているものを収録しています
        （{nf(stats.fightersWithBouts)}人分・{nf(stats.boutRows)}bout）。
      </p>
      <ul className="kick-list">
        {KICK_ROSTER_SOURCES.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <h2 className="kick-section-title">戦績の取得元（4団体）</h2>
      <ul className="kick-list">
        {KICK_PROMOTIONS.map((p) => (
          <li key={p.label}>
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {p.label}
            </a>
          </li>
        ))}
      </ul>

      <h2 className="kick-section-title">データの扱いについて</h2>
      <ul className="kick-list">
        <li>
          <strong>読みは推測で埋めていません。</strong>公式に読みの記載がない{nf(stats.kanaMissing)}人は空欄のまま掲載しています。
        </li>
        <li>
          公式ローマ字からカナ化した{nf(stats.kanaConverted)}人は、判断材料として<strong>ローマ字も併記</strong>しています。
        </li>
        <li>
          同姓同名の別人がいて相手を一意に特定できない場合は、<strong>選手ページへリンクせずテキストのまま</strong>表示します（誤った人物へ飛ばさないため）。
        </li>
        <li>名簿に収録がない対戦相手も、表記名をそのまま掲載しています。</li>
        <li>
          複数団体の公式サイトに同じ試合が載っている場合は1行にまとめ、出典は両方を残しています（{nf(stats.mergedDuplicateRows)}件）。
        </li>
      </ul>

      <h2 className="kick-section-title">収録していないもの</h2>
      <ul className="kick-list">
        <li>勝率・KO率などの算出指標（第1版では出していません）</li>
        <li>選手の検索・ランキング</li>
        <li>上記4団体以外の戦績（NJKF・NKB・MA日本・ジャパンキック等）</li>
      </ul>
    </>
  );
}
