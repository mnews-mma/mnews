import Link from "next/link";
import { notFound } from "next/navigation";
import {
  displayOrgLabel,
  getFighterBoutCount,
  getKickFighter,
  getKickIndex,
  KICK_PROMOTIONS,
  KickBout,
  methodLabel,
  PROMOTION_SHORT,
  RESULT_LABEL,
  TITLE_TYPE_LABEL,
} from "@/lib/kick/data";
import { normalizeKickDecisionScorePerspective } from "@/lib/kick/decisionScorePerspective";
import { pageMetadata } from "@/lib/seo";

/** 名簿全員分をビルド時に静的生成する(リクエスト時の処理をゼロにする)。 */
export function generateStaticParams() {
  return getKickIndex().fighters.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = getKickFighter(decodeURIComponent(slug));
  if (!f) return {};
  const yomi = f.kana ? `（${f.kana}）` : "";
  return pageMetadata({
    title: `${f.name}${yomi}の戦績・プロフィール｜立ち技名鑑 - Mニュース`,
    description: `${f.name}${yomi}の戦績${
      getFighterBoutCount(f) ? `${getFighterBoutCount(f)}試合` : ""
    }を掲載。日付・大会名・対戦相手・決着・勝敗を取得元URL付きで確認できます。`,
    path: `/kick/fighters/${encodeURIComponent(f.slug)}`,
  });
}

function ResultCell({ b }: { b: KickBout }) {
  return (
    <span className={`kick-r kick-r--${b.result}`} title={b.result}>
      {RESULT_LABEL[b.result]}
    </span>
  );
}

function OpponentCell({ b }: { b: KickBout }) {
  // リンクしてよいのは一意に解決できた相手だけ。
  // ambiguous(同名異人)・未解決は誤って別人へ飛ばさないためテキスト表示にする。
  //
  // 表示層混入監査(2026-08、3度目の指摘): 選手名の<span>とバッジの<span>が直接
  // 隣接しており、CSS(パディング等)がある通常のブラウザ表示では視覚的に区切られて
  // 見えるが、テキスト抽出(スクリーンリーダー・自動テキスト監査・アクセシビリティ
  // ツリー等、CSSを介さずDOMのテキストノードをそのまま連結する経路)では
  // 「一輝同姓同名のため未リンク」のように選手名とバッジ内部ラベルが空白無しで
  // 連結して読まれてしまう。バッジの直前に明示的な空白テキストノードを1つ挿入し、
  // どの読み上げ・抽出経路でも語の境界が保たれるようにする。
  return (
    <>
      {b.opponentSlug ? (
        <Link href={`/kick/fighters/${encodeURIComponent(b.opponentSlug)}`}>{b.opponentName}</Link>
      ) : (
        <span>{b.opponentName}</span>
      )}
      {b.opponentAmbiguous && (
        <>
          {" "}
          <span
            className="kick-badge"
            title={`「${b.opponentName}」という名前の選手が${b.opponentCandidateCount}人おり、どちらの選手か区別できないため選手ページへのリンクを付けていません`}
          >
            同姓同名のため未リンク
          </span>
        </>
      )}
      {b.opponentAffiliation && <div className="kick-table__aff">{b.opponentAffiliation}</div>}
    </>
  );
}

