// 「数字で見る対戦カード」記事(オリジナル・editorial)のデータ定義。
// タスク③の方針: 管理画面の記事生成ツール(タブ③)が出力する「配列要素1件分の
// 完成TSXコード」を、人間がこのファイルにコピー&ペーストして通常のgitコミットで
// 公開する(DraftsToolの既存タブと同じ「自動処理でgitに書かない」思想)。
//
// 【フィールドごとのライブ/スナップショット方針】
// - 戦績・フィニッシュ率・勝ち方内訳・直近5戦は"ライブ"(表示時にfighterRecords.jsonから
//   都度算出。記事の数字が古くならないようにするため、この配列には焼き込まない)
// - 共通対戦相手・注目点は"スナップショット"(生成時点の閾値判定・文面をここに固定する。
//   条件付きセクションの表示可否は生成時に確定させ、空セクションのコードを出力しない
//   運用のため、後から再計算すると表示条件と本文がズレる可能性があるため)

export interface OriginalArticleFighterRef {
  slug: string; // fighters.ts の slug。表示名・現在戦績はfighterRecords.jsonから都度解決する
  nameJa: string; // 生成時点の表示名(フォールバック用。fighters.ts側の表記揺れ・削除に備える)
}

// 共通対戦相手1件(スナップショット)。resultA/Bは生成時点の対戦結果。
// 同一相手と複数回対戦している場合、対戦ごとに行を分けて複数件を返す
// (1行=1対戦を必ず保つ)。片方しか対戦していない回はnull(空欄表示)。
export interface CommonOpponent {
  name: string;
  resultA: "win" | "loss" | "draw" | "nc" | null;
  resultB: "win" | "loss" | "draw" | "nc" | null;
}

export interface OriginalArticleFight {
  fighterA: OriginalArticleFighterRef;
  fighterB: OriginalArticleFighterRef;
  weightClass?: string; // 大会データ(events.ts等)からの転記。捏造ではなく既存データの複製
  isTitleMatch?: boolean;
  // 共通対戦相手セクション(スナップショット)。0件(未検出)なら配列自体を省略し、
  // 表示側でセクションごと非表示にする。
  commonOpponents?: CommonOpponent[];
  // 注目点セクション(スナップショット)。閾値未達で0件なら配列自体を省略。
  notablePoints?: string[];
}

// ランキング更新告知など、対戦カード比較以外のプロース記事1件分のスナップショット。
// 生成時点のdata/rankings.jsonの値をここに焼き込む(告知記事は「その時点の状態を
// 報告する」性質のため、対戦カード記事のライブ戦績方針とは異なりスナップショット固定でよい)。
export interface RankingDivisionSnapshot {
  divisionLabel: string; // 例: "フライ級"
  divisionSlug: string; // /rankings/[division] のslug。例: "flyweight"
  champion: string;
  top5: string[]; // 1〜5位の表示名
}

export interface OriginalArticle {
  slug: string;
  title: string;
  eventSlug: string; // 大会ページ(/events/[slug] または /results/[slug])との相互リンク用
  publishedAt: string; // YYYY-MM-DD
  // 新着フィードでの並び替え用の公開時刻(JST、HH:MM)。必須(未設定だと
  // "00:00"扱いになり、当日中に投稿される他の実タイムスタンプ付き記事より
  // 常に古く扱われて48時間ウィンドウ上位から溢れる。2026-07-19、ランキング
  // 更新記事が「すべて」タブに出ない不具合の原因になったため必須化した)。
  // 実際にmainへマージ・デプロイする時刻に合わせて指定すること。
  publishedAtTime: string;
  fights: OriginalArticleFight[]; // 選択した試合ごとに1セクション(通常1件、複数可)。プロース記事では空配列
  body?: string[]; // 自由記述段落(ランキング更新告知等、対戦カード比較に当てはまらない記事用)
  rankingSnapshots?: RankingDivisionSnapshot[]; // ランキング更新告知の階級別スナップショット表示
}

