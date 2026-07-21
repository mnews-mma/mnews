// RIZIN パウンドフォーパウンド(P4P)ランキング試算レポート(運用者向け・非公開)。
// docs/instructions/(P4P試算指示書)に基づく設計検証用。本番データ・エンジン・
// 定数は一切変更しない読み取り専用スクリプト。data/rankings.json(既存の
// 単一ゲート=PUBLISHED_DIVISIONS)をそのまま読み込み、階級内での「ドミナンス」
// (平均・中央値からの乖離)を3変種のスコア式で正規化して階級横断に並べ直す。
//
// 実行: npx tsx scripts/check-p4p-trial.ts
import fs from "fs";
import path from "path";
import { PUBLISHED_DIVISIONS, MnewsDivision } from "../src/lib/mnewsRating/divisions";
import { divisionRankingsKey, RankingsFile, DivisionRankings } from "../src/lib/mnewsRating/rankingsFile";
import { RANKING_DISPLAY_CAP } from "../src/lib/mnewsRating/divisionRankingView";
import { RIZIN_CHAMPIONS } from "../src/lib/champions";
import { FIGHTERS } from "../src/lib/fighters";

const RANKINGS_PATH = path.join(process.cwd(), "data", "rankings.json");
const OUT_DIR = path.join(process.cwd(), "out");
const OUT_PATH = path.join(OUT_DIR, "p4p-trial.md");

interface Candidate {
  slug: string;
  nameJa: string;
  division: MnewsDivision;
  divisionRank: number;
  rawRating: number;
  capIn: boolean;
  isChampion: boolean;
}

interface DivisionStats {
  division: MnewsDivision;
  n: number;
  mean: number;
  median: number;
  sigma: number; // 母集団標準偏差(candidatesがその階級の全数のため標本ではなく母集団として扱う)
  mad: number; // 中央絶対偏差(median(|x-median|))、スケール係数なし
  championSlug: string | null; // RIZIN_CHAMPIONSにエントリがある場合のslug(nullは王座空位/DB外)
  championRawRating: number | null; // championSlugがcandidatesに存在する場合のみ非null
  championFlag: string | null; // レート算出不能等の理由フラグ
}

