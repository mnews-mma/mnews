import { computeFighterStripStats, computeWinRate, LAST5_SYMBOL } from "@/lib/fighterStrip";
import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";

// events/[slug](full)・results/[slug](compact)で共用する戦績ストリップ。
// slug/entryのいずれかが無い(=選手DB未登録・戦績データなし)場合、
// full は何も出さず、compact は既存同様プレーンテキストの名前のみにする
// (fighterRecords.jsonに無い選手をリンク化・捏造しない)。
//
// full は選手名を含まない(呼び出し側のBoutCardが選手名を1回だけ別途表示する
// ため、ここでは名前の直下に来る戦績スタッツのみを返す)。2段固定:
// 上段=戦績+直近5戦○●／下段=勝率+フィニッシュ率。折り返しの有無を幅任せに
// せず常にこの2段で描画する(TKOはKO側に含める前提の既存finishRate算出ロジック
// はそのまま流用、ラベル表記のみ「フィニッシュ率」)。
export default function FighterStrip({
  name,
  slug,
  entry,
  variant,
}: {
  name: string;
  slug: string | null;
  entry: FighterRecordEntry | null;
  variant: "full" | "compact";
}) {
  if (variant === "compact") {
    if (!slug || !entry) return <span>{name}</span>;
    const { record } = computeFighterStripStats(entry);
    return (
      <>
        <a href={`/fighters/${slug}`} className="opponent-link">
          {name}
        </a>
        <span className="fighter-strip-compact-record">{record}</span>
      </>
    );
  }

  // full
  if (!slug || !entry) return null;
  const { record, finishRate, last5 } = computeFighterStripStats(entry);
  const winRate = computeWinRate(entry);
  return (
    <div className="fighter-strip">
      <div className="fighter-strip-row1">
        <span className="fighter-strip-record">{record}</span>
        {last5.length > 0 && (
          <span className="fighter-strip-last5">
            {last5.map((r, i) => (
              <span key={i} className={`fighter-strip-last5-${r}`}>
                {LAST5_SYMBOL[r]}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="fighter-strip-row2">
        <span className="fighter-strip-winrate">勝率{winRate !== null ? `${winRate}%` : "—"}</span>
        {finishRate !== null && (
          <span className="fighter-strip-finish">フィニッシュ率{finishRate}%</span>
        )}
      </div>
    </div>
  );
}
