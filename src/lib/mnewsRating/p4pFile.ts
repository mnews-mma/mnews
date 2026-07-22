// パウンドフォーパウンド(P4P)ランキングの生成ロジック(2026-07-22追加)。
//
// 設計方針改訂(2026-07-22、2回目): 当初(2026-07-21試算PR #172)は「王者を
// 必ずP4P1〜4位に固定し、防衛回数→勝率でタイブレークする」設計、次に
// 「王者ティア固定を撤回し、階級内zスコア1本でフラットに並べる」設計を経て、
// 最終的に以下に変更した:
// - 全員(王者+挑戦者)を、rawRating(σディスカウント後のEloレート)の絶対値
//   そのままで階級横断にフラットに並べる。階級内平均・σによる正規化
//   (zスコア)は撤回した。
//   理由: zスコアは「強い階級ほど損をする」逆転を生む(フェザー級は4階級中
//   最も水準が高いため、フェザー級王者シェイドゥラエフの絶対rawRatingは
//   4王者中最高なのに、zスコアでは3位に落ちていた)。rawRatingは階級を跨いだ
//   1本のEloで計算されており(engine.tsのbuildBoutsは階級でフィルタしない、
//   王者・挑戦者を問わず同じ計算式)、層の厚い階級で勝ち続けること自体が
//   自然にレートを押し上げる。zスコアで正規化するとこの効果を打ち消して
//   しまうため、正規化なしの絶対値の方がファンの直感(強い階級での防衛・
//   活躍がそのまま評価される)に合う。
// - 挑戦者(非王者)は、同一階級内の順序が階級別公開ランキングのrank順
//   (1位>2位>3位…)を絶対に逆転しないようclampする(running-min方式:
//   公開rank昇順に見て、直前のclamp後スコアを上回っていたら直前値まで
//   引き下げる)。
//   理由(2026-07-22、一度撤回した後に復活させた): clampを外すと、同じ階級の
//   中でP4Pと階級別ランキングの前後が入れ替わって見える(例: フェザー級は
//   公開1位の朝倉未来より公開2位のクレベル・コイケがP4Pで上、フライ級は
//   公開2位のトニー・ララミーより公開3位の元谷友貴がP4Pで上)。原因は
//   H2H単調性補正が階級別ランキング側にのみかかっていることで、説明自体は
//   可能だが「同じサイトの2ページで前後が逆」を読者に納得させる説明コストが
//   高すぎると判断した。P4Pは階級を跨いだ比較のための指標であり、階級内の
//   序列は階級別ランキングに従わせる方が一貫する。
//   なお王者は階級内の「公開rank」を持たない(overlay設計で番号付きランキングの
//   対象外)ためclampの対象にできず、生のrawRatingのままグローバル順位に
//   参加する。王者を上位固定するティアは設けない(2026-07-22、撤回済み)。
// - 防衛回数・通算勝率は順位にも画面表示にも使わない(2026-07-22、表示も
//   取りやめ)。データ自体はdata/p4p.jsonに保持し続けるが、これは将来の
//   再利用に備えた据え置き(championDefenses.tsの冒頭コメント参照)。
//
// 【clampの副作用・意図的に受け入れている点】clampは「自階級の上位者を
// 追い越さない」制約なので、Eloレート自体は高いのに自階級の公開上位者に
// 直接対決で負けている選手は、その上位者のスコアまで引き下げられてP4Pの
// 順位を落とす(例: ホベルト・サトシ・ソウザはrawRating 1596.10と全体3位相当
// だが、ライト級公開1位のイルホム・ノジモフ(1548.84)に直接対決で敗れている
// ため1548.84まで引き下げられ、トップ15圏外に落ちる)。これは階級内の整合性を
// 優先した設計上のトレードオフとして受け入れる。
//
// このモジュールはdata/rankings.json(既存Eloランキング)を読み取り専用の入力
// とし、data/rankings.json自体・engine.ts・共有定数には一切影響しない
// (P4P専用ロジックはこのファイルとscripts/generate-p4p.tsのみに閉じる)。
import { MnewsDivision, PUBLISHED_DIVISIONS } from "./divisions";
import { RankingsFile, RankingEntryRecord, divisionRankingsKey } from "./rankingsFile";
import { ChampionDefenseEntry } from "../championDefenses";

