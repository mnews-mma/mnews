// 掲載階級の事実オーバーレイ。champions.ts/retirements.tsと同じ思想:
// 「どの階級のランキングに載せるか」を選手単位で確定できる一次ソース・データが
// あるとき、latestRizinDivision(自動判定)より優先して使う。
//
// これは掲載階級(=どの階級バケットに出すか)と、戦績スコープの起点日
// (eligibilityScopeStartDate、任意)だけの上書き。順位・レートは引き続き
// Eloの自動算出のまま(このファイルが順位やレートに触れることはない)。
// 推測での指定は禁止。根拠(note)を必ず添える。
//
// eligibilityScopeStartDate: 階級変更後の「戦績・掲載資格カウント対象」の
// 起点日。自動判定(detectDivisionChangeCutoff)は試合結果に階級名が明示
// されている場合のみ機能するが、RIZIN公式ソースでも階級名の明示が無い選手
// (例: 武田光司)では自動検出できないため、事実として起点日を手動指定する。
// 指定が無ければ従来どおり全期間を対象にする。
// recordDisplayExclusions: 通算戦績のスコープ起点(eligibilityScopeStartDate)
// では表現できない、キャリア途中の単発の他階級試合(例: フェザー級選手が
// 一度だけライト級タイトルマッチに出た)を、戦績表示からピンポイントで
// 除外する。順位・レート・掲載資格の判定には一切影響しない(表示テキストのみ)。
//
// 【既知の設計判断・仕様であってバグではない】上記のとおりeligibilityScopeStartDate/
// recordDisplayExclusionsはcomputeRawRatings(Elo計算本体)に一切触れないため、
// 「表示戦績(階級スコープ)」と「順位の根拠になっているレート(階級横断の生涯Elo)」
// が指す試合範囲は一致しないことがある(例: フライ級ページの表示戦績が「3勝3敗」でも、
// レートはその選手の全キャリア・全階級の結果を通算した値)。これは
// 「参戦前実績を初期補正としてレートに機械反映する」という既存方針(=キャリア全体で
// 今の強さを測る)と一貫した意図的な設計であり、レートも階級スコープ化する案(選手ごとに
// computeRawRatingsをスコープ対応させる)は2026-07-14に検討・シミュレーション済みだが、
// 階級移行選手全体に波及し王者交代等の大きな変動を招くため見送った(詳細は
// docs/ranking-internal-spec-v6.md「既知の容認事項」参照)。表示とレートのズレを見て
// 「バグでは」と再調査する前に、まずこのコメントとspecを確認すること。
export interface RecordDisplayExclusion {
  date: string; // rizinRecords.json優先適用後のhistory側の日付
  opponentSlug: string; // 対戦相手の自社DB slug
}

export interface FighterDivisionOverlayEntry {
  slug: string;
  name: string;
  division: "フライ級" | "バンタム級" | "フェザー級" | "ライト級" | "ヘビー級";
  eligibilityScopeStartDate?: string; // YYYY-MM-DD。この日付以降の試合のみを戦績集計の対象にする
  recordDisplayExclusions?: RecordDisplayExclusion[];
  fetchedDate: string;
  note: string;
}