export default async function KickFighterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = getKickFighter(decodeURIComponent(slug));
  if (!f) notFound();

  const converted = f.kanaSource?.type === "from_romaji";

  return (
    <>
      <div className="kick-profile">
        <h1 className="kick-name">{f.name}</h1>
        <div className="kick-yomi">
          {f.kana ? (
            <>
              {f.kana}
              {f.romaji && <span className="kick-yomi__romaji">　{f.romaji}</span>}
            </>
          ) : (
            <>
              <span className="kick-empty">読み未取得</span>
              {f.romaji && <span className="kick-yomi__romaji">　{f.romaji}</span>}
            </>
          )}
        </div>

        {getFighterBoutCount(f) > 0 && (
          <p className="kick-record-summary">
            収録{getFighterBoutCount(f)}試合
            {f.record.total > 0 &&
              (f.record.total === getFighterBoutCount(f) ? (
                <>
                  ：{f.record.wins}勝{f.record.losses}敗{f.record.draws}分
                  {f.record.unknownCount > 0 && `、ほか不明${f.record.unknownCount}件`}
                </>
              ) : (
                <>
                  (うち集計対象{f.record.total}：{f.record.wins}勝{f.record.losses}敗{f.record.draws}分
                  {f.record.unknownCount > 0 && `、ほか不明${f.record.unknownCount}件`})
                </>
              ))}
          </p>
        )}

        <dl className="kick-meta">
          {f.aliases.length > 0 && (
            <>
              <dt>別表記</dt>
              <dd>{f.aliases.join("、")}</dd>
            </>
          )}
          <dt>掲載団体</dt>
          <dd>
            {f.orgs.length ? (
              // PR-21.5検証時の指摘: keyに内部団体ラベル(o)の生値をそのまま使うと、
              // RSC(React Server Components)のハイドレーション用ペイロードに
              // "Wikipedia(その他団体)"という内部ラベル文字列がそのまま(表示テキストとは別に)
              // 埋め込まれ、生HTMLへの単純な文字列検索で誤って「未修正」と誤検知されうる
              // (実害は無い=ユーザーの目に見えるテキストは常にdisplayOrgLabel(o)の結果)。
              // 紛らわしさを避けるため、keyには生ラベルではなくインデックスを使う。
              f.orgs.map((o, i) => (
                <span className="kick-tag" key={`org-${i}`}>
                  {displayOrgLabel(o)}
                </span>
              ))
            ) : (
              <span className="kick-empty">—（掲載戦績なし）</span>
            )}
          </dd>
          <dt>出典</dt>
          <dd>
            {f.sources.map((u) => (
              <div key={u} className="kick-src">
                <a href={u} target="_blank" rel="noopener noreferrer">
                  {u}
                </a>
              </div>
            ))}
          </dd>
        </dl>

        {converted && (
          <div className="kick-note">
            この選手の読みは<strong>公式のローマ字表記から変換したもの</strong>です（公式にカナの記載がないため）。
            判断材料としてローマ字も併記しています。誤りにお気づきの場合はご指摘ください。
          </div>
        )}

        {!f.kana && (
          <div className="kick-note">
            この選手の<strong>読みは公開元が見つかっていません</strong>。推測で埋めず空欄にしています。
            正しい読みをご存じでしたら{" "}
            <a href="https://x.com/mnews_mma" target="_blank" rel="noopener noreferrer">
              𝕏 @mnews_mma
            </a>{" "}
            のDMで「{f.name} の読み」としてお知らせください。いただいた情報は出典を確認のうえ反映します。
          </div>
        )}
      </div>

      <h2 className="kick-section-title">
        戦績{getFighterBoutCount(f) > 0 && <span style={{ fontWeight: 400, fontSize: 12 }}>（{getFighterBoutCount(f)}試合）</span>}
      </h2>

      {getFighterBoutCount(f) === 0 ? (
        <div className="kick-note">
          この選手の試合記録は、収録対象の{KICK_PROMOTIONS.length}団体
          （{KICK_PROMOTIONS.map((p) => p.label).join("／")}）の公式サイトには掲載されていません。
          名簿は<strong>各団体公式サイトおよびWikipediaの掲載</strong>を根拠に収録しています。
        </div>
      ) : (
        <div className="kick-table-wrap">
          <table className="kick-table">
            <thead>
              <tr>
                <th style={{ width: 92 }}>日付</th>
                <th>大会名</th>
                <th>対戦相手</th>
                <th style={{ width: 110 }}>決着</th>
                <th style={{ width: 44 }}>R</th>
                <th style={{ width: 52 }}>勝敗</th>
                <th style={{ width: 96 }}>出典</th>
              </tr>
            </thead>
            <tbody>
              {f.bouts.map((b, i) => (
                <tr key={i}>
                  <td className="kick-table__date">{b.date ?? <span className="kick-empty">不明</span>}</td>
                  <td>
                    {b.event ?? <span className="kick-empty">不明</span>}
                    {b.venue && <div className="kick-table__aff">{b.venue}</div>}
                    {b.note && <div className="kick-table__aff">{b.note}</div>}
                    {b.isDebut && (
                      <>
                        {" "}
                        <span className="kick-badge">デビュー戦</span>
                      </>
                    )}
                    {b.ruleset && (
                      <>
                        {" "}
                        <span className="kick-badge">{b.ruleset.toUpperCase()}</span>
                      </>
                    )}
                    {b.titleType && (
                      <>
                        {" "}
                        <span className="kick-badge kick-badge--title">{TITLE_TYPE_LABEL[b.titleType]}</span>
                      </>
                    )}
                  </td>
                  <td className="kick-table__opp">
                    <OpponentCell b={b} />
                  </td>
                  <td>
                    <span title={b.methodRaw ? `出典の原文: ${b.methodRaw}` : undefined}>
                      {normalizeKickDecisionScorePerspective(methodLabel(b.methodRaw), b.result).text}
                    </span>
                    {b.isExtension && (
                      <>
                        {" "}
                        <span className="kick-badge">延長</span>
                      </>
                    )}
                  </td>
                  <td className="kick-table__date">{b.round ?? "—"}</td>
                  <td>
                    <ResultCell b={b} />
                  </td>
                  <td className="kick-src">
                    <a
                      href={b.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={b.sourceType === "wikipedia" ? `${displayOrgLabel(b.promotion)}(出典: Wikipedia)` : b.promotion}
                    >
                      {b.sourceType === "wikipedia" ? "Wikipedia" : PROMOTION_SHORT[b.promotion] ?? b.promotion}
                    </a>
                    {b.alsoFrom.map((u) => (
                      <div key={u}>
                        <a href={u} target="_blank" rel="noopener noreferrer">
                          別出典
                        </a>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="kick-foot" style={{ padding: "18px 0 0", borderTop: "none" }}>
        <Link href="/kick/fighters">← 選手一覧へ戻る</Link>
      </p>
    </>
  );
}
