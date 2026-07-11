// mnewsレーティング: パラメータ定義。
// 「算出方法の完全公開」が編集部ランキングとの差別化のため、この定数群はそのまま
// /rankings/methodology に転記される前提。秘匿しない(旧Mレーティングの
// server-only非公開方式とは方針が逆)。
export const RATING_NAME = "mnewsレーティング";
export const RATING_KEY = "mnewsRating";

// 係数を変更したらインクリメントし、CHANGELOGに記録する。
export const ALGORITHM_VERSION = 1;

export const INITIAL_RATING = 1500;
export const K_BASE = 32; // 判定勝ち・ドロー
export const K_FINISH = 40; // KO/TKO・一本勝ち(フィニッシュボーナス)

export const DECAY_PERIOD_DAYS = 180; // 6ヶ月
export const DECAY_PER_PERIOD = 25;
export const DECAY_FLOOR = 1400;

export const ELIGIBILITY_MIN_FIGHTS = 3;
export const ELIGIBILITY_MIN_WINS = 1;
export const ELIGIBILITY_MAX_INACTIVE_MONTHS = 18;
