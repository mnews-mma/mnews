// 掲載階級の決定。本来は「直近のRIZIN試合の階級」だが、fighterRecords.jsonの
// history には試合ごとの階級フィールドが無い(取得していない)ため、現時点では
// 選手プロフィール(fighters.ts の weightClass、既存の単一ソース)で代用する。
// 第一弾のフェザー級公開に限ればこれで十分実用だが、他階級展開時に「直近試合の
// 階級」を厳密に出すには fighterRecords.json 側へ per-fight 階級の拡張が要る
// (要判断・このファイルはその暫定措置であることを明示する)。
export function isFeatherweightProfile(weightClass: string | undefined): boolean {
  return /フェザー級/.test(weightClass ?? "");
}
