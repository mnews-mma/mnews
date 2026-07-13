// mnewsレーティング エンジンのユニットテスト。
// リポジトリに既存のテストフレームワークが無いため(check-fighter-records-integrity.ts
// と同じ流儀で)tsxで直接実行するassertベースのスクリプトにしている。
// 実行: npx tsx scripts/test-mnews-rating.ts
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  computeScopedRecord,
  filterPublishableStates,
  isEligible,
  applyInactivityDecay,
  FighterRecordsInput,
  RatingState,
  AsymmetricEloParams,
  NEUTRAL_ELO_PARAMS,
} from "../src/lib/mnewsRating/engine";
import {
  ALGORITHM_VERSION,
  DECAY_FLOOR,
  ELIGIBILITY_RECENT_MIN_FIGHTS,
  ELIGIBILITY_RECENT_YEAR_START,
} from "../src/lib/mnewsRating/constants";
import {
  buildDivisionRankings,
  hasRankingChange,
  shouldSuppressDelta,
  roundToDisplayStep,
  DivisionRankings,
  ChampionOverlay,
} from "../src/lib/mnewsRating/rankingsFile";
import { applyRecordOverrides, applyRecordOverridesToTotals } from "../src/lib/mnewsRating/recordOverrides";
import {
  getDivisionRankingView,
  getPublishedDivisionRankingView,
  toClientSafeDivisionRankingView,
} from "../src/lib/mnewsRating/divisionRankingView";
import { PUBLISHED_DIVISIONS, latestRizinDivision, isNominallyWomensDivision, MnewsDivision } from "../src/lib/mnewsRating/divisions";
import { getDivisionOverlay } from "../src/lib/mnewsRating/fighterDivisions";
import {
  FighterBoutSummary,
  computeEligibilityFightsAndWins,
  detectDivisionChangeCutoff,
  findRankerWinExemptions,
  isStandardEligible,
  summarizeBoutsForFighter,
} from "../src/lib/mnewsRating/eligibilityRules";
import { Bout } from "../src/lib/mnewsRating/engine";

let failures = 0;
let passes = 0;

