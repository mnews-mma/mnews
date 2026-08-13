// パウンドフォーパウンド(P4P)ランキングの生成ロジック(2026-07-22追加)。
//
// 設計方針(2026-07-26改訂・現行): P4Pは「階級を超えた強さ」を1本に並べる指標。
// 評価軸は次の3つで、優先順位もこの順に強い。
//
// 1. 階級内順位は絶対(最優先)
//    同一階級では、必ず [王者 → 公開1位 → 公開2位 → …] の順を維持する。
//    P4Pが階級別ランキングと食い違うと、同じサイト内で矛盾した2つの序列を
//    出すことになるため。
//    衝突したときは「下位を引き下げる」のではなく「上位を引き上げる」
//    (enforceDivisionOrderByPullUp)。ここが設計の要で、例えばライト級では
//    元王者サトシ・ソウザ(戴冠+5度防衛)の実績スコアが公開1位ノジモフを
//    上回るが、このときサトシを削るのではなくノジモフ・グスタボを引き上げる。
//    → 「サトシがいる階級」全体の評価が上がる。ライト級上位陣が不当に低く
//      評価される問題が解消し、順位はグスタボ>ノジモフ>サトシのまま保たれる。
//    引き下げ方式(2026-07-22の完全clamp)だと、サトシの実績・レートが公開1位に
//    削られてP4P16位に沈み、ベルトを巻いたことのない他階級のランカーより
//    下になっていた。これが違和感の正体だった。
//
// 2. 王座実績(RIZIN王座戦での勝利 = 戴冠 + 防衛。鮮度で減衰させる)
//    P4Pは「その階級で最強を証明したか」を見る指標なので、ベルトを獲り
//    防衛した実績を明示的に加点する(TITLE_WIN_BONUS)。
//    これが無いと、一度もベルトを巻いていない選手(佐藤将光・トニー・ララミー・
//    元谷友貴・秋元強真・カルシャガ・ダウトベック等)が、5度防衛した元王者
//    サトシより上に来てしまう(2026-07-26に実データで発生していた)。
//    逆に元王者(井上直樹・クレベル・コイケ・扇久保博正)が上位に来るのは
//    この軸で自然に説明できる。
//    ただし実績は永久に同じ重みでは効かせない。半減期2年の指数減衰をかけ、
//    直近の防衛ほど重く、古い戴冠ほど軽くする(titleAchievements.tsの
//    TITLE_RECENCY_HALF_LIFE_YEARS)。減衰が無いと、3年前に一度ベルトを
//    巻いただけの選手の加点が、pull-upを通じて階級の上位陣まで押し上げて
//    しまう(実例: ヴガール・ケラモフ2023年の王座勝がダウトベック・秋元を、
//    鈴木千裕2023-24年の王座勝がYA-MANを不当に押し上げていた)。
//    王座実績は手書きの元王者リストではなく戦績データから機械的に導出する
//    (titleAchievements.ts参照 = 捏造ゼロ・今後のタイトル戦に自動追従)。
//
// 3. レート(rawRating: σディスカウント後のEloレート、正規化なし)
//    現在の強さの基礎点。階級内平均・σによる正規化(zスコア)は使わない。
//    理由: zスコアは「層の厚い階級ほど損をする」逆転を生む(フェザー級は
//    4階級中最も水準が高いため、王者シェイドゥラエフの絶対rawRatingは4王者中
//    最高なのに、zスコアでは3位に落ちていた)。rawRatingは階級を跨いだ1本の
//    Eloで計算されており(engine.tsのbuildBoutsは階級でフィルタしない)、
//    層の厚い階級で勝ち続けること自体が自然にレートを押し上げるため、
//    正規化しない絶対値の方が実感に合う。
//
// 最終スコア = rawRating + TITLE_WIN_BONUS × 鮮度減衰後のRIZIN王座実績値
//              → その後、階級内でpull-up補正(上記1)をかけて確定
//
// 撤回済みの設計(再導入しないこと):
// - 王者をP4P1〜4位に固定するティアロジック(2026-07-22撤回)。王座実績は
//   上記2の連続値で評価するため、固定枠は不要。
// - 階級内zスコア正規化(2026-07-22撤回、理由は上記3)。
// - 閾値付き部分clamp(P4P_DIVISION_ORDER_THRESHOLD、2026-07-26撤回)。
//   「レート差が閾値を超えたら階級内順位を逆転してよい」という設計だったが、
//   階級内順位を崩さずにサトシを正当に評価する方法(pull-up + 王座実績)が
//   見つかったため不要になった。閾値というマジックナンバーの調整も消えた。
// - 防衛回数(championDefenses.ts)・通算勝率による順位付け。データは
//   data/p4p.jsonに保持し続けるが順位・表示には使わない(将来の再利用に
//   備えた据え置き)。王座実績は上記2のとおり戦績データ由来の値を使う
//   (championDefenses.tsは現王者しか持たず元王者を表現できないため)。
//
// このモジュールはdata/rankings.json(既存Eloランキング)を読み取り専用の入力
// とし、data/rankings.json自体・engine.ts・共有定数には一切影響しない
// (P4P専用ロジックはこのファイルとscripts/generate-p4p.tsのみに閉じる)。
import { MnewsDivision, PUBLISHED_DIVISIONS } from "./divisions";
import { RankingsFile, RankingEntryRecord, divisionRankingsKey } from "./rankingsFile";
import { RANKING_DISPLAY_CAP } from "./divisionRankingView";
import { ChampionDefenseEntry } from "../championDefenses";
import type { TitleAchievement } from "./titleAchievements";

