import { SourceKey } from "../sources";

// Keyword -> org mapping used to classify secondary-media articles
// (ゴング格闘技 / MMAPLANET / イーファイト) that don't carry their own
// official org tag, per mnews-spec.md's mixed-source curation model.
// 日本MMAメイン団体（RIZIN・DEEP・パンクラス）以外は「その他」に
// 分類する（classifyOrg が null を返すと呼び出し側で "other" になる）。
// 修斗は公式サイトを直接取得できず、メディア記事のキーワード判定に
// 頼るしかなかったため対象から除外（「公式発表」を名乗るには不正確）。
const KEYWORDS: { key: SourceKey; patterns: RegExp[] }[] = [
  { key: "rizin", patterns: [/RIZIN/i, /ライジン/] },
  { key: "deep", patterns: [/\bDEEP\b/i] },
  { key: "pancrase", patterns: [/パンクラス/, /PANCRASE/i] },
];

export function classifyOrg(title: string): SourceKey | null {
  for (const { key, patterns } of KEYWORDS) {
    if (patterns.some((p) => p.test(title))) return key;
  }
  return null;
}