export const ORIGINAL_ARTICLES: OriginalArticle[] = [
  {
    slug: "rizin-landmark-15-sabatello-kashimura",
    title: "数字で見る対戦カード: RIZIN LANDMARK 15 ダニー・サバテロ vs 鹿志村仁之介",
    eventSlug: "rizin-landmark-15",
    publishedAt: "2026-07-10",
    publishedAtTime: "00:00", // 実際の公開時刻は未記録(publishedAtTime必須化以前に公開)
    fights: [
      {
        fighterA: { slug: "sabatello-danny", nameJa: "ダニー・サバテロ" },
        fighterB: { slug: "kashimura-jinnosuke", nameJa: "鹿志村仁之介" },
        weightClass: "バンタム級（61.0kg）",
        isTitleMatch: true,
        // 共通対戦相手: 後藤丈治(サバテロは2026-04-12に判定勝ち、鹿志村は
        // 2025-06-14に判定負け)。data/fighterRecords.json の両者history照合で検出。
        commonOpponents: [{ name: "後藤丈治", resultA: "win", resultB: "loss" }],
        // 注目点(生成時点のfighterRecords.jsonより。computeNotablePoints()の実出力と
        // 一致させている: サバテロ 18勝(KO4/一本5/判定9)、鹿志村 12勝(KO1/一本10/判定1))。
        notablePoints: [
          "ダニー・サバテロは判定決着が50%を占める",
          "鹿志村仁之介のフィニッシュ率は92%と非常に高い",
          "鹿志村仁之介は一本勝ちの比率が83%を占め、サブミッション色が強い",
          "両者のフィニッシュ率には42ポイントの差がある(ダニー・サバテロ50% / 鹿志村仁之介92%)",
        ],
      },
    ],
  },
  {
    slug: "ai-rizin-rankings-update-landmark15",
    title: "AI RIZINランキング更新: RIZIN LANDMARK 15の結果を反映",
    eventSlug: "rizin-landmark-15",
    publishedAt: "2026-07-19",
    publishedAtTime: "23:20",
    fights: [],
    body: [
      "7月18日に開催されたRIZIN LANDMARK 15の全MMA試合結果を反映し、AI RIZINランキング(階級別)を更新しました。",
      "RIZINに公式ランキングは存在しません。AI RIZINランキングは、RIZIN開催のMMAルール試合の結果のみをもとにmnews.jpが独自算出する非公式ランキングです。",
      "今回の更新で特に動きがあったのがバンタム級です。第10試合で太田忍を2R 3:04、TKO(レフェリーストップ:グラウンドでの膝打撃)で下したイリスベク・ティレノフが、初戦にして7位にランクイン。",
      "フライ級では、第2試合でイ・ジェフンに3R 4:25 TKO(レフェリーストップ:グラウンドパンチ)で勝利した火の鳥が9位に浮上しています。",
    ],
    rankingSnapshots: [
      {
        divisionLabel: "フライ級",
        divisionSlug: "flyweight",
        champion: "神龍誠",
        top5: ["扇久保博正", "トニー・ララミー", "元谷友貴", "山本アーセン", "伊藤裕樹"],
      },
      {
        divisionLabel: "バンタム級",
        divisionSlug: "bantamweight",
        champion: "ダニー・サバテロ",
        top5: ["井上直樹", "佐藤将光", "後藤丈治", "アジズベク・テミロフ", "福田龍彌"],
      },
      {
        divisionLabel: "フェザー級",
        divisionSlug: "featherweight",
        champion: "ラジャブアリ・シェイドゥラエフ",
        top5: ["朝倉未来", "クレベル・コイケ", "カルシャガ・ダウトベック", "秋元強真", "ヴガール・ケラモフ"],
      },
      {
        divisionLabel: "ライト級",
        divisionSlug: "lightweight",
        champion: "ルイス・グスタボ",
        top5: ["イルホム・ノジモフ", "ホベルト・サトシ・ソウザ", "堀江圭功", "野村駿太", "キム・ギョンピョ"],
      },
    ],
  },
  {
    slug: "ai-rizin-p4p-ranking-explainer-2026-07",
    title: "階級の壁を越えた最強は誰か: AI RIZIN P4Pランキングを公開",
    eventSlug: "rizin-landmark-15",
    publishedAt: "2026-07-27",
    publishedAtTime: "23:30",
    fights: [],
    body: [
      "RIZINには公式のパウンドフォーパウンド(P4P)ランキングが存在しません。",
      "mnews.jpのAI RIZIN P4Pランキングは、階級別ランキング(AI RIZINランキング)のレートをもとに階級の壁を取り払い、全選手を横並びで序列化した独自の参考指標です。",
      "現時点(2026-07-25更新)の1位はフェザー級王者ラジャブアリ・シェイドゥラエフ。RIZIN通算7戦7勝で無敗を維持しています。",
      "2位には7月18日のRIZIN LANDMARK 15で防衛に成功したバンタム級王者ダニー・サバテロ、3位にライト級王者ルイス・グスタボが続きます。",
      "上位15傑は王者だけで占められているわけではありません。",
      "4位イルホム・ノジモフ、5位ホベルト・サトシ・ソウザは、ライト級で王者ルイス・グスタボに次ぐ評価を受けたランクインです。",
      "日本人選手では、6位に井上直樹(バンタム級)、7位に神龍誠(フライ級王者)、8位に朝倉未来(フェザー級)、10位に扇久保博正(フライ級)がランクイン。",
      "フェザー級はクレベル・コイケ(9位)、カルシャガ・ダウトベック(11位)、秋元強真(12位)、ヴガール・ケラモフ(13位)と、上位15傑に4名を送り込む最激戦区になっています。",
      "P4Pランキングでは王者も番号付きの順位に含まれ、戦績は階級を問わないRIZIN通算で表示されます。",
      "順位は今後の大会結果を受けて随時更新されます。",
    ],
  },
  {
    // RIZIN.54 全10試合の勝敗予想。試合順・出場選手は2026-08-03時点の公式発表
    // (jp.rizinff.com/_ct/17846026)に準拠。当初発表のケイト・ロータス vs NOEL
    // (女子スーパーアトム級)はケイトの負傷欠場のため対象外(events.tsのコメント参照)。
    // weightClassには公式の試合番号を併記する(表示は既存のbout-weightバッジ)。
    // fights[0]はOG画像に使われるため、メインイベント(第10試合)を先頭に置く。
    // 各fightのnotablePointsは生成時点のスナップショット。数字は本文と記事ページの
    // 比較カード(fighterRecords.json由来のライブ表示)が一致するよう、
    // computeFighterStripStats/computeWinMethodBreakdownの実出力に合わせている。
    slug: "rizin-54-full-card-predictions",
    title: "RIZIN.54 全10試合を数字で予想する",
    eventSlug: "rizin-54",
    publishedAt: "2026-08-03",
    publishedAtTime: "23:30",
    body: [
      "8月11日(火・祝)、TOYOTA ARENA TOKYOで開催されるRIZIN.54の全10試合について、mnews.jpが保有する戦績データをもとに勝敗を予想します。",
      "予想の材料は3つです。1つめはRIZIN・DEEP・パンクラス・修斗の公式サイトから集めた各選手の全試合データ。2つめは勝ち方・負け方の内訳、つまり「倒して勝つのか、判定で勝つのか」「倒されて負けるのか、極められて負けるのか」という形の相性。3つめはmnews.jpが独自に算出している非公式のAI RIZINランキングの順位です。",
      "各試合の比較カードに出る戦績・フィニッシュ率・勝ち方の内訳・直近5戦は、記事を開いた時点の最新データを自動表示しています。",
      "当初発表されていた女子スーパーアトム級のケイト・ロータス vs NOELは、ケイトの負傷により今大会では実施されません。またヘビー級の2試合は、いずれもRIZIN JAPAN GP 2026 ヘビー級トーナメントの1回戦です。",
      "予想勝者を先に並べます。メイン側から順に、秋元強真(第10試合)、パッチー・ミックス(第9試合)、伊藤裕樹(第8試合)、上田幹雄(第7試合)、スダリオ剛(第6試合)。",
      "続いて摩嶋一整(第5試合)、後藤丈治(第4試合)、平本丈(第3試合)、直樹(第2試合)、水野新太(第1試合)を予想します。",
      "10試合のなかでもっとも数字がはっきりしているのが第6試合のスダリオ剛 vs 酒井リョウ、もっとも読みにくいのが第8試合の伊藤裕樹 vs アリベク・ガジャマトフとメインの第10試合です。",
      "本記事の予想はmnews.jpの独自見解です。",
    ],
    fights: [
      {
        fighterA: { slug: "koike-kleber", nameJa: "クレベル・コイケ" },
        fighterB: { slug: "akimoto-kyoma", nameJa: "秋元強真" },
        weightClass: "第10試合／フェザー級（66.0kg）",
        // 共通対戦相手: 萩原京平(クレベルは2022-05-05に一本勝ち、秋元は2025-11-03に
        // TKO勝ち)。data/fighterRecords.json の両者history照合で検出。
        commonOpponents: [{ name: "萩原京平", resultA: "win", resultB: "win" }],
        notablePoints: [
          "【予想】秋元強真の判定勝ち、または後半のTKO勝ち。ただし10試合でもっとも五分に近い一戦",
          "クレベル・コイケは35勝のうち29が一本勝ち(一本率83%)。一方で9敗の中身は判定7・KO1・一本1で、「極まらない・倒れない、だがポイントで負ける」という極端な形",
          "秋元強真は5連勝中で、唯一の黒星は元谷友貴との判定のみ。まだ一度もフィニッシュされていない",
          "3月のRIZIN.52では元Bellator世界王者パッチー・ミックスを2R 0分37秒でTKO。そのパッチーが今大会の第9試合に出場する",
          "クレベルは2025年12月31日のヴガール・ケラモフ戦以来、約7か月半ぶりの試合。近年の黒星は朝倉未来・金原正徳との判定で、いずれも「前に出て打撃で圧をかけられた」形。秋元の勝ちパターンと重なる",
          "逆にクレベルの勝ち筋は明確で、秋元が一度でも寝技に付き合えば一本の危険がある。秋元は元谷戦でグラウンドを支配されて失点しており、そこが唯一の穴",
          "AI RIZINランキングではクレベルがフェザー級2位、秋元が4位",
        ],
      },
      {
        fighterA: { slug: "sato-shoko", nameJa: "佐藤将光" },
        fighterB: { slug: "patchy-mix", nameJa: "パッチー・ミックス" },
        weightClass: "第9試合／バンタム級（61.0kg）",
        notablePoints: [
          "【予想】パッチー・ミックスの判定勝ち",
          "佐藤将光は通算38勝17敗2分。17敗のうち14が判定で、極められて負けたのは2度だけ。倒すのは難しいが、ポイントは渡しやすいタイプ",
          "パッチー・ミックスは20勝のうち13が一本勝ち(一本率65%)。元Bellator世界バンタム級王者",
          "ただし現在3連敗中。3月に秋元強真にTKO負け、その前はUFCで2試合連続の判定負け。3連敗の中身は判定2つとTKO1つで、極められた試合はない",
          "今回は本来の階級であるバンタム級に戻る一戦",
          "佐藤も3月のRIZIN.52でジョン・スウィーニーを1R 4分49秒の三角絞めで仕留めており、寝技勝負に出れば決着の目はある",
          "AI RIZINランキングでは佐藤がバンタム級2位。パッチーはRIZIN出場が2試合のみのため番付の対象外",
        ],
      },
      {
        fighterA: { slug: "ito-yuki", nameJa: "伊藤裕樹" },
        fighterB: { slug: "gadzhamatov-alibeg", nameJa: "アリベク・ガジャマトフ" },
        weightClass: "第8試合／フライ級（57.0kg）",
        notablePoints: [
          "【予想】伊藤裕樹の判定勝ち。ただし10試合でもっとも判断が難しい一戦",
          "AI RIZINランキングは伊藤がフライ級5位、ガジャマトフが6位で、評価はほぼ横並び",
          "アリベク・ガジャマトフは7戦して6勝、しかも6勝すべてがフィニッシュ(KO5・一本1)。判定までいった勝ち試合が1つもない",
          "その唯一の黒星が、2025年9月の扇久保博正戦の判定0-3。技術と経験で上を行く相手に時間を使われると打つ手がなくなる、という弱点が出た試合",
          "伊藤は通算27戦のキャリアで、まさにその「時間を使わせる」側。3月のRIZIN.52ではカルロス・モタを1R 2分27秒のTKOで倒している",
          "ガジャマトフは2025年9月以来、約10か月半のブランク",
          "不安要素は伊藤の負け方。7敗のうち6が判定で、上位相手に競り負けるパターンが続いている",
        ],
      },
      {
        fighterA: { slug: "ueda-mikio", nameJa: "上田幹雄" },
        fighterB: { slug: "edpolo-king", nameJa: "エドポロキング" },
        weightClass: "第7試合／ヘビー級（120.0kg）",
        notablePoints: [
          "【予想】上田幹雄の1〜2RのKOまたはTKO勝ち",
          "両者とも勝ち方が全部フィニッシュ。上田は5勝すべてKO、エドポロキングは3勝すべてKO。判定までもつれた勝ち試合が2人合わせて1つもない",
          "上田は判定負けもゼロで、8戦すべてが決着で終わっている。この試合も早い時間に終わる可能性が高い",
          "エドポロキングはMMA3戦。2024年12月31日に貴賢神を1R 3分22秒のTKO、2025年3月30日に酒井リョウ(第6試合出場)を2R 2分32秒のTKOで倒しており、破壊力は実証済み",
          "経験値では上田が上。ヘビー級トーナメントで勝ち上がった実績があり、AI RIZINランキングでもヘビー級2位。エドポロキングは出場数が少なく番付の対象外",
          "上田は2025年7月のアレクサンダー・ソルダトキン戦以来、約12か月半ぶり。エドポロキングは2025年3月以来、約16か月半ぶり。両者ブランク明けで、コンディション差が結果を左右する",
        ],
      },
      {
        fighterA: { slug: "sudario-tsuyoshi", nameJa: "スダリオ剛" },
        fighterB: { slug: "sakai-ryo", nameJa: "酒井リョウ" },
        weightClass: "第6試合／ヘビー級（120.0kg）",
        // 共通対戦相手: ロッキー・マルティネス(酒井は2度対戦)・関根“シュレック”秀樹
        // (酒井は2度対戦)・SAINT。1行=1対戦の原則に従い、片方しか戦っていない回は
        // resultAをnullにしている。
        commonOpponents: [
          { name: "ロッキー・マルティネス", resultA: "win", resultB: "loss" },
          { name: "ロッキー・マルティネス", resultA: null, resultB: "loss" },
          { name: "関根“シュレック”秀樹", resultA: "win", resultB: "win" },
          { name: "関根“シュレック”秀樹", resultA: null, resultB: "loss" },
          { name: "SAINT", resultA: "win", resultB: "loss" },
        ],
        notablePoints: [
          "【予想】スダリオ剛の1〜2RのKOまたはTKO勝ち。10試合でもっとも数字がはっきりしている一戦",
          "スダリオ剛は9勝のうち8がKO(KO率89%)",
          "酒井リョウは通算15勝15敗で、15敗のうち8が打撃によるKO/TKO負け。6月のRIZIN LANDMARK 14でも貴賢神に1R 1分16秒でTKO負けしている",
          "「倒す確率が高い側」と「倒されてきた側」の組み合わせで、決着の形まで読みやすい",
          "共通対戦相手にも差が出ている。スダリオが判定で下したロッキー・マルティネスに酒井は2度敗れ、スダリオがKOしたSAINTにも酒井はKOで敗れている",
          "不安要素はスダリオのブランク。2025年5月のジョゼ・アウグスト戦以来、約15か月ぶりの試合となる",
        ],
      },
      {
        fighterA: { slug: "majima-kazumasa", nameJa: "摩嶋一整" },
        fighterB: { slug: "takeda-koji", nameJa: "武田光司" },
        weightClass: "第5試合／フェザー級（66.0kg）",
        // 共通対戦相手: 新居すぐる(摩嶋は2024-07-28に一本勝ち、武田は2024-12-31に
        // テクニカル判定勝ち)。
        commonOpponents: [{ name: "新居すぐる", resultA: "win", resultB: "win" }],
        notablePoints: [
          "【予想】摩嶋一整の一本勝ち",
          "摩嶋一整は19勝のうち16が一本勝ち(一本率84%)。4月のRIZIN LANDMARK 13ではジェームズ・ギャラガーを3R 2分35秒の肩固めで仕留め、2連勝中",
          "武田光司は19勝のうち11が判定(判定率58%)で、KOで勝ったのは2度だけ。レスリングで組み伏せてポイントを積む形が持ち味",
          "摩嶋の6敗の内訳はKO3・一本2・判定1。打撃で崩されると弱いが、KO勝ちが2度しかない武田にその崩し方は期待しにくい",
          "つまり武田の勝ち筋は判定に絞られ、上を取り続けるあいだずっと下から極められる危険を負うことになる",
          "武田も2連勝中で、寝技そのものは上手い。2025年12月のDEEP 129 IMPACTでは奥山貴大を1R 4分01秒のリアネイキッドチョークで仕留めている",
          "AI RIZINランキングは摩嶋がフェザー級7位、武田が10位で、評価は近い",
        ],
      },
      {
        fighterA: { slug: "goto-joji", nameJa: "後藤丈治" },
        fighterB: { slug: "temirov-azizbek", nameJa: "アジズベク・テミロフ" },
        weightClass: "第4試合／バンタム級（61.0kg）",
        notablePoints: [
          "【予想】後藤丈治の判定勝ち",
          "アジズベク・テミロフは6勝すべてがKO/TKO。判定で勝った試合が1つもない一方、2敗はどちらも判定0-3。勝ち筋が打撃一本に限られている",
          "対する後藤丈治は9敗しているが、打撃で倒されたことが一度もない。敗因は一本4つと判定5つ",
          "「打撃でしか勝ったことがない選手」と「打撃で倒されたことがない選手」の対決で、この一点が予想の軸",
          "後藤は4月のRIZIN LANDMARK 13で王者ダニー・サバテロにタイトル挑戦して判定負け。その前は3連勝で、KOも一本も持っている",
          "テミロフは同じ大会で福田龍彌を2R 1分40秒のKOで倒しての勝利。1Rの一発だけは常に警戒が必要",
          "AI RIZINランキングは後藤がバンタム級3位、テミロフが4位",
        ],
      },
      {
        fighterA: { slug: "hiramoto-jo", nameJa: "平本丈" },
        fighterB: { slug: "jolly", nameJa: "ジョリー" },
        weightClass: "第3試合／フライ級（57.0kg）",
        notablePoints: [
          "【予想】平本丈の判定勝ち",
          "ジョリーは4戦4勝で全部フィニッシュ。しかも直近2戦はどちらも1Rの腕ひしぎ十字固め(2025年12月31日に芦澤竜誠を0分25秒、5月に児玉兼慎を1分11秒)",
          "ただし相手を見ると打撃系の選手が中心で、2018年に2試合を戦ってから7年のブランクを経て復帰した経歴。MMAの総合力はまだ読めない",
          "平本丈は5月のRIZIN.53で飴山聖也を2R 0分27秒のリアネイキッドチョークで下している。2024年11月には木村琉音に腕ひしぎ十字固めで敗れており、極める形への対応は勝ち負け両方で経験している",
          "ジョリーはAI RIZINランキングではバンタム級で評価されている選手。今回はフライ級の57.0kg契約で、減量の負担が読めない",
          "対抗はジョリーの1R一本。平本が最初の5分を凌げば、経験差で判定に持ち込む形が本線",
        ],
      },
      {
        fighterA: { slug: "naoki", nameJa: "直樹" },
        fighterB: { slug: "hosokawa-issou", nameJa: "細川一颯" },
        weightClass: "第2試合／69.0kg契約",
        notablePoints: [
          "【予想】直樹の1RのTKOまたは一本勝ち",
          "直樹は3勝すべてフィニッシュで、直近2戦はどちらも1R決着(6月のRIZIN LANDMARK 14で黒井海成をTKO、3月のDEEP 130 IMPACTで木下カラテをリアネイキッドチョーク)",
          "細川一颯はBreakingDown出身で、mnews.jpの選手データベースにMMAの試合記録がない。4団体(RIZIN・DEEP・パンクラス・修斗)の公式データで確認できるのは、2024年12月31日のRIZIN DECADE 雷神番外地で戦ったキックボクシングルールの1試合のみ(宇佐美正パトリックに2R 2分59秒でTKO負け)",
          "つまりMMAの実績が比較できないカードで、予想は実戦経験の差だけを根拠にしている",
          "唯一の警戒点は直樹の被弾。2025年11月のDEEP 128 IMPACTで三井俊希に1R 0分27秒でKOされており、打撃の一発をもらうと終わる可能性は残る",
          "AI RIZINランキングでは直樹がフェザー級15位",
        ],
      },
      {
        fighterA: { slug: "mizuno-shinta", nameJa: "水野新太" },
        fighterB: { slug: "lee-kaiwen", nameJa: "リー・カイウェン" },
        weightClass: "第1試合／フェザー級（66.0kg）",
        notablePoints: [
          "【予想】水野新太の判定勝ち",
          "水野新太は9勝1敗で、まだ一度も倒されていないし極められてもいない。勝ち方は判定が6つ(判定率67%)で、崩れずにポイントを積む形",
          "5月のDEEP 131 IMPACTで牛久絢太郎に判定5-0で勝利し、DEEPフェザー級の暫定王者。今回がRIZIN初参戦になる",
          "リー・カイウェンは16勝8敗だが、8敗のうち4が打撃によるKO/TKO負け",
          "しかも現在2連敗中。5月のRIZIN.53で高木凌に1R 1分38秒でTKO負け、その前はRoad to UFCで中村京一郎に判定0-3",
          "「崩れない側」と「打撃で崩れてきた側」の組み合わせで、リーの勝ち筋は序盤の打撃に絞られる",
        ],
      },
    ],
  },
];

