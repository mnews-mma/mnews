import type { FeedArticle } from "./newsClassify";

// トップページの新着フィード(4タブ共通)の唯一のビルドロジック。
// タブごとに対象ソース集合(全件/公式/メディア/オリジナル)を絞ってから
// この関数に通すことで、窓・フォールバック・上限の挙動を全タブで一致させる
// (タブ固有の分岐ロジックはここに持ち込まない)。
export const FEED_WINDOW_HOURS = 48;
export const FEED_MIN_FALLBACK = 5;
export const FEED_MAX_ITEMS = 15;
// メディアタブのみ適用するソフト上限(会見日等の同一ネタ量産対策)。
export const FEED_MEDIA_SOFT_CAP = 10;

// 48時間以内が FEED_MIN_FALLBACK 件以上ならその窓内から新しい順に最大
// maxItems件。窓内がFEED_MIN_FALLBACK件未満なら窓を無視し、全体から
// 新しい順に直近FEED_MIN_FALLBACK件で埋める(閑散期対策)。
export function buildFeed(items: FeedArticle[], opts: { maxItems?: number } = {}): FeedArticle[] {
  const maxItems = opts.maxItems ?? FEED_MAX_ITEMS;
  const sorted = [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const cutoffMs = Date.now() - FEED_WINDOW_HOURS * 3600_000;
  const within = sorted.filter((a) => new Date(a.publishedAt).getTime() >= cutoffMs);
  const base = within.length >= FEED_MIN_FALLBACK ? within : sorted.slice(0, FEED_MIN_FALLBACK);
  return base.slice(0, maxItems);
}
