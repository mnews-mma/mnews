import { FIGHTERS } from "./fighters";

// ニュース見出し内の選手名(完全一致)検出→関連選手チップ用。サーバー側
// (page.tsx等のリクエスト時レンダリング)でのみ呼び出し、結果(name/slug)のみを
// クライアントへ渡す。fighters.ts全量・マッチングロジック自体はクライアントに出さない。

// リングネーム単独(姓名分割なし)かつ短い登録名のうち、一般名詞・著名作品名・
// ありふれた人名と衝突し誤マッチしうるものを除外する。
const EXCLUDED_CHIP_NAMES = new Set<string>([
  "ヒロヤ", // 一般的な人名としても頻出
  "金太郎", // 童話「金太郎」と同一
  "皇治", // 無関係な同名人物のリスク
  "直樹", // 極めてありふれた日本人の名前
  "力也", // ありふれた人名
  "誠悟", // ありふれた人名
  "ダイヤ", // 「ダイヤモンド」の略として一般名詞化
  "亮我", // ありふれた人名
  "ヒカル", // 極めてありふれた名前(YouTuber等の同名多数)
  "たてお", // ひらがなの一般的な人名
  "ソーキ", // 沖縄料理「ソーキ」と同一表記
  "リトル", // 英語借用の一般名詞
  "千春", // ありふれた人名(著名人多数)
  "大成", // 一般名詞「大成」(西谷大成。既にhidden:trueだが念のため明記)
  "海飛", // 読みが一般的な人名になりやすい
  "火の鳥", // 手塚治虫の代表作タイトルと同一
]);

export interface RelatedFighterChip {
  name: string;
  slug: string;
}

// マッチング候補プール: 非hidden かつ 除外リスト対象外。nameJaのみ照合
// (aliases・nicknameは対象外。aliasesには"KENTA"等の著名別人と衝突する値が
// 含まれるため、意図的に見ない)。
const CANDIDATES = FIGHTERS.filter((f) => !f.hidden && !EXCLUDED_CHIP_NAMES.has(f.nameJa));

const norm = (s: string) => s.replace(/[\s　]/g, "");

// タイトル文字列に含まれる登録選手名(完全一致)を、タイトル内の出現順で
// 最大3件返す。本文・URLは対象外。マッチ0件は空配列(呼び出し側でチップ非表示)。
export function matchRelatedFighters(title: string): RelatedFighterChip[] {
  const normTitle = norm(title);
  const matches: { name: string; slug: string; index: number }[] = [];
  for (const f of CANDIDATES) {
    const normName = norm(f.nameJa);
    if (!normName) continue;
    const index = normTitle.indexOf(normName);
    if (index !== -1) matches.push({ name: f.nameJa, slug: f.slug, index });
  }
  return matches
    .sort((a, b) => a.index - b.index)
    .slice(0, 3)
    .map(({ name, slug }) => ({ name, slug }));
}
