// P2(2026-07-16・未採用・デフォルトOFF): 直接対決の単調性オーバーレイ。
// 「RIZIN内でAがBに勝っているのに、順位ではAがBより下」という見た目の矛盾を、
// 順位差がmaxRankGap以内の隣接ケースに限り後段で補正する。Elo自体・レート値には
// 一切触れず、最終的な順位配列(rankedSlugs)の並び替えのみを行う。
// 循環(A>B>C>A)が検出された組は補正をスキップする(全順序が定義できないため)。
//
// 【重要・P1(小サンプル補正)との関係】 shrinkageは対戦数が少ない選手を
// 母集団平均へ引き寄せるため、「AがBに直接勝っているのに対戦数差でAがBより
// 下位になる」ケースを新たに作りうる。両方を同時にONにする場合、この
// オーバーレイが常にshrinkage後の順位を上書きする形になり、shrinkageの意図
// (対戦数が少ない選手を評価しすぎない)と直接対決の単調性が競合する。
// 現時点はどちらも未採用のため、採用判断時に方向性を揃える必要がある。

export interface H2HWin {
  winnerSlug: string;
  loserSlug: string;
}

export interface MonotonicityParams {
  maxRankGap: number; // N。この順位差以内の隣接ケースのみ補正対象にする
}

// 勝敗が矛盾しない(AがBに勝ち、BがAに勝った記録が無い)組だけを対象にする。
// 同一カードで複数回対戦し勝敗が割れている(1勝1敗等)場合は「どちらが上か」の
// 単一方向のシグナルが無いため、両方向とも除外する。
function buildUnambiguousWinPairs(h2hWins: H2HWin[]): Array<{ winner: string; loser: string }> {
  const winners = new Map<string, Set<string>>(); // key: `${a}|${b}` (aがbに勝った) の存在チェック用
  const pairKey = (x: string, y: string) => [x, y].sort().join("|");
  const resultsByPair = new Map<string, Set<string>>(); // pairKey -> 勝者の集合(1人だけなら一方向、2人ならsplit)

  for (const { winnerSlug, loserSlug } of h2hWins) {
    const key = pairKey(winnerSlug, loserSlug);
    if (!resultsByPair.has(key)) resultsByPair.set(key, new Set());
    resultsByPair.get(key)!.add(winnerSlug);
  }

  const pairs: Array<{ winner: string; loser: string }> = [];
  for (const { winnerSlug, loserSlug } of h2hWins) {
    const key = pairKey(winnerSlug, loserSlug);
    const winnersOfPair = resultsByPair.get(key)!;
    if (winnersOfPair.size !== 1) continue; // split(1勝1敗等)は単一方向のシグナルが無いため除外
    pairs.push({ winner: winnerSlug, loser: loserSlug });
  }
  // 重複排除(同一カードで複数回対戦し全勝の場合、同じ組が複数回入るのを1つに畳む)
  const seen = new Set<string>();
  return pairs.filter(({ winner, loser }) => {
    const key = `${winner}>${loser}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 有向グラフ内の循環に関与する辺を検出する(DFSベースの単純な実装。
// N=2運用を想定した小規模グラフ向けで、全探索の効率最適化はしていない)。
function findCyclicEdges(pairs: Array<{ winner: string; loser: string }>): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const { winner, loser } of pairs) {
    if (!adjacency.has(winner)) adjacency.set(winner, []);
    adjacency.get(winner)!.push(loser);
  }

  const cyclicEdges = new Set<string>();
  const nodes = new Set<string>();
  for (const { winner, loser } of pairs) {
    nodes.add(winner);
    nodes.add(loser);
  }

  // 各ノードを起点にDFSし、訪問中のパス(onPath)に戻る辺を見つけたら
  // そのパス上の全辺を循環関与としてマークする。
  for (const start of nodes) {
    const path: string[] = [];
    const onPath = new Set<string>();
    const visited = new Set<string>();

    function dfs(node: string) {
      path.push(node);
      onPath.add(node);
      for (const next of adjacency.get(node) ?? []) {
        if (onPath.has(next)) {
          // 循環発見: path内でnextが最初に現れた位置から現在までの辺を全てマーク
          const idx = path.indexOf(next);
          for (let i = idx; i < path.length - 1; i++) {
            cyclicEdges.add(`${path[i]}>${path[i + 1]}`);
          }
          cyclicEdges.add(`${path[path.length - 1]}>${next}`);
        } else if (!visited.has(next)) {
          dfs(next);
        }
      }
      path.pop();
      onPath.delete(node);
      visited.add(node);
    }
    dfs(start);
  }
  return cyclicEdges;
}

// rankedSlugs(0-indexed、先頭=1位)を、直接対決の単調性に沿って補正する。
// 補正は「順位差の小さいものから順」に1件ずつ、勝者(winner)を敗者(loser)の
// 直上へ移動する形で適用する(他の選手の相対順序はそのまま)。
// 循環に関与する組は補正対象から除外する(スキップ)。
export function applyHeadToHeadMonotonicity(
  rankedSlugs: string[],
  h2hWins: H2HWin[],
  params: MonotonicityParams
): string[] {
  const unambiguousPairs = buildUnambiguousWinPairs(h2hWins);
  const cyclicEdges = findCyclicEdges(unambiguousPairs);
  const acyclicPairs = unambiguousPairs.filter(({ winner, loser }) => !cyclicEdges.has(`${winner}>${loser}`));

  let order = [...rankedSlugs];

  // 順位差が小さい違反から解消する(大きな入れ替えを先にやると後続の判定が
  // 崩れやすいため)。violationsは適用のたびに順位が変わるので、1件ずつ
  // 再計算しながら処理する。
  let remaining = acyclicPairs;
  // 安全弁: 理論上は毎回最低1件消化されるはずだが、想定外の入力でも
  // 無限ループにならないよう試行回数の上限を設ける。
  const maxIterations = acyclicPairs.length + 1;
  for (let iter = 0; iter < maxIterations && remaining.length > 0; iter++) {
    const violations = remaining
      .map(({ winner, loser }) => {
        const winnerIdx = order.indexOf(winner);
        const loserIdx = order.indexOf(loser);
        if (winnerIdx === -1 || loserIdx === -1) return null; // ランキング対象外の選手が絡む組は無視
        if (winnerIdx <= loserIdx) return null; // 既に矛盾していない
        const gap = winnerIdx - loserIdx;
        if (gap > params.maxRankGap) return null; // 対象範囲外
        return { winner, loser, gap };
      })
      .filter((v): v is { winner: string; loser: string; gap: number } => v !== null);

    if (violations.length === 0) break;
    violations.sort((a, b) => a.gap - b.gap);
    const { winner, loser } = violations[0];

    const winnerIdx = order.indexOf(winner);
    const loserIdx = order.indexOf(loser);
    order.splice(winnerIdx, 1);
    const newLoserIdx = order.indexOf(loser);
    order.splice(newLoserIdx, 0, winner);

    remaining = remaining.filter((p) => !(p.winner === winner && p.loser === loser));
  }

  return order;
}
