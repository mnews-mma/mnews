/**
 * /kick(立ち技名鑑)配下で「名前の突合・結合」を行うすべての箇所が共用する、
 * 唯一の名前正規化関数。
 *
 * 背景(PR-G調査、2026-08-17): 統一前は次の2箇所で異なる正規化ルールが使われていた。
 * - 「相手名寄せ」(scripts/build-kick-data.ts の旧normName): NFKC + 空白除去 + 中黒(・･)除去 + 小文字化。
 * - 「Wikipedia記事↔選手の結合」(同ファイルの realnames.json 照合): `fightersByName.get(r.name)`
 *   による**完全一致のみ**で、正規化処理そのものが無かった(空白1つの有無で結合が失敗しうる)。
 * この関数1つに統一し、以後どちらの結合もこれを経由する。
 *
 * 適用するルール(この順序で適用):
 * 1. NFKC正規化(半角/全角英数字・半角/全角スペースの統一を含む)
 * 2. 残った空白(全角スペース含む)の除去
 * 3. 引用符類・区切り記号の除去(ニックネーム囲み・中黒の半角/全角等)
 * 4. 旧字体・異体字の統一
 * 5. 字形が酷似する漢字/カタカナの統一
 * 6. 大文字/小文字の統一
 *
 * 4・5の対応表は scripts/lib/fighterNameBackfill.ts の VARIANT_CHAR_MAP /
 * HOMOGRAPH_CHAR_MAP(MMA選手DBのバックフィルで実測済みの表記ゆれ)と同一の内容を踏襲する
 * (依存方向の都合上、値はここに複製するが、新しい対応を追加する場合は両ファイルを
 * 揃えて更新すること)。
 */

// 旧字体・異体字 -> 統一先。
const VARIANT_CHAR_MAP: Record<string, string> = {
  "髙": "高",
  "﨑": "崎",
  "齋": "斉",
  "齊": "斉",
  "斎": "斉",
  "濵": "浜",
};
const VARIANT_CHAR_RE = new RegExp(`[${Object.keys(VARIANT_CHAR_MAP).join("")}]`, "g");

// 漢字とカタカナで字形が同じ/酷似する文字の統一(片方をもう片方に寄せる)。
const HOMOGRAPH_CHAR_MAP: Record<string, string> = {
  "ニ": "二",
  "ロ": "口",
  "カ": "力",
  "エ": "工",
  "ト": "卜",
};
const HOMOGRAPH_CHAR_RE = new RegExp(`[${Object.keys(HOMOGRAPH_CHAR_MAP).join("")}]`, "g");

// 引用符類(ニックネーム囲みの各種引用符・プライム記号)・中黒(全角/半角)・中点。
const SYMBOL_STRIP_RE = /["'‘’“”〝〞〟′″「」『』・･·‧]/g;

export function normalizeKickName(raw: string): string {
  return (raw ?? "")
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(SYMBOL_STRIP_RE, "")
    .replace(VARIANT_CHAR_RE, (c) => VARIANT_CHAR_MAP[c])
    .replace(HOMOGRAPH_CHAR_RE, (c) => HOMOGRAPH_CHAR_MAP[c])
    .toLowerCase();
}
