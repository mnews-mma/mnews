// mnewsレーティング: 純関数Eloエンジン。I/O(fs/fetch)を一切持たない。
// 呼び出し側(scripts/compute-mnews-rating.ts、将来のrankings.json生成バッチ)が
// data/fighterRecords.json と選手名インデックスを読み込み、ここへ渡す。
// 同じ入力(records + resolveOpponentSlug + asOf)なら必ず同じ出力になる決定論的
// フル再計算(冪等性優先・差分計算はしない)。
import {
  DECAY_FLOOR,
  DECAY_PERIOD_DAYS,
  DECAY_PER_PERIOD,
  ELIGIBILITY_MAX_INACTIVE_MONTHS,
  ELIGIBILITY_MIN_FIGHTS,
  ELIGIBILITY_MIN_WINS,
  INITIAL_RATING,
  K_BASE,
  K_FINISH,
} from "./constants";

export interface HistoryEntryLike {
  date: string;
  opponent: string;
  result: "win" | "loss" | "draw" | "nc";
  method: string;
  event: string;
  round?: string;
  weightClass?: string;
  // rizinRecords.json(RIZIN公式ソース)由来のオープニングファイト判定
  // (カード最下位=前座)。マッチする公式データが無い試合はundefined
  // (前座かどうか不明。掲載資格カウントからは除外しない=推測補完しない)。
  isOpeningFight?: boolean;
}

export interface FighterRecordEntryLike {
  history: HistoryEntryLike[];
}

export type FighterRecordsInput = Record<string, FighterRecordEntryLike>;

export interface ExclusionWarning {
  slug: string;
  date: string;
  opponent: string;
  reason: string;
}

export type MethodClass = "finish" | "decision" | "unknown";

const NON_MMA_EVENT_KEYWORDS = /キックルール|kickboxing|エキシビション|exhibition/i;

// RIZIN開催のMMAルール試合のみを対象にする(キックルール・エキシビションは除外)。
export function isRizinMmaEvent(eventName: string): boolean {
  const ev = eventName ?? "";
  if (!/RIZIN/i.test(ev)) return false;
  if (NON_MMA_EVENT_KEYWORDS.test(ev)) return false;
  return true;
}

// 計量オーバーの検知キーワード。現状のfighterRecords.json(method/event文字列)には
// 計量関連の記載が一切無い(データ実地調査で確認済み)ため、この関数は今のところ
// 常にfalseを返す。捏造せず、将来データソースに計量情報が加われば自動で拾える
// よう構造だけ用意しておく。
const WEIGH_IN_MISS_KEYWORDS = /計量.*(オーバー|失敗|未達)|オーバーウェイト/;

export function detectWeighInMiss(h: Pick<HistoryEntryLike, "method" | "event">): boolean {
  return WEIGH_IN_MISS_KEYWORDS.test(`${h.method ?? ""} ${h.event ?? ""}`);
}

// method文字列(例: "1R 1:08 KO（右ストレート）" "5分3R終了 判定3-0"
// "2R 3:44 リアネイキッドチョーク")からフィニッシュ/判定を分類する。
// 空文字・欠損は unknown とし、勝手に決着種別を推測しない。
export function classifyMethod(method: string): MethodClass {
  const m = (method ?? "").trim();
  if (!m) return "unknown";
  if (/判定/.test(m)) return "decision";
  if (/KO/i.test(m)) return "finish"; // TKOも"KO"を含むため同時に拾う
  // 判定でもKO/TKOでもない場合、この戦績フォーマットでは一本勝ちの技名のみが
  // 記載される(データ実地調査で確認済み)。
  return "finish";
}

// aNode/bNode: 自社DB(fighterRecords.json)のキー、または自社DB圏外の相手を表す
// 疑似ノードID(`name:正規化名`)。圏外の相手も同じ正規化名で登場するたびに
// 同一ノードとして扱われ、Eloレートが毎回1500へリセットされずに引き継がれる
// (公開されるのはfighterRecords.jsonのキーに対応するノードのみ。
// filterPublishableStates参照)。
export interface Bout {
  key: string;
  date: string;
  aNode: string;
  bNode: string;
  opponentLabel: string; // 表示・ログ用の相手名(history.opponentそのまま)
  scoreA: number; // aNode視点: 1=勝ち, 0=負け, 0.5=分け
  finish: boolean;
  method: string; // 同一実試合の重複検知(dedupeGhostWallBouts)に使う
  weightClass?: string; // 掲載資格の階級変更検出(eligibilityRules.ts)に使う。EVENT_RESULTS突合分のみ判明
  // オープニングファイト(前座)判定。Elo計算(computeRawRatings)には一切
  // 使わない(順位・レートへの手動介入はしない)。掲載資格カウント
  // (eligibilityRules.ts)でのみ参照する。未設定はfalse扱い(前座でない)。
  isOpeningFight?: boolean;
}

