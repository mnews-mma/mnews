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
export function extractH2HWinsForDivision(bouts: BoutLike[], divisionSlugs: Set<string>, recencyCutoff = ""): H2HWin[] {
  const wins: H2HWin[] = [];
  for (const b of bouts) {
    if (!divisionSlugs.has(b.aNode) || !divisionSlugs.has(b.bNode)) continue;
    if (recencyCutoff && b.date < recencyCutoff) continue; // recencyCutoffより古い直接対決は単調性の対象外
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
// maxRankGap(2026-07-16採用・v9改訂): 指定時のみ、直接対決を「補正前の
// 順位差がこの値以内」のケースに限定する(弱い整合。距離無制限ハード制約
// による広範な入れ替えを避けるため)。順位差はrankedSlugsの元の並び
// (σディスカウント後・補正前)で測る。未指定(デフォルト)は従来どおり
// 距離無制限(v8互換)。
//
// 【重要・2026-07-16実装】gapフィルタは循環検出より前、全ペアに対して行う
// (循環に関与する辺だけを対象外にする設計は撤回した)。理由: フライ級の
// 実データ調査で、王者(神龍誠)を介した複数の輪(ougikubo>motoya>神龍>
// ougikubo、ougikubo>torres>神龍>ougikubo、yamamoto>ito>laramie>motoya>
// 神龍>yamamoto等)が絡み合い、循環内リオーダー((b)ロジック)が
// 「ito・laramie・motoyaが互いを待ってブロックされている間に、レートの
// 低いtorres・gadzhamatovが(唯一の前提条件=ougikuboが最初に確定済みという
// だけで)貪欲法の穴を突いて先に確定してしまう」というドミノ効果(玉突き)
// を起こしていた。torres・gadzhamatovはito・laramie・motoyaの誰にも直接
// 勝っておらず、rawRでも本来5〜6位相当なのに2〜3位まで浮いていた
// (実データ調査・Kaina指摘で発覚)。
// gapフィルタを循環検出より先に全ペアへ適用することで、王者を介した
// 「順位が遠く離れた選手同士を繋ぐ辺」がそもそも候補から外れ、循環自体が
// 局所的な(近い順位同士の)ものだけに縮小される。これによりtorres・
// gadzhamatovのような「関係ない選手が巻き添えで浮く」ドミノ効果が消える
// (rawR相応の順位に戻る)。ランキング対象外の選手(王者オーバーレイ等、
// rankedSlugsに含まれない)が絡む辺は、gapを測れないため無条件で除外する
// (これらの辺はどのみち最終的な制約(predecessors)には使われないが、
// 循環判定の橋渡しに使われると上記のドミノ効果を起こすため、判定対象にも
// 含めない)。
export function applyHeadToHeadMonotonicity(rankedSlugs: string[], h2hWins: H2HWin[], maxRankGap?: number): string[] {
  let pairs = resolvePairDirections(h2hWins);

  if (maxRankGap !== undefined) {
    const originalIndexForGap = new Map(rankedSlugs.map((slug, i) => [slug, i]));
    pairs = pairs.filter(({ winner, loser }) => {
      const winnerIdx = originalIndexForGap.get(winner);
      const loserIdx = originalIndexForGap.get(loser);
      if (winnerIdx === undefined || loserIdx === undefined) return false; // ランキング対象外選手が絡む辺は循環判定の橋渡しに使わせない
      return Math.abs(winnerIdx - loserIdx) <= maxRankGap;
    });
  }

  const cyclicEdgeKeys = findCyclicEdges(pairs);
  const nonCyclicPairs = pairs.filter(({ winner, loser }) => !cyclicEdgeKeys.has(`${winner}>${loser}`));
  const cyclicPairs = pairs.filter(({ winner, loser }) => cyclicEdgeKeys.has(`${winner}>${loser}`));

  if (process.env.MN_DEBUG_MONO) {
    console.error("[DEBUG] pairs (after gap filter):", pairs.map((p) => `${p.winner}>${p.loser}`));
    console.error("[DEBUG] cyclicEdgeKeys:", [...cyclicEdgeKeys]);
  }

  const resolvedCyclicPairs = resolveCyclicEdgesByRecency(cyclicPairs, nonCyclicPairs);

  if (process.env.MN_DEBUG_MONO) {
    console.error("[DEBUG] resolvedCyclicPairs:", resolvedCyclicPairs.map((p) => `${p.winner}>${p.loser}`));
  }

  const rankedSet = new Set(rankedSlugs);

  // 2段階方式(2026-07-16 v9再改訂):
  // ステージ1(循環内・resolvedCyclicPairs): 推移閉包(トポロジカルソート)で
  // 解決する。循環はもともと直接繋がった選手だけの局所グループであり、
  // 「直近対戦を優先して矛盾なく一本の順序に並べる」((b)案)ことが目的その
  // ものなので、推移律の強制がここでは正しい挙動。
  // ステージ2(非循環・nonCyclicPairs): ローカルスワップ方式で適用する。旧
  // 方式はステージ1と同じトポロジカルソートを全ペアに適用しており、「AがB
  // に勝ち、BがCに勝つ」という2つの独立した直接対決を、Aが一度もCと対戦して
  // いなくてもAがCより上でなければならないという推移的制約に自動合成して
  // しまっていた(フェザー級で発覚: karamov>asakura・asakura>koikeという
  // 2つの正当な直接対決だけで、koikeがkaramovと無関係に4位まで落とされた)。
  // ここではv7時代のローカルスワップ実装(git show 0b96467)を参照し、「現在の
  // 並びでwinnerがloserより下にあり、かつ現在の順位差がmaxRankGap以内」の
  // 組だけを毎周期再計算し、順位差が最小のものから1件ずつ、winnerをloserの
  // 直前へ移動する。毎周期"現在の並び"を基準に判定し直すのが肝: ある補正が
  // 別ペアの順位差を広げてmaxRankGapを超えさせたら、そのペアは以後の補正
  // 対象から自然に外れる(推移律を強制しない=玉突きの自己抑制)。
  const stage1Order = applyTransitiveOrder(rankedSlugs, resolvedCyclicPairs, rankedSet);
  const order = applyLocalSwapOrder(stage1Order, nonCyclicPairs, rankedSet, maxRankGap);

  if (process.env.MN_DEBUG_MONO) {
    console.error("[DEBUG] stage1Order (cyclic, top10):", stage1Order.slice(0, 10));
    console.error("[DEBUG] final order (top10):", order.slice(0, 10));
  }

  return order;
}

// 循環内リオーダー((b)案)の推移閉包解決: 「まだ配置していない選手のうち、
// 直接の前提(自分に直接負けている相手)が全て配置済みの選手の中で、元の
// レート順で最も上位の選手」を選んで配置していく(制約付きトポロジカル
// ソート、Kahn法+元順序によるタイブレーク)。
function applyTransitiveOrder(rankedSlugs: string[], pairs: ResolvedPair[], rankedSet: Set<string>): string[] {
  const predecessors = new Map<string, Set<string>>();
  for (const slug of rankedSlugs) predecessors.set(slug, new Set());
  for (const { winner, loser } of pairs) {
    if (!rankedSet.has(winner) || !rankedSet.has(loser)) continue;
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

// 非循環の直接対決のローカルスワップ解決(v7参照実装ベース、2026-07-16
// 選択基準を直近優先に変更)。処理順は「毎周期、現時点でまだ矛盾している
// (かつ現時点の順位差がmaxRankGap以内の)組の中で、最も直近の対戦を1件選んで
// 適用する」。循環内リオーダー((b)案)と同じ「直近対戦を優先」の原則で統一
// する。これが必要な理由: 例えばフライ級の「伊藤裕樹>ラミー(2025-03-30、
// 古い)」と「ラミー>元谷(2026-06-06、新しい)」は無関係な2つの直接対決だが、
// laramie-tonyを共通の敗者/勝者として共有するため、適用順序によっては
// 片方が他方を(意図せず)打ち消してしまう。gap最小優先だと処理順が同点
// タイブレークに依存して不安定になるが、直近優先なら常に同じ結果になり、
// かつ新しい対戦(ラミー>元谷)を先に確定させてから古い対戦(伊藤裕樹>
// ラミー)を"その上に"積む形になるため、両方が矛盾なく両立する
// (伊藤裕樹>ラミー>元谷という順序は、伊藤裕樹が元谷と対戦していなくても
// 数学的に両立可能な組み合わせであり、玉突きではない)。
function applyLocalSwapOrder(startOrder: string[], pairs: ResolvedPair[], rankedSet: Set<string>, maxRankGap?: number): string[] {
  const order = [...startOrder];
  let remainingPairs = pairs.filter(({ winner, loser }) => rankedSet.has(winner) && rankedSet.has(loser));
  const effectiveMaxGap = maxRankGap ?? Infinity;
  const MAX_ITERATIONS = remainingPairs.length + 1;
  let iterations = 0;

  while (remainingPairs.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const indexOf = new Map(order.map((slug, i) => [slug, i]));
    let bestPair: ResolvedPair | null = null;
    for (const pair of remainingPairs) {
      const winnerIdx = indexOf.get(pair.winner)!;
      const loserIdx = indexOf.get(pair.loser)!;
      if (winnerIdx <= loserIdx) continue; // 既に矛盾していない
      const gap = winnerIdx - loserIdx;
      if (gap > effectiveMaxGap) continue; // 現時点の順位差が対象範囲外(自己抑制)
      if (bestPair === null || pair.date > bestPair.date) {
        bestPair = pair;
      }
    }
    if (bestPair === null) break; // 残りは全て解消済みか対象範囲外

    const { winner, loser } = bestPair;
    const winnerIdx = order.indexOf(winner);
    order.splice(winnerIdx, 1);
    const newLoserIdx = order.indexOf(loser);
    order.splice(newLoserIdx, 0, winner);

    remainingPairs = remainingPairs.filter((p) => !(p.winner === winner && p.loser === loser));
  }

  return order;
}

export interface H2HViolation {
  winner: string;
  loser: string;
  winnerRank: number; // 1-indexed
  loserRank: number;
}

// 最終順位配列(applyHeadToHeadMonotonicity適用後を想定)に対し、全H2H制約
// (勝者の順位 <= 敗者の順位)が満たされているかを検査する(回帰テスト・
// update-mnews-rating.tsの自己検証・CI用に常設)。
//
// 【2026-07-16再設計】以前はgapフィルタ→循環検出をこの関数内で独自に再実装
// していたが、applyHeadToHeadMonotonicity本体(ステージ2のローカルスワップ)
// が「処理途中の他ペアの補正で現在の順位差がmaxRankGapを超えたら、その場で
// 諦める(自己抑制)」という、事前の静的なgap判定だけでは再現できない挙動を
// 持つようになった(フライ級で実例: 伊藤裕樹>ラミー・ラミー>元谷は共にlaramie
// が絡む非循環ペアで、処理順序によって片方が他方を打ち消しうる)。個別に
// gap+循環判定を再実装すると、本体の実際の判定(処理過程に依存)とズレて
// 誤検知/見逃しを起こす。
// そこで「本体を同じ入力(preCorrectionOrder・h2hWins・maxRankGap)でもう一度
// 実行し、その正準結果(canonical)自身が満たせなかった組は検査対象外にする」
// 方式に変更した。canonicalが満たしている組なのに、渡されたrankedSlugsでは
// 満たされていない場合だけを「本物の違反」として報告する(=構築処理が
// applyHeadToHeadMonotonicity本体と食い違っている、という実際のバグのみ検出)。
// 【重要】preCorrectionOrderは必ず構築時(applyHeadToHeadMonotonicityに渡した
// rankedSlugs)と同じ順序を渡すこと。省略時はrankedSlugsで代用するが、
// これは(補正後の順位を基準にgapを測ることになり)本来の判定とズレる場合が
// あるため、呼び出し側は極力preCorrectionOrderを渡すこと
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
  const canonical = applyHeadToHeadMonotonicity(preCorrectionOrder ?? rankedSlugs, h2hWins, maxRankGap);
  const canonicalRankOf = new Map(canonical.map((slug, i) => [slug, i]));
  const rankOf = new Map(rankedSlugs.map((slug, i) => [slug, i]));
  const violations: H2HViolation[] = [];
  for (const { winner, loser } of pairs) {
    const canonicalWinnerIdx = canonicalRankOf.get(winner);
    const canonicalLoserIdx = canonicalRankOf.get(loser);
    if (canonicalWinnerIdx === undefined || canonicalLoserIdx === undefined) continue; // ランキング対象外
    if (canonicalWinnerIdx > canonicalLoserIdx) continue; // 本体自身もこの組を満たせない(自己抑制/循環の犠牲)=想定内
    const winnerIdx = rankOf.get(winner);
    const loserIdx = rankOf.get(loser);
    if (winnerIdx === undefined || loserIdx === undefined) continue;
    if (winnerIdx > loserIdx) {
      violations.push({ winner, loser, winnerRank: winnerIdx + 1, loserRank: loserIdx + 1 });
    }
  }
  return violations;
}

// 非対称ガード(2026-07-17・(b)案の回帰防止用): 「直近{recentWindowDays}日
// 以内の直接対決で勝った側が負けた側より下位のまま」というケースをゼロに
// する。maxRankGap指定時(v9・弱い整合)は、applyHeadToHeadMonotonicityと
// 同じ順序(gapフィルタ→循環検出)でgapを超えて離れているペアをそもそも
// 対象外にする(=構築時に制約として一切考慮されないため、破れても想定内)。
// gapを生き残った上で循環に関与する組は、maxRankGapの有無に関係なく除外
// しない(=循環内リオーダーの設計上、諦められる辺は必ず最も古いものになる
// はずなので、直近の対戦が破れることがあってはならない、という非対称性を
// 明示的に検査する)。古い辺が破れる(=このチェックの対象外の期間で違反が
// 残る)のは許容する。
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
  // checkH2HInvariantと同じ理由(2026-07-16再設計)で、本体を同じ入力で
  // もう一度実行した正準結果(canonical)を基準に「本体自身が満たせる組か」を
  // 判定する。循環に関与する組もここでは除外しない(canonical自体が(b)案の
  // 直近優先ロジックを反映済みのため、循環内で諦められるべき最古の辺は
  // canonicalでも満たされておらず自然に対象外になる。逆に直近の辺が
  // canonicalで満たされているのに実際のrankedSlugsで破れていれば、それは
  // 本物の非対称性バグとして検出する)。
  const canonical = applyHeadToHeadMonotonicity(preCorrectionOrder ?? rankedSlugs, h2hWins, maxRankGap);
  const canonicalRankOf = new Map(canonical.map((slug, i) => [slug, i]));
  const rankOf = new Map(rankedSlugs.map((slug, i) => [slug, i]));
  const violations: H2HViolation[] = [];
  for (const { winner, loser, date } of pairs) {
    if (date < cutoffStr) continue; // 直近半年より古い対戦は対象外(諦めることを許容する)
    const canonicalWinnerIdx = canonicalRankOf.get(winner);
    const canonicalLoserIdx = canonicalRankOf.get(loser);
    if (canonicalWinnerIdx === undefined || canonicalLoserIdx === undefined) continue;
    if (canonicalWinnerIdx > canonicalLoserIdx) continue; // 本体自身も満たせない(自己抑制/循環の犠牲)=想定内
    const winnerIdx = rankOf.get(winner);
    const loserIdx = rankOf.get(loser);
    if (winnerIdx === undefined || loserIdx === undefined) continue;
    if (winnerIdx > loserIdx) {
      violations.push({ winner, loser, winnerRank: winnerIdx + 1, loserRank: loserIdx + 1 });
    }
  }
  return violations;
}
