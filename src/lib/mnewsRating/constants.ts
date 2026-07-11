// mnewsレーティング: パラメータ定義。
// 「算出方法の完全公開」が編集部ランキングとの差別化のため、この定数群はそのまま
// /rankings/methodology に転記される前提。秘匿しない(旧Mレーティングの
// server-only非公開方式とは方針が逆)。
export const RATING_NAME = "mnewsレーティング";
export const RATING_KEY = "mnewsRating";

// 係数を変更したらインクリメントし、CHANGELOG(/rankings/methodology)に記録する。
export const ALGORITHM_VERSION = 2;

export const INITIAL_RATING = 1500;
export const K_BASE = 32; // 判定勝ち・ドロー
export const K_FINISH = 40; // KO/TKO・一本勝ち(フィニッシュボーナス)

export const DECAY_PERIOD_DAYS = 180; // 6ヶ月
export const DECAY_PER_PERIOD = 25;
export const DECAY_FLOOR = 1400;

export const ELIGIBILITY_MIN_FIGHTS = 3;
export const ELIGIBILITY_MIN_WINS = 1;
export const ELIGIBILITY_MAX_INACTIVE_MONTHS = 18;

// 王者の表示方式(UFC方式がデフォルト)。
// "overlay": 番号付きランキングから王者を除外し、最上段に別掲載する(1位=王者を
//   除いたトップレート選手になる)。
// "badge": 王者もリストに残したまま、該当行にバッジのみ付ける(除外しない)。
// この定数1つで切替可能(ページ側のロジックはrankingsFile.tsのbuildDivisionRankings
// に一本化してあるため、切替時にページコンポーネントを直接いじる必要はない)。
export const CHAMPION_DISPLAY_MODE: "overlay" | "badge" = "overlay";