export interface BuildBoutsResult {
  bouts: Bout[];
  warnings: ExclusionWarning[];
}

function normalizeOpponentName(s: string): string {
  return s.replace(/[\s　・]/g, "");
}

// 計量オーバー側が勝った試合はノーコンテスト裁定として扱う(J-1)。
// lookupWeighInMissが返す"self"/"opponent"は「このhistoryエントリの持ち主(self)と
// 対戦相手(opponent)のどちらが計量オーバーしたか」を表す。オーバーした側が
// 勝った場合のみノーコンテストに倒す(負け・引き分けなら通常どおり)。
export function applyWeighInMissRuling(
  result: HistoryEntryLike["result"],
  missedBy: "self" | "opponent" | null
): HistoryEntryLike["result"] {
  if (!missedBy) return result;
  if (missedBy === "opponent" && result === "loss") return "nc"; // 相手(計量オーバー)が勝った
  if (missedBy === "self" && result === "win") return "nc"; // 自分(計量オーバー)が勝った
  return result;
}

// records内の全選手の全履歴からRIZIN MMA試合のみを抽出し、対戦の配列にする。
// DB内対決(両者がfighterRecords.jsonのキー)は日付+両ノードで重複排除する
// (両者の履歴に二重計上されるのを防ぐ)。その際、両者の記録の勝敗方向が食い違う
// 場合(例: 双方が「自分が勝った」と記録している)は自動判定せずその対戦を
// 除外してwarningに出す。決着種別(フィニッシュ/判定)のみの食い違いは、
// 勝敗自体は一致しているため除外はせず保守的にK=32(判定)側へ倒す。
// resolveOpponentSlug: history.opponent(自由記述の名前)→自社DB内の相手slug。
// 解決できない、またはfighterRecords.json未収録の場合はnullを返してよい
// (その場合は正規化名の疑似ノードとして扱う)。
// getKnownNames: slug→既知の名前表記一覧(dedupeGhostWallBouts用、省略可)。
// lookupWeighInMiss: (fighterId,date,opponent)→計量オーバーした側(省略可、
// 常にnullを返す関数がデフォルト=計量オーバー考慮なし)。
// lookupOpeningFightOverride: (fighterId,date,opponent)→この試合を強制的に
// オープニングファイト扱いにするか(省略可、常にfalseを返す関数がデフォルト)。
// rizinRecords.json由来のisOpeningFight判定を補う一度きりの個別指定用
// (例: 「喧嘩三番勝負」のような通常の前座判定に乗らないミニシリーズ)。
export function buildBouts(
  records: FighterRecordsInput,
  resolveOpponentSlug: (opponentName: string, selfSlug: string) => string | null,
  getKnownNames: (slug: string) => string[] = () => [],
  lookupWeighInMiss: (fighterId: string, date: string, opponent: string) => "self" | "opponent" | null = () => null,
  asOf: Date = new Date(),
  lookupOpeningFightOverride: (fighterId: string, date: string, opponent: string) => boolean = () => false
): BuildBoutsResult {
  const warnings: ExclusionWarning[] = [];
  const boutMap = new Map<string, Bout>();
  const conflictKeys = new Set<string>();
  // 開催日がasOfより未来の「結果」は、データソース側の誤り(Wikipediaの
  // いたずら・時期尚早な編集等で、開催前の試合に確定済みの結果が書き込まれる
  // ケースが実在した=カルシャガ・ダウトベックのRIZIN LANDMARK 15/超RIZIN.5戦)
  // であり、集計から一律除外する一般ルール。個別選手のハードコード対応はしない。
  const asOfKey = asOf.toISOString().slice(0, 10);

  for (const [slug, entry] of Object.entries(records)) {
    for (const h of entry.history ?? []) {
      if (!isRizinMmaEvent(h.event)) continue;
      if (h.result === "nc") continue; // ノーコンテスト・無効試合はレート変動なし

      if (!h.date || !h.opponent) {
        warnings.push({ slug, date: h.date ?? "", opponent: h.opponent ?? "", reason: "日付または対戦相手名が欠損" });
        continue;
      }

      if (h.date > asOfKey) {
        warnings.push({
          slug,
          date: h.date,
          opponent: h.opponent,
          reason: "開催日が現在日付より未来のため除外(未開催の試合に結果が入っているデータ不整合の可能性)",
        });
        continue;
      }

      const missedBy = lookupWeighInMiss(slug, h.date, h.opponent);
      const effectiveResult = applyWeighInMissRuling(h.result, missedBy);
      if (effectiveResult === "nc") {
        warnings.push({
          slug,
          date: h.date,
          opponent: h.opponent,
          reason: `計量オーバー側(${missedBy === "self" ? slug : h.opponent})の勝利のためノーコンテスト裁定として除外`,
        });
        continue;
      }

      const cls = classifyMethod(h.method);
      if (cls === "unknown") {
        warnings.push({ slug, date: h.date, opponent: h.opponent, reason: "決着方法(method)が空でフィニッシュ/判定を判定不能" });
        continue;
      }

      const scoreA = effectiveResult === "win" ? 1 : effectiveResult === "draw" ? 0.5 : 0;
      const finish = cls === "finish";
      const isOpeningFight = (h.isOpeningFight ?? false) || lookupOpeningFightOverride(slug, h.date, h.opponent);

      const resolvedSlug = resolveOpponentSlug(h.opponent, slug);
      if (resolvedSlug === slug) {
        warnings.push({ slug, date: h.date, opponent: h.opponent, reason: "対戦相手が自分自身に解決された(データ不整合)" });
        continue;
      }

      const isDbOpponent = !!resolvedSlug && !!records[resolvedSlug];

      if (isDbOpponent) {
        const oppSlug = resolvedSlug as string;
        // DB内対決: date + sorted(node) で一意化。scoreは常に「ソート先頭ノード視点」に揃える。
        const [a, b] = [slug, oppSlug].sort();
        const key = `db|${h.date}|${a}|${b}`;
        const scoreForA = a === slug ? scoreA : 1 - scoreA;

        if (conflictKeys.has(key)) continue; // 既に勝敗矛盾を検出し除外確定済み

        const existing = boutMap.get(key);
        if (existing) {
          const scoreMismatch = Math.abs(existing.scoreA - scoreForA) > 1e-9;
          if (scoreMismatch) {
            warnings.push({
              slug,
              date: h.date,
              opponent: h.opponent,
              reason: "対戦相手側の記録と勝敗結果が矛盾するため除外(一次ソース確認が必要)",
            });
            boutMap.delete(key);
            conflictKeys.add(key);
            continue;
          }
          if (existing.finish !== finish) {
            warnings.push({
              slug,
              date: h.date,
              opponent: h.opponent,
              reason: "決着種別(フィニッシュ/判定)が対戦相手側の記録と食い違うため判定(K=32)扱いに倒した",
            });
            if (existing.finish) boutMap.set(key, { ...existing, finish: false });
          }
          continue;
        }

        boutMap.set(key, { key, date: h.date, aNode: a, bNode: b, opponentLabel: h.opponent, scoreA: scoreForA, finish, method: h.method, weightClass: h.weightClass, isOpeningFight });
      } else {
        // 自社DB圏外の相手: 正規化名の疑似ノード。同名相手が別の選手の履歴にも
        // 登場すればそのたびに同じノードのレートが引き継がれる(1500へは戻らない)。
        const bNode = `name:${normalizeOpponentName(h.opponent)}`;
        const key = `wall|${h.date}|${slug}|${bNode}`;
        if (boutMap.has(key)) continue;
        boutMap.set(key, { key, date: h.date, aNode: slug, bNode, opponentLabel: h.opponent, scoreA, finish, method: h.method, weightClass: h.weightClass, isOpeningFight });
      }
    }
  }

  const deduped = dedupeGhostWallBouts([...boutMap.values()], warnings, getKnownNames);
  const bouts = deduped.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.key < y.key ? -1 : 1));
  return { bouts, warnings };
}

