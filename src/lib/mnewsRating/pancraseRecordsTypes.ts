// data/pancraseRecords.json の出力形式の型定義(scripts/build-pancrase-records.ts
// が書き出す)。生成スクリプト自体は型をファイル内にローカル定義しているため、
// 読み出し側(このモジュール)で同じ形を再定義する。フィールド名・意味は
// data/rizinRecords.json(rizinScraper.ts の RizinRecordsBout/RizinRecordsEvent)
// を基本形として踏襲しているため、そちらと共通の項目は同じ名前を使う。
export interface PancraseRecordsBout {
  cardPosition: number;
  isOpeningFight: boolean;
  headingText: string;
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleType: string; // "MMA" | "エキシビジョン" | "キックボクシング" | "プロレスルール" | "グラップリング" | "シュートボクシング"
  weightKg: number | null; // 常にnull(左右で計量後体重が異なるため。weightLeftRaw/weightRightRaw参照)
  namedDivision: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  winnerName: string | null;
  winnerSlug: string | null;
  round: string | null;
  time: string | null;
  methodRaw: string;
  isWeighInMiss: boolean;
  // パンクラス固有の追加フィールド
  weightClassRaw: string | null;
  leftUrl: string | null;
  rightUrl: string | null;
  leftMarkerRaw: string;
  rightMarkerRaw: string;
  weightLeftRaw: string | null;
  weightRightRaw: string | null;
  note: string | null;
}

export interface PancraseRecordsEvent {
  eventName: string;
  date: string | null;
  sourceUrl: string;
  fetchedDate: string;
  bouts: PancraseRecordsBout[];
  parseFailures: number;
  // パンクラス固有の追加フィールド
  venueRaw: string | null;
  note: string | null;
}