export type P4PTier = "champion" | "challenger";

export interface P4PRankPositionDelta {
  kind: "up" | "down" | "same" | "new";
  positions: number;
}

export interface P4PEntry {
  fighterId: string;
  division: MnewsDivision;
  p4pRank: number; // 1始まり、rawRating降順
  divisionRank: number | "champion"; // 階級内位置(公開rank、王者は"champion")。参考表示用、順位計算には使わない
  tier: P4PTier;
  defenseCount: number | null; // 王者のみ。参考表示用(順位には使わない)。取得不能はnull(0埋め・推定禁止)
  record: RankingEntryRecord;
  lastFight: string | null;
  // buildP4PFileの時点ではnull。scripts/generate-p4p.tsがcomputeP4PRankPositionDeltas
  // で前回data/p4p.jsonとの差分を算出した後に埋める(rankPositionDelta.tsの
  // 既存の階級別ランキングと同じ「後処理として付与する」設計を踏襲)。
  rankPositionDelta: P4PRankPositionDelta | null;
  // 内部専用フィールド(次回実行時のdelta計算にのみ使う、公開ページには出さない)。
  internalScore: number; // rawRatingそのもの(σディスカウント後、正規化なし)。これがP4P順位を決める唯一の値
}

export interface P4PFile {
  updatedAt: string; // ISO
  algorithmVersion: number; // 参照したdata/rankings.jsonの各階級algorithmVersion(全階級一致が前提)
  entries: P4PEntry[]; // p4pRank昇順、全候補(表示キャップはページ側で適用)
  defenseDataIssues: string[]; // 現王者で防衛回数データが無かった場合の明細(空なら問題なし)
  // RIZIN通算戦績(allRizinRecords)を解決できなかった選手の明細(空なら問題なし)。
  // 空でない場合はscripts/generate-p4p.ts側でexit 1する(階級スコープ済み戦績と
  // RIZIN通算戦績が混在した状態で公開しないため)。
  recordDataIssues: string[];
}

// data/rankings.jsonのentries由来の候補(非王者)。
interface ChallengerCandidate {
  slug: string;
  division: MnewsDivision;
  divisionRank: number;
  rawRating: number;
  record: RankingEntryRecord;
  lastFight: string | null;
}

// エンジン読み取り専用再計算で得た王者のσディスカウント後rawRating
// (rankings.jsonのchampion overlayはrawRatingを保持しないため、
// scripts/generate-p4p.ts側でengine.tsを読み取り専用に再実行して渡す)。
export interface ChampionRawRatingInput {
  slug: string;
  division: MnewsDivision;
  rawRating: number;
}

// 挑戦者候補をdata/rankings.jsonのentriesからそのまま抽出する(公開階級のみ)。
export function collectChallengerCandidates(rankings: RankingsFile): ChallengerCandidate[] {
  const out: ChallengerCandidate[] = [];
  for (const division of PUBLISHED_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const divData = rankings[key];
    if (!divData) continue; // 空データは「候補0件」として続行(異常系はgenerate-p4p.ts側でexit1)
    for (const e of divData.entries) {
      out.push({
        slug: e.fighterId,
        division,
        divisionRank: e.rank,
        rawRating: e.rawRating,
        record: e.record,
        lastFight: e.lastFight,
      });
    }
  }
  return out;
}