function check(cond: boolean, label: string) {
  if (cond) {
    passes++;
  } else {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

function near(actual: number, expected: number, tolerance = 0.05) {
  return Math.abs(actual - expected) <= tolerance;
}

// 簡易resolver: テストfixture内でしか使わない名前→slugマップ。
function makeResolver(map: Record<string, string>) {
  return (opponentName: string) => map[opponentName] ?? null;
}

// ── 1. 基本の勝敗レート移動(判定, K=32) ─────────────────────────────
{
  const records: FighterRecordsInput = {
    "fighter-a": {
      history: [{ date: "2026-01-01", opponent: "選手B", result: "win", method: "5分3R終了 判定3-0", event: "RIZIN.99" }],
    },
    "fighter-b": {
      history: [{ date: "2026-01-01", opponent: "選手A", result: "loss", method: "5分3R終了 判定0-3", event: "RIZIN.99" }],
    },
  };
  const resolve = makeResolver({ 選手A: "fighter-a", 選手B: "fighter-b" });
  const { bouts, warnings } = buildBouts(records, resolve);
  check(bouts.length === 1, "基本レート移動: DB内対決が重複排除され1件になる");
  check(warnings.length === 0, "基本レート移動: warningが出ない");

  const states = computeRawRatings(bouts);
  const a = states.get("fighter-a")!;
  const b = states.get("fighter-b")!;
  // 同レート同士(1500 vs 1500)の判定勝ち: expected=0.5, K=32 → ±16
  check(near(a.rawRating, 1516), `基本レート移動: 勝者rawRating≈1516 (got ${a.rawRating})`);
  check(near(b.rawRating, 1484), `基本レート移動: 敗者rawRating≈1484 (got ${b.rawRating})`);
  check(a.wins === 1 && a.losses === 0, "基本レート移動: 勝者の戦績が1-0-0");
  check(b.losses === 1 && b.wins === 0, "基本レート移動: 敗者の戦績が0-1-0");
}

// ── 2. フィニッシュボーナス K=40 ──────────────────────────────────
{
  const records: FighterRecordsInput = {
    "fighter-c": {
      history: [{ date: "2026-02-01", opponent: "選手D", result: "win", method: "1R 1:08 KO（右ストレート）", event: "RIZIN.100" }],
    },
    "fighter-d": {
      history: [{ date: "2026-02-01", opponent: "選手C", result: "loss", method: "1R 1:08 KO負け（右ストレート）", event: "RIZIN.100" }],
    },
  };
  const resolve = makeResolver({ 選手C: "fighter-c", 選手D: "fighter-d" });
  const { bouts } = buildBouts(records, resolve);
  check(bouts[0].finish === true, "フィニッシュボーナス: KOがfinish=trueと判定される");

  const states = computeRawRatings(bouts);
  const c = states.get("fighter-c")!;
  const d = states.get("fighter-d")!;
  // K=40, expected=0.5 → ±20
  check(near(c.rawRating, 1520), `フィニッシュボーナス: 勝者rawRating≈1520 (got ${c.rawRating})`);
  check(near(d.rawRating, 1480), `フィニッシュボーナス: 敗者rawRating≈1480 (got ${d.rawRating})`);

  // 一本勝ち(技名のみ・KOでも判定でもない)も finish 扱いになること
  const subRecords: FighterRecordsInput = {
    "fighter-e": {
      history: [{ date: "2026-02-02", opponent: "選手F", result: "win", method: "2R 3:44 リアネイキッドチョーク", event: "RIZIN.101" }],
    },
    "fighter-f": {
      history: [{ date: "2026-02-02", opponent: "選手E", result: "loss", method: "2R 3:44 一本負け", event: "RIZIN.101" }],
    },
  };
  const subResolve = makeResolver({ 選手E: "fighter-e", 選手F: "fighter-f" });
  const subBouts = buildBouts(subRecords, subResolve).bouts;
  check(subBouts[0].finish === true, "フィニッシュボーナス: 技名のみの一本勝ちもfinish=trueと判定される");
}

// ── 3. ドロー ───────────────────────────────────────────────────
{
  const records: FighterRecordsInput = {
    "fighter-g": {
      history: [{ date: "2026-03-01", opponent: "選手H", result: "draw", method: "5分3R終了 判定1-1-1", event: "RIZIN.102" }],
    },
    "fighter-h": {
      history: [{ date: "2026-03-01", opponent: "選手G", result: "draw", method: "5分3R終了 判定1-1-1", event: "RIZIN.102" }],
    },
  };
  const resolve = makeResolver({ 選手G: "fighter-g", 選手H: "fighter-h" });
  const { bouts } = buildBouts(records, resolve);
  const states = computeRawRatings(bouts);
  const g = states.get("fighter-g")!;
  const h = states.get("fighter-h")!;
  // 同レート同士のドロー: expected=0.5, score=0.5 → 変動なし
  check(near(g.rawRating, 1500), `ドロー: 互角の相手とのドローはレート変動なし (got ${g.rawRating})`);
  check(near(h.rawRating, 1500), `ドロー: 互角の相手とのドローはレート変動なし (got ${h.rawRating})`);
  check(g.draws === 1 && h.draws === 1, "ドロー: 両者の戦績にdrawが1つ記録される");
}

// ── 4. ノーコンテスト ────────────────────────────────────────────
{
  const records: FighterRecordsInput = {
    "fighter-i": {
      history: [{ date: "2026-04-01", opponent: "選手J", result: "nc", method: "1R 反則（頭突き）ノーコンテスト", event: "RIZIN.103" }],
    },
  };
  const resolve = makeResolver({});
  const { bouts, warnings } = buildBouts(records, resolve);
  check(bouts.length === 0, "ノーコンテスト: 対戦として計上されない");
  check(warnings.length === 0, "ノーコンテスト: warningとしても計上されない(正常な除外)");
  const states = computeRawRatings(bouts);
  check(!states.has("fighter-i"), "ノーコンテスト: レート状態が一切生成されない(変動なし)");
}

// ── 5. 不活性ディケイ(表示のみ・rawRatingは不変) ───────────────────
{
  const asOf = new Date("2026-07-11T00:00:00Z");
  const lastFight400daysAgo = new Date(asOf.getTime() - 400 * 86400000).toISOString().slice(0, 10);
  const raw = 1600;
  const decayed = applyInactivityDecay(raw, lastFight400daysAgo, asOf);
  // 400日 / 180日 = 2期 → -50
  check(near(decayed, 1550), `不活性ディケイ: 400日不活性で-50 (got ${decayed})`);

  const veryOld = new Date(asOf.getTime() - 5 * 365 * 86400000).toISOString().slice(0, 10);
  const decayedFloor = applyInactivityDecay(1450, veryOld, asOf);
  check(decayedFloor === DECAY_FLOOR, `不活性ディケイ: 下限${DECAY_FLOOR}を下回らない (got ${decayedFloor})`);

  const states = new Map<string, RatingState>([
    ["fighter-k", { rawRating: raw, fights: 3, wins: 2, losses: 1, draws: 0, lastFightDate: lastFight400daysAgo }],
  ]);
  const displayNow = buildDisplayEntries(states, asOf);
  // +200日: 400日→600日で不活性期間が2期(360日)から3期(540日)に進み、確実にdisplayRatingが動く
  const displayLater = buildDisplayEntries(states, new Date(asOf.getTime() + 200 * 86400000));
  check(displayNow.get("fighter-k")!.rawRating === raw, "不活性ディケイ: displayRating計算後もrawRatingは元の値のまま");
  check(
    displayNow.get("fighter-k")!.rawRating === displayLater.get("fighter-k")!.rawRating,
    "不活性ディケイ: asOfを変えてもrawRatingは変化しない(displayRatingのみ変化)"
  );
  check(
    displayNow.get("fighter-k")!.displayRating !== displayLater.get("fighter-k")!.displayRating,
    "不活性ディケイ: asOfが進むとdisplayRatingは変化する"
  );
}

// ── 6. 掲載資格フィルタ ───────────────────────────────────────────
{
  const asOf = new Date("2026-07-11T00:00:00Z");
  const recent = "2026-06-01";
  const twentyMonthsAgo = new Date(asOf.getTime() - 20 * 30.44 * 86400000).toISOString().slice(0, 10);

  const tooFewFights: RatingState = { rawRating: 1500, fights: 2, wins: 2, losses: 0, draws: 0, lastFightDate: recent };
  check(!isEligible(tooFewFights, asOf), "掲載資格: 3戦未満は資格なし");

  const inactive: RatingState = { rawRating: 1500, fights: 3, wins: 2, losses: 1, draws: 0, lastFightDate: twentyMonthsAgo };
  check(!isEligible(inactive, asOf), "掲載資格: 直近18ヶ月以内に試合が無いと資格なし");

  const noWins: RatingState = { rawRating: 1450, fights: 3, wins: 0, losses: 2, draws: 1, lastFightDate: recent };
  check(!isEligible(noWins, asOf), "掲載資格: 1勝もしていないと資格なし");

  const ok: RatingState = { rawRating: 1520, fights: 3, wins: 1, losses: 2, draws: 0, lastFightDate: recent };
  check(isEligible(ok, asOf), "掲載資格: 3戦以上・直近18ヶ月以内・1勝以上を満たせば資格あり");
}

// ── 7. 自社DB圏外の相手は正規化名で永続トラッキングされる(毎回1500へ戻らない) ──
{
  const records: FighterRecordsInput = {
    "fighter-w1": {
      history: [{ date: "2026-01-01", opponent: "無名選手", result: "win", method: "1R 1:08 KO（右ストレート）", event: "RIZIN.200" }],
    },
    "fighter-w2": {
      history: [{ date: "2026-02-01", opponent: "無名選手", result: "win", method: "1R 1:08 KO（右ストレート）", event: "RIZIN.201" }],
    },
  };
  const resolve = makeResolver({});
  const { bouts } = buildBouts(records, resolve);
  check(bouts.length === 2, "圏外相手の永続トラッキング: 同名相手への2試合が両方対戦として計上される");
  check(bouts[0].bNode === bouts[1].bNode, "圏外相手の永続トラッキング: 同じ正規化名は同一の疑似ノードに解決される");

  const states = computeRawRatings(bouts);
  const wall = states.get(bouts[0].bNode)!;
  check(wall.fights === 2 && wall.losses === 2, "圏外相手の永続トラッキング: 疑似ノードも2敗として状態が蓄積される");
  // 2戦目の相手(fighter-w2)は、1敗して下がった後の相手レートを見ているため
  // 1戦目の相手(fighter-w1)より得られるレートが少ない(=フレッシュな1500を毎回
  // 狩れる歪みが解消されている)。
  const w1 = states.get("fighter-w1")!;
  const w2 = states.get("fighter-w2")!;
  check(w1.rawRating > w2.rawRating, "圏外相手の永続トラッキング: 2人目の挑戦者は目減りした相手レートしか得られない");

  const records2: FighterRecordsInput = JSON.parse(JSON.stringify(records));
  const publishable = filterPublishableStates(computeRawRatings(buildBouts(records2, resolve).bouts), records2);
  check(!publishable.has(bouts[0].bNode), "圏外相手の永続トラッキング: 疑似ノードはfilterPublishableStatesで公開対象から除外される");
  check(publishable.has("fighter-w1") && publishable.has("fighter-w2"), "圏外相手の永続トラッキング: 実在選手は公開対象に残る");
}

// ── 8. DB内対決の勝敗矛盾は自動判定せず除外する ──────────────────────
{
  const records: FighterRecordsInput = {
    "fighter-x": {
      history: [{ date: "2026-03-01", opponent: "選手Y", result: "win", method: "5分3R終了 判定3-0", event: "RIZIN.210" }],
    },
    "fighter-y": {
      // 同一試合について、自分も勝ったと記録している(矛盾)
      history: [{ date: "2026-03-01", opponent: "選手X", result: "win", method: "5分3R終了 判定3-0", event: "RIZIN.210" }],
    },
  };
  const resolve = makeResolver({ 選手X: "fighter-x", 選手Y: "fighter-y" });
  const { bouts, warnings } = buildBouts(records, resolve);
  check(bouts.length === 0, "勝敗矛盾: 双方が「勝った」と記録している対戦は計算対象から除外される");
  check(
    warnings.some((w) => w.reason.includes("矛盾")),
    "勝敗矛盾: 除外理由がwarningとして出力される"
  );

  // 決着種別だけが食い違う場合(勝敗の方向は一致)は除外せずK=32側に倒す
  const records2: FighterRecordsInput = {
    "fighter-p": {
      history: [{ date: "2026-04-01", opponent: "選手Q", result: "win", method: "1R 1:08 KO（右ストレート）", event: "RIZIN.211" }],
    },
    "fighter-q": {
      history: [{ date: "2026-04-01", opponent: "選手P", result: "loss", method: "5分3R終了 判定0-3", event: "RIZIN.211" }],
    },
  };
  const resolve2 = makeResolver({ 選手P: "fighter-p", 選手Q: "fighter-q" });
  const { bouts: bouts2, warnings: warnings2 } = buildBouts(records2, resolve2);
  check(bouts2.length === 1, "決着種別の食い違い: 勝敗が一致していれば除外せず1件として残す");
  check(bouts2[0].finish === false, "決着種別の食い違い: 保守的に判定(K=32)側へ倒す");
  check(
    warnings2.some((w) => w.reason.includes("決着種別")),
    "決着種別の食い違い: 食い違いがwarningとして出力される"
  );
}

// ── 9. 冪等性(同じ入力→同じ出力。rawRatingはバッチ実行日に依存しない) ──
{
  const records: FighterRecordsInput = {
    "fighter-a": {
      history: [
        { date: "2026-01-01", opponent: "選手B", result: "win", method: "5分3R終了 判定3-0", event: "RIZIN.99" },
        { date: "2026-05-01", opponent: "選手C", result: "win", method: "1R 1:08 KO（右ストレート）", event: "RIZIN.104" },
      ],
    },
    "fighter-b": {
      history: [{ date: "2026-01-01", opponent: "選手A", result: "loss", method: "5分3R終了 判定0-3", event: "RIZIN.99" }],
    },
    "fighter-c": {
      history: [{ date: "2026-05-01", opponent: "選手A", result: "loss", method: "1R 1:08 KO負け（右ストレート）", event: "RIZIN.104" }],
    },
  };
  const resolve = makeResolver({ 選手A: "fighter-a", 選手B: "fighter-b", 選手C: "fighter-c" });

  const run = () => {
    const parsed: FighterRecordsInput = JSON.parse(JSON.stringify(records));
    const { bouts } = buildBouts(parsed, resolve);
    const states = computeRawRatings(bouts);
    return [...states.entries()].sort(([s1], [s2]) => (s1 < s2 ? -1 : 1));
  };

  const run1 = run();
  const run2 = run();
  check(JSON.stringify(run1) === JSON.stringify(run2), "冪等性: 同じ入力を2回計算しても結果が一致する");

  // asOfを変えてもrawRatingそのもの(=計算結果)は不変であることの確認
  const states1 = new Map(run1);
  const d1 = buildDisplayEntries(states1, new Date("2026-07-11"));
  const d2 = buildDisplayEntries(states1, new Date("2027-01-01"));
  check(
    d1.get("fighter-a")!.rawRating === d2.get("fighter-a")!.rawRating,
    "冪等性: rawRatingはバッチ実行日(asOf)に依存しない"
  );
}

// ── 10. rankings.json組み立て(delta算出・アーカイブ要否判定) ────────────
{
  const asOf1 = new Date("2026-01-01");
  const eligible1 = [
    {
      meta: { slug: "fighter-r1", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-r1", rawRating: 1600, displayRating: 1600, fights: 5, wins: 4, losses: 1, draws: 0, lastFightDate: "2025-12-01", eligible: true },
    },
    {
      meta: { slug: "fighter-r2", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-r2", rawRating: 1550, displayRating: 1550, fights: 4, wins: 3, losses: 1, draws: 0, lastFightDate: "2025-11-01", eligible: true },
    },
  ];
  const first = buildDivisionRankings("フェザー級", eligible1, asOf1, undefined, null);
  check(first.entries[0].fighterId === "fighter-r1" && first.entries[0].rank === 1, "rankings組み立て: レート降順で1位が決まる");
  check(first.entries.every((e) => e.delta === null), "rankings組み立て: 前回データが無い初回はdeltaがnull");
  check(hasRankingChange(first, undefined), "rankings組み立て: 初回公開もアーカイブ対象(変動ありとみなす)");

  // 2回目: r1が上昇・r2が変わらず・新顔r3が追加
  const asOf2 = new Date("2026-01-02");
  const eligible2 = [
    { ...eligible1[0], display: { ...eligible1[0].display, rawRating: 1620, displayRating: 1620 } },
    eligible1[1],
    {
      meta: { slug: "fighter-r3", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-r3", rawRating: 1500, displayRating: 1500, fights: 3, wins: 1, losses: 2, draws: 0, lastFightDate: "2025-10-01", eligible: true },
    },
  ];
  const second = buildDivisionRankings("フェザー級", eligible2, asOf2, first, null);
  const r1 = second.entries.find((e) => e.fighterId === "fighter-r1")!;
  const r2 = second.entries.find((e) => e.fighterId === "fighter-r2")!;
  const r3 = second.entries.find((e) => e.fighterId === "fighter-r3")!;
  check(r1.delta === 20, `rankings組み立て: 前回比deltaが正しく算出される (got ${r1.delta})`);
  check(r2.delta === 0, "rankings組み立て: レート据え置きはdelta=0");
  check(r3.delta === null, "rankings組み立て: 新規掲載選手はdelta=null");
  check(hasRankingChange(second, first), "rankings組み立て: 顔ぶれ・レートが変われば変動ありと判定される");

  // 3回目: 完全に同じ顔ぶれ・同じレート → 変動なし
  const third = buildDivisionRankings("フェザー級", eligible2, new Date("2026-01-03"), second, null);
  check(!hasRankingChange(third, second), "rankings組み立て: 顔ぶれ・レートが完全に同一なら変動なしと判定される");
}

// ── 11. 王者の事実オーバーレイ(F) ──────────────────────────────────
{
  const asOf = new Date("2026-01-01");
  const pool = [
    {
      meta: { slug: "champ", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "champ", rawRating: 1650, displayRating: 1650, fights: 7, wins: 7, losses: 0, draws: 0, lastFightDate: "2025-12-01", eligible: true },
    },
    {
      meta: { slug: "challenger-1", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "challenger-1", rawRating: 1600, displayRating: 1600, fights: 8, wins: 7, losses: 1, draws: 0, lastFightDate: "2025-11-01", eligible: true },
    },
  ];
  const champion: ChampionOverlay = { fighterId: "champ", rating: 1650, record: { wins: 7, losses: 0, draws: 0 }, lastFight: "2025-12-01" };

  const overlay = buildDivisionRankings("フェザー級", pool, asOf, undefined, champion, "overlay");
  check(!overlay.entries.some((e) => e.fighterId === "champ"), "王者オーバーレイ: overlayモードでは王者が番号付きentriesから除外される");
  check(overlay.entries[0].fighterId === "challenger-1" && overlay.entries[0].rank === 1, "王者オーバーレイ: 除外後の1位は次点選手になる");
  check(overlay.champion?.fighterId === "champ", "王者オーバーレイ: championフィールドに王者が設定される");
  check(!("delta" in (overlay.champion as object)), "王者オーバーレイ: champion情報にdeltaフィールド自体が存在しない(表示側は常に—)");

  const badge = buildDivisionRankings("フェザー級", pool, asOf, undefined, champion, "badge");
  check(badge.entries.some((e) => e.fighterId === "champ"), "王者オーバーレイ: badgeモードでは王者もentriesに残る(切替が機能)");
  check(badge.entries.find((e) => e.fighterId === "champ")?.isChampion === true, "王者オーバーレイ: badgeモードではisChampionフラグが立つ");
  check(badge.champion === null, "王者オーバーレイ: badgeモードではchampionフィールドは使わない(null)");

  // 王者がElo掲載資格を満たさない(3戦未満)・レート未算出でも事実として表示する
  const noEloChampion: ChampionOverlay = { fighterId: "champ-no-data", rating: null, record: null, lastFight: null };
  const overlayNoData = buildDivisionRankings("フェザー級", pool, asOf, undefined, noEloChampion, "overlay");
  check(
    overlayNoData.champion?.fighterId === "champ-no-data" && overlayNoData.champion.rating === null,
    "王者オーバーレイ: Eloデータが無い王者でも事実(名前)としてchampionに設定される"
  );
}

// ── 12. algorithmVersion変更日のdelta一律抑制(C-3) ───────────────────
{
  const pool = [
    {
      meta: { slug: "fighter-v1", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-v1", rawRating: 1550, displayRating: 1550, fights: 5, wins: 3, losses: 2, draws: 0, lastFightDate: "2026-01-01", eligible: true },
    },
  ];
  const prevSameVersion: DivisionRankings = {
    division: "フェザー級",
    updatedAt: "2025-12-31T00:00:00.000Z",
    algorithmVersion: ALGORITHM_VERSION,
    champion: null,
    entries: [{ fighterId: "fighter-v1", rank: 1, rating: 1500, rawRating: 1500, delta: 0, record: { wins: 3, losses: 2, draws: 0 }, lastFight: "2025-12-01", weighInMiss: false }],
  };
  const sameVersionResult = buildDivisionRankings("フェザー級", pool, new Date("2026-01-02"), prevSameVersion, null);
  check(sameVersionResult.entries[0].delta === 50, `バージョン不変日: 通常どおりdeltaが算出される (got ${sameVersionResult.entries[0].delta})`);

  const prevOldVersion: DivisionRankings = { ...prevSameVersion, algorithmVersion: ALGORITHM_VERSION - 1 };
  check(shouldSuppressDelta(prevOldVersion), "delta抑制: algorithmVersionが前回と異なればshouldSuppressDeltaがtrue");
  check(!shouldSuppressDelta(prevSameVersion), "delta抑制: algorithmVersionが同じならfalse");
  check(!shouldSuppressDelta(undefined), "delta抑制: 前回データが無い(初回)場合はfalse(通常のnull初回扱いに任せる)");

  const versionChangedResult = buildDivisionRankings("フェザー級", pool, new Date("2026-01-02"), prevOldVersion, null);
  check(versionChangedResult.entries[0].delta === null, "delta抑制: algorithmVersion変更日はdeltaがnullに抑制される(前回データがあっても)");
  check(hasRankingChange(versionChangedResult, prevOldVersion), "delta抑制: バージョン変更日は顔ぶれ・レート不変でもアーカイブ対象とみなす");
}

// ── 13. 戦績訂正オーバーライド(H): 実際のYA-MAN訂正で3勝2敗になる ────────
{
  const historyWithoutDebut = [
    { date: "2023-12-31", opponent: "平本蓮", result: "loss" as const, method: "5分3R終了 判定0-3", event: "RIZIN.45", round: "R3" },
    { date: "2024-07-28", opponent: "鈴木博昭", result: "win" as const, method: "1R 3:28 KO（左フック）", event: "超RIZIN.3", round: "R1" },
    { date: "2024-12-31", opponent: "カルシャガ・ダウトベック", result: "loss" as const, method: "5分3R終了 判定0-3", event: "RIZIN.49", round: "R3" },
    { date: "2025-07-27", opponent: "金原正徳", result: "win" as const, method: "3R 2:51 TKO（右アッパー→パウンド）", event: "超RIZIN.4 真夏の喧嘩祭り", round: "R3" },
  ];
  const corrected = applyRecordOverrides("ya-man", historyWithoutDebut);
  check(corrected.length === 5, `戦績訂正オーバーライド: YA-MANのデビュー戦bout追加で5戦になる (got ${corrected.length})`);
  check(
    corrected.some((h) => h.date === "2023-05-06" && h.opponent === "三浦孝太" && h.result === "win"),
    "戦績訂正オーバーライド: 追加されたboutの内容が正しい(出典付き)"
  );

  // 通算戦績(集計値)はhistoryの都度カウントでは導出しない(GAMMA戦績混入による
  // シェイドゥラエフ水増し事故のため。Wikipedia/シード値を据え置く)。
  // ただしRECORD_OVERRIDES(add型)で明示的に欠落が判明しているboutは、
  // Wikipedia生値(historyWithoutDebut)に対して個別補正する。
  const totals = applyRecordOverridesToTotals("ya-man", historyWithoutDebut, {
    wins: 2,
    losses: 2,
    draws: 0,
    ko: 2,
    sub: 0,
    decision: 0,
  });
  check(totals.wins === 3 && totals.ko === 3, `戦績訂正オーバーライド: 集計値もYA-MAN 3勝(KO3)に是正される (got ${totals.wins}勝 ko${totals.ko})`);

  const correctedTwice = applyRecordOverrides("ya-man", corrected);
  check(correctedTwice.length === 5, "戦績訂正オーバーライド: 既に適用済みの状態に再適用しても重複追加されない(冪等)");

  const untouchedHistory = [{ date: "2020-01-01", opponent: "誰か", result: "win" as const, method: "判定", event: "RIZIN.1", round: "R1" }];
  const untouched = applyRecordOverrides("no-such-fighter", untouchedHistory);
  check(untouched === untouchedHistory, "戦績訂正オーバーライド: 対象外の選手のhistoryには一切影響しない");

  // このbout追加自体がElo再計算に正しく反映されること(G/H共通の確認)。
  // 訂正後のhistoryを実際にbuildBoutsへ通し、追加されたboutが対戦として計上されるかを見る。
  const records: FighterRecordsInput = { "ya-man": { history: corrected } };
  const resolveNone = () => null;
  const { bouts: yamanBouts } = buildBouts(records, resolveNone);
  check(
    yamanBouts.some((b) => b.date === "2023-05-06" && b.opponentLabel === "三浦孝太"),
    "戦績訂正オーバーライド: 追加bout(2023-05-06 三浦孝太戦)がElo計算対象の対戦として計上される"
  );
}

// ── 14. 計量オーバーNC裁定(J): 一般ルールとして王者オーバーレイと独立にエンジンへ適用される ──
{
  // 14-1. 計量オーバー側が実際の試合で勝った → 双方ノーコンテスト(勝敗記録なし)
  {
    const records: FighterRecordsInput = {
      "fighter-nc-winner-side": {
        history: [{ date: "2026-05-01", opponent: "選手Z", result: "loss", method: "1R パウンド", event: "RIZIN.220" }],
      },
    };
    const resolve = makeResolver({});
    const lookupWeighInMiss = (fighterId: string, date: string, opponent: string) =>
      fighterId === "fighter-nc-winner-side" && date === "2026-05-01" && opponent === "選手Z" ? "opponent" : null;
    const { bouts, warnings } = buildBouts(records, resolve, () => [], lookupWeighInMiss);
    check(bouts.length === 0, "計量オーバーNC: 計量オーバー側が勝った試合は対戦として計上されない(NC)");
    check(
      warnings.some((w) => w.reason.includes("ノーコンテスト")),
      "計量オーバーNC: NC裁定の理由がwarningとして出力される"
    );
    const states = computeRawRatings(bouts);
    check(!states.has("fighter-nc-winner-side"), "計量オーバーNC: NC裁定によりレート状態が一切生成されない(勝敗どちらにも計上されない)");
  }

  // 14-2. 計量オーバー側が実際の試合で負けた(または引き分けた) → 通常どおり結果が有効
  {
    const records: FighterRecordsInput = {
      "fighter-nc-loser-side": {
        history: [{ date: "2026-05-02", opponent: "選手Z2", result: "win", method: "5分3R終了 判定3-0", event: "RIZIN.221" }],
      },
    };
    const resolve = makeResolver({});
    const lookupWeighInMiss = (fighterId: string, date: string, opponent: string) =>
      fighterId === "fighter-nc-loser-side" && date === "2026-05-02" && opponent === "選手Z2" ? "self" : null;
    const { bouts, warnings } = buildBouts(records, resolve, () => [], lookupWeighInMiss);
    check(bouts.length === 0, "計量オーバーNC: 計量オーバー側自身が負けた試合はNCとして除外される");
    check(warnings.length === 1, "計量オーバーNC: 除外理由がwarningとして1件出力される");

    // 相手側(計量オーバーしていない側)が勝った通常のケースは、対象外(missedBy=null)なら普通に計上される
    const recordsOpponentWin: FighterRecordsInput = {
      "fighter-nc-loser-side": {
        history: [{ date: "2026-05-02", opponent: "選手Z2", result: "loss", method: "5分3R終了 判定0-3", event: "RIZIN.221" }],
      },
    };
    const lookupWeighInMissForLoss = (fighterId: string, date: string, opponent: string) =>
      fighterId === "fighter-nc-loser-side" && date === "2026-05-02" && opponent === "選手Z2" ? "self" : null;
    const { bouts: boutsOpponentWin } = buildBouts(recordsOpponentWin, resolve, () => [], lookupWeighInMissForLoss);
    check(
      boutsOpponentWin.length === 1 && boutsOpponentWin[0].scoreA === 0,
      "計量オーバーNC: 計量オーバー側が敗れた場合は相手の勝ちが通常どおり有効になる"
    );
  }
}

// ── 15. トップウィジェット/ランキングページ共有セレクタ(I) ────────────────
{
  const asOf = new Date("2026-06-01");
  const champion: ChampionOverlay = { fighterId: "champ-shared", rating: 1650, record: { wins: 7, losses: 0, draws: 0 }, lastFight: "2026-05-01" };
  const pool = [
    {
      meta: { slug: "shared-1", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "shared-1", rawRating: 1600, displayRating: 1600, fights: 8, wins: 7, losses: 1, draws: 0, lastFightDate: "2026-04-01", eligible: true },
    },
    {
      meta: { slug: "shared-2", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "shared-2", rawRating: 1580, displayRating: 1580, fights: 6, wins: 5, losses: 1, draws: 0, lastFightDate: "2026-03-01", eligible: true },
    },
  ];
  const data = buildDivisionRankings("フェザー級", pool, asOf, undefined, champion, "overlay");

  const pageView = getDivisionRankingView(data); // ページ本体: 全件
  check(pageView.contenders.length === 2, "共有セレクタ: topN省略時は全件を返す(ページ本体用)");
  check(pageView.champion?.fighterId === "champ-shared", "共有セレクタ: championフィールドをそのまま返す");
  check(!pageView.contenders.some((e) => e.fighterId === "champ-shared"), "共有セレクタ: 王者は番号付きcontendersに含まれない");

  const widgetView = getDivisionRankingView(data, 1); // ウィジェット: 上位N件
  check(widgetView.contenders.length === 1 && widgetView.contenders[0].fighterId === "shared-1", "共有セレクタ: topN指定時は先頭N件のみを返す(ウィジェット用)");
  check(widgetView.champion?.fighterId === pageView.champion?.fighterId, "共有セレクタ: ページとウィジェットで同じ王者・同じ並び順を返す(独自に組み立てない)");
  check(
    widgetView.contenders[0].fighterId === pageView.contenders[0].fighterId,
    "共有セレクタ: ウィジェットの1位とページの1位が一致する"
  );

  check(getDivisionRankingView(null).champion === null && getDivisionRankingView(null).contenders.length === 0, "共有セレクタ: データが無い階級はchampion=null・contenders=[]を返す");

  // 王者行のdeltaは表示側で常に固定値(RankingDelta(null))を渡す設計であり、
  // championオブジェクト自体にdeltaフィールドが存在しないことで構造的に保証される。
  check(!("delta" in (data.champion as object)), "共有セレクタ: champion情報にdeltaが存在しないため表示側は常に「—」になる");
}

// ── 16. トップウィジェットの公開可否ゲート(PUBLISHED_DIVISIONS単一の真実源) ──
// /rankings/[division]・/rankings(ハブ)が既に参照しているPUBLISHED_DIVISIONS
// ホワイトリストを、トップウィジェット側でも同じ関数経由で参照すること。
// 準備中の階級はElo算出済みでも挑戦者ランキング(1〜5位)を出さない(王者のみ)。
{
  const asOf = new Date("2026-06-01");
  const champion: ChampionOverlay = { fighterId: "champ-gate", rating: 1600, record: { wins: 5, losses: 0, draws: 0 }, lastFight: "2026-05-01" };
  const pool = [
    {
      meta: { slug: "gate-1", division: "フライ級" as const, weighInMiss: false },
      display: { slug: "gate-1", rawRating: 1550, displayRating: 1550, fights: 5, wins: 4, losses: 1, draws: 0, lastFightDate: "2026-04-01", eligible: true },
    },
  ];
  const data = buildDivisionRankings("フライ級", pool, asOf, undefined, champion, "overlay");

  check(!PUBLISHED_DIVISIONS.includes("フライ級"), "公開可否ゲート: フライ級は現時点で非公開(前提の確認)");
  const gated = getPublishedDivisionRankingView("フライ級", data, 5);
  check(gated.contenders.length === 0, "公開可否ゲート: 非公開階級はElo算出済みでも挑戦者ランキングを出さない");
  check(gated.champion?.fighterId === "champ-gate", "公開可否ゲート: 非公開階級でも王者は事実として表示を維持する");

  check(PUBLISHED_DIVISIONS.includes("フェザー級"), "公開可否ゲート: フェザー級は公開済み(前提の確認)");
  const featherData = buildDivisionRankings("フェザー級", pool.map((p) => ({ ...p, meta: { ...p.meta, division: "フェザー級" as const } })), asOf, undefined, champion, "overlay");
  const published = getPublishedDivisionRankingView("フェザー級", featherData, 5);
  check(published.contenders.length === 1, "公開可否ゲート: 公開済み階級は通常どおり挑戦者ランキングを出す");

  check(getPublishedDivisionRankingView("フライ級", null, 5).contenders.length === 0, "公開可否ゲート: データが無い非公開階級もcontenders=[]のまま(エラーにならない)");
}

// ── 17. latestRizinDivision: 単発の未明示キャッチウェイト戦1つで階級バケットが ──
// ────  ぶれない(武田光司・コレスニックがRIZIN.52の71.0kg契約1試合だけで
// ────  フェザー級ランキングから消えたバグの修正)
{
  // 17-1. 直近1戦が未明示のkg契約で、それ以前の判明済み試合群と食い違う場合は
  // 直近以前の多数決階級を採用する(武田光司の実データパターン: FW,FW,→LW一発)
  check(
    latestRizinDivision([
      { date: "2026-03-07", weightClass: "71.0kg契約" },
      { date: "2025-05-31", weightClass: "66.0kg契約" },
    ]) === "フェザー級",
    "latestRizinDivision: 直近の単発キャッチウェイト戦が過去の唯一の判明済み階級と食い違う場合、過去側を採用する"
  );

  // 17-2. 過去複数戦のうち多数派と食い違う場合も多数派を採用する(コレスニックの実データパターン)
  check(
    latestRizinDivision([
      { date: "2026-03-07", weightClass: "71.0kg契約" },
      { date: "2025-09-28", weightClass: "RIZINフェザー級タイトルマッチ" },
      { date: "2025-06-14", weightClass: "66.0kg契約" },
    ]) === "フェザー級",
    "latestRizinDivision: 直近の単発キャッチウェイト戦が過去の多数派階級と食い違う場合、多数派を採用する"
  );

  // 17-3. 直近戦が階級名を明示している場合は、食い違っていてもそのまま直近戦を採用する
  // (真の階級移動を示す明確なシグナルのため、キャッチウェイト救済ロジックの対象外)
  check(
    latestRizinDivision([
      { date: "2026-06-01", weightClass: "RIZINバンタム級タイトルマッチ" },
      { date: "2025-01-01", weightClass: "57.0kg契約" },
    ]) === "バンタム級",
    "latestRizinDivision: 直近戦が階級名を明示している場合は過去と食い違っても直近戦をそのまま採用する"
  );

  // 17-4. 比較対象となる過去の判明済み試合が無い場合(直近戦のみ)は、これまでどおり
  // 直近戦をそのまま採用する(中村大介の実データパターン: 唯一の判明済み試合で正しい階級移動を反映)
  check(
    latestRizinDivision([{ date: "2025-05-04", weightClass: "71.0kg契約" }]) === "ライト級",
    "latestRizinDivision: 過去の判明済み試合が無い場合は直近の1戦をそのまま採用する(既存の階級移動反映を壊さない)"
  );

  // 17-5. 直近戦が明示的に対象外階級(女子等)の場合はフォールバックせずnullを維持する
  check(
    latestRizinDivision([
      { date: "2025-12-31", weightClass: "RIZIN女子スーパーアトム級タイトルマッチ" },
      { date: "2025-07-27", weightClass: "52.0kg契約" },
    ]) === null,
    "latestRizinDivision: 直近戦が明示的に対象外階級(女子等)の場合は過去戦にフォールバックせずnullを維持する"
  );

  // 17-6. 直近戦が多数派と一致している場合は通常どおり直近戦を採用する(木村柊也の実データパターン=対照群)
  check(
    latestRizinDivision([
      { date: "2026-03-07", weightClass: "66.0kg契約" },
      { date: "2025-11-03", weightClass: "66.0kg契約" },
      { date: "2025-06-14", weightClass: "66.0kg契約" },
    ]) === "フェザー級",
    "latestRizinDivision: 直近戦が過去の多数派と一致している場合は通常どおり直近戦を採用する(対照群: 影響を受けない)"
  );

  // 17-7. 該当boutが1つも無い選手はnull(名目階級へのフォールバックは行わない、既存方針)
  check(latestRizinDivision([]) === null, "latestRizinDivision: 判明済みRIZIN MMA boutが無い選手はnull");
}

// ── 18. B-2: 階級変更後の資格スコープ ──────────────────────────────────
{
  // 18-1. 階級名が明示された食い違いが無ければcutoffはnull(全期間で判定・既存動作を維持)
  {
    const summaries: FighterBoutSummary[] = [
      { date: "2026-03-07", weightClass: "66.0kg契約", isWin: true, opponentNode: "opp-a" },
      { date: "2025-06-14", weightClass: "66.0kg契約", isWin: false, opponentNode: "opp-b" },
    ];
    check(detectDivisionChangeCutoff(summaries, "フェザー級") === null, "B-2: 階級名明示の食い違いが無ければcutoff=null(既存動作維持)");
    const { fights, wins } = computeEligibilityFightsAndWins(summaries, "フェザー級");
    check(fights === 2 && wins === 1, "B-2: cutoff無し時は全期間をそのままカウントする");
  }

  // 18-2. 未明示の単発キャッチウェイト(kg契約のみ)は階級変更の証拠にしない(latestRizinDivisionと同じ救済)
  {
    const summaries: FighterBoutSummary[] = [
      { date: "2026-03-07", weightClass: "71.0kg契約", isWin: true, opponentNode: "opp-a" }, // ライト級相当だが未明示
      { date: "2025-06-14", weightClass: "66.0kg契約", isWin: false, opponentNode: "opp-b" },
    ];
    check(detectDivisionChangeCutoff(summaries, "フェザー級") === null, "B-2: 未明示の単発キャッチウェイトは階級変更の証拠にしない");
  }

  // 18-3. 階級名が明示された食い違いがあれば、その直近日をcutoffとし、それ以前を除外する
  {
    const summaries: FighterBoutSummary[] = [
      { date: "2026-03-07", weightClass: "66.0kg契約", isWin: true, opponentNode: "opp-a" }, // cutoff後: カウント対象
      { date: "2025-06-14", weightClass: "RIZINバンタム級タイトルマッチ", isWin: false, opponentNode: "opp-b" }, // cutoff本体: 除外
      { date: "2024-01-01", weightClass: "RIZINバンタム級タイトルマッチ", isWin: true, opponentNode: "opp-c" }, // cutoff以前: 除外
    ];
    check(detectDivisionChangeCutoff(summaries, "フェザー級") === "2025-06-14", "B-2: 階級名明示の食い違いの直近日をcutoffにする");
    const { fights, wins } = computeEligibilityFightsAndWins(summaries, "フェザー級");
    check(fights === 1 && wins === 1, "B-2: cutoff以降(厳密に後)の試合のみでカウントする(cutoff本体は除外)");
  }

  // 18-4. isStandardEligible: 階級変更後1勝未満ならランカーにしない
  {
    const summaries: FighterBoutSummary[] = [
      { date: "2026-05-01", weightClass: "66.0kg契約", isWin: false, opponentNode: "opp-a" },
      { date: "2026-03-07", weightClass: "66.0kg契約", isWin: false, opponentNode: "opp-b" },
      { date: "2026-01-01", weightClass: "66.0kg契約", isWin: false, opponentNode: "opp-c" },
      { date: "2025-06-14", weightClass: "RIZINバンタム級タイトルマッチ", isWin: true, opponentNode: "opp-d" },
    ];
    const asOf = new Date("2026-06-01");
    check(
      isStandardEligible(summaries, "フェザー級", "2026-05-01", asOf) === false,
      "B-2: 階級変更後3戦以上あっても1勝もしていなければランカーにしない"
    );
  }
}

// ── 19. B-1: ランカー勝ち特例(二段階・単一パス・順位挿入なし) ────────────────
{
  function bout(date: string, aNode: string, bNode: string, scoreA: number): Bout {
    return { key: `${date}|${aNode}|${bNode}`, date, aNode, bNode, opponentLabel: bNode, scoreA, finish: false, method: "判定" };
  }

  // 19-1. 3戦未満でも、その年にランカーへ勝てば3戦要件を免除される(1勝要件も兼ねる)
  {
    const bouts: Bout[] = [bout("2026-03-01", "newcomer", "ranker-1", 1)];
    const divisionBySlug = new Map<string, MnewsDivision | null>([
      ["newcomer", "フェザー級"],
      ["ranker-1", "フェザー級"],
    ]);
    const baseRankers = new Map<MnewsDivision, Set<string>>([["フェザー級", new Set(["ranker-1"])]]);
    const summariesBySlug = new Map<string, FighterBoutSummary[]>([
      ["newcomer", summarizeBoutsForFighter(bouts, "newcomer")],
      ["ranker-1", summarizeBoutsForFighter(bouts, "ranker-1")],
    ]);
    const exempted = findRankerWinExemptions(summariesBySlug, divisionBySlug, baseRankers, "2026-");
    check(exempted.has("newcomer"), "B-1: 通算1戦でもその年にランカーへ勝てば資格特例の対象になる");
  }

  // 19-2. ランカーに負けた選手は免除対象にならない
  {
    const bouts: Bout[] = [bout("2026-03-01", "challenger", "ranker-1", 0)];
    const divisionBySlug = new Map<string, MnewsDivision | null>([
      ["challenger", "フェザー級"],
      ["ranker-1", "フェザー級"],
    ]);
    const baseRankers = new Map<MnewsDivision, Set<string>>([["フェザー級", new Set(["ranker-1"])]]);
    const summariesBySlug = new Map<string, FighterBoutSummary[]>([
      ["challenger", summarizeBoutsForFighter(bouts, "challenger")],
      ["ranker-1", summarizeBoutsForFighter(bouts, "ranker-1")],
    ]);
    const exempted = findRankerWinExemptions(summariesBySlug, divisionBySlug, baseRankers, "2026-");
    check(!exempted.has("challenger"), "B-1: ランカーに負けた場合は資格特例の対象にならない");
  }

  // 19-3. 別階級のランカーに勝っても対象にならない(同一階級内のみ)
  {
    const bouts: Bout[] = [bout("2026-03-01", "candidate", "lw-ranker", 1)];
    const divisionBySlug = new Map<string, MnewsDivision | null>([
      ["candidate", "フェザー級"],
      ["lw-ranker", "ライト級"],
    ]);
    const baseRankers = new Map<MnewsDivision, Set<string>>([
      ["フェザー級", new Set()],
      ["ライト級", new Set(["lw-ranker"])],
    ]);
    const summariesBySlug = new Map<string, FighterBoutSummary[]>([
      ["candidate", summarizeBoutsForFighter(bouts, "candidate")],
      ["lw-ranker", summarizeBoutsForFighter(bouts, "lw-ranker")],
    ]);
    const exempted = findRankerWinExemptions(summariesBySlug, divisionBySlug, baseRankers, "2026-");
    check(!exempted.has("candidate"), "B-1: 掲載階級が異なるランカーへの勝利は対象にならない(同一階級内のみ)");
  }

  // 19-4. 前年の勝利は対象にならない(当年開催の大会のみ)
  {
    const bouts: Bout[] = [bout("2025-12-31", "candidate", "ranker-1", 1)];
    const divisionBySlug = new Map<string, MnewsDivision | null>([
      ["candidate", "フェザー級"],
      ["ranker-1", "フェザー級"],
    ]);
    const baseRankers = new Map<MnewsDivision, Set<string>>([["フェザー級", new Set(["ranker-1"])]]);
    const summariesBySlug = new Map<string, FighterBoutSummary[]>([
      ["candidate", summarizeBoutsForFighter(bouts, "candidate")],
      ["ranker-1", summarizeBoutsForFighter(bouts, "ranker-1")],
    ]);
    const exempted = findRankerWinExemptions(summariesBySlug, divisionBySlug, baseRankers, "2026-");
    check(!exempted.has("candidate"), "B-1: 対象年より前の勝利は資格特例の対象にならない");
  }

  // 19-5. カスケードしない: 特例で新規に入った選手Bへの勝利では、Cは特例の対象にならない(単一パス)
  {
    const bouts: Bout[] = [
      bout("2026-01-01", "newcomer-b", "ranker-1", 1), // Bがランカーに勝ち特例対象になる
      bout("2026-03-01", "candidate-c", "newcomer-b", 1), // CはBに勝つ(Bはベースランカーではない)
    ];
    const divisionBySlug = new Map<string, MnewsDivision | null>([
      ["newcomer-b", "フェザー級"],
      ["candidate-c", "フェザー級"],
      ["ranker-1", "フェザー級"],
    ]);
    const baseRankers = new Map<MnewsDivision, Set<string>>([["フェザー級", new Set(["ranker-1"])]]);
    const summariesBySlug = new Map<string, FighterBoutSummary[]>([
      ["newcomer-b", summarizeBoutsForFighter(bouts, "newcomer-b")],
      ["candidate-c", summarizeBoutsForFighter(bouts, "candidate-c")],
      ["ranker-1", summarizeBoutsForFighter(bouts, "ranker-1")],
    ]);
    const exempted = findRankerWinExemptions(summariesBySlug, divisionBySlug, baseRankers, "2026-");
    check(exempted.has("newcomer-b"), "B-1: ベースランカーに勝った選手(B)は特例対象になる");
    check(!exempted.has("candidate-c"), "B-1: 特例で新規に入った選手(B)への勝利では別選手(C)は特例対象にならない(カスケードしない・単一パス)");
  }
}

// ── 20. (i) 女子選手の誤混入根絶: 名目階級(fighters.ts側)を主ソースにする ──
{
  check(isNominallyWomensDivision("女子スーパーアトム級"), "女子除外: 名目階級に「女子」を含めばtrue");
  check(isNominallyWomensDivision("女子アトム級"), "女子除外: 「アトム」を含めばtrue");
  check(!isNominallyWomensDivision("フライ級"), "女子除外: 通常の男子階級表記はfalse");
  check(!isNominallyWomensDivision(undefined), "女子除外: 未指定はfalse");

  // ケイト・ロータス型の実データパターン: bout単位のweightClassは全て性別ラベル
  // なしの「49.0kg契約」(男子フライ級と同じkg数値レンジ)のみで、旧実装では
  // これがフライ級へ素通りしていた。名目階級を渡せば階級横断でnullになる。
  const womensOnlyKgBouts = [
    { date: "2026-05-10", weightClass: "51.0kg契約" },
    { date: "2026-03-07", weightClass: "49.0kg契約" },
    { date: "2025-11-03", weightClass: "50.0kg契約" },
  ];
  check(
    latestRizinDivision(womensOnlyKgBouts, "女子スーパーアトム級") === null,
    "女子除外: 性別ラベルなしのkg契約のみでも、名目階級が女子系ならnullになる(誤混入バグの再発防止)"
  );
  check(
    latestRizinDivision(womensOnlyKgBouts) === "フライ級",
    "女子除外: 名目階級を渡さない場合は旧実装のバグを再現する(このテストで回帰を検知できる状態を保つ)"
  );

  // 男子選手は名目階級を渡しても通常どおり計算される(既存動作への影響なし)
  check(
    latestRizinDivision([{ date: "2026-01-01", weightClass: "66.0kg契約" }], "フェザー級") === "フェザー級",
    "女子除外: 男子選手の名目階級は判定に影響しない(既存動作を壊さない)"
  );
}

// ── 21. (iii) latestRizinDivisionのタイ解消ロジック(2026-07-13再修正) ──────
{
  // 伊藤裕輝の実データパターン: フライ級2票・バンタム級2票のタイで、タイ候補の
  // 中に階級名が明示された試合(フライ級)があるため、それを最優先の証拠として
  // 採用する(日付の新しさより明示的な階級名を優先)。
  const tiedBouts = [
    { date: "2026-03-07", weightClass: "59.0kg契約" }, // 直近(未明示) バンタム級ゾーン
    { date: "2025-09-28", weightClass: "57.0kg契約 フライ級トーナメント2回戦" }, // 明示フライ級
    { date: "2025-07-27", weightClass: "57.0kg契約" }, // フライ級ゾーン
    { date: "2025-05-04", weightClass: "59.0kg契約" }, // バンタム級ゾーン
    { date: "2025-03-30", weightClass: "59.0kg契約" }, // バンタム級ゾーン
  ];
  check(
    latestRizinDivision(tiedBouts) === "フライ級",
    "タイ解消(a): タイ候補の中に階級名明示の試合(フライ級)があれば最優先で採用する"
  );

  // 金太郎の実データパターン(2026-07-13本番混入の直接原因): フェザー級1票・
  // バンタム級1票のタイで、階級名の明示は無い。直近戦(バンタム級)自身の値が
  // タイ候補に含まれるため、それを採用する(全3戦の単純多数決=バンタム2:
  // フェザー1とも整合する)。旧ロジックはothersのみ(直近戦を除いた2戦)で
  // タイを取り、othersの中で最新のフェザー級を誤って採用していた。
  const kintaroPattern = [
    { date: "2026-05-10", weightClass: "61.0kg契約" }, // 直近(未明示) バンタム級ゾーン
    { date: "2025-11-03", weightClass: "62.0kg契約" }, // フェザー級ゾーン
    { date: "2025-05-31", weightClass: "61.0kg契約" }, // バンタム級ゾーン
  ];
  check(
    latestRizinDivision(kintaroPattern) === "バンタム級",
    "タイ解消(b): 階級名明示が無いタイでは、直近戦自身の値がタイ候補に含まれればそれを採用する(金太郎の混入バグ修正)"
  );

  // 回帰確認: 単独多数派があるケース(武田光司・コレスニックのパターン)は
  // これまでどおり多数派をそのまま採用する(タイでないので直近戦の値は無関係)。
  check(
    latestRizinDivision([
      { date: "2026-03-07", weightClass: "71.0kg契約" },
      { date: "2025-09-28", weightClass: "RIZINフェザー級タイトルマッチ" },
      { date: "2025-06-14", weightClass: "66.0kg契約" },
    ]) === "フェザー級",
    "タイ解消: 単独多数派があるケースは回帰なく多数派をそのまま採用する"
  );

  // 回帰確認: laramie-tony/jolly/torres-jose型(othersのみで単独多数派、または
  // others1件のみ)は、直近戦を含めた全体集計に切り替えても結果が変わらない
  // (単独多数派の分岐がothersのみの集計を維持しているため無影響)。
  check(
    latestRizinDivision([
      { date: "2026-06-06", weightClass: "59.0kg契約" }, // 直近(未明示) バンタム級
      { date: "2026-03-07", weightClass: "57.0kg契約" }, // フライ級
      { date: "2025-11-03", weightClass: "57.0kg契約" }, // フライ級
      { date: "2025-03-30", weightClass: "59.0kg契約" }, // バンタム級
    ]) === "フライ級",
    "回帰: othersのみで単独多数派(フライ級2:バンタム級1)のケースは従来どおり不変"
  );
}

// ── 22. (iv) 掲載資格基準: 通算3戦以上 OR 直近年2戦以上 ───────────────────
{
  const asOf = new Date(`${Number(ELIGIBILITY_RECENT_YEAR_START) + 1}-01-15`);

  // 通算2戦のみだが、直近年に2戦(1勝1敗)している選手は資格を得る
  const recentTwoFights: FighterBoutSummary[] = [
    { date: `${ELIGIBILITY_RECENT_YEAR_START}-06-01`, isWin: true, opponentNode: "opp-a" },
    { date: `${ELIGIBILITY_RECENT_YEAR_START}-03-01`, isWin: false, opponentNode: "opp-b" },
  ];
  check(
    recentTwoFights.length < 3 && isStandardEligible(recentTwoFights, "フライ級", recentTwoFights[0].date, asOf),
    `(iv): 通算${recentTwoFights.length}戦でも${ELIGIBILITY_RECENT_YEAR_START}年以降${ELIGIBILITY_RECENT_MIN_FIGHTS}戦以上・1勝あれば資格を得る`
  );

  // 直近年1戦のみ(基準未達)・通算も3戦未満なら資格なし
  const recentOneFight: FighterBoutSummary[] = [{ date: `${ELIGIBILITY_RECENT_YEAR_START}-06-01`, isWin: true, opponentNode: "opp-a" }];
  check(
    !isStandardEligible(recentOneFight, "フライ級", recentOneFight[0].date, asOf),
    "(iv): 直近年1戦のみ・通算も3戦未満なら、どちらの基準も満たさず資格なし"
  );

  // 通算3戦以上(直近年に集中していなくても)は従来どおり資格を得る(回帰確認)
  const legacyThreeFights: FighterBoutSummary[] = [
    { date: "2020-01-01", isWin: true, opponentNode: "opp-a" },
    { date: "2021-01-01", isWin: true, opponentNode: "opp-b" },
    { date: "2022-01-01", isWin: false, opponentNode: "opp-c" },
  ];
  // 直近性(18ヶ月)は満たさないため、直近日を新しく差し替えて確認する
  const legacyRecentDate = new Date(asOf.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const legacyWithRecentLastFight: FighterBoutSummary[] = [...legacyThreeFights, { date: legacyRecentDate, isWin: true, opponentNode: "opp-d" }];
  check(
    isStandardEligible(legacyWithRecentLastFight, "フライ級", legacyRecentDate, asOf),
    "(iv): 通算3戦以上を満たす場合は従来どおり資格を得る(回帰確認)"
  );
}

// ── 23. (v) 非対称傾斜Elo ────────────────────────────────────────────
{
  function bout(date: string, aNode: string, bNode: string, scoreA: number, finish = false): Bout {
    return { key: `${date}|${aNode}|${bNode}`, date, aNode, bNode, opponentLabel: bNode, scoreA, finish, method: finish ? "KO" : "判定" };
  }

  // NEUTRAL_ELO_PARAMS(既定値)は既存の対称Eloと完全に同一の挙動になる(後方互換)
  {
    const bouts: Bout[] = [bout("2026-01-01", "fighter-a", "fighter-b", 1)];
    const neutralStates = computeRawRatings(bouts); // params省略=NEUTRAL_ELO_PARAMS
    const explicitNeutralStates = computeRawRatings(bouts, NEUTRAL_ELO_PARAMS);
    check(
      neutralStates.get("fighter-a")!.rawRating === explicitNeutralStates.get("fighter-a")!.rawRating,
      "非対称Elo: params省略時はNEUTRAL_ELO_PARAMSを明示指定した場合と完全に同一の結果になる"
    );
    check(near(neutralStates.get("fighter-a")!.rawRating, 1516), "非対称Elo: NEUTRAL_ELO_PARAMSは既存の対称Elo(K=32)と同じ変動幅になる");
  }

  // 格上に勝った場合、非対称パラメータ(strongWinBoost>1)は中立時より加点が大きい
  {
    const params: AsymmetricEloParams = { strongWinBoost: 1.5, weakWinDampen: 1, strongLossDampen: 1, weakLossBoost: 1, thinResumeFightThreshold: 0, thinResumeWinDampen: 1 };
    // fighter-yを先に強くしておき(格上化)、fighter-xがそれに勝つ
    const setupBouts: Bout[] = [bout("2025-01-01", "fighter-y", "wall-1", 1), bout("2025-02-01", "fighter-y", "wall-2", 1)];
    const upsetBout: Bout = bout("2026-01-01", "fighter-x", "fighter-y", 1);

    const neutralStates = computeRawRatings([...setupBouts, upsetBout], NEUTRAL_ELO_PARAMS);
    const boostedStates = computeRawRatings([...setupBouts, upsetBout], params);
    check(
      boostedStates.get("fighter-x")!.rawRating > neutralStates.get("fighter-x")!.rawRating,
      "非対称Elo: strongWinBoost>1のとき、格上に勝った場合の加点が中立時より大きい"
    );
  }

  // 格下に勝った場合、weakWinDampen<1は中立時より加点が小さい
  {
    const params: AsymmetricEloParams = { strongWinBoost: 1, weakWinDampen: 0.5, strongLossDampen: 1, weakLossBoost: 1, thinResumeFightThreshold: 0, thinResumeWinDampen: 1 };
    const setupBouts: Bout[] = [bout("2025-01-01", "fighter-b", "wall-1", 0), bout("2025-02-01", "fighter-b", "wall-2", 0)];
    const stompBout: Bout = bout("2026-01-01", "fighter-a", "fighter-b", 1);

    const neutralStates = computeRawRatings([...setupBouts, stompBout], NEUTRAL_ELO_PARAMS);
    const dampenedStates = computeRawRatings([...setupBouts, stompBout], params);
    check(
      dampenedStates.get("fighter-a")!.rawRating < neutralStates.get("fighter-a")!.rawRating,
      "非対称Elo: weakWinDampen<1のとき、格下に勝った場合の加点が中立時より小さい"
    );
  }

  // 格下に負けた場合、weakLossBoost>1は中立時より減点が大きい(「倒した相手より下」の解消)
  {
    const params: AsymmetricEloParams = { strongWinBoost: 1, weakWinDampen: 1, strongLossDampen: 1, weakLossBoost: 1.5, thinResumeFightThreshold: 0, thinResumeWinDampen: 1 };
    const setupBouts: Bout[] = [bout("2025-01-01", "fighter-b", "wall-1", 0), bout("2025-02-01", "fighter-b", "wall-2", 0)];
    const upsetLossBout: Bout = bout("2026-01-01", "fighter-a", "fighter-b", 0); // 格上のaが格下のbに負ける

    const neutralStates = computeRawRatings([...setupBouts, upsetLossBout], NEUTRAL_ELO_PARAMS);
    const boostedStates = computeRawRatings([...setupBouts, upsetLossBout], params);
    check(
      boostedStates.get("fighter-a")!.rawRating < neutralStates.get("fighter-a")!.rawRating,
      "非対称Elo: weakLossBoost>1のとき、格下に負けた場合の減点が中立時より大きい"
    );
  }

  // 格上に負けた場合、strongLossDampen<1は中立時より減点が小さい
  {
    const params: AsymmetricEloParams = { strongWinBoost: 1, weakWinDampen: 1, strongLossDampen: 0.5, weakLossBoost: 1, thinResumeFightThreshold: 0, thinResumeWinDampen: 1 };
    const setupBouts: Bout[] = [bout("2025-01-01", "fighter-y", "wall-1", 1), bout("2025-02-01", "fighter-y", "wall-2", 1)];
    const braveLossBout: Bout = bout("2026-01-01", "fighter-x", "fighter-y", 0);

    const neutralStates = computeRawRatings([...setupBouts, braveLossBout], NEUTRAL_ELO_PARAMS);
    const dampenedStates = computeRawRatings([...setupBouts, braveLossBout], params);
    check(
      dampenedStates.get("fighter-x")!.rawRating > neutralStates.get("fighter-x")!.rawRating,
      "非対称Elo: strongLossDampen<1のとき、格上に負けた場合の減点が中立時より小さい(善戦の過度な沈み込みを防ぐ)"
    );
  }

  // 対戦数の少ない(実績の薄い)相手への勝利は、thinResumeWinDampenでさらに加点が圧縮される
  {
    const params: AsymmetricEloParams = { strongWinBoost: 1, weakWinDampen: 1, strongLossDampen: 1, weakLossBoost: 1, thinResumeFightThreshold: 3, thinResumeWinDampen: 0.3 };
    const thinBout: Bout = bout("2026-01-01", "fighter-a", "newcomer", 1); // newcomerは対戦数0(閾値3未満)

    const neutralStates = computeRawRatings([thinBout], NEUTRAL_ELO_PARAMS);
    const dampenedStates = computeRawRatings([thinBout], params);
    check(
      dampenedStates.get("fighter-a")!.rawRating < neutralStates.get("fighter-a")!.rawRating,
      "非対称Elo: 対戦数が閾値未満の(実績の薄い)相手への勝利は、thinResumeWinDampenで加点がさらに圧縮される"
    );
  }

  // ドローは非対称傾斜の対象外(常に中立と同じ変動になる)
  {
    const drawBout: Bout = bout("2026-01-01", "fighter-a", "fighter-b", 0.5);
    const params: AsymmetricEloParams = { strongWinBoost: 2, weakWinDampen: 0.1, strongLossDampen: 0.1, weakLossBoost: 2, thinResumeFightThreshold: 10, thinResumeWinDampen: 0.1 };
    const neutralStates = computeRawRatings([drawBout], NEUTRAL_ELO_PARAMS);
    const extremeStates = computeRawRatings([drawBout], params);
    check(
      neutralStates.get("fighter-a")!.rawRating === extremeStates.get("fighter-a")!.rawRating,
      "非対称Elo: ドローは傾斜パラメータの影響を受けない(常に中立と同じ結果)"
    );
  }
}

// ── 24. レート表示の丸め(B案): 10点刻み・表示層のみ・順位とdeltaは生レート基準 ──
{
  check(roundToDisplayStep(1638) === 1640, "丸め: 1638→1640");
  check(roundToDisplayStep(1602) === 1600, "丸め: 1602→1600");
  check(roundToDisplayStep(1569) === 1570, "丸め: 1569→1570");
  check(roundToDisplayStep(1605) === 1610, "丸め: 中間値(1605)は四捨五入で切り上げ側(1610)になる");
  check(roundToDisplayStep(1500) === 1500, "丸め: すでに10の倍数の値はそのまま");

  // 順位は生レート順で決まる(丸めて同点表示になっても、生レートの差で順位が一意に決まる)
  const asOf1 = new Date("2026-01-01");
  const pool = [
    {
      meta: { slug: "fighter-x1", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-x1", rawRating: 1603, displayRating: 1603, fights: 3, wins: 2, losses: 1, draws: 0, lastFightDate: "2025-12-01", eligible: true },
    },
    {
      meta: { slug: "fighter-x2", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-x2", rawRating: 1597, displayRating: 1597, fights: 3, wins: 2, losses: 1, draws: 0, lastFightDate: "2025-12-01", eligible: true },
    },
  ];
  const result = buildDivisionRankings("フェザー級", pool, asOf1, undefined, null);
  check(
    result.entries[0].rating === 1600 && result.entries[1].rating === 1600,
    "丸め: 生レート1603と1597はどちらも表示上1600に丸められ、表示上は同点になる"
  );
  check(
    result.entries[0].fighterId === "fighter-x1" && result.entries[0].rank === 1 && result.entries[1].rank === 2,
    "丸め: 表示レートが同点でも、順位は生レートの差(1603>1597)で一意に決まる"
  );

  // deltaは丸め後の値同士の差ではなく、生レート同士の差で算出する(二重丸め誤差を避ける)
  const asOf2 = new Date("2026-01-02");
  const prevWithRaw: DivisionRankings = {
    division: "フェザー級",
    updatedAt: "2025-12-31T00:00:00.000Z",
    algorithmVersion: 4,
    champion: null,
    entries: [
      { fighterId: "fighter-x1", rank: 1, rating: 1600, rawRating: 1596, delta: null, record: { wins: 2, losses: 1, draws: 0 }, lastFight: "2025-12-01", weighInMiss: false },
    ],
  };
  const poolNext = [
    {
      meta: { slug: "fighter-x1", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-x1", rawRating: 1603, displayRating: 1603, fights: 3, wins: 2, losses: 1, draws: 0, lastFightDate: "2025-12-01", eligible: true },
    },
  ];
  const nextResult = buildDivisionRankings("フェザー級", poolNext, asOf2, prevWithRaw, null);
  check(
    nextResult.entries[0].rating === 1600 && nextResult.entries[0].delta === 7,
    `丸め: 表示レートは前回・今回とも1600(同点)だが、deltaは生レートの差(1603-1596=7)で算出され、丸め後の差(0)にはならない (got rating=${nextResult.entries[0].rating}, delta=${nextResult.entries[0].delta})`
  );

  // 旧スナップショット(rawRatingフィールドが無い)との互換性: 丸め済みratingへフォールバックする
  const prevWithoutRaw = {
    division: "フェザー級" as const,
    updatedAt: "2025-12-31T00:00:00.000Z",
    algorithmVersion: 4,
    champion: null,
    entries: [
      { fighterId: "fighter-x1", rank: 1, rating: 1590, delta: null, record: { wins: 2, losses: 1, draws: 0 }, lastFight: "2025-12-01", weighInMiss: false },
    ],
  } as unknown as DivisionRankings;
  const fallbackResult = buildDivisionRankings("フェザー級", poolNext, asOf2, prevWithoutRaw, null);
  check(
    fallbackResult.entries[0].delta === 13,
    `丸め: rawRatingが無い旧スナップショットとの互換性(丸め済みratingへフォールバック、1603-1590=13) (got ${fallbackResult.entries[0].delta})`
  );

  // rawRatingは表示用のratingとは独立のフィールドとして持つ(表示コンポーネントは
  // 参照しない想定だが、値そのものは正しく生のdisplayRatingと一致すること)
  check(nextResult.entries[0].rawRating === 1603, "丸め: rawRatingフィールドには丸め前の生の表示レートがそのまま入る");
}

// ── 25. "use client"コンポーネントへ渡す前にrating/rawRatingを必ず除去する(D-2) ──
{
  const asOf = new Date("2026-01-01");
  const champion: ChampionOverlay = { fighterId: "champ-cs", rating: 1650, record: { wins: 7, losses: 0, draws: 0 }, lastFight: "2025-12-01" };
  const pool = [
    {
      meta: { slug: "fighter-cs1", division: "フェザー級" as const, weighInMiss: false },
      display: { slug: "fighter-cs1", rawRating: 1603.456, displayRating: 1603.456, fights: 3, wins: 2, losses: 1, draws: 0, lastFightDate: "2025-12-01", eligible: true },
    },
  ];
  const data = buildDivisionRankings("フェザー級", pool, asOf, undefined, champion);
  const view = getDivisionRankingView(data);
  check("rawRating" in view.contenders[0] && "rating" in view.contenders[0], "クライアント安全化: 変換前のcontendersにはrating/rawRatingが含まれる(前提の確認)");

  const safeView = toClientSafeDivisionRankingView(view);
  check(!("rawRating" in safeView.contenders[0]) && !("rating" in safeView.contenders[0]), "クライアント安全化: 適用後はcontendersからrating/rawRatingが両方とも除去される");
  check(safeView.champion !== null && !("rating" in safeView.champion), "クライアント安全化: championからもratingが除去される");
  check(safeView.contenders[0].fighterId === "fighter-cs1" && safeView.contenders[0].rank === 1, "クライアント安全化: rating以外のフィールド(fighterId/rank等)は維持される");
  const serialized = JSON.stringify(safeView);
  check(!serialized.includes("rawRating") && !serialized.includes("1603") && !serialized.includes("1650"), "クライアント安全化: JSON化してもrawRating文字列・生レート数値ともに一切残らない(シリアライズ時の漏洩防止の最終確認)");
}

// ── 26. 戦績訂正オーバーライド: patch-weight-class(既存boutのweightClassのみ補完) ──
{
  const historyMissingWeightClass = [
    { date: "2022-03-20", opponent: "山本空良", result: "loss" as const, method: "5分3R終了 判定1-2", event: "RIZIN.34", round: "R3" },
  ];
  const patched = applyRecordOverrides("nakamura-daisuke", historyMissingWeightClass);
  check(patched.length === 1, "patch-weight-class: bout件数は変わらない(追加でも削除でもない)");
  check((patched[0] as { weightClass?: string }).weightClass === "68.0kg契約", "patch-weight-class: weightClassのみ補完される");
  check(
    patched[0].date === "2022-03-20" && patched[0].opponent === "山本空良" && patched[0].result === "loss" && patched[0].method === "5分3R終了 判定1-2",
    "patch-weight-class: date/opponent/result/methodは一切変更されない"
  );

  const patchedTwice = applyRecordOverrides("nakamura-daisuke", patched);
  check(
    JSON.stringify(patchedTwice) === JSON.stringify(patched),
    "patch-weight-class: 既に適用済みの状態に再適用しても結果が変わらない(冪等)"
  );

  const unrelated = applyRecordOverrides("nakamura-daisuke", [
    { date: "2099-01-01", opponent: "別の誰か", result: "win" as const, method: "判定", event: "RIZIN.99", round: "R1" },
  ]);
  check(
    (unrelated[0] as { weightClass?: string }).weightClass === undefined,
    "patch-weight-class: date/opponentが一致しないboutには影響しない"
  );
}

// ── 27. 掲載階級の事実オーバーレイ(fighterDivisions.ts): オーバーレイ優先 ──
{
  check(getDivisionOverlay("kintaro") === "バンタム級", "階級オーバーレイ: 金太郎はバンタム級で確定指定されている");
  check(getDivisionOverlay("takeda-koji") === "フェザー級", "階級オーバーレイ: 武田光司はフェザー級で確定指定されている");
  check(getDivisionOverlay("ito-yuki") === null, "階級オーバーレイ: 指定の無い選手はnull(自動判定にフォールバックする対象)");
  check(getDivisionOverlay("nakamura-daisuke") === null, "階級オーバーレイ: 中村大介は今回指定なし(自動判定のまま)");

  // 優先順位の確認: オーバーレイの値は自動判定(latestRizinDivision)の結果に
  // かかわらず必ず勝つ(update-mnews-rating.tsと同じ合成: overlay ?? auto)。
  const autoWouldSayFeatherweight = latestRizinDivision([
    { date: "2026-01-01", weightClass: "66.0kg契約" },
  ]);
  check(autoWouldSayFeatherweight === "フェザー級", "前提確認: このダミーデータは自動判定でもフェザー級になる");
  const overlayDivision = getDivisionOverlay("kintaro");
  const resolved = overlayDivision ?? autoWouldSayFeatherweight;
  check(resolved === "バンタム級", "階級オーバーレイ: 自動判定の結果と異なっていてもオーバーレイが優先される(順位・レートには一切触れない=掲載階級バケットの決定のみ)");
}

// ── 28. buildBouts: 開催日が現在日付より未来の「結果」は一般ルールで除外する
//       (カルシャガ・ダウトベックのWikipedia記事に、まだ開催されていない
//       RIZIN LANDMARK 15/超RIZIN.5の「結果」が書き込まれていた実例の回帰確認。
//       個別選手のハードコードではなく、asOfより未来のdateを一律除外する) ──
{
  const asOf = new Date("2026-07-13");
  const records: FighterRecordsInput = {
    "fighter-future1": {
      history: [
        { date: "2026-07-18", opponent: "fighter-future2", result: "win", method: "判定3-0", event: "RIZIN LANDMARK 15" },
        { date: "2026-01-01", opponent: "fighter-future2", result: "win", method: "判定3-0", event: "RIZIN.60" },
      ],
    },
    "fighter-future2": { history: [] },
  };
  const resolve = (name: string) => (name === "fighter-future2" ? "fighter-future2" : null);
  const { bouts, warnings } = buildBouts(records, resolve, undefined, undefined, asOf);
  check(bouts.length === 1, "未来日付フィルタ: asOfより未来の試合は除外し、過去の試合だけが残る");
  check(bouts[0].date === "2026-01-01", "未来日付フィルタ: 除外後に残るのは過去の試合のみ");
  check(
    warnings.some((w) => w.date === "2026-07-18" && w.reason.includes("未来")),
    "未来日付フィルタ: 除外した試合はwarningとして記録する(捏造ではなく可視化)"
  );
}

// ── 29. buildBouts: asOf未指定時は現在日時がデフォルトになる(回帰確認。
//       過去の全テストがasOfを渡していなくても壊れないことの確認) ──
{
  const records: FighterRecordsInput = {
    "fighter-past-a": {
      history: [{ date: "2020-01-01", opponent: "fighter-past-b", result: "win", method: "判定3-0", event: "RIZIN.20" }],
    },
    "fighter-past-b": { history: [] },
  };
  const resolve = (name: string) => (name === "fighter-past-b" ? "fighter-past-b" : null);
  const { bouts } = buildBouts(records, resolve);
  check(bouts.length === 1, "asOf未指定: 過去日付の試合はデフォルト(現在日時)でも除外されない");
}

// ── 30. computeScopedRecord: 指定日付以降の対戦だけで勝敗を数え直す
//       (武田光司のフェザー転向後3-2表示の基盤機能) ──
{
  const bouts: Bout[] = [
    { key: "1", date: "2019-04-21", aNode: "takeda", bNode: "opp1", opponentLabel: "opp1", scoreA: 0, finish: true, method: "" },
    { key: "2", date: "2024-03-23", aNode: "takeda", bNode: "opp2", opponentLabel: "opp2", scoreA: 1, finish: false, method: "" },
    { key: "3", date: "2024-06-09", aNode: "opp3", bNode: "takeda", opponentLabel: "takeda", scoreA: 1, finish: true, method: "" }, // takedaはbNode側→自視点score=0(負け)
    { key: "4", date: "2026-03-07", aNode: "opp4", bNode: "takeda", opponentLabel: "takeda", scoreA: 0, finish: false, method: "" }, // takedaはbNode側→自視点score=1(勝ち)
  ];
  const scoped = computeScopedRecord(bouts, "takeda", "2024-03-23");
  check(scoped.fights === 3, "computeScopedRecord: 起点日以降の対戦だけを数える(2019年分は除外)");
  check(scoped.wins === 2 && scoped.losses === 1, "computeScopedRecord: aNode/bNodeどちらの視点でも正しく勝敗を数える");
}

// ── 31. latestRizinDivision: 2年窓による「直近の物量が過去の物量を上回る」
//       再修正(2026-07-13 Phase3再修正・元谷友貴の実データパターン) ──
{
  // 元谷友貴の実データパターン(簡略版): 直近戦は未明示59kg契約(バンタムゾーン)。
  // 2年窓の中に、明示フライ級×3(2025年)と、明示バンタム級×1+未明示バンタム
  // ゾーン×1(2024〜2025年)が入る。フライ3:バンタム3のタイになるが、
  // タイ候補の中で最も新しい明示試合(フライ級)が優先され、フライ級が採用される。
  // 2年窓より前にある8年分の未明示61kg契約(旧ロジックではこれが数の力で
  // バンタム級に誤判定させていた)は窓の外なので集計に一切影響しない。
  const motoyaPattern = [
    { date: "2026-06-06", weightClass: "59.0kg契約" }, // 直近(未明示) バンタムゾーン
    { date: "2025-12-31", weightClass: "フライ級" },
    { date: "2025-09-28", weightClass: "フライ級" },
    { date: "2025-07-27", weightClass: "フライ級" },
    { date: "2025-03-30", weightClass: "61.0kg契約" }, // バンタムゾーン
    { date: "2024-12-31", weightClass: "バンタム級" },
    { date: "2024-09-29", weightClass: "61.0kg契約" }, // バンタムゾーン(2年窓の境界付近)
    // 2年窓の外: 8年分の未明示61kg契約(旧ロジックではここの物量がバンタム級を
    // 押し上げていた)。窓の外なので結果に影響しないことを確認する。
    { date: "2023-12-31", weightClass: "61.0kg契約" },
    { date: "2022-12-31", weightClass: "61.0kg契約" },
    { date: "2021-12-31", weightClass: "61.0kg契約" },
    { date: "2020-12-31", weightClass: "61.0kg契約" },
    { date: "2019-12-31", weightClass: "61.2kg契約" },
    { date: "2018-12-31", weightClass: "60.0kg契約" },
    { date: "2016-12-29", weightClass: "60.0kg契約" },
  ];
  check(
    latestRizinDivision(motoyaPattern) === "フライ級",
    "2年窓(a): 2年より前の未明示物量に押し流されず、窓内の明示フライ級評価が採用される(元谷友貴パターン)"
  );

  // 秋元強真の実データパターン(簡略版): 2年窓の中に単発の明示バンタム級(2024-12-31)
  // が1件混ざるが、周囲を未明示フェザーゾーンの試合が多数囲んでおり、
  // 単純多数決で単独多数派(フェザー級)が決まるため、単発の明示評価1件だけでは
  // 階級を動かさない(明示優先はタイの時のみ効き、単独多数派には効かない)。
  const akimotoPattern = [
    { date: "2026-03-07", weightClass: "66.0kg契約" }, // 直近(未明示) フェザーゾーン
    { date: "2025-12-31", weightClass: "66.0kg契約" }, // フェザーゾーン
    { date: "2025-11-03", weightClass: "66.0kg契約" }, // フェザーゾーン
    { date: "2025-07-27", weightClass: "68.0kg契約" }, // ライトゾーン
    { date: "2025-05-04", weightClass: "66.0kg契約" }, // フェザーゾーン
    { date: "2024-12-31", weightClass: "バンタム級" }, // 単発の明示バンタム級(異常値)
    { date: "2024-11-17", weightClass: "66.0kg契約" }, // フェザーゾーン
  ];
  check(
    latestRizinDivision(akimotoPattern) === "フェザー級",
    "2年窓(b): 単発の明示評価1件だけでは単純多数決の結果を覆さない(秋元強真パターン。誤って階級を動かさない回帰確認)"
  );
}

// ── 32. 2026-07-13緊急修正: 通算戦績はWiki/シード据え置き・RIZIN集計は導出、の分離 ──
{
  // (a) 非冪等バグの再発防止(核心): 旧実装(廃止済みのapplyRecordOverridesToTotals)は
  // 「Wikipedia生値に毎回+1」という固定delta加算だったため、Wikipedia側が独自に
  // そのboutを取り込んだ瞬間、生値(既に+1込み)にさらに+1してしまい二重加算に
  // なっていた(YA-MAN wins3→4、高木凌decision2→3で実際に発生)。新実装は毎回
  // 生historyを見て対象boutの有無を判定するため、Wikipedia側が追いついた後は
  // 自動的に加算をやめる(=同じ入力なら常に同じ結果になる。非冪等バグは再発しない)。
  const rawHistoryBeforeWikiCatchesUp = [
    { date: "2023-12-31", opponent: "平本蓮", result: "loss" as const, method: "判定0-3", event: "RIZIN.45", round: "R3" },
  ];
  const totalsBefore = applyRecordOverridesToTotals("ya-man", rawHistoryBeforeWikiCatchesUp, {
    wins: 0,
    losses: 1,
    draws: 0,
    ko: 0,
    sub: 0,
    decision: 0,
  });
  check(totalsBefore.wins === 1, `緊急修正(a): Wikipedia未収録時は+1補正が効く (got wins${totalsBefore.wins})`);

  // Wikipedia側が独自にこのboutを取り込んだ後(生historyに既に存在する状態)。
  // 生値(totals引数)も既にこのboutを反映した値になっているはずなので、
  // ここでさらに+1すると二重加算になる。新実装はrawHistoryに存在するため
  // 加算をスキップし、二重加算しない。
  const rawHistoryAfterWikiCatchesUp = [
    { date: "2023-05-06", opponent: "三浦孝太", result: "win" as const, method: "1R KO", event: "RIZIN.42", round: "R1" },
    { date: "2023-12-31", opponent: "平本蓮", result: "loss" as const, method: "判定0-3", event: "RIZIN.45", round: "R3" },
  ];
  const totalsAfter = applyRecordOverridesToTotals("ya-man", rawHistoryAfterWikiCatchesUp, {
    wins: 1, // Wikipedia側が追いついて既にこのboutを反映した生値
    losses: 1,
    draws: 0,
    ko: 1,
    sub: 0,
    decision: 0,
  });
  check(
    totalsAfter.wins === 1 && totalsAfter.ko === 1,
    `緊急修正(a): Wikipedia側が追いついた後は加算をスキップし二重加算しない(冪等) (got wins${totalsAfter.wins} ko${totalsAfter.ko})`
  );

  // (b) 分離原則: 通算戦績(総合格闘技 戦績)はWiki/シード値を据え置く。GAMMA等の
  // 他団体戦績が混入したhistoryを都度カウントすることはしない、という原則を
  // 明文化する回帰テスト(シェイドゥラエフ19-0が22-0に水増しされた事故の再発防止)。
  // rizinRecords由来のRIZIN集計(computeFighterMmaRecord)はrizinRecords.jsonのみを
  // 対象とするため、GAMMA等の非RIZIN団体戦は最初からデータに存在せず、この種の
  // 混入は構造的に起こり得ない(test-rizin-records-aggregate.tsで別途検証済み)。

  // (c) totalsAlreadyReflected: 集計値(infobox)は既に対象boutを反映済みだが、
  // 試合結果テーブル(Fight-cont)にだけ欠落しているケース(鈴木博昭の平本蓮戦)。
  // historyには追加するが、集計値には加算しない(既に正しいため)。
  const totalsUnchanged = applyRecordOverridesToTotals("suzuki-hiroaki", [], {
    wins: 6,
    losses: 6,
    draws: 0,
    ko: 4,
    sub: 0,
    decision: 2,
  });
  check(
    totalsUnchanged.wins === 6 && totalsUnchanged.losses === 6,
    `totalsAlreadyReflected: 集計値には加算しない(鈴木博昭6勝6敗のまま) (got ${totalsUnchanged.wins}勝${totalsUnchanged.losses}敗)`
  );
  const suzukiHistory = applyRecordOverrides("suzuki-hiroaki", []);
  check(
    suzukiHistory.some((h) => h.date === "2022-07-02" && h.opponent === "平本蓮"),
    "totalsAlreadyReflected: historyへの追加(試合結果テーブル表示)は行われる"
  );
}

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);
