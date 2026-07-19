// 階級のソート順を配列順・追加順に依存させないための単一の基盤マップ。
// キーは体重上限(kg)。/ranking/* と /fighters(FighterFilterGrid)で共有し、
// 後から階級を足しても常に正しい位置(軽い→重い、男子→女子)へ入るようにする。
// メガトン級・スーパーヘビー級はヘビー級と同じキー(統合表示)。
// 女子階級は+1000のオフセットを付けて男子より必ず後ろに来るようにする。
const FEMALE_OFFSET = 1000;

export const WEIGHT_KG: Record<string, number> = {
  "ストロー級": 52.2,
  "フライ級": 56.7,
  "バンタム級": 61.2,
  "フェザー級": 65.8,
  "ライト級": 70.3,
  "ウェルター級": 77.1,
  "ミドル級": 83.9,
  "ライトヘビー級": 93.0,
  "ヘビー級": 120.2,
  "メガトン級": 120.2,
  "スーパーヘビー級": 120.2,
  "女子アトム級": FEMALE_OFFSET + 47.6,
  "女子スーパーアトム級": FEMALE_OFFSET + 50.0,
  "女子ストロー級": FEMALE_OFFSET + 52.2,
  "女子フライ級": FEMALE_OFFSET + 56.7,
  "女子バンタム級": FEMALE_OFFSET + 61.2,
  "女子フェザー級": FEMALE_OFFSET + 65.8,
};

// 未知の階級は末尾に送る(データ欠損で表示が壊れないようにする安全側フォールバック)。
export function weightSortKey(weightClass: string): number {
  return WEIGHT_KG[weightClass] ?? 9999;
}

// /dream・/vsのシェアURL短縮用の安定した短縮コード(§H)。日本語ラベルを
// そのままURLエンコードすると1語で30字超になるため、階級ごとに固定の英字コードを
// 割り当ててURLに使う。キーの追加・削除はあってもコード自体は後方互換のため
// 変更しない。
export const WEIGHT_CODE: Record<string, string> = {
  "ストロー級": "straw",
  "フライ級": "fly",
  "バンタム級": "bantam",
  "フェザー級": "feather",
  "ライト級": "light",
  "ウェルター級": "welter",
  "ミドル級": "middle",
  "ライトヘビー級": "lheavy",
  "ヘビー級": "heavy",
  "メガトン級": "megaton",
  "スーパーヘビー級": "sheavy",
  "女子アトム級": "watom",
  "女子スーパーアトム級": "wsatom",
  "女子ストロー級": "wstraw",
  "女子フライ級": "wfly",
  "女子バンタム級": "wbantam",
  "女子フェザー級": "wfeather",
};

const CODE_TO_WEIGHT: Record<string, string> = Object.fromEntries(
  Object.entries(WEIGHT_CODE).map(([label, code]) => [code, label])
);

// 表示ラベル→URL用コード。未知のラベル(旧リンクの生日本語等)はそのまま
// 通す(コード化できないだけで表示は壊れない)。
export function weightClassToCode(label: string): string {
  return WEIGHT_CODE[label] ?? label;
}

// URL用コード→表示ラベル。コード表に無い値は「旧形式の生日本語ラベルが
// そのまま渡ってきた」ケースとして値自体をラベル扱いする(後方互換)。
export function weightCodeToClass(code: string): string {
  return CODE_TO_WEIGHT[code] ?? code;
}

export function sortByWeightClass<T>(items: T[], getWeightClass: (item: T) => string): T[] {
  return [...items].sort((a, b) => weightSortKey(getWeightClass(a)) - weightSortKey(getWeightClass(b)));
}

// ランキング表内の順位(王者→暫定→1→2…)の並び順キー。数値以外(王者/暫定王者)を
// 最優先にし、以降は番号昇順。
export function rankSortKey(rank: string): number {
  if (/^王者$/.test(rank)) return -2;
  if (/暫定/.test(rank)) return -1;
  const n = parseInt(rank, 10);
  return Number.isNaN(n) ? 999 : n;
}
