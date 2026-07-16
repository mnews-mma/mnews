// 選手slug変更時の恒久リダイレクト台帳(単一の情報源)。
// 読み間違い等でslugを変更した場合は、以前のslugをここに追記する。
// 【重要】エントリの削除・上書きは禁止。一度でも公開したslugへの被リンク・
// 検索インデックスは死ぬまで残りうるため、旧slugは恒久的に保持する。
// next.config.tsのredirects()がこの配列を読み、/fighters/[from] →
// /fighters/[to] の301(permanent)リダイレクトを機械的に生成する。
export interface FighterSlugRedirect {
  from: string; // 旧slug
  to: string; // 新slug(現在fighters.tsで使われている値と一致させること)
  note: string; // 変更理由(誤読みの内容・訂正日)
}

export const FIGHTER_SLUG_REDIRECTS: FighterSlugRedirect[] = [
  { from: "sudario-go", to: "sudario-tsuyoshi", note: "「剛」の読みが「つよし」と判明(2026-07)" },
  { from: "seiya-takashi", to: "soya-takaki", note: "征矢貴: せいや たかし→そや たかき(2026-07-18)" },
  { from: "kikanoshin", to: "takenshin", note: "貴賢神: きかんしん→たけんしん(2026-07-18)" },
  { from: "horie-keiko", to: "horie-yoshinori", note: "堀江圭功: けいこ→よしのり(2026-07-18)" },
  { from: "sato-masamitsu", to: "sato-shoko", note: "佐藤将光: まさみつ→しょうこう(2026-07-18)" },
  { from: "kashimura-ninnosuke", to: "kashimura-jinnosuke", note: "鹿志村仁之介: にんのすけ→じんのすけ(2026-07-18)" },
  { from: "miyagawa-hinata", to: "miyagawa-hyuga", note: "宮川日向: ひなた→ひゅうが(2026-07-18)" },
];
