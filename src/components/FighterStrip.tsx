import { computeFighterStripStats, computeWinRate, LAST5_SYMBOL } from "@/lib/fighterStrip";
import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";

// events/[slug](full)・results/[slug](compact)で共用する戦績ストリップ。
// slug/entryのいずれかが無い(=選手DB未登録・戦績データなし)場合、
// full は何も出さず、compact は既存同様プレーンテキストの名前のみにする
// (fighterRecords.jsonに無い選手をリンク化・捏造しない)。
//
// full は選手名を含まない(呼び出し側のBoutCardが選手名を1回だけ別途表示する
// ため、ここでは名前の直下に来る戦績スタッツのみを返す)。3段固定:
// 上段=戦績(勝率%)／中段=直近5戦○●／下段=フィニッシュ率のみ。
// 折り返しの有無を幅任せにせず常にこの3段で描画する(TKOはKO側に含める
// 前提の既存finishRate算出ロジックはそのまま流用)。
// 左右の見た目は要素の並び順(DOM順)を一切変えず、CSS側(.bout-side--right)の
// text-align/justify-content:flex-endだけで右寄せにする(以前のmirror propは
// 廃止=左右ともドットは常に「左→右(古い→新しい)」の同じ順序)。
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
        <span className="fighter-strip-winrate">（勝率{winRate !== null ? `${winRate}%` : "—"}）</span>
      </div>
      <div className="fighter-strip-row2">
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
      <div className="fighter-strip-row3">
        {finishRate !== null && (
          <span className="fighter-strip-finish">フィニッシュ率{finishRate}%</span>
        )}
      </div>
    </div>
  );
}