interface ScoredCandidate extends Candidate {
  scoreA: number; // (rating-mean)/sigma
  scoreB: number; // (rating-median)/mad
  scoreC: number; // rating-median
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function populationSigma(xs: number[], m: number): number {
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function mad(xs: number[], m: number): number {
  return median(xs.map((x) => Math.abs(x - m)));
}

function loadRankings(): RankingsFile {
  if (!fs.existsSync(RANKINGS_PATH)) {
    throw new Error(`[FATAL] data/rankings.json が存在しません: ${RANKINGS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(RANKINGS_PATH, "utf8")) as RankingsFile;
}

const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

// nameJaの解決失敗(FIGHTERSに存在しないslugがrankings.jsonに載っている)は
// 黙ってcontinueせず、集計に理由付きで反映する(lookup miss黙殺禁止)。
const lookupMissSlugs: string[] = [];
function resolveName(slug: string): string {
  const name = nameBySlug.get(slug);
  if (!name) {
    lookupMissSlugs.push(slug);
    return `(name lookup miss: ${slug})`;
  }
  return name;
}

function buildCandidatesAndStats(rankings: RankingsFile): { candidates: Candidate[]; statsByDivision: Map<MnewsDivision, DivisionStats> } {
  const candidates: Candidate[] = [];
  const statsByDivision = new Map<MnewsDivision, DivisionStats>();

  for (const division of PUBLISHED_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const divData: DivisionRankings | undefined = rankings[key];
    if (!divData) {
      throw new Error(`[FATAL] 階級名突合失敗: division="${division}" のkey="${key}" がdata/rankings.jsonに存在しません`);
    }
    if (divData.entries.length === 0) {
      throw new Error(`[FATAL] ${division} の候補プールが0件です(データ異常の疑い)`);
    }

    const divisionCandidates: Candidate[] = divData.entries.map((e) => ({
      slug: e.fighterId,
      nameJa: resolveName(e.fighterId),
      division,
      divisionRank: e.rank,
      rawRating: e.rawRating,
      capIn: e.rank <= RANKING_DISPLAY_CAP,
      isChampion: e.fighterId === divData.champion?.fighterId,
    }));
    candidates.push(...divisionCandidates);

    const ratings = divisionCandidates.map((c) => c.rawRating);
    const m = mean(ratings);
    const med = median(ratings);

    // 王者の扱い: champions.tsオーバーレイに当該階級のRIZIN現王者エントリが
    // あるか個別確認。無ければ「王座空位/champions.ts未掲載」として王者無しで
    // 続行。あればslugを特定し、そのslugがこの階級のcandidatesに実在するかで
    // rawRatingの有無を判定する(捏造禁止・レート無しは理由付きでフラグ)。
    const champEntry = RIZIN_CHAMPIONS.find((c) => c.org === "rizin" && c.weightClass === division);
    let championSlug: string | null = null;
    let championRawRating: number | null = null;
    let championFlag: string | null = null;
    if (!champEntry) {
      championFlag = "champions.tsに当該階級のRIZIN王者エントリなし(王座空位/未掲載)";
    } else if (!champEntry.slug) {
      championFlag = `王者「${champEntry.name}」はchampions.ts上でslug未設定(DB外/hidden)のためP4P算出不能`;
    } else {
      championSlug = champEntry.slug;
      const champCandidate = divisionCandidates.find((c) => c.slug === championSlug);
      if (champCandidate) {
        championRawRating = champCandidate.rawRating;
      } else {
        championFlag = `王者「${champEntry.name}」(${championSlug})はこの階級のランキング候補に不在のためレート無し・P4P算出不能`;
      }
    }

    statsByDivision.set(division, {
      division,
      n: divisionCandidates.length,
      mean: m,
      median: med,
      sigma: populationSigma(ratings, m),
      mad: mad(ratings, med),
      championSlug,
      championRawRating,
      championFlag,
    });
  }

  return { candidates, statsByDivision };
}

function scoreCandidates(candidates: Candidate[], statsByDivision: Map<MnewsDivision, DivisionStats>): ScoredCandidate[] {
  return candidates.map((c) => {
    const s = statsByDivision.get(c.division)!;
    return {
      ...c,
      scoreA: s.sigma === 0 ? 0 : (c.rawRating - s.mean) / s.sigma,
      scoreB: s.mad === 0 ? 0 : (c.rawRating - s.median) / s.mad,
      scoreC: c.rawRating - s.median,
    };
  });
}

// 自己検証(a): 各変種は階級内でrawRatingの単調増加変換のはずなので、
// 「変種スコアでソートした階級内順序」と「rawRatingでソートした階級内順序」は
// 必ず一致する(スコア計算式そのものの実装ミスを検出する目的)。
// 注意: これはdata/rankings.jsonの公開rank(H2H単調性補正後の最終順位)とは
// 別軸の検証。公開rankとrawRating降順は、既存エンジンのH2H補正により階級ごとに
// 数件の逆転が実際に存在する(仕様であり本スクリプトのバグではない)。その逆転は
// exit 1にはせず、レポート内に発見事項として記録する(§4「王者仮説」節の前段)。
function verifyScoreMonotonicity(scored: ScoredCandidate[]): string[] {
  const errors: string[] = [];
  const byDivision = new Map<MnewsDivision, ScoredCandidate[]>();
  for (const c of scored) {
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  for (const [division, list] of byDivision) {
    const byRawDesc = [...list].sort((a, b) => b.rawRating - a.rawRating).map((c) => c.slug);
    for (const [variant, key] of [
      ["A", "scoreA"],
      ["B", "scoreB"],
      ["C", "scoreC"],
    ] as const) {
      const byScoreDesc = [...list].sort((a, b) => b[key] - a[key]).map((c) => c.slug);
      if (JSON.stringify(byRawDesc) !== JSON.stringify(byScoreDesc)) {
        errors.push(`${division} 変種${variant}: rawRating降順とスコア降順の階級内順序が不一致(スコア式実装バグの疑い)`);
      }
    }
  }
  return errors;
}

// rawRating降順(H2H補正前相当)と公開rank(H2H補正後)の階級内順序が食い違う
// 箇所を発見事項として収集する(exit 1対象ではない。ユーザー判断: 2026-07-21)。
function collectRankOrderInversions(candidates: Candidate[]): { division: MnewsDivision; higherRawLowerRank: string; lowerRawHigherRank: string }[] {
  const byDivision = new Map<MnewsDivision, Candidate[]>();
  for (const c of candidates) {
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  const inversions: { division: MnewsDivision; higherRawLowerRank: string; lowerRawHigherRank: string }[] = [];
  for (const [division, list] of byDivision) {
    const byRank = [...list].sort((a, b) => a.divisionRank - b.divisionRank);
    for (let i = 1; i < byRank.length; i++) {
      if (byRank[i].rawRating > byRank[i - 1].rawRating) {
        inversions.push({
          division,
          higherRawLowerRank: `${byRank[i].nameJa}(${byRank[i].slug}, rank${byRank[i].divisionRank}, raw${byRank[i].rawRating.toFixed(2)})`,
          lowerRawHigherRank: `${byRank[i - 1].nameJa}(${byRank[i - 1].slug}, rank${byRank[i - 1].divisionRank}, raw${byRank[i - 1].rawRating.toFixed(2)})`,
        });
      }
    }
  }
  return inversions;
}

interface P4PRankedList {
  variant: "A" | "B" | "C";
  ranked: ScoredCandidate[]; // 全候補、スコア降順
}

function buildP4PLists(scored: ScoredCandidate[]): P4PRankedList[] {
  return [
    { variant: "A" as const, ranked: [...scored].sort((a, b) => b.scoreA - a.scoreA) },
    { variant: "B" as const, ranked: [...scored].sort((a, b) => b.scoreB - a.scoreB) },
    { variant: "C" as const, ranked: [...scored].sort((a, b) => b.scoreC - a.scoreC) },
  ];
}

function scoreOf(c: ScoredCandidate, variant: "A" | "B" | "C"): number {
  return variant === "A" ? c.scoreA : variant === "B" ? c.scoreB : c.scoreC;
}

// 変種間乖離: 3変種間でP4P順位が5以上割れる選手を検出する。
function findDivergentVariants(lists: P4PRankedList[]): { slug: string; nameJa: string; ranks: Record<"A" | "B" | "C", number>; spread: number }[] {
  const rankMaps: Record<"A" | "B" | "C", Map<string, number>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const l of lists) {
    l.ranked.forEach((c, i) => rankMaps[l.variant].set(c.slug, i + 1));
  }
  const allSlugs = new Set(lists[0].ranked.map((c) => c.slug));
  const bySlug = new Map(lists[0].ranked.map((c) => [c.slug, c]));
  const out: { slug: string; nameJa: string; ranks: Record<"A" | "B" | "C", number>; spread: number }[] = [];
  for (const slug of allSlugs) {
    const ranks = { A: rankMaps.A.get(slug)!, B: rankMaps.B.get(slug)!, C: rankMaps.C.get(slug)! };
    const spread = Math.max(ranks.A, ranks.B, ranks.C) - Math.min(ranks.A, ranks.B, ranks.C);
    if (spread >= 5) {
      out.push({ slug, nameJa: bySlug.get(slug)!.nameJa, ranks, spread });
    }
  }
  out.sort((a, b) => b.spread - a.spread);
  return out;
}

function formatNum(n: number): string {
  return n.toFixed(3);
}

function buildReport(
  candidates: Candidate[],
  statsByDivision: Map<MnewsDivision, DivisionStats>,
  scored: ScoredCandidate[],
  lists: P4PRankedList[],
  divergent: { slug: string; nameJa: string; ranks: Record<"A" | "B" | "C", number>; spread: number }[],
  inversions: { division: MnewsDivision; higherRawLowerRank: string; lowerRawHigherRank: string }[],
  driftMatch: boolean
): string {
  const lines: string[] = [];
  lines.push("# RIZIN パウンドフォーパウンド(P4P) 試算レポート(運用者向け・非公開・内部レビュー専用)");
  lines.push("");
  lines.push("本レポートは公開ページ・X投稿・記事素材に転用しないこと。rawRating生値を含む(内部値・非公開方針)。");
  lines.push("");
  lines.push(`生成コミット時点のdata/rankings.jsonのみを入力とし、壁時計を使わない決定性な計算(2回連続実行の一致確認: ${driftMatch ? "OK(完全一致)" : "NG(不一致)"})。`);
  lines.push("");
  lines.push("候補プール: PUBLISHED_DIVISIONSの公開階級のみ(非公開階級は含まない)。各階級の現行ランキング候補全員(表示キャップ=王者+15の外も含む)。除外(引退・hidden・階級離脱等)は既存のdata/rankings.json生成過程(isExcludedByFact)にそのまま従う。");
  lines.push("");

  lines.push("## 1. 階級別統計サマリ");
  lines.push("");
  lines.push("母集団: その階級の候補プール全員のrawRating(data/rankings.jsonのentries[].rawRating、σディスカウント適用後の値)。");
  lines.push("");
  lines.push("| 階級 | n | 平均 | 中央値 | σ(母集団) | MAD | 王者 | 王者rawRating |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const division of PUBLISHED_DIVISIONS) {
    const s = statsByDivision.get(division)!;
    const champLabel = s.championSlug ? `${s.championSlug}` : "(空位/未掲載)";
    const champRating = s.championRawRating !== null ? formatNum(s.championRawRating) : s.championFlag ? `フラグ: ${s.championFlag}` : "-";
    lines.push(`| ${division} | ${s.n} | ${formatNum(s.mean)} | ${formatNum(s.median)} | ${formatNum(s.sigma)} | ${formatNum(s.mad)} | ${champLabel} | ${champRating} |`);
  }
  lines.push("");

  lines.push("## 2. P4P順位表");
  lines.push("");
  for (const l of lists) {
    lines.push(`### 変種${l.variant} トップ15`);
    lines.push("");
    lines.push("| P4P順位 | 選手名 | slug | 階級 | 階級内順位 | rawRating | スコア | キャップ内外 |");
    lines.push("|---|---|---|---|---|---|---|---|");
    l.ranked.slice(0, 15).forEach((c, i) => {
      const rankLabel = c.isChampion ? `王者/${c.divisionRank}` : `${c.divisionRank}`;
      lines.push(
        `| ${i + 1} | ${c.nameJa} | ${c.slug} | ${c.division} | ${rankLabel} | ${formatNum(c.rawRating)} | ${formatNum(scoreOf(c, l.variant))} | ${c.capIn ? "内" : "外"} |`
      );
    });
    lines.push("");
  }

  lines.push("### 全候補フルテーブル(変種A順)");
  lines.push("");
  lines.push("| P4P順位(A) | 選手名 | slug | 階級 | 階級内順位 | rawRating | scoreA | scoreB | scoreC | キャップ内外 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  lists[0].ranked.forEach((c, i) => {
    const rankLabel = c.isChampion ? `王者/${c.divisionRank}` : `${c.divisionRank}`;
    lines.push(
      `| ${i + 1} | ${c.nameJa} | ${c.slug} | ${c.division} | ${rankLabel} | ${formatNum(c.rawRating)} | ${formatNum(c.scoreA)} | ${formatNum(c.scoreB)} | ${formatNum(c.scoreC)} | ${c.capIn ? "内" : "外"} |`
    );
  });
  lines.push("");

  lines.push("## 3. 変種間乖離フラグ(3変種間でP4P順位が5以上割れる選手)");
  lines.push("");
  if (divergent.length === 0) {
    lines.push("該当なし。");
  } else {
    lines.push("| 選手名 | slug | 階級 | A順位 | B順位 | C順位 | 最大差 | 考察 |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const d of divergent) {
      const s = statsByDivision.get(candidates.find((c) => c.slug === d.slug)!.division)!;
      const note =
        s.sigma < s.mad
          ? "σ<MAD(外れ値の影響でσが縮小/拡大しA-B間で差が出やすい階級)"
          : s.sigma > s.mad
            ? "σ>MAD(小標本での分散推定の差がA-B間の乖離に影響しうる)"
            : "σ≈MADだがCは絶対値のためスケールの違いで乖離";
      lines.push(`| ${d.nameJa} | ${d.slug} | ${candidates.find((c) => c.slug === d.slug)!.division} | ${d.ranks.A} | ${d.ranks.B} | ${d.ranks.C} | ${d.spread} | ${note} |`);
    }
  }
  lines.push("");

  lines.push("## 4. 王者仮説の検証(各公開階級の王者、または王者不在なら#1がP4Pトップ10に入るか)");
  lines.push("");
  lines.push("入らない場合はバグではなく設計上の発見として報告する(この試算の主目的の一つ)。");
  lines.push("");
  lines.push("| 階級 | 対象 | 変種A順位 | 変種B順位 | 変種C順位 | トップ10入り(A/B/C) |");
  lines.push("|---|---|---|---|---|---|");
  const rankMaps: Record<"A" | "B" | "C", Map<string, number>> = { A: new Map(), B: new Map(), C: new Map() };
  for (const l of lists) l.ranked.forEach((c, i) => rankMaps[l.variant].set(c.slug, i + 1));
  for (const division of PUBLISHED_DIVISIONS) {
    const s = statsByDivision.get(division)!;
    let targetSlug: string | null = s.championSlug && s.championRawRating !== null ? s.championSlug : null;
    let targetLabel: string;
    if (targetSlug) {
      targetLabel = `王者 ${targetSlug}`;
    } else {
      const top1 = candidates.filter((c) => c.division === division).sort((a, b) => a.divisionRank - b.divisionRank)[0];
      targetSlug = top1.slug;
      targetLabel = `#1(王者フラグ: ${s.championFlag ?? "空位"}) ${top1.nameJa}`;
    }
    const rA = rankMaps.A.get(targetSlug);
    const rB = rankMaps.B.get(targetSlug);
    const rC = rankMaps.C.get(targetSlug);
    const inTop10 = `${rA !== undefined && rA <= 10 ? "○" : "×"}/${rB !== undefined && rB <= 10 ? "○" : "×"}/${rC !== undefined && rC <= 10 ? "○" : "×"}`;
    lines.push(`| ${division} | ${targetLabel} | ${rA ?? "-"} | ${rB ?? "-"} | ${rC ?? "-"} | ${inTop10} |`);
  }
  lines.push("");

  lines.push("## 5. 日本人フィルタ参考列");
  lines.push("");
  lines.push("選手データ(src/lib/fighters.ts Fighter型)に国籍/日本人判定の既存フィールドは存在しない(フィールド不在)。選手名からの国籍推定は捏造にあたるため行っていない。将来「日本人最強」を検討する場合は、国籍を事実として確認できるデータソースの追加が前提になる。");
  lines.push("");

  lines.push("## 6. 発見事項: rawRating降順と公開rank(H2H単調性補正後)の階級内順序の不一致");
  lines.push("");
  lines.push("本スクリプトの自己検証(a)はスコア式自体の実装ミス検出用であり、rawRating降順とスコア降順の一致は全変種で確認済み(下記参照)。一方、rawRating降順と`data/rankings.json`の公開rank(既存エンジンのH2H単調性補正後)は、以下の箇所で一致しない(仕様であり本スクリプトのバグではない。ユーザー判断: 2026-07-21、exit 1にせず発見事項として報告する運用とした)。P4PスコアはrawRating(σディスカウント後、H2H補正前)ベースのため、これらの階級では階級内P4P順位が公開rankとわずかに異なりうる。");
  lines.push("");
  if (inversions.length === 0) {
    lines.push("該当なし。");
  } else {
    lines.push("| 階級 | 公開rankが上位(rawRatingは下)| 公開rankが下位(rawRatingは上)|");
    lines.push("|---|---|---|");
    for (const inv of inversions) {
      lines.push(`| ${inv.division} | ${inv.lowerRawHigherRank} | ${inv.higherRawLowerRank} |`);
    }
  }
  lines.push("");

  lines.push("## 7. lookup miss");
  lines.push("");
  if (lookupMissSlugs.length === 0) {
    lines.push("該当なし(全候補slugがFIGHTERSで解決できた)。");
  } else {
    lines.push(`FIGHTERSでnameJaが解決できなかったslug(${lookupMissSlugs.length}件): ${lookupMissSlugs.join(", ")}`);
  }
  lines.push("");

  return lines.join("\n") + "\n";
}

function runOnce(): { report: string; scored: ScoredCandidate[] } {
  const rankings = loadRankings();
  const { candidates, statsByDivision } = buildCandidatesAndStats(rankings);
  const scored = scoreCandidates(candidates, statsByDivision);

  const monotonicityErrors = verifyScoreMonotonicity(scored);
  if (monotonicityErrors.length > 0) {
    console.error("[FATAL] 自己検証(a)失敗(スコア式実装バグの疑い):");
    for (const e of monotonicityErrors) console.error(`  ${e}`);
    throw new Error("自己検証(a)失敗");
  }

  const inversions = collectRankOrderInversions(candidates);
  const lists = buildP4PLists(scored);
  const divergent = findDivergentVariants(lists);
  const report = buildReport(candidates, statsByDivision, scored, lists, divergent, inversions, true);
  return { report, scored };
}

function main() {
  // 決定性の自己検証(b): 同一コミット上で2回連続実行し、出力が完全一致することを確認する。
  const first = runOnce();
  const second = runOnce();
  const driftMatch = first.report.replace(/生成コミット.*\n/, "") === second.report.replace(/生成コミット.*\n/, "");
  if (!driftMatch) {
    console.error("[FATAL] 自己検証(b)失敗: 2回連続実行の出力が一致しません(非決定性の疑い)");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, first.report);
  console.log(`[OK] ${OUT_PATH} を生成しました(決定性チェックOK)`);
  console.log(`階級数: ${PUBLISHED_DIVISIONS.length} / 候補総数: ${first.scored.length}`);
}

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
