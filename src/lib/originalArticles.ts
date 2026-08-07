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
  // 冒頭サマリー表(全試合予想一覧)用。予想勝者がfighterA/fighterBのどちら側か。
  // confidencePctは「AI予想の確度(%)」の表示値。導出方法は記事ごとに異なりうる
  // (レートのexpectedScoreで機械算出する場合と、戦績・試合内容を踏まえた質的判断の
  // 場合の両方がある)。どちらの方法を使ったかはbody/closingNoteの説明文に合わせること。
  // 2026-08-06、rizin-54-full-card-predictionsは機械算出(D≈152.4較正)から質的判断に
  // 戻した(ユーザー指示: 一番最初の予想の勝者・確度を復元)。
  predictedWinner?: "A" | "B";
  confidencePct?: number;
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
  // 記事末尾の方法論(任意)。専門用語なしで3行以内を想定。bodyが冒頭の短い前文
  // 専用なのに対し、closingNoteは全試合セクションの後(関連大会リンクの手前)に出る。
  closingNote?: string[];
  rankingSnapshots?: RankingDivisionSnapshot[]; // ランキング更新告知の階級別スナップショット表示
  // 編集中の記事を本番で一時的に到達不能にするフラグ(Fighter.hiddenと同じ命名規約)。
  // true時: 記事ページ本体はnotFound()、generateStaticParamsで静的生成対象から除外、
  // サイトマップ・トップ/archiveの新着フィード・大会ページの関連記事リンクからも除外する
  // (findArticlesForEventの時点でフィルタするため呼び出し側は変更不要)。slugは変えず、
  // リダイレクトも張らない。編集完了後にこのフラグを外せば同じURLで再公開される。
  hidden?: boolean;
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
    publishedAt: "2026-08-07",
    publishedAtTime: "15:10",
    body: [
      "8月11日(火・祝)、TOYOTA ARENA TOKYOでRIZIN.54が開催されます。",
      "全10試合について、各選手の戦績や試合内容、AI RIZINランキングの順位もふまえて勝敗を予想しました。",
    ],
    closingNote: [
      "予想は、各選手の戦績・フィニッシュ率・直近の試合内容を踏まえてmnews編集部が判定したものです。",
    ],
    fights: [
      {
        fighterA: { slug: "koike-kleber", nameJa: "クレベル・コイケ" },
        fighterB: { slug: "akimoto-kyoma", nameJa: "秋元強真" },
        weightClass: "第10試合／フェザー級（66.0kg）",
        predictedWinner: "B",
        confidencePct: 55,
        // 共通対戦相手: 萩原京平(クレベルは2022-05-05に一本勝ち、秋元は2025-11-03に
        // TKO勝ち)。data/fighterRecords.json の両者history照合で検出。
        commonOpponents: [{ name: "萩原京平", resultA: "win", resultB: "win" }],
        notablePoints: [
          "クレベル・コイケは35勝のうち29が一本勝ち(一本率83%)。一方で9敗の中身は判定7・KO1・一本1で、「極まらない・倒れない、だがポイントで負ける」という極端な形",
          "秋元強真は5連勝中で、唯一の黒星は元谷友貴との判定のみ。まだ一度もフィニッシュされていない",
          "秋元が寝技に深く付き合えばクレベルの一本の危険は残る(元谷戦ではグラウンドを支配され失点した経験がある)。決着は判定、または終盤の運動量勝負でのTKOを想定",
          "AI RIZINランキングではクレベルがフェザー級2位、秋元が4位",
        ],
      },
      {
        fighterA: { slug: "sato-shoko", nameJa: "佐藤将光" },
        fighterB: { slug: "patchy-mix", nameJa: "パッチー・ミックス" },
        weightClass: "第9試合／バンタム級（61.0kg）",
        predictedWinner: "B",
        confidencePct: 60,
        notablePoints: [
          "佐藤将光は通算37勝17敗2分。17敗のうち14が判定で、極められて負けたのは2度だけ",
          "パッチー・ミックスは20勝のうち13が一本勝ち(一本率65%)。元Bellator世界バンタム級王者だが現在3連敗中",
          "本来の階級であるバンタム級への復帰でミックス本来の力が出せれば、3連敗を脱する材料になる。ただし佐藤の一本の圧はミックスにとって最大の警戒点で、決着は判定を想定",
          "AI RIZINランキングでは佐藤がバンタム級2位",
        ],
      },
      {
        fighterA: { slug: "ito-yuki", nameJa: "伊藤裕樹" },
        fighterB: { slug: "gadzhamatov-alibeg", nameJa: "アリベク・ガジャマトフ" },
        weightClass: "第8試合／フライ級（57.0kg）",
        predictedWinner: "A",
        confidencePct: 55,
        notablePoints: [
          "アリベク・ガジャマトフは7戦6勝、6勝すべてフィニッシュ。判定までいった勝ち試合が1つもない",
          "唯一の黒星は2025年9月の扇久保博正戦の判定0-3。時間を使われると弱いという弱点が出た試合",
          "伊藤自身も7敗中6が判定というタフな戦績で、簡単には終わらない相手。決着は判定を想定。ただし上位相手に競り負けるパターンも続いている点は懸念材料",
          "AI RIZINランキングでは伊藤がフライ級5位、ガジャマトフが6位",
        ],
      },
      {
        fighterA: { slug: "ueda-mikio", nameJa: "上田幹雄" },
        fighterB: { slug: "edpolo-king", nameJa: "エドポロキング" },
        weightClass: "第7試合／ヘビー級（120.0kg）",
        predictedWinner: "A",
        confidencePct: 57,
        notablePoints: [
          "両者とも勝ち方が全部フィニッシュ。上田は5勝すべてKO、エドポロキングは3勝すべてKO。判定までもつれた勝ち試合が2人合わせて1つもない",
          "上田は判定負けもゼロで8戦すべてが決着。エドポロキングも酒井リョウ・貴賢神をKOで下した実績があり、破壊力は実証済み",
          "上田は約12か月半、エドポロキングは約16か月半のブランク明け。コンディション差が結果を左右する",
          "ブランクの短い上田がやや優勢で、決着は序盤〜中盤のKO/TKOを想定",
        ],
      },
      {
        fighterA: { slug: "sudario-tsuyoshi", nameJa: "スダリオ剛" },
        fighterB: { slug: "sakai-ryo", nameJa: "酒井リョウ" },
        weightClass: "第6試合／ヘビー級（120.0kg）",
        predictedWinner: "A",
        confidencePct: 73,
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
          "スダリオ剛は9勝のうち8がKO(KO率89%)",
          "酒井リョウは通算15勝15敗で、15敗のうち8が打撃によるKO/TKO負け。直近も貴賢神に1R TKO負け",
          "共通対戦相手にも差(スダリオが下した相手に酒井は敗れている)。不安要素はスダリオの約15か月のブランク",
          "打撃の圧はスダリオが明確に上で、決着は早いラウンドでのKO/TKOを想定。ブランク明けの立ち上がりだけが波乱の芽",
        ],
      },
      {
        fighterA: { slug: "majima-kazumasa", nameJa: "摩嶋一整" },
        fighterB: { slug: "takeda-koji", nameJa: "武田光司" },
        weightClass: "第5試合／フェザー級（66.0kg）",
        predictedWinner: "A",
        confidencePct: 57,
        // 共通対戦相手: 新居すぐる(摩嶋は2024-07-28に一本勝ち、武田は2024-12-31に
        // テクニカル判定勝ち)。
        commonOpponents: [{ name: "新居すぐる", resultA: "win", resultB: "win" }],
        notablePoints: [
          "摩嶋一整は19勝のうち16が一本勝ち(一本率84%)、2連勝中",
          "武田光司は19勝のうち11が判定(判定率58%)で、KOで勝ったのは2度だけ。レスリングで組み伏せる形が持ち味",
          "摩嶋の6敗はKO3・一本2・判定1。打撃には弱いが、KO勝ちが2度しかない武田にその崩し方は期待しにくく、決着は摩嶋の一本を想定",
          "AI RIZINランキングでは摩嶋がフェザー級7位、武田が10位",
        ],
      },
      {
        fighterA: { slug: "goto-joji", nameJa: "後藤丈治" },
        fighterB: { slug: "temirov-azizbek", nameJa: "アジズベク・テミロフ" },
        weightClass: "第4試合／バンタム級（61.0kg）",
        predictedWinner: "A",
        confidencePct: 60,
        notablePoints: [
          "アジズベク・テミロフは6勝すべてKO/TKO。判定勝ちが無く、2敗はどちらも判定負け",
          "後藤丈治は9敗しているが、打撃で倒されたことは一度もない",
          "「打撃でしか勝ったことがない選手」と「打撃で倒されたことがない選手」の対決。テミロフの1Rの一発には要警戒だが、そこを耐えれば後藤が判定に持ち込むと想定",
          "AI RIZINランキングでは後藤がバンタム級3位、テミロフが4位",
        ],
      },
      {
        fighterA: { slug: "hiramoto-jo", nameJa: "平本丈" },
        fighterB: { slug: "jolly", nameJa: "ジョリー" },
        weightClass: "第3試合／フライ級（57.0kg）",
        predictedWinner: "A",
        confidencePct: 55,
        notablePoints: [
          "ジョリーは4戦4勝で全部フィニッシュ。直近2戦はどちらも1Rの腕ひしぎ十字固め",
          "ただし相手は打撃系中心で、7年のブランクを経て復帰した経歴。MMAの総合力はまだ読めない",
          "平本丈は極める形への対応を勝ち負け両方で経験している。対抗は平本の判定持ち込み",
        ],
      },
      {
        fighterA: { slug: "naoki", nameJa: "直樹" },
        fighterB: { slug: "hosokawa-issou", nameJa: "細川一颯" },
        weightClass: "第2試合／69.0kg契約",
        predictedWinner: "A",
        confidencePct: 78,
        notablePoints: [
          "直樹は3勝すべてフィニッシュ、直近2戦とも1R決着。細川一颯はBreakingDown出身で、RIZINで確認できるのはキックボクシング1試合(TKO負け)のみ",
          "MMAでの実戦経験がほぼ無い細川に対し、直樹が主導権を握れば早期決着が濃厚。決着は1RのTKOか一本を想定",
          "唯一の警戒点は直樹の被弾。2025年11月に三井俊希へ1R KO負けしており、一発をもらうと終わる可能性は残る",
          "AI RIZINランキングでは直樹がフェザー級15位",
        ],
      },
      {
        fighterA: { slug: "mizuno-shinta", nameJa: "水野新太" },
        fighterB: { slug: "lee-kaiwen", nameJa: "リー・カイウェン" },
        weightClass: "第1試合／フェザー級（66.0kg）",
        predictedWinner: "A",
        confidencePct: 68,
        notablePoints: [
          "水野新太は9勝1敗で、唯一の敗戦も判定(フィニッシュされたことは一度もない)。その1敗の直後、2026年5月にDEEPフェザー級暫定王座決定戦を判定5-0で制しており、勢いは戻っている",
          "リー・カイウェンは15勝8敗ながら現在2連敗中。2025年8月の中村京一郎戦は判定0-3の接戦負けだったが、直近2026年5月の高木凌戦は1R 1:38のTKO負けと、より早い時間で崩されている",
          "リーの連敗、特に直近の早期TKO負けが一時的な不振か地力の低下かが焦点。大きく崩れなければ水野が試合を組み立てて判定に持ち込む展開を想定",
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
  return ORIGINAL_ARTICLES.filter((a) => a.eventSlug === eventSlug && !a.hidden);
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
