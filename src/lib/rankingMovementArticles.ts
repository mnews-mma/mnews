// AIランキング変動ネタ化(Task B②)。bout由来のランキング変動(勝敗が引き起こした
// 順位変動)のみを、mnews発の一次情報として「オリジナル」タブに出す。
//
// ORIGINAL_ARTICLES(数字で見る対戦カード=対戦前スタッツ比較)とはスキーマが
// 別物(こちらは対戦後の順位変動そのものが主題)のため、専用の型・配列として
// 分離する。ただしフィード表示への合流方式(isOriginal:trueでUnifiedFeedの
// 「オリジナル」タブに乗せる)はORIGINAL_ARTICLESと完全に共通化し、既存の
// ニュース区分アーキテクチャに素直に乗せる。
//
// 生成: scripts/generate-ranking-movement-content.ts が出力するコードを、
// 人間がレビューの上でこの配列に貼り付け、通常のgitコミット→デプロイで公開する
// (ORIGINAL_ARTICLESと同じ「自動処理でgitに書かない」思想)。
//
// レート数値(rawRating等)は一切保持しない。保持するのは「順位」のみ
// (外向き非公開方針。docs/ranking-internal-spec-v6.md「表示・ブランディング」参照)。
export interface RankingMovementEntry {
  fighterSlug: string;
  fighterName: string;
  division: string;
  rankBefore: number | null; // 前回未掲載(新規ランクイン)ならnull
  rankAfter: number;
  opponentName: string | null;
  result: "win" | "loss" | "draw" | "nc" | null;
  method: string | null;
}

export interface RankingMovementArticle {
  slug: string;
  title: string;
  eventSlug: string; // 大会ページ(/results/[slug])との相互リンク用
  publishedAt: string; // YYYY-MM-DD
  entries: RankingMovementEntry[];
}

export const RANKING_MOVEMENT_ARTICLES: RankingMovementArticle[] = [];

export function findRankingMovementArticle(slug: string): RankingMovementArticle | undefined {
  return RANKING_MOVEMENT_ARTICLES.find((a) => a.slug === slug);
}

// 大会slugに紐づくランキング変動記事を返す(events/[slug]・results/[slug]の
// 「関連記事」導線用。findArticlesForEvent(originalArticles.ts)と同じ発想)。
export function findRankingMovementArticlesForEvent(eventSlug: string): RankingMovementArticle[] {
  return RANKING_MOVEMENT_ARTICLES.filter((a) => a.eventSlug === eventSlug);
}

const DIVISION_TO_SLUG: Record<string, string> = {
  フライ級: "flyweight",
  バンタム級: "bantamweight",
  フェザー級: "featherweight",
  ライト級: "lightweight",
  ヘビー級: "heavyweight",
};

// UnifiedFeed用のFeedArticleへ変換(originalArticleToFeedArticleと同じ形)。
// urlは新規詳細ページを作らず、既に順位が反映済みの/rankings/[division]へ
// 直接送る(「初出のヘッドラインを自前発信の棚に明示的に置く」目的は
// フィード上のタイトル表示で満たされるため、遷移先は既存ページの再利用でよい
// と判断)。
export function rankingMovementArticleToFeedArticle(
  article: RankingMovementArticle
): import("./newsClassify").FeedArticle {
  const primaryDivision = article.entries[0]?.division;
  const divisionSlug = primaryDivision ? DIVISION_TO_SLUG[primaryDivision] : undefined;
  return {
    id: `ranking-movement-${article.slug}`,
    source: "other",
    title: article.title,
    origin: "Mニュース",
    url: divisionSlug ? `/rankings/${divisionSlug}` : "/rankings",
    publishedAt: new Date(`${article.publishedAt}T00:00:00+09:00`).toISOString(),
    kind: "media",
    newsType: "article",
    flash: false,
    isOriginal: true,
  };
}
