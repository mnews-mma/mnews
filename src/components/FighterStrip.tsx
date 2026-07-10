import { computeFighterStripStats, LAST5_SYMBOL } from "@/lib/fighterStrip";
import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";

// events/[slug](full)・results/[slug](compact)で共用する戦績ストリップ。
// slug/entryのいずれかが無い(=選手DB未登録・戦績データなし)場合、
// full は何も出さず、compact は既存同様プレーンテキストの名前のみにする
// (fighterRecords.jsonに無い選手をリンク化・捏造しない)。
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
  return (
    <div className="fighter-strip">
      <a href={`/fighters/${slug}`} className="fighter-strip-name">
        {name}
      </a>
      <span className="fighter-strip-record">{record}</span>
      {finishRate !== null && (
        <span className="fighter-strip-finish">フィニッシュ率{finishRate}%</span>
      )}
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
  );
}
