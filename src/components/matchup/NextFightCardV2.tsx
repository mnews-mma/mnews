import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { computeCommonOpponents, computeHeadToHead } from "@/lib/articleGenerator";
import styles from "@/styles/matchup.module.css";
import MatchupTape from "./MatchupTape";
import { CommonOpponentsHeader } from "./CommonOpponentsList";
import HeadToHeadBanner from "./HeadToHeadBanner";
import { buildTapeData } from "./matchupData";

export default function NextFightCardV2({
  selfName,
  self,
  eventSlug,
  eventDate,
  eventName,
  weightClass,
  opponentName,
  opponentSlug,
  opponent,
  visibleSlugs,
}: {
  selfName: string;
  self: FighterRecordEntry;
  eventSlug: string;
  eventDate: string;
  eventName: string;
  weightClass?: string;
  opponentName: string;
  opponentSlug: string;
  opponent: FighterRecordEntry;
  visibleSlugs: Set<string>;
}) {
  const headToHead = computeHeadToHead(self, opponentName);
  const commons = computeCommonOpponents(self, opponent).slice(0, 8);

  return (
    <div className={styles.mv2}>
      <section className={styles.card}>
        <div className={styles.nfBar}>
          <span className={styles.nfFlag}>次戦</span>
          <span className={styles.nfEvent}>
            <span className={styles.num}>{eventDate}</span>{" "}
            <a href={`/events/${eventSlug}`}>{eventName}</a>
          </span>
          {weightClass && <span className={styles.nfWeight}>{weightClass}</span>}
        </div>
        <MatchupTape
          left={buildTapeData(selfName, null, self, { withLast5: true })}
          right={buildTapeData(opponentName, opponentSlug, opponent, { withLast5: true })}
        />
        <HeadToHeadBanner nameA={selfName} nameB={opponentName} matches={headToHead} />
        <CommonOpponentsHeader
          selfName={selfName}
          opponentName={opponentName}
          commons={commons}
          visibleSlugs={visibleSlugs}
        />
      </section>
    </div>
  );
}
