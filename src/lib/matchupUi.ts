// 対戦カードUI刷新(v2)の出し分け判定。
//
// 2026-07-16: 恒久化に伴いデフォルトを反転した。新UIが標準(デフォルトON)で、
// 環境変数 NEXT_PUBLIC_NEW_MATCHUP_UI を明示的に "0" にした場合のみ旧UIに戻る
// (Vercel production環境変数を削除・未設定でも、コード側のデフォルトがONの
// ためv2のまま=env var消失に対する多重防御になっている)。
//
// 実測の結果、Next.js(このバージョン)は generateStaticParams を持つルートで
// searchParams を読んでも、明示的な `export const dynamic = "force-dynamic"`
// (リテラルのみ許可・式は不可)を付けない限り実際には動的化されない
// (ビルド時のsearchParams分岐を条件付きにしても●=SSGのまま)。かつ
// `dynamic` の値をビルド環境(VERCEL_ENV)で出し分ける式もNext.jsに拒否される
// ("can't recognize the exported `config` field"エラー)。
// そのため、SSG(=本番の長尾ページとして必須)を維持する events/[slug]・
// fighters/[slug] では ?ui=new クエリを使わず、ビルド時環境変数
// NEXT_PUBLIC_NEW_MATCHUP_UI のみで判定する(searchParamsに一切触れない)。
// dream(SEO対象外・既にforce-dynamic)のみ、引き続きクエリでも切り替え可能にする。

// events/[slug]・fighters/[slug]用: 環境変数のみで判定(searchParams非依存)。
// これによりSSG(generateStaticParams)が壊れない。
// デフォルトON: "0" が明示されている場合のみfalse(旧UI)。未設定・"1"・
// その他の値はすべてtrue(新UI)。
export function isNewMatchupUiEnabledByEnv(): boolean {
  return process.env.NEXT_PUBLIC_NEW_MATCHUP_UI !== "0";
}

// dream用: 環境変数がOFF("0")の場合のみ ?ui=new クエリでの一時的な確認を許可する
// (dreamはSEO対象外でforce-dynamic前提のため、クエリ読み出しによる追加コストがない)。
// 環境変数が明示OFFでない限りisNewMatchupUiEnabledByEnv()が先にtrueを返すため、
// 通常時(デフォルトON)はクエリの有無に関わらず新UI。
export function isNewMatchupUiEnabled(
  searchParams: Record<string, string | string[] | undefined> | null | undefined
): boolean {
  if (isNewMatchupUiEnabledByEnv()) return true;
  if (!searchParams) return false;
  const raw = searchParams.ui;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "new";
}

// fighters/[slug]用: このページは(v2実装と無関係な理由=Wikipedia戦績の
// リクエスト時取得のため)既にforce-dynamicなので、SSG崩壊の心配は無い。
// 環境変数がデフォルトON(明示OFFでない)であればそのままtrueを返し、
// 明示OFF時のみ本番以外(プレビュー/ローカル)で ?ui=new による一時確認を許可する。
export async function resolveMatchupUiV2ForDynamicPage(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<boolean> {
  if (isNewMatchupUiEnabledByEnv()) return true;
  if (process.env.VERCEL_ENV === "production") return false;
  const sp = await searchParams;
  return isNewMatchupUiEnabled(sp);
}