// wallの相手名(正規化済み)が、db側のもう一方の選手の既知の名前表記
// (nameJa/nameEn/aliases、正規化済み)のいずれかを部分一致で含む/含まれるか。
// 「西谷大成」⊃「大成」のような、表記ゆれで解決に失敗したケースを拾う。
function namesRelated(wallOpponentLabel: string, otherSlug: string, getKnownNames: (slug: string) => string[]): boolean {
  const w = normalizeOpponentName(wallOpponentLabel);
  if (!w) return false;
  return getKnownNames(otherSlug).some((n) => n.length > 0 && (w.includes(n) || n.includes(w)));
}

// 「圏外相手」として登録されたwall boutが、実は別の選手側の記録が後から解決
// できたことで同じ日付のdb boutとして重複登録されているケースを検出し、
// wall bout側を除外する(db bout側は双方向で裏付けが取れているためより
// 信頼できる。残す)。判定は以下いずれかを満たす場合のみ(同日というだけで
// 統合すると、同日複数試合をこなすトーナメント形式で無関係な2試合を誤って
// 統合しうるため、必ずどちらかの強いシグナルを要求する):
//   (a) 決着文言(method)が完全一致
//   (b) 勝敗方向が一致 かつ wallの相手名がdb側のもう一方の選手の既知の名前と
//       部分一致で関連付けられる(表記ゆれ)
// 実例: 西谷大成(fighters.ts上のnameJaは「大成」)は、対戦相手側の履歴では
// 「西谷大成」表記で記録され解決に失敗し続けていたが、本人のWikipedia記事が
// 後日解決されたことで本人視点のdb boutが新たに生成され、萩原京平・高木凌・
// 鈴木博昭の3選手でそれぞれ同一試合が二重計上されていた(高木凌×コレスニック
// の勝敗矛盾検出と同種の「一次データの後発的解決による整合崩れ」)。萩原京平の
// ケースはmethod文言が両者で異なっていたため(a)では拾えず、(b)で拾う。
function dedupeGhostWallBouts(
  bouts: Bout[],
  warnings: ExclusionWarning[],
  getKnownNames: (slug: string) => string[]
): Bout[] {
  const dbBoutsByFighterDate = new Map<string, Bout[]>();
  for (const b of bouts) {
    if (b.bNode.startsWith("name:")) continue; // wallはキーに登録しない(db同士のみ)
    for (const node of [b.aNode, b.bNode]) {
      const key = `${node}|${b.date}`;
      const list = dbBoutsByFighterDate.get(key) ?? [];
      list.push(b);
      dbBoutsByFighterDate.set(key, list);
    }
  }

  return bouts.filter((b) => {
    if (!b.bNode.startsWith("name:")) return true; // dbはそのまま残す
    const candidates = dbBoutsByFighterDate.get(`${b.aNode}|${b.date}`) ?? [];
    for (const dup of candidates) {
      const sameMethod = dup.method === b.method;
      const otherSlug = dup.aNode === b.aNode ? dup.bNode : dup.aNode;
      const dupScoreForA = dup.aNode === b.aNode ? dup.scoreA : 1 - dup.scoreA;
      const consistentDirection = Math.abs(dupScoreForA - b.scoreA) < 1e-9;
      if (!sameMethod && !(consistentDirection && namesRelated(b.opponentLabel, otherSlug, getKnownNames))) continue;

      warnings.push({
        slug: b.aNode,
        date: b.date,
        opponent: b.opponentLabel,
        reason: sameMethod
          ? `対戦相手側の解決済み記録(${otherSlug})と同一試合(同日・同決着文言)と判定し重複除外`
          : `対戦相手側の解決済み記録(${otherSlug})と同一試合(同日・相手名の表記ゆれ・勝敗方向一致)と判定し重複除外`,
      });
      return false;
    }
    return true;
  });
}

