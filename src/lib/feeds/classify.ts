import { SourceKey } from "../sources";

// Keyword -> org mapping used to classify secondary-media articles
// (ゴング格闘技 / MMAPLANET / イーファイト) that don't carry their own
// official org tag, per mnews-spec.md's mixed-source curation model.
const KEYWORDS: { key: SourceKey; patterns: RegExp[] }[] = [
  { key: "rizin", patterns: [/RIZIN/i, /ライジン/] },
  { key: "ufc", patterns: [/UFC/i] },
  { key: "shooto", patterns: [/修斗/] },
  { key: "deep", patterns: [/\bDEEP\b/i] },
  { key: "pancrase", patterns: [/パンクラス/, /PANCRASE/i] },
  { key: "one", patterns: [/ONE\s?(Championship|FC)/i, /ONE\s?フライデー/i] },
];

export function classifyOrg(title: string): SourceKey | null {
  for (const { key, patterns } of KEYWORDS) {
    if (patterns.some((p) => p.test(title))) return key;
  }
  return null;
}
