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
import type { P4PFile } from "../mnewsRating/p4pFile";

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

// ===== P4P(パウンドフォーパウンド)必達不変条件 =====
//
// 「王者が全員存在する」「非公開階級が混入しない」の2つは判定ロジック自体を
// P4Pビルダーと同じファイル(src/lib/mnewsRating/p4pFile.ts)に置き、ここでは
// scripts/generate-p4p.tsが呼ぶ入口として再エクスポートするに留める。
//
// 2026-07-26: 閾値clamp(閾値30)へ戻したため「同一階級内P4P順序==公開rank順」の
// 完全一致チェック(旧checkP4PDivisionOrderInvariant)は撤回した。明確な格上
// (レート差>閾値)の逆転は意図した挙動であり、完全一致を強制するとサトシ・
// ソウザの逆転で常に落ちてしまう。代わりに下記checkP4PH2HRespectで「P4Pが
// 直接対決(H2H)の結果と矛盾しない」ことだけを守る。
export {
  verifyAllChampionsPresent as checkP4PAllChampionsPresent,
  verifyPublishedDivisionsOnly as checkP4PPublishedDivisionsOnly,
} from "../mnewsRating/p4pFile";

// P4P版のH2H整合チェック。上のREQUIRED_RANKING_INVARIANTS(階級別ランキング用に
// キュレーションした直接対決リスト)を、P4Pランキングにも適用する:
// 勝者が敗者よりP4Pで上位(p4pRankが小さい)でなければならない。閾値clampが
// 「明確な格上」の逆転を許した結果、直接対決で負けている選手が勝者を追い越す
// (福田>テミロフ等)ことを防ぐ最終防衛。clampの内部状態・閾値の値には一切
// 依存せず、生成後の最終成果物(p4pRank)だけを見る独立チェック。
// 王者・挑戦者いずれのtierかを問わずfighterIdで突合する。両者ともP4Pに存在する
// ときのみ判定する(片方が資格喪失等でP4P圏外なら順序の矛盾自体が生じない)。
export function checkP4PH2HRespect(file: P4PFile): string[] {
  const errors: string[] = [];
  const rankByFighter = new Map(file.entries.map((e) => [e.fighterId, e.p4pRank]));
  for (const inv of REQUIRED_RANKING_INVARIANTS) {
    const winnerRank = rankByFighter.get(inv.winnerSlug);
    const loserRank = rankByFighter.get(inv.loserSlug);
    if (winnerRank === undefined || loserRank === undefined) continue;
    if (winnerRank > loserRank) {
      errors.push(
        `${inv.division}: P4Pが直接対決の結果と矛盾(${inv.winnerSlug}がP4P${winnerRank}位 / 敗者${inv.loserSlug}がP4P${loserRank}位): ${inv.note}`
      );
    }
  }
  return errors;
}
