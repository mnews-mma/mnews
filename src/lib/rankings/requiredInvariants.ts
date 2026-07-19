// 必達不変条件リスト(2026-07-19 PR-1)。
//
// checkRecentH2HInvariant(monotonicity.ts)は「直近182日以内のH2H」のみを
// 無条件に守る非対称ガードで、それより古い対決やrank gapが
// MONOTONICITY_MAX_RANK_GAP_V9を超えるペアは補正・検証の対象外になり得る。
// テミロフ>福田がgap拡大で静かに壊れた事例(2026-07-19)では、補正ロジックが
// 届かない範囲(gap超過)を検証ロジックも同じ理由で見逃していた —
// 「補正が届く範囲」と「検証が届く範囲」が同一という設計が盲点だった。
//
// このリストは上記の仕組みと完全に独立して、gapの大小・recency窓の内外を
// 問わず「勝者は敗者より順位が上でなければならない」ことを機械的に強制する。
// 追加・削除は必ず実データ(fighterRecords.json)のboutDateを確認した上で行う。
import { MnewsDivision } from "../mnewsRating/divisions";

export interface RequiredInvariantEntry {
  division: MnewsDivision;
  winnerSlug: string;
  loserSlug: string;
  boutDate: string;
  note: string;
}

export const REQUIRED_RANKING_INVARIANTS: RequiredInvariantEntry[] = [
  {
    division: "フライ級",
    winnerSlug: "laramie-tony",
    loserSlug: "motoya-yuki",
    boutDate: "2026-06-06",
    note: "RIZIN LANDMARK 14 直接対決",
  },
  {
    division: "バンタム級",
    winnerSlug: "temirov-azizbek",
    loserSlug: "fukuda-ryuya",
    boutDate: "2026-04-12",
    note: "RIZIN LANDMARK 13 直接対決(gap拡大でsilent breakした実例あり)",
  },
  {
    division: "バンタム級",
    winnerSlug: "yrysbek-tilenov",
    loserSlug: "ota-shinobu",
    boutDate: "2026-07-18",
    note: "RIZIN LANDMARK 15 直接対決(ティレノフが太田より上、の緩和要件を恒久化)",
  },
];

export interface RequiredInvariantViolation {
  division: MnewsDivision;
  winnerSlug: string;
  loserSlug: string;
  winnerRank: number;
  loserRank: number;
  note: string;
}

// rankedSlugsByDivision: 階級ごとの最終順位配列(0番目が1位)。
// 対象階級がスコープ外、またはいずれかの選手が現在ランク圏内に存在しない
// 場合はチェック対象外(そもそも順位関係が定義できないため)。
export function checkRequiredInvariants(
  rankedSlugsByDivision: Map<MnewsDivision, string[]>
): RequiredInvariantViolation[] {
  const violations: RequiredInvariantViolation[] = [];
  for (const entry of REQUIRED_RANKING_INVARIANTS) {
    const rankedSlugs = rankedSlugsByDivision.get(entry.division);
    if (!rankedSlugs) continue;
    const winnerIdx = rankedSlugs.indexOf(entry.winnerSlug);
    const loserIdx = rankedSlugs.indexOf(entry.loserSlug);
    if (winnerIdx === -1 || loserIdx === -1) continue;
    if (winnerIdx > loserIdx) {
      violations.push({
        division: entry.division,
        winnerSlug: entry.winnerSlug,
        loserSlug: entry.loserSlug,
        winnerRank: winnerIdx + 1,
        loserRank: loserIdx + 1,
        note: entry.note,
      });
    }
  }
  return violations;
}
