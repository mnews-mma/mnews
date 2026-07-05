import { SourceKey } from "./sources";

// 外部公式ランキングの「スナップショット」。第2チャンク(修斗/パンクラス現ランカー・
// NEXUS現王者)の投入根拠を監査可能・再実行可能に保つための記録。
// 役割は限定: 誰を種にするか(ロスター)＋順位＋取得日を保持するだけ。戦績はここから
// 取らない(戦績の背骨は自社 EVENT_RESULTS + Wikipedia補完)。プロフィール散文は保存しない。
//
// 保持ルール: これはある時点のスナップショット。ランク外・王座陥落しても選手と戦績は
// 永久保持する(Eloの対戦グラフ保護)。ランキングが更新されたら新しいスナップショットを
// 追記し、古いものも監査のため残す方針。

export type RankKind = "champion" | "interim" | "vacant" | number;

export interface RankedEntry {
  rank: RankKind; // "champion" | "interim" | 数値順位 | "vacant"
  name: string; // 日本語表記(ソースのまま)
}

export interface RankingClass {
  weightClass: string;
  entries: RankedEntry[];
}

export interface RankingSnapshot {
  org: SourceKey; // shooto / pancrase / nexus
  source: string; // 表示名
  sourceUrl: string;
  snapshotDate: string; // 取得日 YYYY-MM-DD
  rankingLabel: string; // ソース上の版(例: 2026年6月度 世界ランキング)
  classes: RankingClass[];
}

