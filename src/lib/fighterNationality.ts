// 日本人確認済み選手のホワイトリスト(slug単位)。
// fighters.ts は不可侵・読み取りのみのため、国籍情報はこの別ファイルで管理する。
// 除外がデフォルト: このリストに無い選手は「日本人選手」を前提とした企画
// (例: /ranking/undefeated)には一切表示しない。推測での追加登録は禁止。
// 追加する場合は個別に国籍を確認した上で、追加理由をコメントで残すこと。
//
// 2026-07-10 手動確認(ユーザー確認済み・無敗選手8名の抽出結果より):
//   sheydullaev-rajabali(ラジャブアリ・シェイドゥラエフ)はキルギス国籍のため
//   このリストには含めない。
export const CONFIRMED_JAPANESE_SLUGS = new Set<string>([
  "izawa-seika",
  "aimoto-kazuki",
  "hamada-takumi",
  "ya-man",
  "jolly",
  "edpolo-king",
  "kenmin",
]);

export function isConfirmedJapanese(slug: string): boolean {
  return CONFIRMED_JAPANESE_SLUGS.has(slug);
}