export interface RatingState {
  rawRating: number;
  fights: number;
  wins: number;
  losses: number;
  draws: number;
  lastFightDate: string | null;
}

function freshState(initialRating: number = INITIAL_RATING): RatingState {
  return { rawRating: initialRating, fights: 0, wins: 0, losses: 0, draws: 0, lastFightDate: null };
}

// RIZIN参戦前の戦績(pre-debut record)を機械算出するためのMMAルール判定。
// isRizinMmaEventのキックルール/エキシビション除外キーワードは団体を問わず
// 一般に通用するため、他団体のhistoryエントリにもそのまま適用する。
export function isMmaRuleEvent(eventName: string): boolean {
  return !NON_MMA_EVENT_KEYWORDS.test(eventName ?? "");
}

export interface PreDebutRecord {
  wins: number;
  losses: number;
  draws: number;
  fights: number;
}

// 各選手のRIZIN初参戦日(=最も古いRIZIN MMA boutの日付)より前の全団体での
// 戦績を、既存のhistory(Wiki/DATA MMA由来の全団体戦歴)から機械的に数える。
// RIZIN初参戦が無い選手(まだRIZINで戦っていない)はMap未登録(呼び出し側は
// 存在しない場合0扱い=補正なしとして扱う)。手動の選手別数値は一切使わない。
export function computePreDebutRecords(records: FighterRecordsInput): Map<string, PreDebutRecord> {
  const out = new Map<string, PreDebutRecord>();
  for (const [slug, entry] of Object.entries(records)) {
    const history = entry.history ?? [];
    const rizinMmaDates = history.filter((h) => isRizinMmaEvent(h.event) && h.date).map((h) => h.date);
    if (rizinMmaDates.length === 0) continue;
    const debutDate = rizinMmaDates.reduce((min, d) => (d < min ? d : min));

    const preDebut = history.filter((h) => h.date && h.date < debutDate && isMmaRuleEvent(h.event));
    const wins = preDebut.filter((h) => h.result === "win").length;
    const losses = preDebut.filter((h) => h.result === "loss").length;
    const draws = preDebut.filter((h) => h.result === "draw").length;
    out.set(slug, { wins, losses, draws, fights: preDebut.length });
  }
  return out;
}

