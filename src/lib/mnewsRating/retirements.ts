// 引退選手の除外(事実オーバーレイ)。champions.tsと同じ思想: 公式発表・一次
// ソースで確認できる「事実」のみを載せ、根拠不明な推測は一切行わない(捏造ゼロ)。
// 18ヶ月ルールだけでは直近18ヶ月以内に試合をした引退選手が残ってしまうケースが
// あるため、引退という離散的で検証可能な事実を別途オーバーレイとして持たせ、
// 該当選手を掲載資格の判定より前に全ランキングから除外する。
//
// 2026-07-13時点: 魚井フルスイングについて引退の噂(所属ジム関係者のブログ
// 記事)を確認したが、RIZIN公式・主要メディア(ゴング格闘技/MMAPLANET/ORICON等)
// による一次ソースでの正式な引退発表は見つからなかった。一次ソースが無い状態で
// 掲載除外すると捏造ゼロポリシーに反するため、今回は対象に含めない
// (根拠となる一次ソースが見つかり次第、下記に追加する)。
export interface RetirementEntry {
  slug: string;
  name: string;
  source: string;
  fetchedDate: string;
  note: string;
}

export const RETIRED_FIGHTERS: RetirementEntry[] = [];

export function isRetired(slug: string): boolean {
  return RETIRED_FIGHTERS.some((r) => r.slug === slug);
}
