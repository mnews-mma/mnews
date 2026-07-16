// P0(2026-07-16採用・N=2運用 → 2026-07-17 P0-Bでハード制約化 → 同日(b)で
// 循環内リオーダー追加): 直接対決の単調性オーバーレイ。「RIZIN内でAがBに
// 勝っているのに、順位ではAがBより下」という見た目の矛盾を、距離制限なしで
// 補正する。Elo自体・レート値には一切触れず、最終的な順位配列(rankedSlugs)の
// 並び替えのみを行う。
//
// 循環(A>B>C>A)の扱い(2026-07-17改訂・(b)案): 循環に関与する全辺を同時に
// 満たす線形順序は数学的に存在しないため、以前は循環自体を検出したら全辺を
// 丸ごと補正対象から除外していた(P0-A実例: 元谷友貴>神龍誠>伊藤裕樹>
// トニー・ララミー>元谷友貴の4者循環で、事実として正しいはずのラミー>元谷が
// 補正されなかった)。(b)案では循環の検出はそのまま維持しつつ、循環内の
// メンバーの並び順だけを「直近対戦を優先」で決める: 循環に関与する辺を試合日
// 降順(新しい順)にソートし、既に採用済みの辺(循環外の辺+これまでに採用した
// 循環内の辺)と矛盾しない限り採用する。矛盾=採用すると循環に戻ってしまう
// (loserからwinnerへの経路が既にできている)場合はその辺だけをスキップする。
// 新しい辺から順に処理するため、諦める辺は最も古いものに収束する(4者循環
// なら3辺を満たし最古の1辺だけを諦める形になる)。上記の実例では最新の
// ラミー>元谷(2026-06-06)が必ず満たされ、最古の伊藤裕樹>ラミー(2025-03-30)
// が諦められる(resolveCyclicEdgesByRecency参照)。
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

export interface ResolvedPair {
  winner: string;
  loser: string;
  date: string; // このペアの正とした対戦の日付(循環内リオーダーの新しい順ソートに使う)
}

