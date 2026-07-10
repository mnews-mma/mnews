// 「数字で見る対戦カード」記事生成(管理画面タブ③専用)の純粋関数群。
// ここで確定した値(共通対戦相手・注目点)は originalArticles.ts に
// スナップショットとして焼き込まれる(生成時点で条件付きセクションの
// 表示可否を確定させ、空セクションのコードを出力しないため)。
import type { FighterRecordEntry } from "./fighterRecordsCache";
import { computeFighterStripStats, computeWinMethodBreakdown } from "./fighterStrip";
import type { CommonOpponent, OriginalArticle, OriginalArticleFight } from "./originalArticles";

const norm = (s: string) => s.replace(/[\s　・☆]/g, "");

// 両者のhistoryを対戦相手名(正規化)で突合し、共通対戦相手を検出する。
// 0件なら空配列(呼び出し側でセクション自体を省略する)。
export function computeCommonOpponents(
  entryA: FighterRecordEntry,
  entryB: FighterRecordEntry
): CommonOpponent[] {
  const bByOpponent = new Map<string, FighterRecordEntry["history"][number]>();
  for (const h of entryB.history) {
    const key = norm(h.opponent);
    if (!bByOpponent.has(key)) bByOpponent.set(key, h);
  }
  const results: CommonOpponent[] = [];
  const seen = new Set<string>();
  for (const h of entryA.history) {
    const key = norm(h.opponent);
    if (seen.has(key)) continue;
    const matchB = bByOpponent.get(key);
    if (matchB) {
      results.push({ name: h.opponent, resultA: h.result, resultB: matchB.result });
      seen.add(key);
    }
  }
  return results;
}

// 注目点の閾値(コード内定数)。該当ゼロならそのルールの文言は出力しない。
const FINISH_RATE_HIGH_THRESHOLD = 70; // % 以上でフィニッシュ率が高いと判定
const DECISION_RATE_HIGH_THRESHOLD = 50; // % 以上で判定決着が多いと判定
const SUB_RATE_HIGH_THRESHOLD = 60; // % 以上で一本勝ち比率が高いと判定
const FINISH_RATE_GAP_THRESHOLD = 30; // ポイント差以上で「対照的」と判定

export function computeNotablePoints(
  nameA: string,
  entryA: FighterRecordEntry,
  nameB: string,
  entryB: FighterRecordEntry
): string[] {
  const points: string[] = [];
  const statsA = computeFighterStripStats(entryA);
  const statsB = computeFighterStripStats(entryB);
  const breakdownA = computeWinMethodBreakdown(entryA);
  const breakdownB = computeWinMethodBreakdown(entryB);

  for (const [name, stats, breakdown] of [
    [nameA, statsA, breakdownA],
    [nameB, statsB, breakdownB],
  ] as const) {
    if (stats.finishRate !== null && stats.finishRate >= FINISH_RATE_HIGH_THRESHOLD) {
      points.push(`${name}のフィニッシュ率は${stats.finishRate}%と非常に高い`);
    }
    if (breakdown && breakdown.decisionPct >= DECISION_RATE_HIGH_THRESHOLD) {
      points.push(`${name}は判定決着が${breakdown.decisionPct}%を占める`);
    }
    if (breakdown && breakdown.subPct >= SUB_RATE_HIGH_THRESHOLD) {
      points.push(`${name}は一本勝ちの比率が${breakdown.subPct}%を占め、サブミッション色が強い`);
    }
  }

  if (statsA.finishRate !== null && statsB.finishRate !== null) {
    const gap = Math.abs(statsA.finishRate - statsB.finishRate);
    if (gap >= FINISH_RATE_GAP_THRESHOLD) {
      points.push(
        `両者のフィニッシュ率には${gap}ポイントの差がある(${nameA}${statsA.finishRate}% / ${nameB}${statsB.finishRate}%)`
      );
    }
  }

  return points;
}

// originalArticles.ts に貼り付け可能な「配列要素1件分」のコード文字列を生成する。
// JSON.stringifyの出力はTSのオブジェクトリテラルとしてもそのまま有効な構文なので、
// 独自シリアライザを持たずこれをそのまま流用する。
export function generateArticleCode(article: OriginalArticle): string {
  const body = JSON.stringify(article, null, 2)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `${body},\n// ↑ src/lib/originalArticles.ts の ORIGINAL_ARTICLES 配列にこの要素を追記してコミットしてください`;
}

// X告知テキスト(記事URL+ハッシュタグ)。
export function generateArticleAnnounceText(article: OriginalArticle, siteUrl: string): string {
  return `${article.title}\n\n${siteUrl}/articles/${article.slug}\n\n#MMA #Mニュース`;
}

export function buildFightSectionDraft(
  fighterA: { slug: string; nameJa: string },
  entryA: FighterRecordEntry,
  fighterB: { slug: string; nameJa: string },
  entryB: FighterRecordEntry,
  weightClass?: string,
  isTitleMatch?: boolean
): OriginalArticleFight {
  const commonOpponents = computeCommonOpponents(entryA, entryB);
  const notablePoints = computeNotablePoints(fighterA.nameJa, entryA, fighterB.nameJa, entryB);
  return {
    fighterA,
    fighterB,
    weightClass,
    isTitleMatch,
    ...(commonOpponents.length > 0 ? { commonOpponents } : {}),
    ...(notablePoints.length > 0 ? { notablePoints } : {}),
  };
}
