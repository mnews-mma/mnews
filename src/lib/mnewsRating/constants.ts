// AI RIZINランキング(内部コード名は既存のまま: mnewsRating/mnewsレーティング):
// パラメータ定義。2026-07-13、公開方針をD案(原則・方針は公開/具体的な係数・数値・
// 実装手口は非公開)に変更した。/rankings/methodology には評価の原則のみを
// 一般記述で載せ、この定数群の具体的な数値そのものは転記しない。
import type { AsymmetricEloParams, DecayParams, InitialRatingBoostParams, ShrinkageParams } from "./engine";

// 表示名(D-1、2026-07-13): 外向き表示は「AI RIZINランキング」に統一。
// RATING_NAME/RATING_KEYという定数名自体は内部コード名のため変更しない
// (値=表示テキストのみを変更する)。
export const RATING_NAME = "AI RIZINランキング";
export const RATING_KEY = "mnewsRating";

// 算出方法を変更したらインクリメントする。
export const ALGORITHM_VERSION = 6;

export const INITIAL_RATING = 1500;
export const K_BASE = 32; // 判定勝ち・ドロー
export const K_FINISH = 40; // KO/TKO・一本勝ち(フィニッシュボーナス)

export const DECAY_PERIOD_DAYS = 180; // 6ヶ月
export const DECAY_PER_PERIOD = 25;
export const DECAY_FLOOR = 1400;

export const ELIGIBILITY_MIN_FIGHTS = 3;
export const ELIGIBILITY_MIN_WINS = 1;
export const ELIGIBILITY_MAX_INACTIVE_MONTHS = 18;

// 2026-07-13追加(v4): 通算3戦未満でも、直近活動が濃い選手を拾うための代替基準。
// 「通算3戦以上」OR「ELIGIBILITY_RECENT_YEAR_START年以降にELIGIBILITY_RECENT_MIN_FIGHTS戦以上」
// のいずれかを満たせば試合数の要件をクリアする(1勝以上・18ヶ月以内は従来どおり必須)。
// 2026-07-13(v5)で2戦だと通算1勝1敗のような薄い戦績でも掲載されてしまう
// (直樹のケース)として一度3戦に引き上げたが、根本原因は基準の甘さではなく
// 「オープニングファイト(前座)が資格カウントに混入していたこと」と判明
// (直樹の2025-07-28芦田崇宏戦は喧嘩三番勝負=実質前座)。オープニングファイトを
// 資格カウントから除外する一般ルールを別途追加したため、代替基準自体は
// 2戦に戻す(この2戦の引き上げにより不当に脱落していたズマガジー・野村駿太を
// 復活させる)。
export const ELIGIBILITY_RECENT_MIN_FIGHTS = 2;
export const ELIGIBILITY_RECENT_YEAR_START = "2025";

// 王者の表示方式(UFC方式がデフォルト)。
// "overlay": 番号付きランキングから王者を除外し、最上段に別掲載する(1位=王者を
//   除いたトップレート選手になる)。
// "badge": 王者もリストに残したまま、該当行にバッジのみ付ける(除外しない)。
// この定数1つで切替可能(ページ側のロジックはrankingsFile.tsのbuildDivisionRankings
// に一本化してあるため、切替時にページコンポーネントを直接いじる必要はない)。
export const CHAMPION_DISPLAY_MODE: "overlay" | "badge" = "overlay";

// 非対称傾斜Eloのパラメータプリセット。比較検証用に3段階を用意し、目視レビュー
// の結果MODERATEを採用した。MILD/STRONGは将来の再検討用に残す(過去バージョンの参照用)。
export const ELO_PARAMS_MILD: AsymmetricEloParams = {
  strongWinBoost: 1.15,
  weakWinDampen: 0.85,
  strongLossDampen: 0.85,
  weakLossBoost: 1.15,
  thinResumeFightThreshold: 3,
  thinResumeWinDampen: 0.7,
};

export const ELO_PARAMS_MODERATE: AsymmetricEloParams = {
  strongWinBoost: 1.3,
  weakWinDampen: 0.7,
  strongLossDampen: 0.7,
  weakLossBoost: 1.3,
  thinResumeFightThreshold: 3,
  thinResumeWinDampen: 0.5,
};

export const ELO_PARAMS_STRONG: AsymmetricEloParams = {
  strongWinBoost: 1.5,
  weakWinDampen: 0.5,
  strongLossDampen: 0.5,
  weakLossBoost: 1.5,
  thinResumeFightThreshold: 3,
  thinResumeWinDampen: 0.3,
};

// 2026-07-13(v5)追加: MODERATEの対称強化(勝ち側・負け側を同倍率で強める)は
// 「自分の対戦前レートを基準に格上/格下を判定する」という仕組み上、直近で
// 連敗した選手(自分の過去の高レートを基準に「格下に負けた」と判定されやすい)
// をさらに沈め、逆に戦績が乱高下する選手(自分の一時的に下がったレートを基準に
// 「格上を撃破した」と判定されやすい)をさらに持ち上げる、という比較ダンプでの
// 目視レビューの結果判明した逆効果があった。勝ち側だけを強める非対称な調整
// (weakLossBoostは現状維持に近い水準に留める)の方が意図に近い動きをしたため、
// v5ではこちらを採用する。
export const ELO_PARAMS_V5: AsymmetricEloParams = {
  strongWinBoost: 1.8,
  weakWinDampen: 0.7,
  strongLossDampen: 0.9,
  weakLossBoost: 1.1,
  thinResumeFightThreshold: 3,
  thinResumeWinDampen: 0.5,
};

