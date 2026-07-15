import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { computeCommonOpponents } from "@/lib/articleGenerator";
import styles from "@/styles/matchup.module.css";
import MatchupTape from "./MatchupTape";
import { CommonOpponentsInline } from "./CommonOpponentsList";
import { buildTapeData } from "./matchupData";

export default function DreamCardV2({
  nameA,
  nameB,
  slugA,
  slugB,
  nicknameA,
  nicknameB,
  entryA,
  entryB,
  visibleSlugs,
}: {
  nameA: string;
  nameB: string;
  slugA: string;
  slugB: string;
  nicknameA?: string;
  nicknameB?: string;
  entryA: FighterRecordEntry;
  entryB: FighterRecordEntry;
  visibleSlugs: Set<string>;
}) {
  const commons = computeCommonOpponents(entryA, entryB).slice(0, 8);

  return (
    <div className={styles.mv2}>
      <article className={styles.card}>
        <MatchupTape
          compact
          left={buildTapeData(nameA, slugA, entryA, { nickname: nicknameA, withMethodCounts: true })}
          right={buildTapeData(nameB, slugB, entryB, { nickname: nicknameB, withMethodCounts: true })}
        />
        <div className={styles.commonsHead}>
          <h4>共通の対戦相手</h4>
          <CommonOpponentsInline commons={commons} visibleSlugs={visibleSlugs} />
        </div>
      </article>
    </div>
  );
}
