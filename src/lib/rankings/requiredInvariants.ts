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

// reason: "order"=順位関係が逆転している / "winner-not-found"・
// "loser-not-found"=該当選手が当該階級のランク圏内に存在しない /
// "division-not-found"=当該階級自体がランキング対象外。
// 見つからない場合を"チェック対象外"として黙ってスキップすると、リストの
// slugが実データと紐付いていない死んだエントリ(誰にもマッチせず常にpassする
// だけの行)が検証をすり抜けてしまう。資格喪失等で選手が圏外に落ちた場合も
// 含め、必ず違反として報告し人間判断に上げる(推測での自動除外はしない)。
export type RequiredInvariantViolationReason =
  | "order"
  | "winner-not-found"
  | "loser-not-found"
  | "division-not-found";

export interface RequiredInvariantViolation {
  division: MnewsDivision;
  winnerSlug: string;
  loserSlug: string;
  winnerRank: number | null;
  loserRank: number | null;
  note: string;
  reason: RequiredInvariantViolationReason;
}

// rankedSlugsByDivision: 階級ごとの最終順位配列(0番目が1位)。
export function checkRequiredInvariants(
  rankedSlugsByDivision: Map<MnewsDivision, string[]>
): RequiredInvariantViolation[] {
  const violations: RequiredInvariantViolation[] = [];
  for (const entry of REQUIRED_RANKING_INVARIANTS) {
    const rankedSlugs = rankedSlugsByDivision.get(entry.division);
    if (!rankedSlugs) {
      violations.push({
        division: entry.division,
        winnerSlug: entry.winnerSlug,
        loserSlug: entry.loserSlug,
        winnerRank: null,
        loserRank: null,
        note: entry.note,
        reason: "division-not-found",
      });
      continue;
    }
    const winnerIdx = rankedSlugs.indexOf(entry.winnerSlug);
    const loserIdx = rankedSlugs.indexOf(entry.loserSlug);
    if (winnerIdx === -1 || loserIdx === -1) {
      violations.push({
        division: entry.division,
        winnerSlug: entry.winnerSlug,
        loserSlug: entry.loserSlug,
        winnerRank: winnerIdx === -1 ? null : winnerIdx + 1,
        loserRank: loserIdx === -1 ? null : loserIdx + 1,
        note: entry.note,
        reason: winnerIdx === -1 ? "winner-not-found" : "loser-not-found",
      });
      continue;
    }
    if (winnerIdx > loserIdx) {
      violations.push({
        division: entry.division,
        winnerSlug: entry.winnerSlug,
        loserSlug: entry.loserSlug,
        winnerRank: winnerIdx + 1,
        loserRank: loserIdx + 1,
        note: entry.note,
        reason: "order",
      });
    }
  }
  return violations;
}

// ===== P4P(パウンドフォーパウンド)必達不変条件(2026-07-22追加、同日2回目の
// 改訂でzスコア正規化・clampを撤回したため「同一階級内の順序が公開rank順と
// 一致する」不変条件は撤回済み。P4Pは階級を跨いだ通算rawRatingの絶対値で
// 並べるため、公開ランキングとの食い違いは意図的な仕様) =====
//
// 上記のREQUIRED_RANKING_INVARIANTS(H2H直接対決の手動キュレーションリスト)
// とは性質が異なる(P4Pは階級横断の構造的な不変条件であり、個別の対戦カード
// リストではない)ため、実装(判定ロジック)自体はP4Pビルダーと同じファイル
// (src/lib/mnewsRating/p4pFile.ts)に置く。ここでは「必達不変条件の検証は
// この1ファイルを見ればすべて分かる」という既存の意図を維持するため、
// scripts/generate-p4p.tsが呼ぶ入口として再エクスポートするだけに留める。
export {
  verifyAllChampionsPresent as checkP4PAllChampionsPresent,
  verifyPublishedDivisionsOnly as checkP4PPublishedDivisionsOnly,
  verifyDivisionOrderInvariant as checkP4PDivisionOrderInvariant,
} from "../mnewsRating/p4pFile";
