// mnewsレーティングの掲載階級(RIZIN準拠5階級)。
// レート自体は階級横断で1本(engine.ts)。掲載階級はこのファイルで決める。
//
// 掲載階級は「階級が判明している直近のRIZIN MMA試合の階級」で決める
// (latestRizinDivision)。fighters.tsの名目weightClass(プロフィール表記)は
// 一切参照しない — 2026-07-12、名目階級への代用フォールバックを廃止した
// (中村大介が名目フェザー級のまま直近の実際の試合はライト級だったため
// フェザー級ランキングに誤配置されるバグの恒久修正)。
// bout単位のweightClassはEVENT_RESULTS(自社結果データ)から突合したものを
// fighterRecords.jsonのhistoryに格納している(enrichHistoryWeightClass.ts)。
// EVENT_RESULTSは直近(概ね18ヶ月分)のみ収録のため、古い試合のみの選手は
// 階級不明=nullとなり、どの階級ランキングにも掲載しない(推測補完はしない)。
export type MnewsDivision = "フライ級" | "バンタム級" | "フェザー級" | "ライト級" | "ヘビー級";

export const MNEWS_DIVISIONS: MnewsDivision[] = ["フライ級", "バンタム級", "フェザー級", "ライト級", "ヘビー級"];

// 一般公開する階級。他階級はrankings.jsonには算出結果を出すが、
// ページ(/rankings/[division])としては「準備中」表示に留める。
// 2026-07-13: v6(不活性ディケイ廃止+参戦前実績の初期補正、資格判定の活動空白
// バグ修正)により、フライ級・バンタム級の体感ズレ(実績組が沈み格下勝ち勢が
// 浮く)を是正できたことを目視レビューで確認し、フェザー級・ライト級に続いて
// 公開する。ヘビー級は未レビューのため引き続き非公開。
export const PUBLISHED_DIVISIONS: MnewsDivision[] = ["フライ級", "バンタム級", "フェザー級", "ライト級"];

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

// fighters.ts側の名目階級(プロフィール表記)が女子/アトム系かどうか。
// 2026-07-13、女子選手の誤混入バグの恒久修正として追加: mapToDivision()の
// 女子除外はbout単位のweightClass文字列に「女子」等の語が含まれる場合のみ
// 発火するが、実データの多くは「49.0kg契約」のように性別ラベルの無い体重
// のみの表記で記録されており、この場合は男子フライ級と同じkg数値レンジに
// 素通りして誤分類される(ケイト・ロータス等5名で実際に発生を確認)。
// fighters.tsの名目階級はスクレイピングされた個別試合ではなく、選手プロフィール
// として人手で維持されている「その選手が女子カテゴリの選手であるという事実」
// なので、これを除外判定の主ソースとして最優先で使う(bout単位のテキスト
// パースには依存しない)。
export function isNominallyWomensDivision(nominalWeightClass: string | undefined): boolean {
  return /女子|アトム|JEWELS/i.test(nominalWeightClass ?? "");
}

// weightClass文字列(例: "フェザー級", "71.0kg契約", "RIZINフェザー級タイトル
// マッチ", "第8代RIZINバンタム級王座決定戦") → 掲載階級。判定不能・対象外は
// null(推測で押し込まない)。
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

export interface HistoryBoutForDivision {
  date: string;
  weightClass?: string;
}

// weightClass文字列が階級名を明示しているか(例:「RIZINフェザー級タイトルマッチ」
// 「57.0kg契約 フライ級トーナメント2回戦」)。明示が無い"◯◯kg契約"のみの表記は、
// 単発のキャッチウェイト(2階級またぎの一戦)である可能性があり、その一戦だけで
// 本来の階級バケットから弾き出すのを防ぐ判定に使う(下記latestRizinDivision参照)。
export const NAMED_DIVISION_RE = /フライ級|バンタム級|フェザー級|ライト級|ヘビー級|ストロー級/;

