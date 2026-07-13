// 掲載階級の事実オーバーレイ。champions.ts/retirements.tsと同じ思想:
// 「どの階級のランキングに載せるか」を選手単位で確定できる一次ソース・データが
// あるとき、latestRizinDivision(自動判定)より優先して使う。
//
// これは掲載階級(=どの階級バケットに出すか)だけの上書き。順位・レートは
// 引き続きEloの自動算出のまま(このファイルが順位やレートに触れることはない)。
// 推測での指定は禁止。根拠(note)を必ず添える。
export interface FighterDivisionOverlayEntry {
  slug: string;
  name: string;
  division: "フライ級" | "バンタム級" | "フェザー級" | "ライト級" | "ヘビー級";
  fetchedDate: string;
  note: string;
}

export const FIGHTER_DIVISION_OVERLAYS: FighterDivisionOverlayEntry[] = [
  {
    slug: "kintaro",
    name: "金太郎",
    division: "バンタム級",
    fetchedDate: "2026-07-13",
    note:
      "latestRizinDivisionの旧タイ解消ロジックが、直近戦(RIZIN.53 2026-05-10・61.0kg契約)を" +
      "根拠の弱い単発キャッチウェイトとして集計から除外した結果、残り2戦([RIZIN LANDMARK 12" +
      "・62.0kg契約]対[RIZIN WORLD SERIES in KOREA・61.0kg契約])の1-1タイを直近寄りに解消し、" +
      "フェザー級へ誤配置していた(公開中フェザー級への混入)。直近戦を含めた全3戦の単純集計では" +
      "バンタム級2:フェザー級1でバンタム級が正しい多数派。タイ解消ロジック自体も本コミットで" +
      "根本修正済みだが、事実オーバーレイとしても明示的に確定させる。",
  },
  {
    slug: "takeda-koji",
    name: "武田光司",
    division: "フェザー級",
    fetchedDate: "2026-07-13",
    note:
      "武田光司はRIZIN.15(2019)以降の長いRIZIN MMAキャリアで複数階級を経験しており、" +
      "EVENT_RESULTS収録期間(直近18ヶ月程度)内に階級名が明示された試合が無いため、" +
      "自動判定(latestRizinDivision)は直近2戦([RIZIN.52・71.0kg契約][RIZIN WORLD SERIES in " +
      "KOREA・66.0kg契約]、いずれも階級名の明示なし)からの推定に留まる。fighters.ts側の" +
      "プロフィール表記(現在の階級)がフェザー級であることと合わせ、掲載階級をフェザー級で" +
      "事実確定する。",
  },
];

export function getDivisionOverlay(
  slug: string
): FighterDivisionOverlayEntry["division"] | null {
  return FIGHTER_DIVISION_OVERLAYS.find((o) => o.slug === slug)?.division ?? null;
}