// 同一カードで複数回対戦しているペアは、直近の対戦結果(dateが最も新しいもの)を
// そのペアの正とする(2026-07-17 P0-B: 以前は勝敗が割れる=splitの場合、方向性
// シグナルが無いとして両方向とも除外していたが、「直近の対戦結果を優先」という
// 明確なルールに変更し、より多くのペアにH2H制約を適用できるようにした)。
function resolvePairDirections(h2hWins: H2HWin[]): ResolvedPair[] {
  const pairKey = (x: string, y: string) => [x, y].sort().join("|");
  const latestByPair = new Map<string, H2HWin>();
  for (const win of h2hWins) {
    const key = pairKey(win.winnerSlug, win.loserSlug);
    const existing = latestByPair.get(key);
    if (!existing || win.date > existing.date) {
      latestByPair.set(key, win);
    }
  }
  return [...latestByPair.values()].map((w) => ({ winner: w.winnerSlug, loser: w.loserSlug, date: w.date }));
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

// 循環内メンバーの並び順を「直近対戦を優先」で決める((b)案、2026-07-17)。
// baseAcceptedは循環外の辺(既にDAGであることが保証済み)を初期状態として
// 受け取り、循環に関与する辺を試合日降順(新しい順)に1本ずつ試す: 追加すると
// (baseAccepted+これまでに採用した循環内の辺のグラフ上で)loserからwinnerへ
// 既に経路がある=循環に戻ってしまう場合はその辺をスキップし、無ければ採用する。
// 新しい辺から順に処理するため、スキップされる(=諦められる)辺は各循環の中で
// 最も古いものに収束する。戻り値は「採用された循環内の辺」のみ(baseAcceptedは
// 含まない、呼び出し側で結合する)。
function resolveCyclicEdgesByRecency(cyclicPairs: ResolvedPair[], baseAccepted: Array<{ winner: string; loser: string }>): ResolvedPair[] {
  const adjacency = new Map<string, string[]>();
  const addEdge = (winner: string, loser: string) => {
    if (!adjacency.has(winner)) adjacency.set(winner, []);
    adjacency.get(winner)!.push(loser);
  };
  for (const { winner, loser } of baseAccepted) addEdge(winner, loser);

  function hasPath(from: string, to: string): boolean {
    if (from === to) return true;
    const visited = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node === to) return true;
      if (visited.has(node)) continue;
      visited.add(node);
      for (const next of adjacency.get(node) ?? []) stack.push(next);
    }
    return false;
  }

  const sortedNewestFirst = [...cyclicPairs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const accepted: ResolvedPair[] = [];
  for (const pair of sortedNewestFirst) {
    if (hasPath(pair.loser, pair.winner)) continue; // 採用すると循環に戻るためスキップ(最古の辺が対象になりやすい)
    addEdge(pair.winner, pair.loser);
    accepted.push(pair);
  }
  return accepted;
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
// 循環に関与する辺は、直近対戦を優先する形で一部だけを制約として採用する
// (resolveCyclicEdgesByRecency参照。最も古い辺だけが諦められる)。
// maxRankGap(2026-07-16・v9改訂で追加): 指定時のみ、非循環の直接対決を
// 「補正前の順位差がこの値以内」のケースに限定する(弱い整合。距離無制限
// ハード制約による広範な入れ替えを避けるため)。順位差はrankedSlugsの元の
// 並び(σディスカウント後・補正前)で測る。未指定(デフォルト)は従来どおり
// 距離無制限(v8互換)。循環内の辺(resolveCyclicEdgesByRecency)はこの
// フィルタの対象外(循環は元々「直近優先」で解決するため対象自体が限定的)。
export function applyHeadToHeadMonotonicity(rankedSlugs: string[], h2hWins: H2HWin[], maxRankGap?: number): string[] {
  const pairs = resolvePairDirections(h2hWins);
  const cyclicEdgeKeys = findCyclicEdges(pairs);
  let nonCyclicPairs = pairs.filter(({ winner, loser }) => !cyclicEdgeKeys.has(`${winner}>${loser}`));
  const cyclicPairs = pairs.filter(({ winner, loser }) => cyclicEdgeKeys.has(`${winner}>${loser}`));

  if (maxRankGap !== undefined) {
    const originalIndexForGap = new Map(rankedSlugs.map((slug, i) => [slug, i]));
    nonCyclicPairs = nonCyclicPairs.filter(({ winner, loser }) => {
      const winnerIdx = originalIndexForGap.get(winner);
      const loserIdx = originalIndexForGap.get(loser);
      if (winnerIdx === undefined || loserIdx === undefined) return true; // ランキング対象外選手は後段でどのみち無視される
      return Math.abs(winnerIdx - loserIdx) <= maxRankGap;
    });
  }

  const resolvedCyclicPairs = resolveCyclicEdgesByRecency(cyclicPairs, nonCyclicPairs);
  const constraints = [...nonCyclicPairs, ...resolvedCyclicPairs];

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
// maxRankGap指定時(v9・弱い整合)は、構築時と同じ基準の順位差(前段の
// preCorrectionOrder。省略時はrankedSlugsで代用)でこの差を超えて離れている
// 組も対象外にする(そもそも制約として適用していないため=想定内)。
// 【重要】gapの判定基準は必ず構築時(applyHeadToHeadMonotonicityに渡した
// rankedSlugs)と同じ順序を使うこと。最終順位(post-correction)でgapを測ると、
// 他ペアの補正で偶然近づいた/離れた組を誤って判定してしまう
// (rankingsFile.tsのbuildDivisionRankings onPreCorrectionOrderフック参照)。
// applyHeadToHeadMonotonicityに渡すmaxRankGapと必ず同じ値を渡すこと。
// 違反(勝者が敗者より下位のまま)が1件でもあれば、そのペアを返す(0件なら
// 空配列=常にこうあるべき)。
export function checkH2HInvariant(
  rankedSlugs: string[],
  h2hWins: H2HWin[],
  maxRankGap?: number,
  preCorrectionOrder?: string[]
): H2HViolation[] {
  const pairs = resolvePairDirections(h2hWins);
  const cyclicEdges = findCyclicEdges(pairs);
  const rankOf = new Map(rankedSlugs.map((slug, i) => [slug, i]));
  const gapRankOf = new Map((preCorrectionOrder ?? rankedSlugs).map((slug, i) => [slug, i]));
  const violations: H2HViolation[] = [];
  for (const { winner, loser } of pairs) {
    if (cyclicEdges.has(`${winner}>${loser}`)) continue;
    const winnerIdx = rankOf.get(winner);
    const loserIdx = rankOf.get(loser);
    if (winnerIdx === undefined || loserIdx === undefined) continue;
    if (maxRankGap !== undefined) {
      const gapWinnerIdx = gapRankOf.get(winner);
      const gapLoserIdx = gapRankOf.get(loser);
      if (gapWinnerIdx !== undefined && gapLoserIdx !== undefined && Math.abs(gapWinnerIdx - gapLoserIdx) > maxRankGap) continue;
    }
    if (winnerIdx > loserIdx) {
      violations.push({ winner, loser, winnerRank: winnerIdx + 1, loserRank: loserIdx + 1 });
    }
  }
  return violations;
}

// 非対称ガード(2026-07-17・(b)案の回帰防止用): 「直近{recentWindowDays}日
// 以内の直接対決で勝った側が負けた側より下位のまま」というケースをゼロに
// する。checkH2HInvariantと違い、循環に関与する組はmaxRankGapの有無に関係
// なく除外しない(=循環内リオーダーの設計上、諦められる辺は必ず最も古い
// ものになるはずなので、直近の対戦が破れることがあってはならない、という
// 非対称性を明示的に検査する)。非循環の組はmaxRankGap指定時(v9・弱い整合)
// のみ、構築時と同じ基準の順位差(preCorrectionOrder。checkH2HInvariantと
// 同じ理由で最終順位ではなく構築時の順位を使う)でこの差を超えて離れていれば
// 対象外にする(そもそも制約として適用していないため=想定内)。古い辺が
// 破れる(=このチェックの対象外の期間で違反が残る)のは許容する。
export function checkRecentH2HInvariant(
  rankedSlugs: string[],
  h2hWins: H2HWin[],
  asOf: Date,
  recentWindowDays = 182, // 約6ヶ月(DECAY_PERIOD_DAYSと同じ定義に揃える)
  maxRankGap?: number,
  preCorrectionOrder?: string[]
): H2HViolation[] {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - recentWindowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const pairs = resolvePairDirections(h2hWins);
  const cyclicEdges = findCyclicEdges(pairs);
  const rankOf = new Map(rankedSlugs.map((slug, i) => [slug, i]));
  const gapRankOf = new Map((preCorrectionOrder ?? rankedSlugs).map((slug, i) => [slug, i]));
  const violations: H2HViolation[] = [];
  for (const { winner, loser, date } of pairs) {
    if (date < cutoffStr) continue; // 直近半年より古い対戦は対象外(循環で諦めることを許容する)
    const winnerIdx = rankOf.get(winner);
    const loserIdx = rankOf.get(loser);
    if (winnerIdx === undefined || loserIdx === undefined) continue;
    const isCyclic = cyclicEdges.has(`${winner}>${loser}`);
    if (!isCyclic && maxRankGap !== undefined) {
      const gapWinnerIdx = gapRankOf.get(winner);
      const gapLoserIdx = gapRankOf.get(loser);
      if (gapWinnerIdx !== undefined && gapLoserIdx !== undefined && Math.abs(gapWinnerIdx - gapLoserIdx) > maxRankGap) continue;
    }
    if (winnerIdx > loserIdx) {
      violations.push({ winner, loser, winnerRank: winnerIdx + 1, loserRank: loserIdx + 1 });
    }
  }
  return violations;
}
