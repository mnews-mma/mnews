// AI RIZINランキング(内部コード名は既存のまま: mnewsRating/mnewsレーティング):
// パラメータ定義。2026-07-13、公開方針をD案(原則・方針は公開/具体的な係数・数値・
// 実装手口は非公開)に変更した。/rankings/methodology には評価の原則のみを
// 一般記述で載せ、この定数群の具体的な数値そのものは転記しない。
import type { AsymmetricEloParams } from "./engine";

// 表示名(D-1、2026-07-13): 外向き表示は「AI RIZINランキング」に統一。
// RATING_NAME/RATING_KEYという定数名自体は内部コード名のため変更しない
// (値=表示テキストのみを変更する)。
export const RATING_NAME = "AI RIZINランキング";
export const RATING_KEY = "mnewsRating";

// 算出方法を変更したらインクリメントする。
export const ALGORITHM_VERSION = 5;

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