// 階級内順序clamp: 各階級で公開rank昇順(1位→2位→…)に並べ、直前の
// (clamp後)rawRatingを上回っていれば直前値まで引き下げる(running min)。
// これにより同一階級内のP4P順序が必ず公開rank順と一致する。
// 王者は公開rankを持たないため対象外(呼び出し側で挑戦者のみ渡す)。
export function clampChallengersToDivisionOrder(challengers: ChallengerCandidate[]): ChallengerCandidate[] {
  const byDivision = new Map<MnewsDivision, ChallengerCandidate[]>();
  for (const c of challengers) {
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  const out: ChallengerCandidate[] = [];
  for (const [, list] of byDivision) {
    const byRankAsc = [...list].sort((a, b) => a.divisionRank - b.divisionRank);
    let runningMin = Infinity;
    for (const c of byRankAsc) {
      const clamped = Math.min(c.rawRating, runningMin);
      runningMin = clamped;
      out.push({ ...c, rawRating: clamped });
    }
  }
  return out;
}

export interface ChampionTierEntry {
  slug: string;
  division: MnewsDivision;
  record: RankingEntryRecord;
  lastFight: string | null;
  winRate: number | null; // 現在は順位にも表示にも未使用(将来の再利用に備えた据え置き)
  defenseCount: number | null; // 現在は順位にも表示にも未使用(将来の再利用に備えた据え置き)
  rawRating: number; // P4P順位を決める値そのもの
}

// 王者ごとの戦績・防衛回数・勝率を算出する(防衛回数・勝率は現在いずれも
// 順位・表示ともに未使用。将来の再利用に備えた据え置き)。防衛回数データが
// 無い王者は取得不能を明示フラグする(0埋め・推定は禁止、championDefenses.ts参照)。
export function buildChampionEntries(
  championRawRatings: ChampionRawRatingInput[],
  championRecords: Map<string, { record: RankingEntryRecord; lastFight: string | null }>,
  defenseData: ChampionDefenseEntry[]
): { champions: ChampionTierEntry[]; defenseDataIssues: string[] } {
  const defenseBySlug = new Map(defenseData.map((d) => [d.slug, d]));
  const issues: string[] = [];
  const champions: ChampionTierEntry[] = [];
  for (const champ of championRawRatings) {
    const recordInfo = championRecords.get(champ.slug);
    const record = recordInfo?.record ?? { wins: 0, losses: 0, draws: 0 };
    const winRate = record.wins + record.losses > 0 ? record.wins / (record.wins + record.losses) : null;
    const defenseEntry = defenseBySlug.get(champ.slug);
    if (!defenseEntry) {
      issues.push(`${champ.division}:${champ.slug} — 防衛回数データが championDefenses.ts に見つからず(取得不能として扱う)`);
    }
    champions.push({
      slug: champ.slug,
      division: champ.division,
      record,
      lastFight: recordInfo?.lastFight ?? null,
      winRate,
      defenseCount: defenseEntry?.defenseCount ?? null,
      rawRating: champ.rawRating,
    });
  }
  return { champions, defenseDataIssues: issues };
}

// 前回のp4p.jsonとの▲▼(順位番号)差分。既存の階級別ランキングの
// computeRankPositionDeltas(rankPositionDelta.ts)と同じ「rank番号だけを比較する
// 純粋関数」という設計を踏襲する(スコア再計算には一切関与しない)。
export function computeP4PRankPositionDeltas(
  currentEntries: P4PEntry[],
  prev: P4PFile | null
): Map<string, P4PRankPositionDelta> {
  const out = new Map<string, P4PRankPositionDelta>();
  if (!prev) {
    for (const e of currentEntries) out.set(e.fighterId, { kind: "same", positions: 0 });
    return out;
  }
  const prevRankByFighter = new Map(prev.entries.map((e) => [e.fighterId, e.p4pRank]));
  for (const e of currentEntries) {
    const prevRank = prevRankByFighter.get(e.fighterId);
    if (prevRank === undefined) {
      out.set(e.fighterId, { kind: "new", positions: 0 });
      continue;
    }
    const diff = prevRank - e.p4pRank;
    if (diff > 0) out.set(e.fighterId, { kind: "up", positions: diff });
    else if (diff < 0) out.set(e.fighterId, { kind: "down", positions: -diff });
    else out.set(e.fighterId, { kind: "same", positions: 0 });
  }
  return out;
}

export interface BuildP4PFileInput {
  rankings: RankingsFile;
  championRawRatings: ChampionRawRatingInput[]; // scripts/generate-p4p.ts側のエンジン読み取り専用再計算で取得
  defenseData: ChampionDefenseEntry[];
  // RIZIN通算戦績(階級スコープなし)。scripts/generate-p4p.ts側のエンジン
  // 読み取り専用再計算(buildDisplayEntries)から渡す。
  //
  // data/rankings.jsonのrecordを使わない理由(2026-07-22): あちらは
  // update-mnews-rating.tsのapplyEligibilityScopeToRecordにより、階級移籍選手に
  // ついて「その階級での戦績」へスコープ済み(fighterDivisions.tsの
  // eligibilityScopeStartDate/recordDisplayExclusions)。階級別ランキングでは
  // それが正しいが、P4Pは階級を跨いだ通算rawRatingで順位を決める指標なので、
  // 隣に表示する戦績も同じ「RIZIN通算」でないと意味が食い違う
  // (例: 扇久保博正はフライ級スコープだと5勝2敗だがRIZIN通算では11勝6敗、
  // 元谷友貴はフライ級スコープだと2勝2敗だがバンタム級戦を含む通算では14勝10敗)。
  allRizinRecords: Map<string, RankingEntryRecord>;
  updatedAt: string; // ISO(壁時計非依存にするため呼び出し側から渡す)
  algorithmVersion: number;
}

// data/rankings.jsonの各階級champion overlay(record/lastFightは既に格納済み。
// rawRatingだけがoverlayに無いためscripts/generate-p4p.ts側の再計算で補う)。
function collectChampionRecords(rankings: RankingsFile): Map<string, { record: RankingEntryRecord; lastFight: string | null }> {
  const out = new Map<string, { record: RankingEntryRecord; lastFight: string | null }>();
  for (const division of PUBLISHED_DIVISIONS) {
    const key = divisionRankingsKey(division);
    const champion = rankings[key]?.champion;
    if (champion && champion.record) {
      out.set(champion.fighterId, { record: champion.record, lastFight: champion.lastFight });
    }
  }
  return out;
}

// P4Pファイル本体を構築する(2026-07-22最終: zスコア正規化なし・王者ティア
// なし・挑戦者は階級内clampあり。冒頭の設計方針コメント参照)。
export function buildP4PFile(input: BuildP4PFileInput): P4PFile {
  // 挑戦者は階級内の公開rank順を逆転しないようclampしてからグローバルに並べる。
  const challengerCandidates = clampChallengersToDivisionOrder(collectChallengerCandidates(input.rankings));
  const championRecords = collectChampionRecords(input.rankings);
  const { champions, defenseDataIssues } = buildChampionEntries(input.championRawRatings, championRecords, input.defenseData);

  // 戦績はdata/rankings.json由来の階級スコープ済みの値ではなく、必ずRIZIN通算
  // (allRizinRecords)を使う(BuildP4PFileInputのコメント参照)。解決できない
  // slugは0埋め・階級スコープ値へのフォールバックをせず、理由付きで
  // recordDataIssuesに積む(呼び出し側がexit 1する)。
  const recordDataIssues: string[] = [];
  const resolveRecord = (slug: string, division: MnewsDivision, fallback: RankingEntryRecord): RankingEntryRecord => {
    const rizinTotal = input.allRizinRecords.get(slug);
    if (!rizinTotal) {
      recordDataIssues.push(`${division}:${slug} — RIZIN通算戦績がエンジン再計算で解決できず(階級スコープ済み戦績との混在を避けるため生成を中止する)`);
      return fallback;
    }
    return rizinTotal;
  };

  const combined: P4PEntry[] = [
    ...champions.map((c) => ({
      fighterId: c.slug,
      division: c.division,
      p4pRank: 0, // 後で振り直す
      divisionRank: "champion" as const,
      tier: "champion" as const,
      defenseCount: c.defenseCount,
      record: resolveRecord(c.slug, c.division, c.record),
      lastFight: c.lastFight,
      rankPositionDelta: null,
      internalScore: c.rawRating,
    })),
    ...challengerCandidates.map((c) => ({
      fighterId: c.slug,
      division: c.division,
      p4pRank: 0,
      divisionRank: c.divisionRank,
      tier: "challenger" as const,
      defenseCount: null,
      record: resolveRecord(c.slug, c.division, c.record),
      lastFight: c.lastFight,
      rankPositionDelta: null,
      internalScore: c.rawRating,
    })),
  ];
  // internalScore(clamp後rawRating)降順でソート。
  // 同点タイブレーク: clampは意図的に同点(直前値まで引き下げ)を作るため、
  // 同一階級内の同点をfighterId(アルファベット順)で解くと公開rank順が壊れ、
  // verifyDivisionOrderInvariantが破れる。まず階級内順位(王者は0扱い)昇順で
  // 解き、最後にfighterIdで完全決定的にする。
  const entries = combined.sort((a, b) => {
    if (b.internalScore !== a.internalScore) return b.internalScore - a.internalScore;
    const rankA = a.divisionRank === "champion" ? 0 : a.divisionRank;
    const rankB = b.divisionRank === "champion" ? 0 : b.divisionRank;
    if (rankA !== rankB) return rankA - rankB;
    return a.fighterId.localeCompare(b.fighterId);
  });
  entries.forEach((e, i) => {
    e.p4pRank = i + 1;
  });

  return {
    updatedAt: input.updatedAt,
    algorithmVersion: input.algorithmVersion,
    entries,
    defenseDataIssues,
    recordDataIssues,
  };
}

// ===== 自己検証(scripts/generate-p4p.ts側で呼び出し、破れたらexit 1) =====
//
// 2026-07-22最終: 「王者が先頭N件を占める」は撤回済み(王者ティアなし)。
// 「同一階級内のP4P順序が公開rank順と一致する」はclamp復活に伴い再導入した
// (下記3)。

// 1. rawRatingを算出できた王者が、全員entriesに含まれていること(位置は問わない)。
export function verifyAllChampionsPresent(file: P4PFile, expectedChampionSlugs: string[]): string[] {
  const errors: string[] = [];
  const presentSlugs = new Set(file.entries.filter((e) => e.tier === "champion").map((e) => e.fighterId));
  for (const slug of expectedChampionSlugs) {
    if (!presentSlugs.has(slug)) errors.push(`王者${slug}がentriesに存在しない(消失の疑い)`);
  }
  if (presentSlugs.size !== expectedChampionSlugs.length) {
    errors.push(`王者tierの件数が期待値と不一致(期待: ${expectedChampionSlugs.length} / 実際: ${presentSlugs.size})`);
  }
  return errors;
}

// 2. 非公開階級の選手が一切出ないこと(候補プールをPUBLISHED_DIVISIONSのみから
// 組み立てている以上構造的に満たすはずだが、将来の改修による混入を防ぐ最終防衛)。
export function verifyPublishedDivisionsOnly(file: P4PFile): string[] {
  const errors: string[] = [];
  for (const e of file.entries) {
    if (!PUBLISHED_DIVISIONS.includes(e.division)) {
      errors.push(`${e.fighterId}: 非公開階級(${e.division})のエントリが混入`);
    }
  }
  return errors;
}

// 3. 同一階級内のP4P順序 == 階級別公開rank順(逆転ゼロ)。clampが効いていれば
// 必ず満たされる。王者は公開rankを持たないため対象外。
export function verifyDivisionOrderInvariant(file: P4PFile): string[] {
  const errors: string[] = [];
  const byDivision = new Map<MnewsDivision, P4PEntry[]>();
  for (const e of file.entries) {
    if (e.tier === "champion") continue;
    if (!byDivision.has(e.division)) byDivision.set(e.division, []);
    byDivision.get(e.division)!.push(e);
  }
  for (const [division, list] of byDivision) {
    const byPublicRank = [...list].sort((a, b) => (a.divisionRank as number) - (b.divisionRank as number)).map((e) => e.fighterId);
    const byP4PRank = [...list].sort((a, b) => a.p4pRank - b.p4pRank).map((e) => e.fighterId);
    if (JSON.stringify(byPublicRank) !== JSON.stringify(byP4PRank)) {
      errors.push(`${division}: P4P順序が階級別公開rank順と不一致(clampが効いていない)`);
    }
  }
  return errors;
}
