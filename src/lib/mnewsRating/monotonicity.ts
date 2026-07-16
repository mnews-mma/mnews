// P0(2026-07-16採用・N=2運用 → 2026-07-17 P0-Bでハード制約化): 直接対決の単調性オーバーレイ。
// 「RIZIN内でAがBに勝っているのに、順位ではAがBより下」という見た目の矛盾を、
// 距離制限なしで補正する(2026-07-17: 従来はmaxRankGap=2以内の隣接ケースのみ
// 補正していたが、距離制限そのものを撤廃しハード制約にした)。Elo自体・レート値には
// 一切触れず、最終的な順位配列(rankedSlugs)の並び替えのみを行う。
// 循環(A>B>C>A)が検出された組は補正をスキップする(全順序が定義できないため。
// 実例: 元谷友貴>神龍誠>伊藤裕樹>トニー・ララミー>元谷友貴の4者循環が
// フライ級の実データに存在する。ラミー>元谷という個別の勝敗は事実として
// 正しいが、この一戦だけを強制すると他の3辺のいずれかを必ず破ることになり
// 「循環はスキップする」という設計判断自体が正しい。2026-07-17のP0-A調査で
// 確認済み・test-mnews-rating.tsに再現テストを追加した)。
//
// P1(σディスカウント、constants.tsのSIGMA_DISCOUNT_COEFFICIENT_V7)との関係:
// σディスカウントは対戦数が少ない選手を一律に押し下げるため、「AがBに直接
// 勝っているのに対戦数差でAがBより下位になる」ケースを新たに作りうる。この
// オーバーレイはその後段バックストップとして機能する。

export interface H2HWin {
  winnerSlug: string;
  loserSlug: string;
  date: string; // 複数回対戦時の直近優先判定に使う(YYYY-MM-DD)
}

// engine.tsの薄いBout型(circular import回避のため必要フィールドのみで受ける)。
interface BoutLike {
  aNode: string;
  bNode: string;
  scoreA: number;
  date: string;
}

// 指定階級の資格保有選手同士(divisionSlugsに両者が含まれる対戦)の決着済み
// 対戦(引き分け/NC除く)をH2HWin[]化する。boutsはElo計算用の全対戦(階級横断)
// のため、両ノードが対象divisionのslug集合に含まれるものだけを抽出する。
// scripts/update-mnews-rating.ts(実運用)とdump-ranking-p1-comparison.ts
// (比較ダンプ)の両方から共有で使う(ロジックの重複・ドリフトを避けるため)。
export function extractH2HWinsForDivision(bouts: BoutLike[], divisionSlugs: Set<string>): H2HWin[] {
  const wins: H2HWin[] = [];
  for (const b of bouts) {
    if (!divisionSlugs.has(b.aNode) || !divisionSlugs.has(b.bNode)) continue;
    if (b.scoreA === 1) wins.push({ winnerSlug: b.aNode, loserSlug: b.bNode, date: b.date });
    else if (b.scoreA === 0) wins.push({ winnerSlug: b.bNode, loserSlug: b.aNode, date: b.date });
    // scoreA===0.5(引き分け)は方向性シグナルが無いためスキップ
  }
  return wins;
}

// 同一カードで複数回対戦しているペアは、直近の対戦結果(dateが最も新しいもの)を
// そのペアの正とする(2026-07-17 P0-B: 以前は勝敗が割れる=splitの場合、方向性
// シグナルが無いとして両方向とも除外していたが、「直近の対戦結果を優先」という
// 明確なルールに変更し、より多くのペアにH2H制約を適用できるようにした)。
function resolvePairDirections(h2hWins: H2HWin[]): Array<{ winner: string; loser: string }> {
  const pairKey = (x: string, y: string) => [x, y].sort().join("|");
  const latestByPair = new Map<string, H2HWin>();
  for (const win of h2hWins) {
    const key = pairKey(win.winnerSlug, win.loserSlug);
    const existing = latestByPair.get(key);
    if (!existing || win.date > existing.date) {
      latestByPair.set(key, win);
    }
  }
  return [...latestByPair.values()].map((w) => ({ winner: w.winnerSlug, loser: w.loserSlug }));
}

// 有向グラフ内の循環に関与する辺を検出する(DFSベースの単純な実装。
// 階級あたり数十人規模のグラフ向けで、全探索の効率最適化はしていない)。
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

