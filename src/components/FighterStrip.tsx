import { computeFighterStripStats, computeWinRate, LAST5_SYMBOL } from "@/lib/fighterStrip";
import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";

// events/[slug](full)・results/[slug](compact)で共用する戦績ストリップ。
// slug/entryのいずれかが無い(=選手DB未登録・戦績データなし)場合、
// full は何も出さず、compact は既存同様プレーンテキストの名前のみにする
// (fighterRecords.jsonに無い選手をリンク化・捏造しない)。
//
// full は選手名を含まない(呼び出し側のBoutCardが選手名を1回だけ別途表示する
// ため、ここでは名前の直下に来る戦績スタッツのみを返す)。2段固定:
// 上段=戦績(勝率%をインライン)+直近5戦○●／下段=フィニッシュ率のみ。
// 折り返しの有無を幅任せにせず常にこの2段で描画する(TKOはKO側に含める
// 前提の既存finishRate算出ロジックはそのまま流用)。
// mirror=true(右選手側)は上段の並びを「ドット→戦績(勝率%)」に反転し、
// 右寄せ配置(CSS側のjustify-content:flex-end)と組み合わせて左側と
// 視覚的に鏡合わせになるようにする。
export default function FighterStrip({
  name,
  slug,
  entry,
  variant,
  mirror,
}: {
  name: string;
  slug: string | null;
  entry: FighterRecordEntry | null;
  variant: "full" | "compact";
  mirror?: boolean;
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
  const recordEl = (
    <span className="fighter-strip-record">
      {record}（勝率{winRate !== null ? `${winRate}%` : "—"}）
    </span>
  );
  const last5El = last5.length > 0 && (
    <span className="fighter-strip-last5">
      {last5.map((r, i) => (
        <span key={i} className={`fighter-strip-last5-${r}`}>
          {LAST5_SYMBOL[r]}
        </span>
      ))}
    </span>
  );
  return (
    <div className="fighter-strip">
      <div className="fighter-strip-row1">
        {mirror ? (
          <>
            {last5El}
            {recordEl}
          </>
        ) : (
          <>
            {recordEl}
            {last5El}
          </>
        )}
      </div>
      <div className="fighter-strip-row2">
        {finishRate !== null && (
          <span className="fighter-strip-finish">フィニッシュ率{finishRate}%</span>
        )}
      </div>
    </div>
  );
}
