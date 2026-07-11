// 「数字で見る対戦カード」記事(オリジナル・editorial)のデータ定義。
// タスク③の方針: 管理画面の記事生成ツール(タブ③)が出力する「配列要素1件分の
// 完成TSXコード」を、人間がこのファイルにコピー&ペーストして通常のgitコミットで
// 公開する(DraftsToolの既存タブと同じ「自動処理でgitに書かない」思想)。
//
// 【フィールドごとのライブ/スナップショット方針】
// - 戦績・フィニッシュ率・勝ち方内訳・直近5戦は"ライブ"(表示時にfighterRecords.jsonから
//   都度算出。記事の数字が古くならないようにするため、この配列には焼き込まない)
// - 共通対戦相手・注目点は"スナップショット"(生成時点の閾値判定・文面をここに固定する。
//   条件付きセクションの表示可否は生成時に確定させ、空セクションのコードを出力しない
//   運用のため、後から再計算すると表示条件と本文がズレる可能性があるため)

export interface OriginalArticleFighterRef {
  slug: string; // fighters.ts の slug。表示名・現在戦績はfighterRecords.jsonから都度解決する
  nameJa: string; // 生成時点の表示名(フォールバック用。fighters.ts側の表記揺れ・削除に備える)
}

// 共通対戦相手1件(スナップショット)。resultA/Bは生成時点の対戦結果。
// 同一相手と複数回対戦している場合、対戦ごとに行を分けて複数件を返す
// (1行=1対戦を必ず保つ)。片方しか対戦していない回はnull(空欄表示)。
export interface CommonOpponent {
  name: string;
  resultA: "win" | "loss" | "draw" | "nc" | null;
  resultB: "win" | "loss" | "draw" | "nc" | null;
}

export interface OriginalArticleFight {
  fighterA: OriginalArticleFighterRef;
  fighterB: OriginalArticleFighterRef;
  weightClass?: string; // 大会データ(events.ts等)からの転記。捏造ではなく既存データの複製
  isTitleMatch?: boolean;
  // 共通対戦相手セクション(スナップショット)。0件(未検出)なら配列自体を省略し、
  // 表示側でセクションごと非表示にする。
  commonOpponents?: CommonOpponent[];
  // 注目点セクション(スナップショット)。閾値未達で0件なら配列自体を省略。
  notablePoints?: string[];
}

export interface OriginalArticle {
  slug: string;
  title: string;
  eventSlug: string; // 大会ページ(/events/[slug] または /results/[slug])との相互リンク用
  publishedAt: string; // YYYY-MM-DD
  fights: OriginalArticleFight[]; // 選択した試合ごとに1セクション(通常1件、複数可)
}

export const ORIGINAL_ARTICLES: OriginalArticle[] = [
  {
    slug: "rizin-landmark-15-sabatello-kashimura",
    title: "数字で見る対戦カード: RIZIN LANDMARK 15 ダニー・サバテロ vs 鹿志村仁之介",
    eventSlug: "rizin-landmark-15",
    publishedAt: "2026-07-10",
    fights: [
      {
        fighterA: { slug: "sabatello-danny", nameJa: "ダニー・サバテロ" },
        fighterB: { slug: "kashimura-ninnosuke", nameJa: "鹿志村仁之介" },
        weightClass: "バンタム級（61.0kg）",
        isTitleMatch: true,
        // 共通対戦相手: 後藤丈治(サバテロは2026-04-12に判定勝ち、鹿志村は
        // 2025-06-14に判定負け)。data/fighterRecords.json の両者history照合で検出。
        commonOpponents: [{ name: "後藤丈治", resultA: "win", resultB: "loss" }],
        // 注目点(生成時点のfighterRecords.jsonより。computeNotablePoints()の実出力と
        // 一致させている: サバテロ 18勝(KO4/一本5/判定9)、鹿志村 12勝(KO1/一本10/判定1))。
        notablePoints: [
          "ダニー・サバテロは判定決着が50%を占める",
          "鹿志村仁之介のフィニッシュ率は92%と非常に高い",
          "鹿志村仁之介は一本勝ちの比率が83%を占め、サブミッション色が強い",
          "両者のフィニッシュ率には42ポイントの差がある(ダニー・サバテロ50% / 鹿志村仁之介92%)",
        ],
      },
    ],
  },
];

export function getOriginalArticle(slug: string): OriginalArticle | undefined {
  return ORIGINAL_ARTICLES.find((a) => a.slug === slug);
}

// 大会ページ(/events/[slug]・/results/[slug])から該当記事を逆引きする
// (「記事が存在する大会のみ」リンクを出すため)。
export function findArticlesForEvent(eventSlug: string): OriginalArticle[] {
  return ORIGINAL_ARTICLES.filter((a) => a.eventSlug === eventSlug);
}

// トップフィードに混在させるための FeedArticle 変換。url は外部リンクではなく
// /articles/[slug] への内部リンクになる点がRSS由来記事と異なる
// (UnifiedFeed側でisOriginalを見て遷移方式を分岐する)。
export function originalArticleToFeedArticle(
  article: OriginalArticle
): import("./newsClassify").FeedArticle {
  return {
    id: `original-${article.slug}`,
    source: "other", // 編集部オリジナル。既存SourceKeyに専用値が無いためotherを流用(表示はisOriginalバッジで区別)
    title: article.title,
    origin: "Mニュース",
    url: `/articles/${article.slug}`,
    publishedAt: new Date(`${article.publishedAt}T00:00:00+09:00`).toISOString(),
    kind: "media",
    newsType: "article",
    flash: false,
    isOriginal: true,
  };
}
