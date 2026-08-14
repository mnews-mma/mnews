import Link from "next/link";
import { notFound } from "next/navigation";
import { getKickFighter, getKickIndex, KickBout, RESULT_LABEL } from "@/lib/kick/data";
import { pageMetadata } from "@/lib/seo";

/** 2,484人分をビルド時に静的生成する(リクエスト時の処理をゼロにする)。 */
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
    description: `${f.name}${yomi}${f.gym ? `／${f.gym}` : ""}の戦績${
      f.bouts.length ? `${f.bouts.length}試合` : ""
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
  return (
    <>
      {b.opponentSlug ? (
        <Link href={`/kick/fighters/${encodeURIComponent(b.opponentSlug)}`}>{b.opponentName}</Link>
      ) : (
        <span>{b.opponentName}</span>
      )}
      {b.opponentAmbiguous && (
        <span className="kick-badge" title={`同名の選手が${b.opponentCandidateCount}人いるため特定できません`}>
          同名{b.opponentCandidateCount}人・特定不可
        </span>
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

        <dl className="kick-meta">
          {f.aliases.length > 0 && (
            <>
              <dt>別表記</dt>
              <dd>{f.aliases.join("、")}</dd>
            </>
          )}
          <dt>所属</dt>
          <dd>{f.gym ?? <span className="kick-empty">—</span>}</dd>
          <dt>掲載団体</dt>
          <dd>
            {f.orgs.length ? (
              f.orgs.map((o) => (
                <span className="kick-tag" key={o}>
                  {o}
                </span>
              ))
            ) : (
              <span className="kick-empty">—（名簿のみ）</span>
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
        戦績{f.bouts.length > 0 && <span style={{ fontWeight: 400, fontSize: 12 }}>（{f.bouts.length}試合）</span>}
      </h2>

      {f.bouts.length === 0 ? (
        <p className="kick-lead">
          収録対象4団体（SHOOT BOXING／RISE／KNOCK OUT／K-1グループ）の公式サイトに、この選手の戦績掲載が見つかりませんでした。
          名簿には収録されていますが、戦績データはありません。
        </p>
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
                    {b.isDebut && <span className="kick-badge">デビュー戦</span>}
                    {b.ruleset && <span className="kick-badge">{b.ruleset.toUpperCase()}</span>}
                  </td>
                  <td className="kick-table__opp">
                    <OpponentCell b={b} />
                  </td>
                  <td>
                    {b.methodRaw || <span className="kick-empty">—</span>}
                    {b.isExtension && <span className="kick-badge">延長</span>}
                  </td>
                  <td className="kick-table__date">{b.round ?? "—"}</td>
                  <td>
                    <ResultCell b={b} />
                  </td>
                  <td className="kick-src">
                    <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {b.promotion}
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
