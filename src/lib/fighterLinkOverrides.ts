import { findFighterSlugByName } from "./fighters";

// 対戦相手名からのリンク解決で、同名別人による誤リンクを個別に抑制するための
// 除外オーバーライド層。findFighterSlugByNameはnameJa/aliases/nameEn(大小無視)の
// 文字列一致だけで解決するグローバル辞書のため、試合単位のコンテキスト
// (どの選手の・いつの試合か)を持たない。同名衝突が見つかった場合はここに
// 追記するだけで対応する(fighters.ts・data/*.jsonは不可侵のため変更しない)。
interface LinkOverrideEntry {
  fighterSlug: string; // 戦績テーブルの持ち主(自分視点)のslug
  date: string; // YYYY-MM-DD(該当試合の日付)
  opponent: string; // 戦績表に記録されている対戦相手名の表記(突合は大小無視)
  note?: string; // 経緯メモ。突合には使わない
}

const NO_LINK_OVERRIDES: LinkOverrideEntry[] = [
  {
    fighterSlug: "hiroya",
    date: "2021-10-17",
    opponent: "RYOGA",
    note: "同名別人(ryogaスラッグの亮我とは別人)・リンク不要。DEEP TOKYO IMPACT 2021～1ST ROUND～",
  },
];

function isSuppressed(opponentName: string, ctx?: { fighterSlug?: string; date?: string }): boolean {
  if (!ctx?.fighterSlug || !ctx?.date) return false;
  return NO_LINK_OVERRIDES.some(
    (o) =>
      o.fighterSlug === ctx.fighterSlug &&
      o.date === ctx.date &&
      o.opponent.toLowerCase() === opponentName.toLowerCase()
  );
}

// findFighterSlugByNameのドロップイン置き換え。ctxで試合単位の情報
// (fighterSlug・date)を渡すと、除外オーバーライドに該当する場合はnullを
// 返す(=リンクさせない)。ctx省略時・非該当時はfindFighterSlugByNameの
// 結果をそのまま返す。
export function resolveOpponentSlug(
  opponentName: string,
  excludeSlug?: string,
  visibleSlugs?: Set<string>,
  ctx?: { fighterSlug?: string; date?: string }
): string | null {
  if (isSuppressed(opponentName, ctx)) return null;
  return findFighterSlugByName(opponentName, excludeSlug, visibleSlugs);
}