export const RANKING_SNAPSHOTS: RankingSnapshot[] = [
  {
    org: "shooto",
    source: "修斗 世界ランキング",
    sourceUrl: "https://www.shooto-mma.com/ranking/",
    snapshotDate: "2026-07-05",
    rankingLabel: "2026年6月度 世界ランキング(男子)",
    classes: [
      {
        weightClass: "ストロー級",
        entries: [
          { rank: "champion", name: "田上こゆる" },
          { rank: 1, name: "内藤頌貴" },
          { rank: 2, name: "当真佳直" },
          { rank: 3, name: "畠山隆称" },
          { rank: 4, name: "黒部和沙" },
          { rank: 5, name: "山上幹臣" },
        ],
      },
      {
        weightClass: "フライ級",
        entries: [
          { rank: "champion", name: "亮我" },
          { rank: 1, name: "高岡宏気" },
          { rank: 2, name: "新井丈" },
          { rank: 3, name: "シモンスズキ" },
          { rank: 4, name: "関口祐冬" },
          { rank: 5, name: "中村優作" },
        ],
      },
      {
        weightClass: "バンタム級",
        entries: [
          { rank: "champion", name: "永井奏多" },
          { rank: 1, name: "齋藤奨司" },
          { rank: 2, name: "中野剛貴" },
          { rank: 3, name: "杉野光星" },
          { rank: 4, name: "シンバートルバットエルデネ" },
          { rank: 5, name: "野瀬翔平" },
        ],
      },
      {
        weightClass: "フェザー級",
        entries: [
          { rank: "champion", name: "SASUKE" },
          { rank: 1, name: "ヒカル" },
          { rank: 2, name: "青井太一" },
          { rank: 3, name: "たてお" },
          { rank: 4, name: "堀江耐志" },
          { rank: 5, name: "TOMA" },
        ],
      },
      {
        weightClass: "ライト級",
        entries: [
          { rank: "champion", name: "エフェヴィガ雄志" },
          { rank: 1, name: "イムクァンウ" },
          { rank: 2, name: "後藤亮" },
          { rank: 3, name: "キャプテン☆アフリカ" },
          { rank: 4, name: "シヴァエフ" },
          { rank: 5, name: "西尾真輔" },
        ],
      },
      {
        weightClass: "ウェルター級",
        entries: [
          { rank: "champion", name: "住村竜市朗" },
          { rank: 1, name: "デソウザマルセル" },
          { rank: 2, name: "墨吉涼太" },
          { rank: 3, name: "マコアクーパー" },
          { rank: 4, name: "西條英成" },
          { rank: 5, name: "ソーキ" },
        ],
      },
    ],
  },
  {
    org: "pancrase",
    source: "パンクラス オフィシャルランキング",
    sourceUrl: "https://www.pancrase.co.jp/rls/ranking.html",
    snapshotDate: "2026-07-05",
    rankingLabel: "2026-07-02発表 KING OF PANCRASE(男子)",
    classes: [
      {
        weightClass: "ミドル級",
        entries: [
          { rank: "champion", name: "コシム・サルドロフ" },
          { rank: 1, name: "林源平" },
          { rank: 2, name: "平田旭" },
          { rank: 3, name: "佐藤龍汰朗" },
          { rank: 4, name: "岡村寿紀" },
        ],
      },
      {
        weightClass: "ウェルター級",
        entries: [
          { rank: "champion", name: "ゴイチ・ヤマウチ" },
          { rank: 1, name: "内藤由良" },
          { rank: 2, name: "武者孝大郎" },
          { rank: 3, name: "佐藤生虎" },
          { rank: 4, name: "村山暁洋" },
        ],
      },
      {
        weightClass: "ライト級",
        entries: [
          { rank: "champion", name: "ラファエル・バルボーザ" },
          { rank: 1, name: "神谷大智" },
          { rank: 2, name: "粕谷優介" },
          { rank: 3, name: "雑賀ヤン坊達也" },
          { rank: 4, name: "鈴木慈也" },
        ],
      },
      {
        weightClass: "フェザー級",
        entries: [
          { rank: "champion", name: "栁川唯人" },
          { rank: "interim", name: "オタベク・ラジャボフ" },
          { rank: 1, name: "カリベク・アルジクルウール" },
          { rank: 2, name: "敢流" },
          { rank: 3, name: "木下尚祐" },
          { rank: 4, name: "平田直樹" },
        ],
      },
      {
        weightClass: "バンタム級",
        entries: [
          { rank: "champion", name: "田嶋椋" },
          { rank: "interim", name: "宮城成歩滝" },
          { rank: 1, name: "高城光弘" },
          { rank: 2, name: "山口怜臣" },
          { rank: 3, name: "松井涼" },
          { rank: 4, name: "井村塁" },
        ],
      },
      {
        weightClass: "フライ級",
        entries: [
          { rank: "champion", name: "時田隆成" },
          { rank: 1, name: "猿飛流" },
          { rank: 2, name: "岸田宙大" },
          { rank: 3, name: "眞藤源太" },
          { rank: 4, name: "谷村泰嘉" },
        ],
      },
      {
        weightClass: "ストロー級",
        entries: [
          { rank: "champion", name: "宮澤雄大" },
          { rank: 1, name: "佐々木瞬真" },
          { rank: 2, name: "船田電池" },
          { rank: 3, name: "リトル" },
          { rank: 4, name: "氏原魁星" },
        ],
      },
    ],
  },
  {
    org: "nexus",
    source: "Fighting NEXUS 現王者",
    sourceUrl: "https://fighting-nexus.net/profile/",
    snapshotDate: "2026-07-05",
    rankingLabel: "2026-07-05取得 現各階級チャンピオン",
    classes: [
      { weightClass: "ストロー級", entries: [{ rank: "champion", name: "宮澤雄大" }] },
      { weightClass: "フライ級", entries: [{ rank: "vacant", name: "" }] },
      { weightClass: "バンタム級", entries: [{ rank: "champion", name: "中桐涼輔" }] },
      { weightClass: "フェザー級", entries: [{ rank: "champion", name: "千春" }] },
      { weightClass: "ライト級", entries: [{ rank: "champion", name: "賢民" }] },
      { weightClass: "ウェルター級", entries: [{ rank: "champion", name: "森昴星" }] },
      { weightClass: "ミドル級", entries: [{ rank: "champion", name: "佐藤龍汰朗" }] },
    ],
  },
];

// 第2チャンクで読み(ローマ字)が裏取り不能で投入を保留した選手。
// 訓練データからの推測でハルシネーションを入れないため保留。公式英語表記が
// 出るか、確度の高い読みが確認できた時点で投入する。戦績は EVENT_RESULTS に
// 名前照合で取り出せる状態で残る。
export interface HeldRanker {
  nameJa: string;
  org: SourceKey;
  reason: "表記ゆれ" | "読み" | "取得不可";
  note: string;
}
export const RANKER_HELD_FIGHTERS: HeldRanker[] = [
  { nameJa: "佐藤生虎", org: "pancrase", reason: "取得不可", note: "「生虎」の読み推定不能(Ikko/Seira/Ikutora等)" },
  { nameJa: "猿飛流", org: "pancrase", reason: "取得不可", note: "リングネーム「猿飛流」の読み推定不能" },
];
