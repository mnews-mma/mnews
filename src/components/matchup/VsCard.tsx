import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { computeCommonOpponents, computeHeadToHead } from "@/lib/articleGenerator";
import styles from "@/styles/matchup.module.css";
import MatchupTape from "./MatchupTape";
import HeadToHeadBanner from "./HeadToHeadBanner";
import { CommonOpponentsInline } from "./CommonOpponentsList";
import { buildTapeData } from "./matchupData";

// /vs・/dream共通のVS対戦比較カード本体(docs/instructions/vs-dream-merge-instructions.md
// §2準拠)。カード描画コンポーネントを1系統に統一するための単一ソース。
export default function VsCard({
  nameA,
  nameB,
  slugA,
  slugB,
  nicknameA,
  nicknameB,
  entryA,
  entryB,
  visibleSlugs,
  dreamMode,
  eventName,
  weightClass,
  nameSizeOverride,
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
  // /dream(夢のカード)専用。実カード(/vs)には渡さない。
  dreamMode?: boolean;
  eventName?: string;
  weightClass?: string;
  // 呼び出し側(/dream・/vs)が全カード共通のサイズを渡す場合に使う
  // (events/[slug]/page.tsxのnameSizeOverrideと同じパターン、2026-07-20)。
  // 未指定時は従来通りこのカード単体(左右)で決まるサイズになる。
  nameSizeOverride?: number;
}) {
  const headToHead = computeHeadToHead(entryA, nameB);
  const commons = computeCommonOpponents(entryA, entryB).slice(0, 8);

  return (
    <div className={styles.mv2}>
      <article className={styles.card}>
        {dreamMode && (eventName || weightClass) && (
          <div className={styles.dreamMeta}>
            {eventName && <span className={styles.dreamMetaEvent}>{eventName}</span>}
            {eventName && weightClass && <span className={styles.dreamMetaSep}>・</span>}
            {weightClass && <span className={styles.dreamMetaWeight}>{weightClass}</span>}
          </div>
        )}
        <MatchupTape
          compact
          nameSizeOverride={nameSizeOverride}
          left={buildTapeData(nameA, slugA, entryA, { nickname: nicknameA, withLast5: true, withMethodCounts: true })}
          right={buildTapeData(nameB, slugB, entryB, { nickname: nicknameB, withLast5: true, withMethodCounts: true })}
        />
        <HeadToHeadBanner nameA={nameA} nameB={nameB} matches={headToHead} />
        <div className={styles.commonsHead}>
          <h4>共通の対戦相手</h4>
          <CommonOpponentsInline leftName={nameA} rightName={nameB} commons={commons} visibleSlugs={visibleSlugs} />
        </div>
      </article>
    </div>
  );
}
