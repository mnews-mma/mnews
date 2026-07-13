// data/rizinRecords.json(RIZIN公式サイトから機械取得した生の試合一覧)から、
// 選手単位の戦績集計を導出する純関数群。rizinRecords.json自体は生データを
// 全ルール種別(MMA・キックボクシング・シュートボクシング・グラップリング等)
// 混在のまま保持する(取得できたものをそのまま残す=捏造ゼロ)。
// 「RIZIN戦績」として意味を持つのはMMAルール戦のみのため、集計時に絞り込む
// (対象外にした試合は削除ではなく理由つきでexcludedとして返す)。
import { RizinRecordsBout, RizinRecordsEvent } from "./rizinScraper";

export interface RizinFighterBout {
  event: string;
  date: string;
  opponentName: string;
  opponentSlug: string | null;
  resultType: string; // "decisive" | "draw" | "nc" | "cancelled" | "unknown"
  isWin: boolean;
  methodRaw: string;
  namedDivision: string | null;
  weightKg: number | null;
}

export interface RizinExcludedBout {
  event: string;
  date: string;
  opponentName: string;
  reason: string; // 例:「ルール種別がMMA以外(キックボクシング)」
}

export interface RizinFighterRecord {
  wins: number;
  losses: number;
  draws: number;
  ncs: number;
  bouts: RizinFighterBout[]; // MMAルール戦のみ(集計対象)
  excluded: RizinExcludedBout[]; // MMAルール以外・対象外として除外した試合
}

// 集計対象に含めるルール種別。MMA以外(キックボクシング・シュートボクシング・
// グラップリング・その他の特別ルール)は「RIZIN(MMA)戦績」には数えない。
const MMA_RULE_TYPES = new Set(["MMA"]);

export function computeFighterMmaRecord(events: RizinRecordsEvent[], slug: string): RizinFighterRecord {
  const bouts: RizinFighterBout[] = [];
  const excluded: RizinExcludedBout[] = [];
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let ncs = 0;

  for (const ev of events) {
    for (const b of ev.bouts) {
      const isA = b.fighterASlug === slug;
      const isB = b.fighterBSlug === slug;
      if (!isA && !isB) continue;

      const opponentName = isA ? b.fighterBName : b.fighterAName;
      const opponentSlug = isA ? b.fighterBSlug : b.fighterASlug;

      if (!MMA_RULE_TYPES.has(b.ruleType)) {
        excluded.push({
          event: ev.eventName,
          date: ev.date,
          opponentName,
          reason: `ルール種別がMMA以外(${b.ruleType})`,
        });
        continue;
      }

      const isWin = b.winnerSlug === slug;
      if (b.resultType === "nc") ncs++;
      else if (b.resultType === "draw") draws++;
      else if (b.resultType === "decisive") {
        if (isWin) wins++;
        else losses++;
      }
      // cancelled/unknownは勝敗・NCいずれにも数えない(試合が成立していない、
      // または決着種別を判定できないため)。boutsには記録として残す。

      bouts.push({
        event: ev.eventName,
        date: ev.date,
        opponentName,
        opponentSlug,
        resultType: b.resultType,
        isWin,
        methodRaw: b.methodRaw,
        namedDivision: b.namedDivision,
        weightKg: b.weightKg,
      });
    }
  }

  bouts.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { wins, losses, draws, ncs, bouts, excluded };
}
