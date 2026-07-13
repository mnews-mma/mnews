// 掲載階級の事実オーバーレイ。champions.ts/retirements.tsと同じ思想:
// 「どの階級のランキングに載せるか」を選手単位で確定できる一次ソース・データが
// あるとき、latestRizinDivision(自動判定)より優先して使う。
//
// これは掲載階級(=どの階級バケットに出すか)と、戦績スコープの起点日
// (eligibilityScopeStartDate、任意)だけの上書き。順位・レートは引き続き
// Eloの自動算出のまま(このファイルが順位やレートに触れることはない)。
// 推測での指定は禁止。根拠(note)を必ず添える。
//
// eligibilityScopeStartDate: 階級変更後の「戦績・掲載資格カウント対象」の
// 起点日。自動判定(detectDivisionChangeCutoff)は試合結果に階級名が明示
// されている場合のみ機能するが、RIZIN公式ソースでも階級名の明示が無い選手
// (例: 武田光司)では自動検出できないため、事実として起点日を手動指定する。
// 指定が無ければ従来どおり全期間を対象にする。
export interface FighterDivisionOverlayEntry {
  slug: string;
  name: string;
  division: "フライ級" | "バンタム級" | "フェザー級" | "ライト級" | "ヘビー級";
  eligibilityScopeStartDate?: string; // YYYY-MM-DD。この日付以降の試合のみを戦績集計の対象にする
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
    eligibilityScopeStartDate: "2024-03-23",
    fetchedDate: "2026-07-13",
    note:
      "武田光司はRIZIN.15(2019)以降の長いRIZIN MMAキャリアで複数階級を経験しており、" +
      "EVENT_RESULTS収録期間(直近18ヶ月程度)内に階級名が明示された試合が無いため、" +
      "自動判定(latestRizinDivision)は直近2戦([RIZIN.52・71.0kg契約][RIZIN WORLD SERIES in " +
      "KOREA・66.0kg契約]、いずれも階級名の明示なし)からの推定に留まる。fighters.ts側の" +
      "プロフィール表記(現在の階級)がフェザー級であることと合わせ、掲載階級をフェザー級で" +
      "事実確定する。rizinRecords.json(RIZIN公式ソース)でも武田選手の試合には階級名の明示が" +
      "一切無く(全て体重数値のみ)、自動の階級変更スコープ検出(detectDivisionChangeCutoff)は" +
      "このデータでも機能しないため、戦績スコープの起点日(2024-03-23 RIZIN LANDMARK 9 in " +
      "KOBE・萩原京平戦、フェザー転向後最初の試合)を事実として手動指定する。" +
      "【2026-07-13時点の既知の食い違い】この起点日以降(2024-03-23〜2026-07-13)の" +
      "rizinRecords.jsonの実測はRIZIN(MMA)戦4試合・2勝2敗であり、期待されていた" +
      "「フェザー3-2」とは一致しない(公式ソースを網羅的に確認した上での実測値。データの" +
      "欠落によるものではない)。この期待値の根拠を再確認する必要がある。",
  },
  {
    slug: "nozimov-ilkhom",
    name: "イルホム・ノジモフ",
    division: "ライト級",
    eligibilityScopeStartDate: "2025-12-31",
    fetchedDate: "2026-07-13",
    note:
      "latestRizinDivisionの自動判定・掲載階級ともにライト級で正しいが、表示戦績が" +
      "フェザー級時代(2023-11-04・2024-04-29・2025-06-14、いずれも66.0kg契約=フェザー級" +
      "マッピング)を含む通算4勝1敗のままライト級ランキングに表示されていた" +
      "(本番/rankings/lightweightで確認、2026-07-13)。ライト級への実際の転向は" +
      "2025-12-31 RIZIN 師走の超強者祭り(サトシ戦・RIZINライト級タイトルマッチで勝利し" +
      "戴冠)で、以降は2026-05-10(グスタボ戦・王座陥落)を含め1勝1敗。武田光司と全く" +
      "同じ限界: 直近2戦は階級名が明示(「ライト級」)されているが、それ以前の" +
      "フェザー級時代3戦がいずれも66.0kg契約(未明示のキャッチウェイト表記)のため、" +
      "detectDivisionChangeCutoffの階級名明示ベースのミスマッチ検出では拾えず自動の" +
      "戦績スコープ起点検出が機能しない。掲載資格自体は直近年2戦の代替基準で" +
      "問題なく満たすため資格判定には影響が無く、表示戦績のみが誤って通算表示に" +
      "なっていた。表示戦績のみ事実として起点日を手動指定する。",
  },
];

export function getDivisionOverlay(
  slug: string
): FighterDivisionOverlayEntry["division"] | null {
  return FIGHTER_DIVISION_OVERLAYS.find((o) => o.slug === slug)?.division ?? null;
}

export function getEligibilityScopeStartDate(slug: string): string | null {
  return FIGHTER_DIVISION_OVERLAYS.find((o) => o.slug === slug)?.eligibilityScopeStartDate ?? null;
}
