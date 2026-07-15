// 対戦カードUI刷新(v2)のプレビュー出し分け判定。
//
// 実測の結果、Next.js(このバージョン)は generateStaticParams を持つルートで
// searchParams を読んでも、明示的な `export const dynamic = "force-dynamic"`
// (リテラルのみ許可・式は不可)を付けない限り実際には動的化されない
// (ビルド時のsearchParams分岐を条件付きにしても●=SSGのまま)。かつ
// `dynamic` の値をビルド環境(VERCEL_ENV)で出し分ける式もNext.jsに拒否される
// ("can't recognize the exported `config` field"エラー)。
// そのため、SSG(=本番の長尾ページとして必須)を維持する events/[slug]・
// fighters/[slug] では ?ui=new クエリを諦め、ビルド時環境変数
// NEXT_PUBLIC_NEW_MATCHUP_UI のみで判定する(searchParamsに一切触れない)。
// dream(SEO対象外・既にforce-dynamic)のみ、引き続きクエリでも切り替え可能にする。

// events/[slug]・fighters/[slug]用: 環境変数のみで判定(searchParams非依存)。
// これによりSSG(generateStaticParams)が壊れない。
export function isNewMatchupUiEnabledByEnv(): boolean {
  return process.env.NEXT_PUBLIC_NEW_MATCHUP_UI === "1";
}

// dream用: 環境変数 または ?ui=new クエリのどちらでも切り替え可能
// (dreamはSEO対象外でforce-dynamic前提のため、クエリ読み出しによる追加コストがない)。
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
// ただしこのページも索引対象の長尾SEOページのため、?ui=new付きURLが
// クロールされて新旧重複コンテンツになるのを避ける目的で、本番
// (VERCEL_ENV==="production")ではクエリを無視し環境変数のみで判定する
// (production環境の実行時にもVERCEL_ENVは正しい値を持つため、ここは
// ランタイムの分岐で問題ない=events/[slug]のSSGルートとは事情が異なる)。
export async function resolveMatchupUiV2ForDynamicPage(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<boolean> {
  if (isNewMatchupUiEnabledByEnv()) return true;
  if (process.env.VERCEL_ENV === "production") return false;
  const sp = await searchParams;
  return isNewMatchupUiEnabled(sp);
}