// 直近戦の日付から2年遡った日付文字列を返す(YYYY-MM-DD文字列比較用)。
// 「直近の事実」の集計対象を絞るための時間窓。ELIGIBILITY_MAX_INACTIVE_MONTHS
// (18ヶ月)より少し広めに取り、階級変更後の実績が数試合分は必ず窓に収まる
// ようにしている。
function twoYearsBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y - 2}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 掲載階級の決定本体: 階級が判明している直近のRIZIN MMA boutの階級を基本とする。
// weightClassはenrichHistoryWeightClass.tsがRIZIN MMA boutにしか付与しない
// ため、ここで改めてisRizinMmaEventを見る必要はない(weightClass有り＝
// RIZIN MMA boutという不変条件)。該当boutが1つも無い(＝RIZIN MMA戦歴自体が
// 無い、または全て階級不明の古い試合のみ)選手はnull(＝ランキング非掲載。
// 名目階級へは絶対にフォールバックしない)。
//
// 例外: 直近の1戦が「階級名を明示しない単発のkg契約」で、かつそれ以前の
// 判明済み試合群の階級と食い違う場合は、その1戦をノイズとみなし、直近以前の
// 群の多数決階級を採用する(武田光司・コレスニックがRIZIN.52の71.0kg契約
// (通常のフェザー級より重い単発カード)1試合だけでフェザー級ランキングから
// 消えたバグの修正)。階級名が明示されている場合(例:「RIZINフェザー級
// タイトルマッチ」)や、比較対象となる過去の判明済み試合が無い場合(例:
// 直近戦しかRIZIN MMA戦績が無い選手の階級移動)は、これまでどおり直近の
// 1戦をそのまま採用する(名目階級へのフォールバックは行わない)。
//
// nominalWeightClass: fighters.ts側の名目階級(任意)。女子/アトム系であれば
// bout単位の判定を一切せずnullを返す(isNominallyWomensDivision参照)。
export function latestRizinDivision(history: HistoryBoutForDivision[], nominalWeightClass?: string): MnewsDivision | null {
  if (isNominallyWomensDivision(nominalWeightClass)) return null;

  const known = history
    .filter((h): h is HistoryBoutForDivision & { weightClass: string } => !!h.weightClass)
    .map((h) => ({ date: h.date, weightClass: h.weightClass, division: mapToDivision(h.weightClass) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const latest = known[0];
  if (!latest) return null;
  if (latest.division === null) return null; // 女子階級等、明示的に対象外の直近戦はフォールバックしない

  const isUnnamedCatchweight = /kg契約/.test(latest.weightClass) && !NAMED_DIVISION_RE.test(latest.weightClass);
  if (!isUnnamedCatchweight) return latest.division;

  const allOthers = known.slice(1).filter((k) => k.division !== null);
  if (allOthers.length === 0) return latest.division;

  // 2026-07-13再修正(Phase3): rizinRecords.jsonで全期間の判明済み試合が揃った
  // ことで、「直近の事実より過去の物量が勝つ」構造的な穴が露呈した(元谷友貴:
  // 2025年の明示フライ級×3より、2016〜2024年の未明示61kg契約×十数件が
  // 単純集計で数の力により上回り、バンタム級に誤判定していた)。othersを
  // 直近戦の2年以内に絞ってから多数決することで、キャリア全体の物量ではなく
  // 「今の階級」を表す直近の実績を優先する(明示された階級名を過去の未明示より
  // 優先する、という原則も従来どおり内側のタイ解消で維持する)。2年以内に
  // othersが1件も無ければ(直近2年に他の判明済み試合が無い選手)、従来どおり
  // 全期間のothersにフォールバックする(捏造を避け、判定不能に倒さない)。
  const recentCutoff = twoYearsBefore(latest.date);
  const recentOthers = allOthers.filter((o) => o.date >= recentCutoff);
  const others = recentOthers.length > 0 ? recentOthers : allOthers;

  // 2026-07-19追加: 比較対象(others)がちょうど1件のみ、かつその1件・直近戦の
  // 双方が未明示のkg契約(ラベルなし)の場合に限り、件数ベースの多数決ではなく
  // 契約体重(kg数値)を比較し、軽い方を採用する。直樹(naoki)が唯一の比較対象
  // (未明示68kg契約=ライト級相当)に押し切られ、直近戦(66kg契約=フェザー級
  // 相当)の方が正しいのに誤ってライト級と判定された事故で発覚: 件数ベースの
  // 多数決はサンプル数1件でも無条件に「多数派」とみなしてしまう。キャッチ
  // ウェイトは通常自階級以上の相手と受けるため、より軽い契約体重の方が本来の
  // 階級に近い代理指標になる(武田光司: 直近71kg契約[ライト級相当]より過去
  // 66kg契約[フェザー級相当]の方が軽く、フェザー級が正しい、という既存修正
  // とも両立する)。
  // 比較対象が2件以上の場合、または1件でもどちらかにラベルがある場合は
  // この特別扱いを行わず、以下の従来どおりの多数決+タイ解消ロジックに委ねる
  // (元谷友貴・秋元強真・金太郎・伊藤裕輝の既存回帰テストが機能する範囲を
  // 変えない)。
  if (others.length === 1) {
    const only = others[0];
    const onlyIsUnnamedCatchweight = /kg契約/.test(only.weightClass) && !NAMED_DIVISION_RE.test(only.weightClass);
    if (onlyIsUnnamedCatchweight) {
      const kgOf = (weightClass: string): number => {
        const m = weightClass.match(/(\d+(?:\.\d+)?)\s*kg/);
        return m ? Number(m[1]) : Infinity;
      };
      return kgOf(only.weightClass) < kgOf(latest.weightClass) ? (only.division as MnewsDivision) : latest.division;
    }
  }

  const counts = new Map<MnewsDivision, number>();
  for (const o of others) counts.set(o.division as MnewsDivision, (counts.get(o.division as MnewsDivision) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const majority = [...counts.entries()].filter(([, c]) => c === maxCount).map(([d]) => d);
  // 単独の多数派があれば、直近戦の値にかかわらずそれを採用する。
  if (majority.length === 1) return majority[0];
  // 複数タイの場合の解消順序(2026-07-13再修正): 単なる日付の新しさより、
  // 証拠の強さで優先順位をつける。
  // (a) タイ候補の中に階級名が明示された試合(NAMED_DIVISION_RE一致)があれば、
  //     それを最優先の証拠として採用する(伊藤裕輝: フライ級2票のうち1件が
  //     「フライ級トーナメント2回戦リザーブ」と明示されており、この明示evidenceが
  //     単なる日付の新しさに優先する)。
  const namedAmongTied = others.filter(
    (o) => majority.includes(o.division as MnewsDivision) && NAMED_DIVISION_RE.test(o.weightClass)
  );
  if (namedAmongTied.length > 0) {
    return namedAmongTied.sort((a, b) => (a.date < b.date ? 1 : -1))[0].division as MnewsDivision;
  }
  // (b) 明示された階級名の証拠が無い場合、直近戦(未明示の単発キャッチウェイト)
  //     自身の階級がタイ候補に含まれていれば採用する。これはothersのみでの
  //     単純集計がたまたまタイになっただけで、直近戦を含めた全体では明確な
  //     多数派になっているケースを救う(金太郎: 直近61kg=バンタムがタイ候補
  //     [フェザー,バンタム]に含まれるためバンタムを採用。全3戦の単純集計でも
  //     バンタム2:フェザー1で一致する)。
  if (majority.includes(latest.division)) return latest.division;
  // (c) それでも決まらない場合は、タイ候補の中で最も新しい試合の階級を採用する
  //     (従来どおりのフォールバック)。
  return others.find((o) => majority.includes(o.division as MnewsDivision))!.division as MnewsDivision;
}