export type P4PTier = "champion" | "challenger";

export interface P4PRankPositionDelta {
  kind: "up" | "down" | "same" | "new";
  positions: number;
}

export interface P4PEntry {
  fighterId: string;
  division: MnewsDivision;
  p4pRank: number; // 1始まり、internalScore降順
  // 階級内位置(公開rank、王者は"champion")。「階級内順位は絶対」の入力として
  // pull-up補正と同点タイブレークの両方で使う(参考表示だけの値ではない)。
  divisionRank: number | "champion";
  tier: P4PTier;
  defenseCount: number | null; // 王者のみ。順位・表示ともに未使用(据え置き)。取得不能はnull(0埋め・推定禁止)
  record: RankingEntryRecord;
  lastFight: string | null;
  // buildP4PFileの時点ではnull。scripts/generate-p4p.tsがcomputeP4PRankPositionDeltas
  // で前回data/p4p.jsonとの差分を算出した後に埋める(rankPositionDelta.tsの
  // 既存の階級別ランキングと同じ「後処理として付与する」設計を踏襲)。
  rankPositionDelta: P4PRankPositionDelta | null;
  // RIZIN王座戦(タイトルマッチ・王座決定戦)での勝利数 = 戴冠 + 防衛。
  // 戦績データから機械的に導出した減衰なしの事実値(titleAchievements.ts)。
  // 将来的な画面表示(「元王者」バッジ等)にも再利用できる。
  titleWins: number;
  // 鮮度減衰(半減期TITLE_RECENCY_HALF_LIFE_YEARS年)をかけた王座実績値。
  // 順位計算に実際に使うのはこちら(古い戴冠は軽くなる)。
  titleValue: number;
  // 直近の王座戦勝利日(無ければnull)。表示・デバッグ用。
  lastTitleWin: string | null;
  // 内部専用フィールド(次回実行時のdelta計算にのみ使う、公開ページには出さない)。
  // rawRating + TITLE_WIN_BONUS×titleValue に階級内pull-up補正をかけた最終値。
  // これがP4P順位を決める唯一の値。
  internalScore: number;
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

// 王座実績1件(直近の戴冠 または 防衛1回、減衰前)あたりの加点。
// 実際の加点は TITLE_WIN_BONUS × 鮮度減衰後の実績値(titleValue)。
//
// 値の選定(15): 実データ(2026-07-26)で以下を全て満たす範囲から選んだ。
//  - 元王者サトシ(RIZIN王座戦6勝)が、ベルト未経験のランカー(佐藤将光・
//    トニー・ララミー・元谷友貴・秋元強真・カルシャガ・ダウトベック)より
//    確実に上に来る
//  - 3連続防衛中のダニー・サバテロ(直近3勝)が、1勝のみのルイス・グスタボより
//    上に来る(鮮度減衰と組み合わせて成立する)
//  - サトシの実績でライト級全体が引き上がり、グスタボ>ノジモフ>サトシの
//    階級内順位は保たれる(これはpull-upにより構造的に保証される)
//  - 無敗の現王者シェイドゥラエフ(直近4勝)がP4P1位を維持する
// 感覚的には「直近の王座戦1勝 ≒ 15レート分の価値」と読める。
export const TITLE_WIN_BONUS = 15;

// 階級内順位の絶対優先(pull-up方式)。
//
// 同一階級を [王者(0) → 公開1位 → 公開2位 → …] の順に見て、下位から上へ
// 走査しながら「自分より下にいる誰よりも低いスコアにはならない」ように
// 床(floor)を引き上げていく。結果、階級内のスコアは必ず単調非増加になり、
// P4Pの並びが階級別ランキングの並びと完全に一致する。
//
// なぜ引き下げ(clamp)ではなく引き上げ(pull-up)なのか:
//   引き下げ方式では、階級内の下位に突出した選手(実績・レートの高い元王者)が
//   いると、その選手のスコアが上位ランカーの水準まで削られる。つまり
//   「強い選手がいる階級ほど、その選手を評価できない」という逆進性が出る。
//   実例(2026-07-26): 元王者サトシ(戴冠+5度防衛、生レートは公開1位より上)が
//   公開1位ノジモフまで削られてP4P16位まで沈み、ベルト未経験の他階級ランカーの
//   下に来ていた。引き上げなら、サトシの実績はサトシ自身に残したまま、同じ
//   階級の上位陣(ノジモフ・グスタボ)を「その実績者より上にいる者」として
//   一緒に引き上げられる。「強い元王者を擁する階級は格が高い」という直感にも合う。
export function enforceDivisionOrderByPullUp<
  T extends { division: MnewsDivision; divisionPosition: number; score: number }
>(candidates: T[]): T[] {
  const byDivision = new Map<MnewsDivision, T[]>();
  for (const c of candidates) {
    if (!byDivision.has(c.division)) byDivision.set(c.division, []);
    byDivision.get(c.division)!.push(c);
  }
  const out: T[] = [];
  for (const [, list] of byDivision) {
    // 王者(0) → 公開1位 → 公開2位 … に整列し、下位から上へ床を上げていく。
    const byPositionAsc = [...list].sort((a, b) => a.divisionPosition - b.divisionPosition);
    let floor = -Infinity;
    for (let i = byPositionAsc.length - 1; i >= 0; i--) {
      const c = byPositionAsc[i];
      floor = Math.max(floor, c.score);
      out.push({ ...c, score: floor } as T);
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
    // 2026-08-13追加: 前回時点でRANKING_DISPLAY_CAP(P4P公開順位の上限)より
    // 下だった場合もNEW扱いにする(rankPositionDelta.tsのcomputeRankPositionDeltas
    // と同じ理由。読者は前回、非公開の順位番号を見ていないため)。
    if (prevRank === undefined || prevRank > RANKING_DISPLAY_CAP) {
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
  // slug -> RIZIN王座実績(勝利数と鮮度減衰後の実績値)。scripts/generate-p4p.ts
  // 側で data/fighterRecords.json から buildTitleAchievementIndex
  // (titleAchievements.ts)を使って導出したものを渡す。索引に無いslugは0扱い
  // (王座戦の記録が無い=未戴冠、という素直な解釈。捏造ではなく実データの
  // 不在をそのまま反映する)。
  titleAchievementsBySlug: Map<string, TitleAchievement>;
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

// 階級内pull-up前の、スコア付き候補(王者+挑戦者を同じ土俵に載せた中間表現)。
interface ScoredCandidate {
  fighterId: string;
  division: MnewsDivision;
  divisionPosition: number; // 0=王者、1..n=階級別公開rank(pull-upと同点解決に使う)
  divisionRank: number | "champion"; // 出力用の表現
  tier: P4PTier;
  defenseCount: number | null;
  record: RankingEntryRecord;
  lastFight: string | null;
  titleWins: number;
  titleValue: number;
  lastTitleWin: string | null;
  score: number;
}

// P4Pファイル本体を構築する(冒頭の設計方針コメント参照)。
// スコア = rawRating + TITLE_WIN_BONUS×王座戦勝利数 → 階級内pull-up補正で確定。
export function buildP4PFile(input: BuildP4PFileInput): P4PFile {
  const challengerCandidates = collectChallengerCandidates(input.rankings);
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

  // 王座実績は索引に無ければ0(=王座戦の記録が無い=未戴冠)として扱う。
  const NO_TITLE: TitleAchievement = { wins: 0, value: 0, lastTitleWin: null };
  const titleOf = (slug: string): TitleAchievement => input.titleAchievementsBySlug.get(slug) ?? NO_TITLE;

  // 王者(divisionPosition=0)と挑戦者(公開rank)を1つのプールにまとめ、
  // スコア = rawRating + TITLE_WIN_BONUS×鮮度減衰後の王座実績値 を与える。
  const scored: ScoredCandidate[] = [
    ...champions.map((c) => {
      const t = titleOf(c.slug);
      return {
        fighterId: c.slug,
        division: c.division,
        divisionPosition: 0,
        divisionRank: "champion" as const,
        tier: "champion" as P4PTier,
        defenseCount: c.defenseCount,
        record: resolveRecord(c.slug, c.division, c.record),
        lastFight: c.lastFight,
        titleWins: t.wins,
        titleValue: t.value,
        lastTitleWin: t.lastTitleWin,
        score: c.rawRating + TITLE_WIN_BONUS * t.value,
      };
    }),
    ...challengerCandidates.map((c) => {
      const t = titleOf(c.slug);
      return {
        fighterId: c.slug,
        division: c.division,
        divisionPosition: c.divisionRank,
        divisionRank: c.divisionRank,
        tier: "challenger" as P4PTier,
        defenseCount: null,
        record: resolveRecord(c.slug, c.division, c.record),
        lastFight: c.lastFight,
        titleWins: t.wins,
        titleValue: t.value,
        lastTitleWin: t.lastTitleWin,
        score: c.rawRating + TITLE_WIN_BONUS * t.value,
      };
    }),
  ];

  // 階級内順位は絶対: 下位に突出した選手がいる場合は上位を引き上げて順序を守る。
  const lifted = enforceDivisionOrderByPullUp(scored);

  // スコア降順でソート。pull-upは意図的に同点(階級内で床を共有する)を作るため、
  // 同点は必ず階級内位置(王者=0)昇順で解く。ここをfighterId順で解くと階級内の
  // 順序が壊れ、verifyDivisionOrderInvariantが破れる。最後にfighterIdで
  // 完全決定的にする(2回実行の出力一致=決定性チェックのため)。
  const entries: P4PEntry[] = [...lifted]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.divisionPosition !== b.divisionPosition) return a.divisionPosition - b.divisionPosition;
      return a.fighterId.localeCompare(b.fighterId);
    })
    .map((e, i) => ({
      fighterId: e.fighterId,
      division: e.division,
      p4pRank: i + 1,
      divisionRank: e.divisionRank,
      tier: e.tier,
      defenseCount: e.defenseCount,
      record: e.record,
      lastFight: e.lastFight,
      rankPositionDelta: null,
      titleWins: e.titleWins,
      titleValue: e.titleValue,
      lastTitleWin: e.lastTitleWin,
      internalScore: e.score,
    }));

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
// 2026-07-22: 「王者が先頭N件を占める」は撤回済み(王者ティア固定なし)。
// 2026-07-26: 「階級内順位は絶対」を設計の最優先ルールに据えたため、
// verifyDivisionOrderInvariantを王者込みの完全版として復活させた(下記3)。
// あわせてrequiredInvariants.tsのcheckP4PH2HRespect(P4Pが直接対決の結果と
// 矛盾しないこと)も併用する。3が守られていればH2H整合は同一階級内では
// 自動的に従うが、独立した最終防衛として両方を回す。

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

// 3. 各階級内のP4P順序が [王者 → 公開1位 → 公開2位 → …] と完全一致すること。
//    設計上の最優先ルール「階級内順位は絶対」を機械的に強制する。
//
// 実装から独立した検証であることが重要: 判定に使うのはpull-up後の最終成果物
// (P4PEntry.p4pRank と divisionRank)だけで、スコアの中身・TITLE_WIN_BONUS・
// pull-up関数の内部状態には一切触れない。
// この独立性は過去の事故の教訓による(2026-07-25): 旧実装は検証側でもclampと
// 同じ閾値ロジックを共有していたため、clamp本体の境界バグ(threshold=0で挙動が
// 反転する不具合)を検証がすり抜け、人力の突き合わせで初めて発覚した。
// 「補正が届く範囲」と「検証が届く範囲」を同一にしない、という原則
// (requiredInvariants.ts冒頭コメント参照)をここでも守る。
export function verifyDivisionOrderInvariant(file: P4PFile): string[] {
  const errors: string[] = [];
  const byDivision = new Map<MnewsDivision, P4PEntry[]>();
  for (const e of file.entries) {
    if (!byDivision.has(e.division)) byDivision.set(e.division, []);
    byDivision.get(e.division)!.push(e);
  }
  const positionOf = (e: P4PEntry): number => (e.divisionRank === "champion" ? 0 : e.divisionRank);
  for (const [division, list] of byDivision) {
    const expected = [...list].sort((a, b) => positionOf(a) - positionOf(b)).map((e) => e.fighterId);
    const actual = [...list].sort((a, b) => a.p4pRank - b.p4pRank).map((e) => e.fighterId);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      errors.push(
        `${division}: P4P順序が階級別ランキングの並びと不一致: 期待(王者→1位→2位…)=[${expected.join(",")}] / 実際(P4P順)=[${actual.join(",")}]`
      );
    }
  }
  return errors;
}
