// mnewsレーティング エンジンのユニットテスト。
// リポジトリに既存のテストフレームワークが無いため(check-fighter-records-integrity.ts
// と同じ流儀で)tsxで直接実行するassertベースのスクリプトにしている。
// 実行: npx tsx scripts/test-mnews-rating.ts
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  filterPublishableStates,
  isEligible,
  applyInactivityDecay,
  FighterRecordsInput,
  RatingState,
} from "../src/lib/mnewsRating/engine";
import { DECAY_FLOOR } from "../src/lib/mnewsRating/constants";
import {
  buildDivisionRankings,
  hasRankingChange,
  shouldSuppressDelta,
  DivisionRankings,
  ChampionOverlay,
} from "../src/lib/mnewsRating/rankingsFile";
import { applyRecordOverrides, applyRecordOverridesToTotals } from "../src/lib/mnewsRating/recordOverrides";
import { getDivisionRankingView, getPublishedDivisionRankingView } from "../src/lib/mnewsRating/divisionRankingView";
import { PUBLISHED_DIVISIONS, latestRizinDivision } from "../src/lib/mnewsRating/divisions";

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
    algorithmVersion: 2,
    champion: null,
    entries: [{ fighterId: "fighter-v1", rank: 1, rating: 1500, delta: 0, record: { wins: 3, losses: 2, draws: 0 }, lastFight: "2025-12-01", weighInMiss: false }],
  };
  const sameVersionResult = buildDivisionRankings("フェザー級", pool, new Date("2026-01-02"), prevSameVersion, null);
  check(sameVersionResult.entries[0].delta === 50, `バージョン不変日: 通常どおりdeltaが算出される (got ${sameVersionResult.entries[0].delta})`);

  const prevOldVersion: DivisionRankings = { ...prevSameVersion, algorithmVersion: 1 };
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

  const totals = applyRecordOverridesToTotals("ya-man", { wins: 2, losses: 2, draws: 0, ko: 2, sub: 0, decision: 0 });
  check(totals.wins === 3 && totals.losses === 2, `戦績訂正オーバーライド: 集計値もYA-MAN 3勝2敗に是正される (got ${totals.wins}-${totals.losses})`);

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

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);
