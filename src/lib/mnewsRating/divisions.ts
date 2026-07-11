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

// 第一弾で一般公開する階級。他階級はrankings.jsonには算出結果を出すが、
// ページ(/rankings/[division])としては「準備中」表示に留める。
export const PUBLISHED_DIVISIONS: MnewsDivision[] = ["フェザー級"];

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
const NAMED_DIVISION_RE = /フライ級|バンタム級|フェザー級|ライト級|ヘビー級|ストロー級/;

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
export function latestRizinDivision(history: HistoryBoutForDivision[]): MnewsDivision | null {
  const known = history
    .filter((h): h is HistoryBoutForDivision & { weightClass: string } => !!h.weightClass)
    .map((h) => ({ date: h.date, weightClass: h.weightClass, division: mapToDivision(h.weightClass) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const latest = known[0];
  if (!latest) return null;
  if (latest.division === null) return null; // 女子階級等、明示的に対象外の直近戦はフォールバックしない

  const isUnnamedCatchweight = /kg契約/.test(latest.weightClass) && !NAMED_DIVISION_RE.test(latest.weightClass);
  if (!isUnnamedCatchweight) return latest.division;

  const others = known.slice(1).filter((k) => k.division !== null);
  if (others.length === 0) return latest.division;

  const counts = new Map<MnewsDivision, number>();
  for (const o of others) counts.set(o.division as MnewsDivision, (counts.get(o.division as MnewsDivision) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const majority = [...counts.entries()].filter(([, c]) => c === maxCount).map(([d]) => d);
  if (majority.includes(latest.division)) return latest.division; // 直近戦も多数派と一致=食い違いなし
  if (majority.length === 1) return majority[0];
  return others.find((o) => majority.includes(o.division as MnewsDivision))!.division as MnewsDivision; // 同数タイは直近優先
}
