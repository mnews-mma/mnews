// 「数字で見る対戦カード」記事生成(管理画面タブ③専用)の純粋関数群。
// ここで確定した値(共通対戦相手・注目点)は originalArticles.ts に
// スナップショットとして焼き込まれる(生成時点で条件付きセクションの
// 表示可否を確定させ、空セクションのコードを出力しないため)。
import type { FighterRecordEntry } from "./fighterRecordsCache";
import { computeFighterStripStats, computeWinMethodBreakdown } from "./fighterStrip";
import type { CommonOpponent, OriginalArticle, OriginalArticleFight } from "./originalArticles";

const norm = (s: string) => s.replace(/[\s　・☆]/g, "");

// 対戦相手名(正規化)ごとにhistoryをグループ化し、各グループを日付昇順(古い→新しい)
// に揃える。同一相手との複数対戦を「1戦目」「2戦目」…の順に対応付けるための土台。
function groupByOpponent(
  history: FighterRecordEntry["history"]
): Map<string, FighterRecordEntry["history"]> {
  const map = new Map<string, FighterRecordEntry["history"]>();
  for (const h of history) {
    const key = norm(h.opponent);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(h);
  }
  for (const fights of map.values()) {
    fights.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return map;
}

// 両者のhistoryを対戦相手名(正規化)で突合し、共通対戦相手を検出する。
// 同一相手と複数回対戦している場合は対戦ごとに行を分ける(1行=1対戦を維持)。
// 左右で対戦回数が異なる場合、時系列順(1戦目・2戦目…)で行を揃え、片方にしか
// 対戦がない回はもう一方をnull(呼び出し側で空欄表示)にする。
// 0件なら空配列(呼び出し側でセクション自体を省略する)。
export function computeCommonOpponents(
  entryA: FighterRecordEntry,
  entryB: FighterRecordEntry
): CommonOpponent[] {
  const aByOpponent = groupByOpponent(entryA.history);
  const bByOpponent = groupByOpponent(entryB.history);

  const results: CommonOpponent[] = [];
  const seen = new Set<string>();
  for (const h of entryA.history) {
    const key = norm(h.opponent);
    if (seen.has(key) || !bByOpponent.has(key)) continue;
    seen.add(key);
    const aFights = aByOpponent.get(key)!;
    const bFights = bByOpponent.get(key)!;
    const rows = Math.max(aFights.length, bFights.length);
    for (let i = 0; i < rows; i++) {
      results.push({
        name: h.opponent,
        resultA: aFights[i]?.result ?? null,
        resultB: bFights[i]?.result ?? null,
      });
    }
  }
  return results;
}

export interface HeadToHeadMatch {
  date: string;
  event: string;
  method: string;
  resultA: "win" | "loss" | "draw" | "nc";
}

// 2選手の直接対決履歴(entryA視点)を新しい順で返す。resultBはresultAの逆
// (win⇔loss、draw/ncはそのまま)として呼び出し側で導出する想定。
// 共通対戦相手(=第三者との対戦の一致)とは概念が別物のため、別関数として分離する。
export function computeHeadToHead(
  entryA: FighterRecordEntry,
  nameB: string
): HeadToHeadMatch[] {
  const keyB = norm(nameB);
  return entryA.history
    .filter((h) => norm(h.opponent) === keyB)
    .map((h) => ({ date: h.date, event: h.event, method: h.method, resultA: h.result }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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
