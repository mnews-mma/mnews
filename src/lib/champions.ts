// RIZIN/DEEP の現王者(正規王者)一覧。トップページの「公式ランキング」セクションに
// 表示する。取得元の生HTMLを直接パースして抽出した確定情報のみを載せる(AI要約は
// 使わない・捏造ゼロ)。暫定王者・空位・抽出が曖昧な階級は掲載しない。
//
// 取得日: 2026-07-06
//   DEEP:  https://www.deep2001.com/champ/
//   RIZIN: https://jp.rizinff.com/fighters
//
// slug は src/lib/fighters.ts の FIGHTERS に存在し、かつ hidden でない場合のみ設定する
// (存在しない/hidden な王者はテキスト表示のみ・リンクなし)。
export interface ChampionEntry {
  org: "rizin" | "deep";
  weightClass: string;
  name: string;
  generation: string; // 例 "第7代"
  slug: string | null;
}

export const RIZIN_CHAMPIONS: ChampionEntry[] = [
  { org: "rizin", weightClass: "フライ級", name: "神龍誠", generation: "第3代", slug: "shinryu-makoto" },
  { org: "rizin", weightClass: "バンタム級", name: "ダニー・サバテロ", generation: "第8代", slug: "sabatello-danny" },
  { org: "rizin", weightClass: "フェザー級", name: "ラジャブアリ・シェイドゥラエフ", generation: "第7代", slug: "sheydullaev-rajabali" },
  { org: "rizin", weightClass: "ライト級", name: "ルイス・グスタボ", generation: "第3代", slug: "gustavo-luis" },
  // 女子スーパーアトム級: 現在「空位」のため掲載しない。
  // ヘビー級: 王座自体が存在しない(ページに項目なし)ため掲載しない。
];

export const DEEP_CHAMPIONS: ChampionEntry[] = [
  { org: "deep", weightClass: "メガトン級", name: "大成", generation: "第7代", slug: null }, // slug nishitani-taisei は hidden のためリンクなし
  { org: "deep", weightClass: "ウェルター級", name: "嶋田伊吹", generation: "第14代", slug: "shimada-ibuki" },
  { org: "deep", weightClass: "ライト級", name: "野村駿太", generation: "第13代", slug: "nomura-shunta" },
  { org: "deep", weightClass: "フェザー級", name: "青井人", generation: "第12代", slug: "aoi-jin" },
  { org: "deep", weightClass: "バンタム級", name: "福田龍彌", generation: "第11代", slug: null }, // DB未登録
  { org: "deep", weightClass: "フライ級", name: "村元友太郎", generation: "第7代", slug: "muramoto-yutaro" },
  { org: "deep", weightClass: "ストロー級", name: "知名昴海", generation: "第6代", slug: null }, // 読み確定できず未登録(HELD)
  // 女子階級: 女子無差別級/女子アトム級/女子ミクロ級/DEEP JEWELS各級が併存し、
  // 「女子スーパーアトム」に一意対応しないため今回は掲載しない(曖昧なら出さない)。
  // ライトヘビー級・ミドル級: 現在「空位」のため掲載しない。
];
