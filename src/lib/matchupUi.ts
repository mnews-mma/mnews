// 対戦カードUI刷新(v2)のプレビュー出し分け判定。
// §0: 既存の公開ルートの見た目は変えない。新デザインは `?ui=new` または
// 環境変数 NEXT_PUBLIC_NEW_MATCHUP_UI=1 でのみ出す(通常アクセスは常に旧デザイン)。
// 環境変数は将来の本番フラグON用の差し込み口(現時点ではVercel側で未設定=常にfalse)。
export function isNewMatchupUiEnabled(
  searchParams: Record<string, string | string[] | undefined> | null | undefined
): boolean {
  if (process.env.NEXT_PUBLIC_NEW_MATCHUP_UI === "1") return true;
  if (!searchParams) return false;
  const raw = searchParams.ui;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "new";
}
