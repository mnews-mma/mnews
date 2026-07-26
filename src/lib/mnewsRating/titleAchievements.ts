// RIZIN王座戦(タイトルマッチ・王座決定戦)の実績を、戦績データ
// (data/fighterRecords.json)から機械的に導出する(2026-07-26追加)。
//
// なぜ手書きの「元王者リスト」を作らないか:
// - champions.ts は現王者のスナップショットしか持たず、元王者(王座を失った
//   選手)を表現できない。手書きの元王者リストを足すと保守コストが増え、
//   実データとの乖離(更新漏れ)も生む。
// - 一方で戦績データには、各boutの weightClass / event に
//   「【RIZINライト級タイトルマッチ】」「【初代RIZINライト級王座決定戦】」という
//   公式表記がそのまま入っている。ここから数えれば捏造ゼロで、今後の
//   タイトル戦にも自動追従する(人手の更新が不要)。
//
// 数え方: RIZIN王座戦での「勝利」= 戴冠 または 防衛。
//   例) ホベルト・サトシ・ソウザ = 6勝
//       (2021-06-13 初代RIZINライト級王座決定戦○ + タイトルマッチ○×5)
// 王座戦での敗北(失冠・挑戦失敗)は減点しない。P4Pで評価したいのは
// 「ベルトを獲り、防衛した実績」そのものであり、失冠は現在のレート
// (rawRating)側に既に反映されているため二重に罰しない。
//
// 他団体(REAL / DEEP / Bellator 等)の王座は数えない。mnewsレーティングが
// RIZIN開催のMMA試合のみで算出されている以上、実績側だけ他団体を混ぜると
// 評価軸が食い違うため(例: 野村駿太のDEEPライト級王座はここでは数えない)。
//
// ===== 鮮度による減衰(2026-07-26追加、重要) =====
// 単純な勝利数だとタイトル実績が永久に同じ重みで効き続け、「何年も前に一度
// ベルトを巻いただけの選手」が現在の序列を歪める。実際に以下が起きていた:
//  - ヴガール・ケラモフ(2023-07-30の王座勝1)の加点が、階級内pull-upを通じて
//    上位のカルシャガ・ダウトベック・秋元強真まで押し上げていた
//  - 鈴木千裕(2023-11-04 / 2024-04-29)の加点が、上位のYA-MANを実力以上に
//    押し上げてP4P15位に置いていた(トニー・ララミー・元谷友貴より上)
// そこで王座勝利1件ごとに「半減期TITLE_RECENCY_HALF_LIFE_YEARS年」の指数減衰を
// かけ、実績値(titleValue)として合算する。直近の防衛ほど重く、古い戴冠ほど軽い。
//   例) 半減期2年のとき、2年前の王座勝=0.5件ぶん、4年前=0.25件ぶん。
// これにより「3連続防衛中のダニー・サバテロ(全て直近)」が「1勝のみのルイス・
// グスタボ」より正しく上に来る、といった直感とも一致する。
export const TITLE_RECENCY_HALF_LIFE_YEARS = 2;

const DAYS_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365.25;

// data/fighterRecords.json の history 要素のうち、王座判定に使う項目だけを
// 構造的に受ける(engine.ts の型に結合させない)。
export interface TitleBoutLike {
  date?: string | null;
  result?: string;
  event?: string | null;
  weightClass?: string | null;
}

export interface TitleAchievement {
  // RIZIN王座戦での勝利数(戴冠+防衛)。減衰なしの事実値。表示に使える。
  wins: number;
  // 鮮度減衰後の実績値。P4Pのスコア計算に使うのはこちら。
  value: number;
  // 直近の王座戦勝利日(無ければnull)。表示・デバッグ用。
  lastTitleWin: string | null;
}

// RIZINの王座戦かどうか。weightClassとeventの両方を連結して判定する
// (どちらに公式表記が入るかはデータ由来で揺れがあるため)。
// 「RIZIN」を含むことを必須にして、他団体の王座戦を除外する。
export function isRizinTitleBout(bout: TitleBoutLike): boolean {
  const text = `${bout.weightClass ?? ""} ${bout.event ?? ""}`;
  if (!text.includes("RIZIN")) return false;
  return text.includes("タイトルマッチ") || text.includes("王座決定");
}

// RIZIN王座戦で勝利した試合の日付一覧(昇順)。
export function collectRizinTitleWinDates(history: TitleBoutLike[] | undefined | null): string[] {
  if (!history) return [];
  const dates: string[] = [];
  for (const bout of history) {
    if (bout.result !== "win") continue;
    if (!bout.date) continue;
    if (!isRizinTitleBout(bout)) continue;
    dates.push(bout.date);
  }
  return dates.sort();
}

// "YYYY-MM-DD" をUTC真夜中として解釈する。日付のみをnew Date()に渡すと実装依存の
// タイムゾーン解釈に頼ることになるため、必ずT00:00:00.000Zを明示する
// (scripts/check-jst-date-bypass.ts の方針に合わせる)。減衰は「2つの日付の差」
// にしか使わないため、UTC同士で揃っていれば壁時計・JSTに一切依存しない。
function parseDateUtcMs(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00.000Z`);
}

// 王座勝利日の一覧を、asOf時点での鮮度減衰つき実績値に変換する。
// asOfDate はデータ内の最新試合日を渡すこと(実行時の壁時計を使わない=
// 同じコミットなら常に同じ出力になる、という既存の決定性方針を守るため)。
export function computeTitleValue(
  winDates: string[],
  asOfDate: string,
  halfLifeYears: number = TITLE_RECENCY_HALF_LIFE_YEARS
): number {
  const asOfMs = parseDateUtcMs(asOfDate);
  let total = 0;
  for (const d of winDates) {
    const ms = parseDateUtcMs(d);
    if (Number.isNaN(ms)) continue;
    const years = (asOfMs - ms) / DAYS_MS / YEAR_DAYS;
    // asOfより後の日付(データ揺れ)は減衰させず1件ぶんとして扱う。
    total += years <= 0 ? 1 : Math.pow(0.5, years / halfLifeYears);
  }
  return total;
}

// slug -> 王座実績 の索引を作る。
export function buildTitleAchievementIndex(
  records: Record<string, { history?: TitleBoutLike[] | null } | undefined>,
  asOfDate: string,
  halfLifeYears: number = TITLE_RECENCY_HALF_LIFE_YEARS
): Map<string, TitleAchievement> {
  const out = new Map<string, TitleAchievement>();
  for (const [slug, entry] of Object.entries(records)) {
    if (!entry) continue;
    const winDates = collectRizinTitleWinDates(entry.history);
    out.set(slug, {
      wins: winDates.length,
      value: computeTitleValue(winDates, asOfDate, halfLifeYears),
      lastTitleWin: winDates.length > 0 ? winDates[winDates.length - 1] : null,
    });
  }
  return out;
}
