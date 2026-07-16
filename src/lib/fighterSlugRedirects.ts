// 選手slug変更時の恒久リダイレクト台帳(単一の情報源)。
// 読み間違い等でslugを変更した場合は、以前のslugをここに追記する。
// 【重要】エントリの削除・上書きは禁止。一度でも公開したslugへの被リンク・
// 検索インデックスは死ぬまで残りうるため、旧slugは恒久的に保持する。
// next.config.tsのredirects()がこの配列を読み、/fighters/[from] →
// /fighters/[to] の恒久リダイレクトを機械的に生成する。
// 【2026-07-18確定】slug恒久リダイレクトはNext.js redirects()のpermanent:true
// (実装上は308 Permanent Redirect)。301ではないが、Googleは301と同等の
// 恒久リダイレクトシグナルとして扱うため、被リンク・インデックス引き継ぎという
// 意図は満たす。GET専用の選手ページでは301との実害差もゼロ。middleware化は
// しない(redirects()で十分・運用コストが低い)。
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
  { from: "suzuki-tomoya", to: "suzuki-chikaya", note: "鈴木慈也: ともや→ちかや(2026-07-18・Pancrase公式で確認)" },
  { from: "terasaki-ryu", to: "terasaki-shoryu", note: "寺崎昇龍: りゅう→しょうりゅう(2026-07-18・「昇」欠落。MMAPLANETで確認)" },
  { from: "hatakeyama-takanori", to: "hatakeyama-ryuya", note: "畠山隆称: たかのり→りゅうや(2026-07-18・別読み。修斗公式/本人インタビューで確認)" },
  { from: "ushiku-kentaro", to: "ushiku-juntaro", note: "牛久絢太郎: けんたろう→じゅんたろう(2026-07-18・Pancrase/RIZIN公式で確認。元RIZINフェザー級王者)" },
  { from: "yamagami-mikio", to: "yamagami-mikihito", note: "山上幹臣: みきお→みきひと(2026-07-18・Kaina目視確定。修斗元世界フライ級王者)" },
  { from: "nakano-takaki", to: "nakano-goki", note: "中野剛貴: たかき→ごうき(2026-07-18・Kaina目視確定)" },
  { from: "dautbek-karshyga", to: "karshyga-dautbek", note: "slug語順修正(誤読みではなく姓名順の不整合。カルシャガが姓・ダウトベックが名、2026-07-18)" },
];
