import { FIGHTERS } from "./fighters";

// ニュース見出し内の選手名検出→関連選手チップ用。サーバー側
// (page.tsx等のリクエスト時レンダリング)でのみ呼び出し、結果(name/slug)のみを
// クライアントへ渡す。fighters.ts全量・マッチングロジック自体はクライアントに出さない。

// リングネーム単独(姓名分割なし)かつ短い登録名のうち、一般名詞・著名作品名・
// ありふれた人名と衝突し誤マッチしうるものを除外する。
// 2026-07: 文字種境界マッチ導入により「短い名前が長い単語の一部として誤検出
// される」リスクは大きく下がったため、それだけが理由だったもの(カタカナ短名の
// 複合語埋め込みリスク)は除外解除した。一方、単独の語としても一般名詞・
// ありふれた同名人物と衝突するもの(境界マッチでは解決できない真の同形異義語)
// はそのまま除外を維持する。
const EXCLUDED_CHIP_NAMES = new Set<string>([
  "皇治", // 無関係な同名人物(著名キックボクサー)のリスク。境界マッチでは解決不可
  "直樹", // 極めてありふれた日本人の名前。「井上 直樹」等の一部としての誤検出も境界マッチで防げるが、独立した語としての同名多数リスクは残る
  "力也", // ありふれた人名
  "誠悟", // ありふれた人名
  "亮我", // ありふれた人名
  "ヒカル", // 極めてありふれた名前(YouTuber等の同名多数)。境界マッチでは解決不可
  "たてお", // ひらがなの一般的な人名
  "千春", // ありふれた人名(著名人多数)
  "大成", // 一般名詞「大成」(西谷大成。既にhidden:trueだが念のため明記)
  "海飛", // 読みが一般的な人名になりやすい
]);

// 短いカタカナ登録名の一部は、ニュース記事タイトルで英字表記や別カナ表記が
// 使われることがあり、nameJaの完全一致だけでは検出漏れ(主語漏れ)が起きる。
// fighters.ts(選手マスタ)の aliases フィールドは対戦相手名解決専用
// (findFighterSlugByName用。"KENTA"等の著名別人と衝突する値を含む)のため
// ここでは流用せず、チップ検出専用の別名辞書をこのファイル内に閉じて持つ。
const CHIP_ALIASES: Record<string, string[]> = {
  jolly: ["JOLLY"],
  noel: ["ノエル"],
  sasuke: ["サスケ"],
};

export interface RelatedFighterChip {
  name: string;
  slug: string;
}

// マッチング候補プール: 非hidden かつ 除外リスト対象外。nameJa(+ 上記の
// チップ専用別名)のみ照合(fighters.ts側のnickname/aliasesは対象外。理由は
// CHIP_ALIASESのコメント参照)。
// 戦績データの有無(noRecordData)はfighters.ts単体の情報だけでは分からない
// (fetchFighterRecords()が必要)ため、ここでは判定せず呼び出し側からvisibleSlugsを
// 受け取って最終フィルタする。
const CANDIDATES = FIGHTERS.filter((f) => !f.hidden && !EXCLUDED_CHIP_NAMES.has(f.nameJa));

const norm = (s: string) => s.replace(/[\s　]/g, "");

// 文字種境界マッチ用の文字クラス分類。「短い登録名が、より長い同一文字種の
// 単語・複合語の一部としてたまたま出現しているだけ」の誤検出(例:
// 「ダイヤ」が「ダイヤモンド」に埋め込まれている、「直樹」が「井上直樹」の
// 末尾に埋め込まれている)を防ぐため、マッチ箇所の前後の文字が登録名と同じ
// 文字種で連続していないか(=単語の切れ目になっているか)を確認する。
// space/句読点等の"other"クラスは常に境界として扱う(空白・記号の後に同じ
// 文字種が続いても、そこは単語の切れ目とみなす)。
type CharClass = "kanji" | "hiragana" | "katakana" | "latin" | "other";

function charClass(ch: string): CharClass {
  if (/[一-鿿]/.test(ch)) return "kanji";
  if (/[぀-ゟ]/.test(ch)) return "hiragana";
  if (/[゠-ヿー]/.test(ch)) return "katakana";
  if (/[A-Za-z0-9]/.test(ch)) return "latin";
  return "other";
}

// text内のmatchStart〜matchEnd(半開区間)が、前後の文字と同一文字種で連続して
// いないか(=単語境界として妥当か)を判定する。
function isBoundarySafe(text: string, matchStart: number, matchEnd: number): boolean {
  const before = matchStart > 0 ? text[matchStart - 1] : null;
  const after = matchEnd < text.length ? text[matchEnd] : null;
  const startClass = charClass(text[matchStart]);
  const endClass = charClass(text[matchEnd - 1]);
  if (before !== null && charClass(before) === startClass && startClass !== "other") return false;
  if (after !== null && charClass(after) === endClass && endClass !== "other") return false;
  return true;
}

// normTitle内でneedleが境界安全にマッチする最初の位置を返す(無ければ-1)。
// 複数出現しうる場合、先頭から順に境界チェックし最初に通った位置を採用する。
function findBoundarySafeIndex(normTitle: string, needle: string): number {
  let from = 0;
  while (from <= normTitle.length - needle.length) {
    const index = normTitle.indexOf(needle, from);
    if (index === -1) return -1;
    if (isBoundarySafe(normTitle, index, index + needle.length)) return index;
    from = index + 1;
  }
  return -1;
}

// タイトル文字列に含まれる登録選手名を、タイトル内の出現順で最大3件返す。
// 本文・URLは対象外。マッチ0件は空配列(呼び出し側でチップ非表示)。
//
// visibleSlugs: getVisibleFighterSlugs()(選手ページ・対戦カードの「表示可能」
// 判定と同一基準=非hidden かつ 戦績データあり)で絞り込んだslugの集合。
// この集合に無いslug(戦績データが空=noRecordData)はマッチしてもチップ化しない
// (中身の無い選手ページへのタグ化を防ぐ)。
export function matchRelatedFighters(title: string, visibleSlugs: Set<string>): RelatedFighterChip[] {
  const normTitle = norm(title);
  const matches: { name: string; slug: string; index: number }[] = [];
  for (const f of CANDIDATES) {
    if (!visibleSlugs.has(f.slug)) continue;
    const surfaceForms = [f.nameJa, ...(CHIP_ALIASES[f.slug] ?? [])];
    let bestIndex = -1;
    for (const surface of surfaceForms) {
      const normName = norm(surface);
      if (!normName) continue;
      const index = findBoundarySafeIndex(normTitle, normName);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) bestIndex = index;
    }
    if (bestIndex !== -1) matches.push({ name: f.nameJa, slug: f.slug, index: bestIndex });
  }
  return matches
    .sort((a, b) => a.index - b.index)
    .slice(0, 3)
    .map(({ name, slug }) => ({ name, slug }));
}
