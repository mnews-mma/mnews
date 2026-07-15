import styles from "@/styles/matchup.module.css";
import type { Result, TapeFighterData } from "./matchupData";

const FORM_LABEL: Record<Result, string> = { win: "W", loss: "L", draw: "D", nc: "D" };
const FORM_CLASS: Record<Result, string> = {
  win: styles.formW,
  loss: styles.formL,
  draw: styles.formD,
  nc: styles.formD,
};

function FormChips({ last5 }: { last5: Result[] }) {
  if (last5.length === 0) return null;
  return (
    <div className={styles.form}>
      {last5.map((r, i) => (
        <i key={i} className={`${styles.formChip} ${FORM_CLASS[r]}`}>
          {FORM_LABEL[r]}
        </i>
      ))}
    </div>
  );
}

function MethodCountsLine({ counts }: { counts: { ko: number; sub: number; decision: number } }) {
  return (
    <li className={styles.statsBreak}>
      KO<b className={styles.num}>{counts.ko}</b>一本<b className={styles.num}>{counts.sub}</b>判定
      <b className={styles.num}>{counts.decision}</b>
    </li>
  );
}

function TapeCorner({ side, data }: { side: "red" | "blue"; data: TapeFighterData }) {
  const cornerClass = `${styles.corner} ${side === "red" ? styles.cornerRed : styles.cornerBlue}`;
  const nameNode = <h3 className={styles.fighterName}>{data.name}</h3>;
  return (
    <div className={cornerClass}>
      {data.nickname && <span className={styles.nick}>{data.nickname}</span>}
      {data.slug ? (
        <a href={`/fighters/${data.slug}`}>{nameNode}</a>
      ) : (
        nameNode
      )}
      <div className={styles.record}>
        <span className={`${styles.recordWl} ${styles.num}`}>{data.record}</span>
      </div>
      <ul className={styles.stats}>
        {data.winRate !== null && (
          <li>
            勝率<b className={styles.num}>{data.winRate}%</b>
          </li>
        )}
        {data.finishRate !== null && (
          <li>
            フィニッシュ率<b className={styles.num}>{data.finishRate}%</b>
          </li>
        )}
        {data.methodCounts && <MethodCountsLine counts={data.methodCounts} />}
      </ul>
      {data.last5 && <FormChips last5={data.last5} />}
    </div>
  );
}

export default function MatchupTape({
  left,
  right,
  compact,
}: {
  left: TapeFighterData;
  right: TapeFighterData;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.tape}${compact ? ` ${styles.tapeCompact}` : ""}`}>
      <TapeCorner side="red" data={left} />
      <div className={styles.vs}>VS</div>
      <TapeCorner side="blue" data={right} />
    </div>
  );
}
