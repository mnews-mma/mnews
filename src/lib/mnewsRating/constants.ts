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
// v8(2026-07-17): H2H単調性オーバーレイの距離制限(N=2)撤廃・複数回対戦は
// 直近結果優先に変更(P0-B)。σディスカウントのn=1キャップ追加(P1)。
export const ALGORITHM_VERSION = 8;

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

// 2026-07-16【不採用・却下・設計ノート】: 小サンプル補正(表示レートのshrinkage)。
// 数学的に「両者の生レートが母集団平均の同じ側にある場合、kをどう変えても
// 順序を反転できない」ことが判明した(shrunk = target + (raw-target)*n/(n+k)
// という凸結合の性質上、targetを挟まない2値は常に同じ大小関係を保つ)。
// 当初の目標設定(篠塚を冨澤より下げる)自体が直接対決の事実(2025-12-31、
// 篠塚が冨澤に勝利済み)に反していたため、この目標は撤回した。「篠塚>冨澤」は
// H2Hとして正しく、反転させるべき対象ではない(下記SIGMA_DISCOUNT_COEFFICIENT_V7
// 参照)。関数(engine.ts applyDisplayShrinkage)自体は不採用の記録として残置。
export const DISPLAY_SHRINKAGE_PARAMS_V7: ShrinkageParams = { k: 4 };

// 2026-07-16採用・確定(v7): 不確実性ディスカウント。
// 順位付け指標を R - coefficient/√n に変更する(σ(n)=C/√nのCとkを一本化した
// 単一係数)。対戦数nが少ない選手ほど一律に順位を割り引く演算子で、shrinkageと
// 異なり「平均のどちら側にいるか」に依存せず対戦数の多寡そのもので順序を
// 動かせる(この性質差がP1をshrinkageからσディスカウントへ置き換えた理由)。
//
// 【本丸】フライ級で2戦の篠塚辰樹が8戦4勝4敗の征矢貴より上位に浮く問題
// (小サンプルの過信)を、対戦数の多い征矢を守り対戦数の少ない篠塚を下げる形で
// 是正する。これがKainaが最初に指摘した不満の直接解決。
//
// 【D=70に決定した理由】(全階級比較ダンプ、6候補[30,50,70,100,130,160]で検証)
// - 征矢>篠塚: D=50では順位差1で脆い。D=70では順位差4と余裕があり、征矢の
//   優位が安定する。この逆転はσディスカウント単体で成立する(H2Hペアで
//   ないため下記の単調性オーバーレイに依存しない=頑健)。
// - 篠塚>冨澤(H2H): D=70では生のσ順位でもなお篠塚が僅かに上(約3pt差)を
//   保っており、単調性オーバーレイ(下記)はその上にバックストップとして
//   効く(オーバーレイに順序決定を依存しない=理想形)。
// - D>=100は却下: 篠塚と冨澤の順位差がオーバーレイの許容差(N=2)を超えて
//   広がり、Kainaが「直接対決の事実として正しい」と確定させた篠塚>冨澤の
//   順序自体が壊れる。
// - 他階級(バンタム/フェザー/ライト/ヘビー)はいずれの候補でも「対戦数が
//   多い選手が薄いサンプルの選手に対して相対的に順位を上げる」という設計
//   どおりの挙動のみで、不可解な崩れは検出されなかった。
// - 階級ごとに値を振ることはしない(全階級共通の単一定数)。個別階級への
//   最適化はオーバーフィットであり、一般ルールという設計原則に反するため。
//
// 【次フェーズ(今回は着手しない)】このσ=C/√nは簡易proxyであり、将来
// 階級を跨いだ運用で破綻が見つかった場合はGlicko-2(μ・RD nativeでμ-2·RDを
// 順位指標にする)への正式移行を検討する。ヒロヤ戦のようなupset(格下勝ち)
// への敗北ペナルティ強化(ELO_PARAMS_V6候補、weakLossBoost 1.1→1.4)は
// 別レバーとして保留のまま(今回のD=70確定とは独立)。
export const SIGMA_DISCOUNT_COEFFICIENT_V7 = 70;

// 2026-07-16採用・確定(v7): 直接対決の単調性オーバーレイをONで運用する。
// σディスカウントが対戦数の少ない選手を押し下げた結果、直接対決で勝っている
// 相手より下位に落ちてしまうケースを復元する。D=70では篠塚>冨澤の関係を
// 主に生のσ順位そのものが満たしており、このオーバーレイは「万一の際の保険」
// として機能する(このオーバーレイの発火に順序決定を依存させない設計)。
//
// 2026-07-17(P0-B)改訂: 順位差の距離制限(旧MONOTONICITY_MAX_RANK_GAP=2)を
// 撤廃し、同階級のH2Hは距離無制限のハード制約にした。契機は元谷友貴(2戦)が
// トニー・ララミー(直接対決で敗北)より上位に表示される実例の調査(P0-A、
// 2026-07-17)。ただし元谷のケース自体は距離制限が原因ではなく、元谷友貴>
// 神龍誠>伊藤裕樹>トニー・ララミー>元谷友貴という4者循環にこの一戦が
// 含まれていたことが原因(循環はスキップする設計を維持しているため、この
// 一戦単独では補正されない=想定どおりの挙動、バグではない)。距離制限の
// 撤廃自体は、循環に含まれない離れた順位のH2H違反(例: テミロフ>福田)を
// 救うための一般化。循環(A>B>C>A)が検出された組は引き続き補正をスキップ
// する(monotonicity.ts参照)。複数回対戦しているペアは直近の対戦結果を
// 正とする(同ファイルのresolvePairDirections参照)。

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