// RIZIN参戦前実績の初期レートへの機械反映パラメータ。恣意的な選手別数値では
// なく、通算戦績(勝敗数)から一律の計算式で補正する。
export interface InitialRatingBoostParams {
  perNetWinPoints: number; // 参戦前の純勝ち星(勝ち-負け)1つあたりの補正点
  maxBoost: number; // 補正の絶対値上限(効きすぎ防止)
  minPreDebutFights: number; // この試合数未満の参戦前戦歴は補正対象外(ノイズ回避)
}

export const INITIAL_RATING_BOOST_OFF: InitialRatingBoostParams = { perNetWinPoints: 0, maxBoost: 0, minPreDebutFights: 3 };

export function computeInitialRatingOverrides(
  preDebutRecords: Map<string, PreDebutRecord>,
  params: InitialRatingBoostParams
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [slug, rec] of preDebutRecords) {
    if (rec.fights < params.minPreDebutFights) continue;
    const netWins = rec.wins - rec.losses;
    const boost = Math.max(-params.maxBoost, Math.min(params.maxBoost, netWins * params.perNetWinPoints));
    if (boost !== 0) out.set(slug, INITIAL_RATING + boost);
  }
  return out;
}

function expectedScore(rSelf: number, rOpp: number): number {
  return 1 / (1 + Math.pow(10, (rOpp - rSelf) / 400));
}

// 非対称傾斜Elo(v4)のパラメータ。勝ち点・負け点を対戦相手の質(対戦時点の
// レート・RIZIN実績)に応じて非対称に傾斜させる度合いを調整する。
// 全て1.0(NEUTRAL_ELO_PARAMS)なら既存のv3までの対称Eloと完全に同一の挙動になる
// (後方互換・既存テストは無変更のまま通る)。
export interface AsymmetricEloParams {
  strongWinBoost: number; // 格上に勝った時、通常の加点にかける倍率(>1で強化)
  weakWinDampen: number; // 格下に勝った時、通常の加点にかける倍率(<1で圧縮)
  strongLossDampen: number; // 格上に負けた時、通常の減点にかける倍率(<1で緩和)
  weakLossBoost: number; // 格下に負けた時、通常の減点にかける倍率(>1で強化)
  thinResumeFightThreshold: number; // この試合数(対戦時点)未満の相手への勝利は加点をさらに圧縮する
  thinResumeWinDampen: number; // ↑発動時に加点へかける追加倍率(<1で圧縮)
}

export const NEUTRAL_ELO_PARAMS: AsymmetricEloParams = {
  strongWinBoost: 1,
  weakWinDampen: 1,
  strongLossDampen: 1,
  weakLossBoost: 1,
  thinResumeFightThreshold: 0,
  thinResumeWinDampen: 1,
};