export const FIGHTER_DIVISION_OVERLAYS: FighterDivisionOverlayEntry[] = [
  {
    slug: "kintaro",
    name: "金太郎",
    division: "バンタム級",
    fetchedDate: "2026-07-13",
    note:
      "latestRizinDivisionの旧タイ解消ロジックが、直近戦(RIZIN.53 2026-05-10・61.0kg契約)を" +
      "根拠の弱い単発キャッチウェイトとして集計から除外した結果、残り2戦([RIZIN LANDMARK 12" +
      "・62.0kg契約]対[RIZIN WORLD SERIES in KOREA・61.0kg契約])の1-1タイを直近寄りに解消し、" +
      "フェザー級へ誤配置していた(公開中フェザー級への混入)。直近戦を含めた全3戦の単純集計では" +
      "バンタム級2:フェザー級1でバンタム級が正しい多数派。タイ解消ロジック自体も本コミットで" +
      "根本修正済みだが、事実オーバーレイとしても明示的に確定させる。",
  },
  {
    slug: "takeda-koji",
    name: "武田光司",
    division: "フェザー級",
    eligibilityScopeStartDate: "2024-03-23",
    fetchedDate: "2026-07-13",
    note:
      "武田光司はRIZIN.15(2019)以降の長いRIZIN MMAキャリアで複数階級を経験しており、" +
      "EVENT_RESULTS収録期間(直近18ヶ月程度)内に階級名が明示された試合が無いため、" +
      "自動判定(latestRizinDivision)は直近2戦([RIZIN.52・71.0kg契約][RIZIN WORLD SERIES in " +
      "KOREA・66.0kg契約]、いずれも階級名の明示なし)からの推定に留まる。fighters.ts側の" +
      "プロフィール表記(現在の階級)がフェザー級であることと合わせ、掲載階級をフェザー級で" +
      "事実確定する。rizinRecords.json(RIZIN公式ソース)でも武田選手の試合には階級名の明示が" +
      "一切無く(全て体重数値のみ)、自動の階級変更スコープ検出(detectDivisionChangeCutoff)は" +
      "このデータでも機能しないため、戦績スコープの起点日(2024-03-23 RIZIN LANDMARK 9 in " +
      "KOBE・萩原京平戦、フェザー転向後最初の試合)を事実として手動指定する。" +
      "【2026-07-13時点の既知の食い違い】この起点日以降(2024-03-23〜2026-07-13)の" +
      "rizinRecords.jsonの実測はRIZIN(MMA)戦4試合・2勝2敗であり、期待されていた" +
      "「フェザー3-2」とは一致しない(公式ソースを網羅的に確認した上での実測値。データの" +
      "欠落によるものではない)。この期待値の根拠を再確認する必要がある。",
  },
  {
    slug: "nozimov-ilkhom",
    name: "イルホム・ノジモフ",
    division: "ライト級",
    eligibilityScopeStartDate: "2025-12-31",
    fetchedDate: "2026-07-13",
    note:
      "latestRizinDivisionの自動判定・掲載階級ともにライト級で正しいが、表示戦績が" +
      "フェザー級時代(2023-11-04・2024-04-29・2025-06-14、いずれも66.0kg契約=フェザー級" +
      "マッピング)を含む通算4勝1敗のままライト級ランキングに表示されていた" +
      "(本番/rankings/lightweightで確認、2026-07-13)。ライト級への実際の転向は" +
      "2025-12-31 RIZIN 師走の超強者祭り(サトシ戦・RIZINライト級タイトルマッチで勝利し" +
      "戴冠)で、以降は2026-05-10(グスタボ戦・王座陥落)を含め1勝1敗。武田光司と全く" +
      "同じ限界: 直近2戦は階級名が明示(「ライト級」)されているが、それ以前の" +
      "フェザー級時代3戦がいずれも66.0kg契約(未明示のキャッチウェイト表記)のため、" +
      "detectDivisionChangeCutoffの階級名明示ベースのミスマッチ検出では拾えず自動の" +
      "戦績スコープ起点検出が機能しない。掲載資格自体は直近年2戦の代替基準で" +
      "問題なく満たすため資格判定には影響が無く、表示戦績のみが誤って通算表示に" +
      "なっていた。表示戦績のみ事実として起点日を手動指定する。",
  },
  {
    slug: "karamov-vugar",
    name: "ヴガール・ケラモフ",
    division: "フェザー級",
    recordDisplayExclusions: [{ date: "2024-12-31", opponentSlug: "souza-roberto-satoshi" }],
    fetchedDate: "2026-07-14",
    note:
      "ケラモフのフェザー級ランキング表示戦績が9-4になっていた(本番/rankings/featherweightで確認、" +
      "2026-07-14)。原因は2件: (1) Wikipedia戦績表の本人ページだけ堀江圭功戦(RIZIN.41)を" +
      "2023-04-02、朝倉未来戦(超RIZIN.2)を2023-07-31と1日ずれて記録しており(相手側ページ・" +
      "RIZIN公式ソースはそれぞれ2023-04-01・2023-07-30で一致)、buildBoutsのDB内対決重複排除が" +
      "date完全一致キーのため二重カウントされていた(RECORD_OVERRIDESのpatch-date型で訂正済み。" +
      "訂正後の通算は7勝4敗)。(2) 2024-12-31のRIZIN.49はRIZINライト級タイトルマッチ(サトシ戦、" +
      "敗戦)であり、ケラモフ自身はフェザー級選手でこの一戦のみ単発でライト級に出た" +
      "(前後の試合はいずれもフェザー級)。武田光司の71.0kg契約単発と同種の一時的な階級越えだが、" +
      "この試合は階級名が明示されている(「ライト級」)ため、latestRizinDivision/掲載資格には" +
      "影響しない(単発ゆえ孤立excursionとして無視される)。フェザー級としての戦績表示からは" +
      "この1敗を除外するのが妥当と判断し、eligibilityScopeStartDateでは表現できない" +
      "(キャリア途中の単発試合のため)ため、recordDisplayExclusionsで個別に除外する。" +
      "結果、表示戦績は7勝3敗。順位・レート・掲載資格の判定には一切影響しない。",
  },
  {
    slug: "torres-jose",
    name: "ホセ・トーレス",
    division: "フライ級",
    recordDisplayExclusions: [{ date: "2025-12-31", opponentSlug: "goto-joji" }],
    fetchedDate: "2026-07-14",
    note:
      "トーレスのフライ級ランキング表示戦績が1勝2敗になっていた(本番/rankings/flyweightで確認、" +
      "2026-07-14)。直近試合の2025-12-31 後藤丈治戦(RIZIN 師走の超強者祭り)は61.0kg契約=" +
      "バンタム級マッピングで、トーレス自身はフライ級選手の単発バンタム級越え(前後の試合は" +
      "2025-07-27 扇久保博正戦[57.0kg契約=フライ級、かつ「RIZINフライ級ワールドグランプリ" +
      "1回戦」と明示]・2024-12-31 神龍誠戦、いずれもフライ級)。ケラモフと同種のケースとして" +
      "この1敗をフライ級としての表示戦績から除外する。掲載資格には影響しない(直近の実質的な" +
      "フライ級戦=2025-07-27扇久保戦が18ヶ月ルールの基準日として機能し、資格判定は従来どおり" +
      "全対戦を対象とするため通算試合数も減らない)。結果、表示戦績は1勝1敗。順位・レート・" +
      "掲載資格の判定には一切影響しない。",
  },
  {
    slug: "yamamoto-arsen",
    name: "山本アーセン",
    division: "フライ級",
    eligibilityScopeStartDate: "2023-05-06",
    fetchedDate: "2026-07-14",
    note:
      "山本アーセンのフライ級表示戦績を、2023-05-06 伊藤裕樹戦(勝利)を起点にフライ級選手としての" +
      "キャリアを開始した扱いとしてスコープする。それ以前はフライ級以外の階級での活動であり、" +
      "全期間を通算するとフライ級としての実態と乖離するため。エンジン実装(buildBouts+" +
      "computeScopedRecord)で検証済み: scopeStartDate=2023-05-06適用後の表示戦績は3勝3敗" +
      "(fights=6)。順位・レート・掲載資格の判定には一切影響しない(表示戦績のみ)。",
  },
  {
    slug: "motoya-yuki",
    name: "元谷友貴",
    division: "フライ級",
    eligibilityScopeStartDate: "2025-07-27",
    fetchedDate: "2026-07-14",
    note:
      "元谷友貴のフライ級表示戦績を、2025-07-27 ヒロヤ戦(勝利)を起点にフライ級選手としての" +
      "キャリアを開始した扱いとしてスコープする。それ以前はフライ級以外の階級での活動であり、" +
      "全期間を通算するとフライ級としての実態と乖離するため。エンジン実装で検証済み: " +
      "scopeStartDate=2025-07-27適用後の表示戦績は2勝2敗(fights=4)。順位・レート・掲載資格の" +
      "判定には一切影響しない(表示戦績のみ)。",
  },
  {
    slug: "ougikubo-hiromasa",
    name: "扇久保博正",
    division: "フライ級",
    eligibilityScopeStartDate: "2022-12-31",
    recordDisplayExclusions: [{ date: "2023-07-30", opponentSlug: "name:フアンアーチュレッタ" }],
    fetchedDate: "2026-07-14",
    note:
      "扇久保博正のフライ級表示戦績を、2022-12-31 堀口恭司戦(敗戦)を起点にフライ級選手としての" +
      "キャリアを開始した扱いとしてスコープする。それ以前はフライ級以外の階級での活動であり、" +
      "全期間を通算するとフライ級としての実態と乖離するため。加えてスコープ内の2023-07-30 " +
      "フアン・アーチュレッタ戦(RIZINバンタム級タイトルマッチ、敗戦)はフライ級選手としての" +
      "単発バンタム級越えであり、トーレス・ケラモフと同種のケースとしてこの1敗を表示戦績から" +
      "除外する。フアン・アーチュレッタは自社DBに選手ページが無い(圏外)ため、対戦相手ノードは" +
      "buildBoutsのnormalizeOpponentNameが生成する疑似ノード名(name:フアンアーチュレッタ)を" +
      "そのままopponentSlugに指定する必要がある(通常のDB slugではない点に注意、エンジン検証" +
      "スクリプトでマッチすることを確認済み)。エンジン実装で検証済み: scopeStartDate=" +
      "2022-12-31 + 上記除外を適用後の表示戦績は5勝2敗(fights=7)。順位・レート・掲載資格の" +
      "判定には一切影響しない(表示戦績のみ)。",
  },
  {
    slug: "horie-yoshinori",
    name: "堀江圭功",
    division: "ライト級",
    eligibilityScopeStartDate: "2023-09-24",
    fetchedDate: "2026-07-14",
    note:
      "堀江圭功のライト級表示戦績を、2023-09-24 スパイク・カーライル戦(勝利、RIZIN.44)を起点に" +
      "ライト級選手としてのキャリアを開始した扱いとしてスコープする。それ以前はライト級以外の" +
      "階級での活動であり、全期間を通算するとライト級としての実態と乖離するため。エンジン実装" +
      "で検証済み: scopeStartDate=2023-09-24適用後の表示戦績は3勝2敗(fights=5)。既存の掲載" +
      "階級(ライト級、rank5)自体は変わらない。順位・レート・掲載資格の判定には一切影響しない" +
      "(表示戦績のみ)。",
  },
  {
    slug: "fukuda-ryuya",
    name: "福田龍彌",
    division: "バンタム級",
    eligibilityScopeStartDate: "2024-12-31",
    fetchedDate: "2026-07-14",
    note:
      "福田龍彌のバンタム級表示戦績を、2024-12-31 芦澤竜誠戦(勝利、RIZIN.49)を起点にバンタム級" +
      "選手としてのキャリアを開始した扱いとしてスコープする。それ以前はバンタム級以外の階級" +
      "(フライ級・修斗世界フライ級タイトル戦等)での活動であり、全期間を通算するとバンタム級" +
      "としての実態と乖離するため。エンジン実装で検証済み: scopeStartDate=2024-12-31適用後の" +
      "表示戦績は2勝2敗(fights=4)。既存の掲載階級(バンタム級、rank5)自体は変わらない。順位・" +
      "レート・掲載資格の判定には一切影響しない(表示戦績のみ)。",
  },
  {
    slug: "miyagawa-hyuga",
    name: "宮川日向",
    division: "バンタム級",
    recordDisplayExclusions: [{ date: "2026-07-18", opponentSlug: "suzuki-hiroaki" }],
    fetchedDate: "2026-07-19",
    note:
      "対鈴木博昭戦(2026-07-18、RIZIN LANDMARK 15)は66.0kg契約=フェザーへの単発excursion。" +
      "宮川はバンタムのランカーで前後の試合はいずれも61.0kg契約。ケラモフ/トーレスと同種の" +
      "単発階級越えとして、この1敗をバンタム級としての表示戦績から除外する(ユーザー判断)。" +
      "除外後の表示戦績は2勝0敗。latestRizinDivisionはバンタムのまま、順位・レート・掲載資格" +
      "の判定には一切影響しない(表示戦績のみ)。",
  },
  {
    slug: "umeno-genji",
    name: "梅野源治",
    division: "バンタム級",
    recordDisplayExclusions: [{ date: "2026-07-18", opponentSlug: "name:昇侍" }],
    fetchedDate: "2026-07-19",
    note:
      "対昇侍戦(2026-07-18、RIZIN LANDMARK 15)は64.0kgキャッチの単発excursion。昇侍は自社DB" +
      "未登録のためopponentSlugは疑似ノード(name:昇侍)で指定する。この1敗をバンタム級としての" +
      "表示戦績から除外する(ユーザー判断)。除外後の表示戦績は2勝1敗。順位・レート・掲載資格" +
      "の判定には一切影響しない(表示戦績のみ)。",
  },
  {
    slug: "akimoto-kyoma",
    name: "秋元強真",
    division: "フェザー級",
    recordDisplayExclusions: [
      { date: "2024-09-29", opponentSlug: "kintaro" },
      { date: "2024-12-31", opponentSlug: "motoya-yuki" },
    ],
    fetchedDate: "2026-07-20",
    note:
      "秋元強真のフェザー級表示戦績に、実際はバンタム級だった2試合が混入していた" +
      "(通算7勝1敗→正しくは6勝0敗)。RIZIN公式ソース(rizinRecords.json)で両試合とも" +
      "61kg(バンタム級)であることを確認済み: Yogibo presents RIZIN.48(2024-09-29、" +
      "対金太郎、61kg)、RIZIN DECADE / Yogibo presents RIZIN.49(2024-12-31、対元谷友貴、" +
      "namedDivision=バンタム級明示)。トーレス・ケラモフと同種の単発他階級試合として、" +
      "この2試合をフェザー級としての表示戦績から除外する。除外後の表示戦績は6勝0敗。" +
      "順位・レート・掲載資格の判定には一切影響しない(表示戦績のみ。Eloは階級横断の" +
      "生涯レートのため、この2試合が実在の対戦である以上レート自体は変更しない。既存の" +
      "設計判断(本ファイル冒頭コメント参照)と同じ扱い)。",
  },
];

export function getDivisionOverlay(
  slug: string
): FighterDivisionOverlayEntry["division"] | null {
  return FIGHTER_DIVISION_OVERLAYS.find((o) => o.slug === slug)?.division ?? null;
}

export function getEligibilityScopeStartDate(slug: string): string | null {
  return FIGHTER_DIVISION_OVERLAYS.find((o) => o.slug === slug)?.eligibilityScopeStartDate ?? null;
}

export function getRecordDisplayExclusions(slug: string): RecordDisplayExclusion[] {
  return FIGHTER_DIVISION_OVERLAYS.find((o) => o.slug === slug)?.recordDisplayExclusions ?? [];
}
