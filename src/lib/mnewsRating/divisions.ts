// mnewsレーティングの掲載階級(RIZIN準拠5階級)。
// レート自体は階級横断で1本(engine.ts)。掲載階級はこのファイルで決める。
//
// 本来は「直近のRIZIN試合の階級」で決めるべきだが、fighterRecords.jsonの
// historyには試合ごとの階級フィールドが無い(未取得)ため、現時点では選手
// プロフィール(fighters.ts の weightClass、既存の単一ソース)で代用する。
// フェザー級単独公開の第一弾はこれで実害が出にくいが、他階級を展開する前に
// fighterRecords.json 側へper-fight階級を持たせる拡張が要る(TODO)。
export type MnewsDivision = "フライ級" | "バンタム級" | "フェザー級" | "ライト級" | "ヘビー級";

export const MNEWS_DIVISIONS: MnewsDivision[] = ["フライ級", "バンタム級", "フェザー級", "ライト級", "ヘビー級"];

// 第一弾で一般公開する階級。他階級はrankings.jsonには算出結果を出すが、
// ページ(/rankings/[division])としては「準備中」表示に留める。
export const PUBLISHED_DIVISIONS: MnewsDivision[] = ["フェザー級"];

export const DIVISION_SLUG: Record<MnewsDivision, string> = {
  フライ級: "flyweight",
  バンタム級: "bantamweight",
  フェザー級: "featherweight",
  ライト級: "lightweight",
  ヘビー級: "heavyweight",
};

export const DIVISION_BY_SLUG: Record<string, MnewsDivision> = Object.fromEntries(
  Object.entries(DIVISION_SLUG).map(([division, slug]) => [slug, division as MnewsDivision])
);

function mapByKg(kg: number): MnewsDivision | null {
  if (kg <= 57.5) return "フライ級";
  if (kg <= 61.5) return "バンタム級";
  if (kg <= 66.5) return "フェザー級";
  if (kg <= 71.5) return "ライト級";
  if (kg >= 93.0) return "ヘビー級";
  return null; // ウェルター〜ライトヘビー相当は現時点で対象外
}

// 選手プロフィールのweightClass文字列 → 掲載階級。判定不能・対象外はnull
// (推測で押し込まない)。
export function mapToDivision(weightClass: string | undefined): MnewsDivision | null {
  const w = weightClass ?? "";
  if (/女子|アトム|JEWELS/i.test(w)) return null;
  if (/ウェルター|ミドル|ライトヘビー/.test(w)) return null;
  if (/ヘビー級|メガトン|スーパーヘビー/.test(w)) return "ヘビー級";
  if (/ストロー級/.test(w)) return "フライ級"; // RIZIN最軽量階級に寄せる
  if (/フライ級/.test(w)) return "フライ級";
  if (/バンタム級/.test(w)) return "バンタム級";
  if (/フェザー級/.test(w)) return "フェザー級";
  if (/ライト級/.test(w)) return "ライト級";
  const m = w.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (m) return mapByKg(Number(m[1]));
  return null;
}