export function getOriginalArticle(slug: string): OriginalArticle | undefined {
  return ORIGINAL_ARTICLES.find((a) => a.slug === slug);
}

// 大会ページ(/events/[slug]・/results/[slug])から該当記事を逆引きする
// (「記事が存在する大会のみ」リンクを出すため)。
export function findArticlesForEvent(eventSlug: string): OriginalArticle[] {
  return ORIGINAL_ARTICLES.filter((a) => a.eventSlug === eventSlug);
}

// トップフィードに混在させるための FeedArticle 変換。url は外部リンクではなく
// /articles/[slug] への内部リンクになる点がRSS由来記事と異なる
// (UnifiedFeed側でisOriginalを見て遷移方式を分岐する)。
export function originalArticleToFeedArticle(
  article: OriginalArticle
): import("./newsClassify").FeedArticle {
  return {
    id: `original-${article.slug}`,
    source: "other", // 編集部オリジナル。既存SourceKeyに専用値が無いためotherを流用(表示はisOriginalバッジで区別)
    title: article.title,
    origin: "Mニュース",
    url: `/articles/${article.slug}`,
    publishedAt: new Date(`${article.publishedAt}T${article.publishedAtTime}:00+09:00`).toISOString(),
    kind: "media",
    newsType: "article",
    flash: false,
    isOriginal: true,
  };
}
