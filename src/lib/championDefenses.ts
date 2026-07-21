// RIZIN王者のタイトル防衛回数。「パウンドフォーパウンド(P4P)」ランキングの
// 王者ティア序列(防衛回数→通算勝率→ドミナンスzスコアのタイブレーク)にのみ
// 使う。champions.ts(現王者名オーバーレイ)と同じ思想: 一次ソースで確認できる
// 「事実」のみを載せ、根拠不明な推測は一切行わない(捏造ゼロ)。
//
// 【運用ルール・厳守】
// - 防衛回数が変わるのは王座戦(防衛成功・王座交代)のときだけ。champions.ts の
//   RIZIN_CHAMPIONS を更新する同じPRで、このファイルも必ず一緒に更新すること
//   (王者が変われば新王者のエントリを追加・防衛回数0からスタート、防衛成功なら
//   既存王者のdefenseCountを+1する)。
// - 自動算出はしない。日次バッチ(scripts/update-mnews-rating.ts)には一切
//   組み込まない(誤カウント防止のため、engine.ts側の試合検知から機械的に
//   +1する仕組みは意図的に作らない)。
// - RIZINベルトのみ計上する。他団体との二冠・ダブルタイトル保持者でも、
//   他団体側の防衛試合はここでは数えない。
// - エントリが無い現王者(未追従)は、P4P生成側が「取得不能」として明示フラグする
//   (0埋め・推定は禁止。scripts/generate-p4p.ts参照)。
//
// 取得元: ja.wikipedia.org/wiki/RIZIN王者一覧(WebFetchによる自動要約を2回・
// 別プロンプトで取得し数値が一致することを確認、2026-07-21)。champions.tsの
// 現王者名オーバーレイとの不一致は確認時点では検出されなかった。
//
// 次回更新トリガー(判明分): 2026-09-10 超RIZIN.5 でシェイドゥラエフの
// 4度目の防衛戦(vs AJマッキー)。勝てば defenseCount を 3→4 に更新すること
// (本ファイル作成時点=試合前のため3のまま)。
export interface ChampionDefenseEntry {
  slug: string;
  weightClass: string;
  defenseCount: number;
  source: string;
  fetchedDate: string;
}

export const CHAMPION_DEFENSES: ChampionDefenseEntry[] = [
  {
    slug: "shinryu-makoto",
    weightClass: "フライ級",
    defenseCount: 0,
    source: "ja.wikipedia.org/wiki/RIZIN王者一覧(戴冠2026-06-06、防衛なし)",
    fetchedDate: "2026-07-21",
  },
  {
    slug: "sabatello-danny",
    weightClass: "バンタム級",
    defenseCount: 2,
    source: "ja.wikipedia.org/wiki/RIZIN王者一覧(戴冠2025-12-31、直近防衛2026-07-15※ページ更新日以降の可能性あり)",
    fetchedDate: "2026-07-21",
  },
  {
    slug: "sheydullaev-rajabali",
    weightClass: "フェザー級",
    defenseCount: 3,
    source: "ja.wikipedia.org/wiki/RIZIN王者一覧(戴冠2025-05-04、直近防衛2026-02-01※ページ更新日以降の可能性あり)",
    fetchedDate: "2026-07-21",
  },
  {
    slug: "gustavo-luis",
    weightClass: "ライト級",
    defenseCount: 0,
    source: "ja.wikipedia.org/wiki/RIZIN王者一覧(戴冠2026-05-10、防衛なし)",
    fetchedDate: "2026-07-21",
  },
];

export function getChampionDefenseCount(slug: string): ChampionDefenseEntry | null {
  return CHAMPION_DEFENSES.find((d) => d.slug === slug) ?? null;
}
