import { getUpcomingEvents } from "@/lib/events";
import { findFighterSlugByName } from "@/lib/fighters";
import { fetchRankings } from "@/lib/mnewsRatingData";
import { mapToDivision, DIVISION_SLUG, PUBLISHED_DIVISIONS } from "@/lib/mnewsRating/divisions";
import { findRankLabelInDivision } from "@/lib/mnewsRating/divisionRankingView";
import LiveResultTool from "@/components/LiveResultTool";

export const dynamic = "force-dynamic";

// その試合の階級(bout.weightClass)におけるAI RIZINランキング順位ラベルを返す。
// 公開中の階級(PUBLISHED_DIVISIONS)のみ判定対象(サイト非公開の階級のランキングを
// X投稿にだけ先出しする、という抜け道を作らないため)。選手名→slug解決に失敗、
// 階級が判定不能、対象階級が非公開、ランキング未掲載、またはRANKING_DISPLAY_CAP
// (=15、/rankings各階級一覧・選手ページのランクバッジと共有する単一の定数)より
// 下の順位のいずれの場合もnull(順位を捏造しない=未ランクとして扱う)。
// findRankLabelInDivision自体がgetDisplayRank(divisionRankingView.ts)の薄い
// フォーマッタなので、キャップの判定ロジックはここでは独自に書かない。
function rankLabelForBoutFighter(
  fighterName: string,
  weightClass: string,
  rankings: Awaited<ReturnType<typeof fetchRankings>>
): string | null {
  const division = mapToDivision(weightClass);
  if (!division || !PUBLISHED_DIVISIONS.includes(division)) return null;
  const slug = findFighterSlugByName(fighterName);
  if (!slug) return null;
  return findRankLabelInDivision(rankings[DIVISION_SLUG[division]], slug);
}

// 大会当日のライブ入力(7/5暫定版: 結果カード生成+X手動ポスト)。
// サイトへの結果反映(git commit経由)とX自動ポストは7/13までに実装予定。
export default async function AdminLivePage() {
  const rankings = await fetchRankings();

  const events = getUpcomingEvents().map((e) => ({
    slug: e.slug,
    eventName: e.eventName,
    date: e.date,
    org: e.org,
    bouts: e.bouts.map((b, i) => ({
      index: i,
      weightClass: b.weightClass,
      fighterA: b.fighterA,
      fighterB: b.fighterB,
      isTitleMatch: !!b.isTitleMatch,
      cancelled: !!b.cancelled,
      fighterARank: rankLabelForBoutFighter(b.fighterA, b.weightClass, rankings),
      fighterBRank: rankLabelForBoutFighter(b.fighterB, b.weightClass, rankings),
    })),
  }));

  return <LiveResultTool events={events} />;
}
