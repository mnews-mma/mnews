import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { computeCommonOpponents, computeHeadToHead } from "@/lib/articleGenerator";
import styles from "@/styles/matchup.module.css";
import MatchupTape from "./MatchupTape";
import { CommonOpponentsToggle } from "./CommonOpponentsList";
import { buildTapeData } from "./matchupData";

export interface EventBoutCardV2Props {
  nameA: string;
  nameB: string;
  slugA: string | null;
  slugB: string | null;
  entryA: FighterRecordEntry | null;
  entryB: FighterRecordEntry | null;
  visibleSlugs: Set<string>;
  weightClass?: string;
  isTitleMatch?: boolean;
  cancelled?: boolean;
  note?: string;
}

// 直接対決バナー: 最新の対戦(先頭=新しい順)のみ表示。判定スコア等の未保有データは
// 捏造せず出さない(日付・大会名・決着方法・勝者名のみ、いずれも実データ)。
function HeadToHeadBanner({
  nameA,
  nameB,
  matches,
}: {
  nameA: string;
  nameB: string;
  matches: ReturnType<typeof computeHeadToHead>;
}) {
  if (matches.length === 0) return null;
  const latest = matches[0];
  const winner = latest.resultA === "win" ? nameA : latest.resultA === "loss" ? nameB : null;
  return (
    <div className={styles.h2h}>
      <span className={styles.h2hFlag}>直接対決</span>
      <span>
        <b className={styles.num}>{latest.date}</b> {latest.event} —{" "}
        {winner ? (
          <>
            <b>{winner}</b>が{latest.method}
          </>
        ) : (
          <>引き分け（{latest.method}）</>
        )}
      </span>
    </div>
  );
}

export default function EventBoutCardV2({
  nameA,
  nameB,
  slugA,
  slugB,
  entryA,
  entryB,
  visibleSlugs,
  weightClass,
  isTitleMatch,
  cancelled,
  note,
}: EventBoutCardV2Props) {
  const bothRegistered = !!entryA && !!entryB && !entryA.noRecordData && !entryB.noRecordData;
  const headToHead = bothRegistered ? computeHeadToHead(entryA!, nameB) : [];
  const commons = bothRegistered ? computeCommonOpponents(entryA!, entryB!).slice(0, 8) : [];

  let tag: { label: string; cls: string } | null = null;
  if (cancelled) {
    tag = { label: "中止・変更", cls: styles.tagMain };
  } else if (isTitleMatch) {
    tag = { label: "TITLE", cls: styles.tagTitle };
  } else if (headToHead.length > 0) {
    tag = { label: "再戦", cls: styles.tagRe };
  } else {
    tag = { label: "注目カード", cls: styles.tagMain };
  }

  return (
    <article className={`${styles.card}${isTitleMatch ? ` ${styles.cardTitle}` : ""}`}>
      {(weightClass || tag || note) && (
        <div className={styles.meta}>
          {weightClass && <span className={styles.weight}>{weightClass}</span>}
          {tag && <span className={`${styles.tag} ${tag.cls}`}>{tag.label}</span>}
        </div>
      )}
      {bothRegistered ? (
        <MatchupTape
          left={buildTapeData(nameA, slugA, entryA!, { withLast5: true })}
          right={buildTapeData(nameB, slugB, entryB!, { withLast5: true })}
        />
      ) : (
        <div className={styles.tape}>
          <div className={`${styles.corner} ${styles.cornerRed}`}>
            <h3 className={styles.fighterName}>{nameA}</h3>
          </div>
          <div className={styles.vs}>VS</div>
          <div className={`${styles.corner} ${styles.cornerBlue}`}>
            <h3 className={styles.fighterName}>{nameB}</h3>
          </div>
        </div>
      )}
      {!cancelled && <HeadToHeadBanner nameA={nameA} nameB={nameB} matches={headToHead} />}
      {note && !isTitleMatch && !cancelled && <div className={styles.emptyCommons}>{note}</div>}
      {bothRegistered && <CommonOpponentsToggle commons={commons} visibleSlugs={visibleSlugs} />}
    </article>
  );
}
