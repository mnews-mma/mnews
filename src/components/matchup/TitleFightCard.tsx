import styles from "@/styles/titleCard.module.css";
import type { Result, TapeFighterData } from "./matchupData";

const DOT_CLASS: Record<Result, string> = {
  win: styles.dotW,
  loss: styles.dotL,
  draw: "",
  nc: "",
};

function FormDots({ last5, align }: { last5: Result[]; align: "a" | "b" }) {
  if (last5.length === 0) return null;
  return (
    <div className={`${align === "a" ? styles.fa : styles.fb} ${styles.form}${align === "b" ? ` ${styles.formB}` : ""}`}>
      {last5.map((r, i) => (
        <span key={i} className={`${styles.dot} ${DOT_CLASS[r]}`} />
      ))}
    </div>
  );
}

function Corner({
  data,
  side,
}: {
  data: TapeFighterData;
  side: "a" | "b";
}) {
  const areaName = side === "a" ? styles.nka : styles.nkb;
  const areaNameField = side === "a" ? styles.na : styles.nb;
  const areaRecord = side === "a" ? styles.ra : styles.rb;
  const areaRate = side === "a" ? styles.sa : styles.sb;
  const nameColorClass = side === "a" ? styles.nameRed : styles.nameBlue;
  const nameEl = <h3 className={`${styles.name} ${nameColorClass}`}>{data.name}</h3>;

  return (
    <>
      <div className={areaName}>{data.nickname && <span className={styles.nick}>{data.nickname}</span>}</div>
      <div className={areaNameField}>{data.slug ? <a href={`/fighters/${data.slug}`}>{nameEl}</a> : nameEl}</div>
      <div className={areaRecord}>
        <span className={styles.record}>{data.record}</span>
      </div>
      <div className={areaRate}>
        {data.winRate !== null && (
          <span className={styles.rate}>
            勝率<b>{data.winRate}%</b>
          </span>
        )}
        {data.finishRate !== null && (
          <span className={styles.rate}>
            フィニッシュ率<b>{data.finishRate}%</b>
          </span>
        )}
      </div>
    </>
  );
}

export default function TitleFightCard({
  left,
  right,
  weightClass,
}: {
  left: TapeFighterData;
  right: TapeFighterData;
  weightClass?: string;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.titleBadge}>TITLE</span>
          {weightClass && <span className={styles.weightClass}>{weightClass}</span>}
        </div>
        <div className={styles.tape}>
          <Corner data={left} side="a" />
          <div className={styles.vs}>
            <span className={styles.vsLabel}>VS</span>
          </div>
          <Corner data={right} side="b" />
          {left.last5 && <FormDots last5={left.last5} align="a" />}
          {right.last5 && <FormDots last5={right.last5} align="b" />}
        </div>
      </div>
    </div>
  );
}
