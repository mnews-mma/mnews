// 引退選手の除外(事実オーバーレイ)。champions.tsと同じ思想: 公式発表・一次
// ソースで確認できる「事実」のみを載せ、根拠不明な推測は一切行わない(捏造ゼロ)。
// 18ヶ月ルールだけでは直近18ヶ月以内に試合をした引退選手が残ってしまうケースが
// あるため、引退という離散的で検証可能な事実を別途オーバーレイとして持たせ、
// 該当選手を掲載資格の判定より前に全ランキングから除外する。
//
// 2026-07-13時点では、魚井フルスイングの引退について所属ジム関係者のブログ
// 記事(噂レベル)しか確認できず、一次ソースが無い状態での掲載除外は捏造ゼロ
// ポリシーに反するため対象に含めていなかった。2026-07-30、以下の複数ソースの
// 突き合わせにより裏付けが取れたため追加した(下記RETIRED_FIGHTERSのnote参照)。
export interface RetirementEntry {
  slug: string;
  name: string;
  source: string;
  fetchedDate: string;
  note: string;
}

export const RETIRED_FIGHTERS: RetirementEntry[] = [
  {
    slug: 'uoi-fullswing',
    name: '魚井フルスイング',
    source:
      '本人Xアカウント(@zurutherapyfish) https://x.com/zurutherapyfish/status/2035325467436450234 (母逝去の報告), ' +
      'https://x.com/zurutherapyfish/status/2074089199033299218 (新事業/クラウドファンディングの告知); ' +
      '大澤ケンジ氏の送り出し投稿 https://x.com/kenjiosawa/status/2035345390644658327; ' +
      '所属ジム代表ブログ「新ゴンズイ日記」https://ameblo.jp/gonzuy/entry-12960595452.html (区切りの試合との説明); ' +
      'DEEP公式戦績 DEEP 130 IMPACT(2026-03-20, 後楽園ホール, 寺崎昇龍戦0-3敗北)が最終試合として確認できる最新記録',
    fetchedDate: '2026-07-30',
    note:
      '2026年3月7日に母親が逝去。本人が「後数試合をして区切りにする」と明言していたと所属ジム代表が報告し、' +
      '同月20日のDEEP 130 IMPACT(後楽園)を区切りの試合として終了。以降(2026-07-30時点)公式戦績なし。' +
      '本人Xでは新事業(クラウドファンディング)への言及があり、現役復帰の発表は確認できていない。',
  },
];

export function isRetired(slug: string): boolean {
  return RETIRED_FIGHTERS.some((r) => r.slug === slug);
}