// score(自分視点): 1=勝ち, 0=負け, 0.5=分け。ドローは非対称傾斜の対象外(常に1倍)。
// 「格上/格下」は対戦時点の相手レート(opponentRating)と自分の対戦前レート
// (selfRatingBefore)の比較で判定する(後から相手が強く/弱くなった影響を受けない
// ・逐次計算=冪等性を維持)。
function asymmetricMultiplier(
  score: number,
  selfRatingBefore: number,
  opponentRating: number,
  opponentFights: number,
  params: AsymmetricEloParams
): number {
  if (score === 0.5) return 1;
  const opponentIsStronger = opponentRating > selfRatingBefore;
  let multiplier: number;
  if (score === 1) {
    multiplier = opponentIsStronger ? params.strongWinBoost : params.weakWinDampen;
    if (opponentFights < params.thinResumeFightThreshold) multiplier *= params.thinResumeWinDampen;
  } else {
    multiplier = opponentIsStronger ? params.strongLossDampen : params.weakLossBoost;
  }
  return multiplier;
}

function applyResult(
  state: RatingState,
  score: number,
  opponentRating: number,
  opponentFights: number,
  k: number,
  date: string,
  params: AsymmetricEloParams
): RatingState {
  const expected = expectedScore(state.rawRating, opponentRating);
  const multiplier = asymmetricMultiplier(score, state.rawRating, opponentRating, opponentFights, params);
  return {
    rawRating: state.rawRating + k * multiplier * (score - expected),
    fights: state.fights + 1,
    wins: state.wins + (score === 1 ? 1 : 0),
    losses: state.losses + (score === 0 ? 1 : 0),
    draws: state.draws + (score === 0.5 ? 1 : 0),
    lastFightDate: date,
  };
}

// 日付昇順の全対戦を逐次再生し、素のレート(rawRating)を返す。
// aNode/bNodeは自社DBのslugと圏外相手の疑似ノードを区別しない(どちらも同じ
// Eloロジックで更新する)。公開して良いのはfighterRecords.jsonのキーに対応する
// ノードのみ(filterPublishableStates参照)。
// 冪等性優先: 常に全履歴を頭から再計算する(バッチ実行日には一切依存しない)。
// params省略時はNEUTRAL_ELO_PARAMS(対称Elo・v3までと同一挙動)。
export function computeRawRatings(
  bouts: Bout[],
  params: AsymmetricEloParams = NEUTRAL_ELO_PARAMS,
  initialRatingOverrides?: Map<string, number>
): Map<string, RatingState> {
  const states = new Map<string, RatingState>();
  const get = (id: string) => states.get(id) ?? freshState(initialRatingOverrides?.get(id));

  const sorted = [...bouts].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.key < y.key ? -1 : 1));

  for (const bout of sorted) {
    const k = bout.finish ? K_FINISH : K_BASE;
    const a = get(bout.aNode);
    const b = get(bout.bNode);
    const newA = applyResult(a, bout.scoreA, b.rawRating, b.fights, k, bout.date, params);
    const newB = applyResult(b, 1 - bout.scoreA, a.rawRating, a.fights, k, bout.date, params);
    states.set(bout.aNode, newA);
    states.set(bout.bNode, newB);
  }

  return states;
}

export interface ScopedRecord {
  wins: number;
  losses: number;
  draws: number;
  fights: number;
}

// 指定日付以降の対戦だけを対象に、勝敗を数え直す(順位・レートには一切
// 触れない。表示用の戦績スコープ起点(fighterDivisions.tsの
// eligibilityScopeStartDate)を反映するために使う。階級変更後の試合だけを
// 数えたい選手向けで、Elo自体は従来どおり全期間の対戦列で計算する)。
export function computeScopedRecord(bouts: Bout[], slug: string, scopeStartDate: string): ScopedRecord {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let fights = 0;
  for (const bout of bouts) {
    if (bout.date < scopeStartDate) continue;
    const isA = bout.aNode === slug;
    if (!isA && bout.bNode !== slug) continue;
    const score = isA ? bout.scoreA : 1 - bout.scoreA;
    fights++;
    if (score === 1) wins++;
    else if (score === 0) losses++;
    else draws++;
  }
  return { wins, losses, draws, fights };
}