// rankedSlugs(0-indexed、先頭=1位、σディスカウント後の生レート降順)を、
// 直接対決の制約を全て満たす順序に並び替える。「H2H制約を満たす最小の順位
// 入替」= 各ステップで「まだ配置していない選手のうち、H2Hの勝者側の制約を
// 全て満たしている(＝自分に直接負けている相手がまだ未配置、ということが無い)
// 選手の中で、元のレート順で最も上位の選手」を選んで配置していく(制約付き
// トポロジカルソート、Kahn法+元順序によるタイブレーク)。この方式は:
// - 全ての(非循環の)H2H制約を厳密に満たす(距離制限なし=ハード制約)。
// - 制約を満たす順序の中で、レート順からの乖離が最小になる(貪欲法だが、
//   「まだ動かせる中で一番レートが高い人を先に確定する」という単純な規則が
//   ソート安定性も保つ: H2H制約が一切無いグループは元のレート順そのままになる)。
// 循環に関与する辺は制約から除外し(現状維持、findCyclicEdges参照)、その
// ペアの相対順序はレートベースの元順序のまま変化しない。
export function applyHeadToHeadMonotonicity(rankedSlugs: string[], h2hWins: H2HWin[]): string[] {
  const pairs = resolvePairDirections(h2hWins);
  const cyclicEdges = findCyclicEdges(pairs);
  const constraints = pairs.filter(({ winner, loser }) => !cyclicEdges.has(`${winner}>${loser}`));

  const rankedSet = new Set(rankedSlugs);
  // loser -> このloserより先に配置されなければならない選手の集合(直接の前提のみ)。
  const predecessors = new Map<string, Set<string>>();
  for (const slug of rankedSlugs) predecessors.set(slug, new Set());
  for (const { winner, loser } of constraints) {
    if (!rankedSet.has(winner) || !rankedSet.has(loser)) continue; // ランキング対象外の選手が絡む組は無視
    predecessors.get(loser)!.add(winner);
  }

  const originalIndex = new Map(rankedSlugs.map((slug, i) => [slug, i]));
  const remaining = new Set(rankedSlugs);
  const result: string[] = [];

  while (remaining.size > 0) {
    let best: string | null = null;
    let bestIdx = Infinity;
    for (const slug of remaining) {
      let ready = true;
      for (const pred of predecessors.get(slug)!) {
        if (remaining.has(pred)) {
          ready = false;
          break;
        }
      }
      if (!ready) continue;
      const idx = originalIndex.get(slug)!;
      if (idx < bestIdx) {
        bestIdx = idx;
        best = slug;
      }
    }
    if (best === null) {
      // 循環は事前に除去済みのため理論上到達しないが、安全弁として残りを
      // 元の順序のまま追加して打ち切る(無限ループ防止)。
      for (const slug of rankedSlugs) {
        if (remaining.has(slug)) result.push(slug);
      }
      break;
    }
    result.push(best);
    remaining.delete(best);
  }

  return result;
}

export interface H2HViolation {
  winner: string;
  loser: string;
  winnerRank: number; // 1-indexed
  loserRank: number;
}

// 最終順位配列(applyHeadToHeadMonotonicity適用後を想定)に対し、全H2H制約
// (勝者の順位 <= 敗者の順位)が満たされているかを検査する(回帰テスト・
// update-mnews-rating.tsの自己検証・CI用に常設)。循環に関与する組は検査対象
// 外にする(仕様どおりスキップされ、補正されないため=想定内)。ランキング
// 対象外の選手(掲載資格なし・王者オーバーレイで別掲載等)が絡む組も対象外。
// 違反(勝者が敗者より下位のまま)が1件でもあれば、そのペアを返す(0件なら
// 空配列=常にこうあるべき)。
export function checkH2HInvariant(rankedSlugs: string[], h2hWins: H2HWin[]): H2HViolation[] {
  const pairs = resolvePairDirections(h2hWins);
  const cyclicEdges = findCyclicEdges(pairs);
  const rankOf = new Map(rankedSlugs.map((slug, i) => [slug, i]));
  const violations: H2HViolation[] = [];
  for (const { winner, loser } of pairs) {
    if (cyclicEdges.has(`${winner}>${loser}`)) continue;
    const winnerIdx = rankOf.get(winner);
    const loserIdx = rankOf.get(loser);
    if (winnerIdx === undefined || loserIdx === undefined) continue;
    if (winnerIdx > loserIdx) {
      violations.push({ winner, loser, winnerRank: winnerIdx + 1, loserRank: loserIdx + 1 });
    }
  }
  return violations;
}