// 2026-07-13(v6)追加: 不活性ディケイの廃止 + RIZIN参戦前実績の初期レート反映。
// フライ/バンタム級で「実績組(他団体で実績を積んでからRIZIN参戦した選手)が
// 沈み、格下勝ち勢が浮く」という体感ズレを、全階級共通の一般ルール2点で
// 是正する(個別選手のハードコードはしない)。ライト級・フェザー級を含む
// 全4階級での比較ダンプ・目視レビューを経て採用(野村駿太・コレスニックの
// 順位上昇は許容範囲として容認)。
// ディケイ廃止: 試合間隔での表示レート減衰を行わない(18ヶ月ルールで
// 完全休眠選手は既に対象外になるため冗長、という判断)。
export const DECAY_PARAMS_V6: DecayParams = { periodDays: DECAY_PERIOD_DAYS, perPeriod: 0, floor: DECAY_FLOOR };
// 初期補正: RIZIN初参戦日より前の全団体戦歴(既存history)から機械算出した
// 純勝ち数(勝-負)×10pt、上限80pt・shrinkageK=5(参戦前3戦未満はノイズとして
// 補正なし)。2026-07-14、Task E「D案」として上限150→80pt+shrinkage(実戦試合数
// nに応じ有効補正=素の補正×n/(n+5))へ変更。理由: 上限150ptがRIZIN実戦の純増減
// (通常±数十pt)を上回り、一部選手でseedがほぼ結論を決めてしまっていたため
// (例: ビクター・コレスニックがRIZIN実戦4勝2敗・inRing-23ptにもかかわらずseed
// 150ptでフェザー級3位に押し上げられていた)。「seedは出発点のハンデ、実戦の
// 積み重ねで薄まっていく」という中間思想にもとづき、cap引き下げのみ(案A)・
// shrinkageのみ(案B)・逓減(案C)・cap+shrinkage併用(案D)を試算した結果、Dが
// 王座級の入れ替えを起こさずseed絶対値を最も圧縮できたため採用
// (docs/ranking-internal-spec-v6.md「Task Eシミュレーション結果」参照)。
export const INITIAL_RATING_BOOST_PARAMS_V6: InitialRatingBoostParams = {
  perNetWinPoints: 10,
  maxBoost: 80,
  minPreDebutFights: 3,
  shrinkageK: 5,
};

// 2026-07-16【不採用・却下】: 小サンプル補正(表示レートのshrinkage)。
// 数学的に「両者の生レートが母集団平均の同じ側にある場合、kをどう変えても
// 順序を反転できない」ことが判明し(比較ダンプで実証済み)、そもそもの目標
// 設定(篠塚を冨澤より下げる)自体が直接対決の事実(篠塚が冨澤に勝利済み)に
// 反すると判断されたため方針転換。下記のSIGMA_DISCOUNT_CANDIDATESに置き換えた。
export const DISPLAY_SHRINKAGE_PARAMS_V7: ShrinkageParams = { k: 4 };

// 2026-07-16(v7候補・比較ダンプ用): 不確実性ディスカウント。
// 順位付け指標を R - coefficient/√n に変更する(σ(n)=C/√nのCとkを一本化した
// 単一係数)。対戦数nが少ない選手ほど大きく順位を割り引く。母集団平均への
// 回帰(shrinkage)と違い「平均のどちら側にいるか」に依存せず、対戦数の多寡
// そのもので順序を動かせる。フライ級の篠塚(n=2, raw≈1514.9)/征矢(n=8,
// raw≈1497.5)を逆転させるには理論上coefficient>約49.3が必要(篠塚/冨澤は
// 直接対決の単調性オーバーレイ(P2)で別途保護するため、このリストの目的では
// 篠塚/冨澤の逆転は狙わない)。複数候補を比較ダンプで確認し、最終値は目視で
// 決定する。
export const SIGMA_DISCOUNT_CANDIDATES = [30, 50, 70, 100, 130, 160];

// 2026-07-16(v7候補・比較ダンプ用): 直接対決の単調性オーバーレイをON運用する
// 場合のN(隣接何位以内まで補正対象にするか)。P1(σディスカウント)が
// 対戦数の少ない選手を押し下げた結果、直接対決で勝っている相手より下位に
// 落ちてしまうケースを、順位が近い場合に限り復元する(P1とP2は補完関係)。
export const MONOTONICITY_MAX_RANK_GAP = 2;

// 2026-07-16(v7候補・未採用): 敗北ペナルティ強化。ELO_PARAMS_V5は勝ち側
// (strongWinBoost=1.8)に比べ負け側(weakLossBoost=1.1)の傾斜が緩く、
// 「格下相手に負けた」ケースの減点が相対的に甘い。weakLossBoostのみを
// 引き上げ、strongLossDampen(格上に負けた際の緩和)は現状維持のまま
// 据え置く(ELO_PARAMS_V5採用時の「勝ち側だけ強く傾け負け側はほぼ対称のまま」
// という設計意図を踏襲し、負け側全体を対称に強めるのではなく「格下に負けた」
// ケースだけを狙って強める)。1.1→1.4は比較ダンプでの調整前の初期候補値。
export const ELO_PARAMS_V6: AsymmetricEloParams = {
  strongWinBoost: 1.8,
  weakWinDampen: 0.7,
  strongLossDampen: 0.9,
  weakLossBoost: 1.4,
  thinResumeFightThreshold: 3,
  thinResumeWinDampen: 0.5,
};