// 公開可能なノードだけに絞る(fighterRecords.jsonのキーを持つ実在選手のみ)。
// 圏外相手の疑似ノードは、実在選手側のEloを正しく動かすための内部状態としてのみ
// 使い、rankings.json等の出力には一切出さない。
export function filterPublishableStates(
  states: Map<string, RatingState>,
  records: FighterRecordsInput
): Map<string, RatingState> {
  const out = new Map<string, RatingState>();
  for (const [id, state] of states) {
    if (records[id]) out.set(id, state);
  }
  return out;
}

export interface DecayParams {
  periodDays: number;
  perPeriod: number;
  floor: number;
}

export const DECAY_PARAMS_DEFAULT: DecayParams = { periodDays: DECAY_PERIOD_DAYS, perPeriod: DECAY_PER_PERIOD, floor: DECAY_FLOOR };
// 廃止版: 試合間隔での減衰を一切行わない(18ヶ月ルールで完全休眠選手は
// 既存の掲載資格側で除外されるため、ディケイ自体が冗長という仮説の検証用)。
export const DECAY_PARAMS_OFF: DecayParams = { periodDays: DECAY_PERIOD_DAYS, perPeriod: 0, floor: DECAY_FLOOR };
// 弱化版: 発動間隔そのままで減衰量を半減。
export const DECAY_PARAMS_WEAK: DecayParams = { periodDays: DECAY_PERIOD_DAYS, perPeriod: DECAY_PER_PERIOD / 2, floor: DECAY_FLOOR };

// 不活性ディケイ: 最終試合からperiodDaysごとにperPeriodを減衰(下限floor)。
// 表示用レートにのみ適用し、rawRatingには一切影響しない(次回のElo計算はrawRatingを使う)。
export function applyInactivityDecay(
  rawRating: number,
  lastFightDate: string | null,
  asOf: Date,
  decayParams: DecayParams = DECAY_PARAMS_DEFAULT
): number {
  if (!lastFightDate) return rawRating;
  const lastMs = new Date(lastFightDate).getTime();
  const daysSince = (asOf.getTime() - lastMs) / 86400000;
  const periods = Math.floor(daysSince / decayParams.periodDays);
  if (periods <= 0) return rawRating;
  return Math.max(decayParams.floor, rawRating - periods * decayParams.perPeriod);
}

export interface DisplayEntry {
  slug: string;
  rawRating: number;
  displayRating: number;
  fights: number;
  wins: number;
  losses: number;
  draws: number;
  lastFightDate: string | null;
  eligible: boolean;
}

export interface EligibilityCounts {
  fights: number;
  wins: number;
  lastFightDate: string | null;
}

// 掲載資格: RIZIN通算3試合以上・直近18ヶ月以内に試合・RIZIN1勝以上。
// RatingStateはEligibilityCountsのスーパーセットなのでそのまま渡せる(既存呼び出し
// 元は無変更)。B-2(階級変更後の資格スコープ)が階級限定のfights/winsだけを
// 差し替えて同じ判定を再利用できるよう、引数の型を最小限に絞ってある。
export function isEligible(state: EligibilityCounts, asOf: Date): boolean {
  if (state.fights < ELIGIBILITY_MIN_FIGHTS) return false;
  if (state.wins < ELIGIBILITY_MIN_WINS) return false;
  if (!state.lastFightDate) return false;
  const monthsSince = (asOf.getTime() - new Date(state.lastFightDate).getTime()) / (30.44 * 86400000);
  if (monthsSince > ELIGIBILITY_MAX_INACTIVE_MONTHS) return false;
  return true;
}

export function buildDisplayEntries(
  states: Map<string, RatingState>,
  asOf: Date,
  decayParams: DecayParams = DECAY_PARAMS_DEFAULT
): Map<string, DisplayEntry> {
  const out = new Map<string, DisplayEntry>();
  for (const [slug, state] of states) {
    out.set(slug, {
      slug,
      rawRating: state.rawRating,
      displayRating: applyInactivityDecay(state.rawRating, state.lastFightDate, asOf, decayParams),
      fights: state.fights,
      wins: state.wins,
      losses: state.losses,
      draws: state.draws,
      lastFightDate: state.lastFightDate,
      eligible: isEligible(state, asOf),
    });
  }
  return out;
}
