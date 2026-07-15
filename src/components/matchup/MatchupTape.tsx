import styles from "@/styles/matchup.module.css";
import type { Result, TapeFighterData } from "./matchupData";

const FORM_LABEL: Record<Result, string> = { win: "W", loss: "L", draw: "D", nc: "D" };
const FORM_CLASS: Record<Result, string> = {
  win: styles.formW,
  loss: styles.formL,
  draw: styles.formD,
  nc: styles.formD,
};

function FormChips({ last5, side }: { last5: Result[]; side: "red" | "blue" }) {
  if (last5.length === 0) return null;
  const areaClass = side === "red" ? styles.fa : styles.fb;
  return (
    <div className={`${areaClass} ${styles.form}${side === "blue" ? ` ${styles.formRight}` : ""}`}>
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

const RESULT_MARK_SYMBOL: Record<NonNullable<TapeFighterData["resultMark"]>, string> = {
  win: "◯",
  loss: "✕",
  draw: "△",
};
const RESULT_MARK_CLASS: Record<NonNullable<TapeFighterData["resultMark"]>, string> = {
  win: styles.resW,
  loss: styles.resL,
  draw: styles.resN,
};

// タレント・オブ・ザ・テープ1コーナー分を、4つの独立したgrid-area要素として描画する
// (名前=na/nb・記録=ra/rb・戦績=sa/sb・戦績ドット=fa/fb)。左右セットで同じ行に
// 配置されることで、片方の名前が2行に折り返しても次の行(記録)は両側とも同じ
// 基準線から始まる(構造的な行揃え、目視調整に頼らない)。
export default function MatchupTape({
  left,
  right,
  compact,
}: {
  left: TapeFighterData;
  right: TapeFighterData;
  compact?: boolean;
}) {
  const leftName = <h3 className={styles.fighterName}>{left.name}</h3>;
  const rightName = <h3 className={styles.fighterName}>{right.name}</h3>;

  return (
    <div className={`${styles.tape}${compact ? ` ${styles.tapeCompact}` : ""}`}>
      {/* 左(赤)コーナー */}
      <div className={`${styles.na} ${styles.cornerRed}`}>
        {left.nickname && <span className={styles.nick}>{left.nickname}</span>}
        <div className={styles.tapeNameRow}>
          {left.resultMark && (
            <span className={`${styles.res} ${RESULT_MARK_CLASS[left.resultMark]}`}>{RESULT_MARK_SYMBOL[left.resultMark]}</span>
          )}
          {left.slug ? <a href={`/fighters/${left.slug}`}>{leftName}</a> : leftName}
        </div>
      </div>
      <div className={`${styles.ra} ${styles.cornerRed}`}>
        <span className={`${styles.recordWl} ${styles.num}`}>{left.record}</span>
      </div>
      <ul className={`${styles.sa} ${styles.stats}`}>
        {left.winRate !== null && (
          <li>
            勝率<b className={styles.num}>{left.winRate}%</b>
          </li>
        )}
        {left.finishRate !== null && (
          <li>
            フィニッシュ率<b className={styles.num}>{left.finishRate}%</b>
          </li>
        )}
        {left.methodCounts && <MethodCountsLine counts={left.methodCounts} />}
      </ul>
      {left.last5 && <FormChips last5={left.last5} side="red" />}

      <div className={styles.vs}>VS</div>

      {/* 右(青)コーナー */}
      <div className={`${styles.nb} ${styles.cornerBlue}`}>
        {right.nickname && <span className={styles.nick}>{right.nickname}</span>}
        <div className={styles.tapeNameRow}>
          {right.resultMark && (
            <span className={`${styles.res} ${RESULT_MARK_CLASS[right.resultMark]}`}>{RESULT_MARK_SYMBOL[right.resultMark]}</span>
          )}
          {right.slug ? <a href={`/fighters/${right.slug}`}>{rightName}</a> : rightName}
        </div>
      </div>
      <div className={`${styles.rb} ${styles.cornerBlue}`}>
        <span className={`${styles.recordWl} ${styles.num}`}>{right.record}</span>
      </div>
      <ul className={`${styles.sb} ${styles.stats}`}>
        {right.winRate !== null && (
          <li>
            勝率<b className={styles.num}>{right.winRate}%</b>
          </li>
        )}
        {right.finishRate !== null && (
          <li>
            フィニッシュ率<b className={styles.num}>{right.finishRate}%</b>
          </li>
        )}
        {right.methodCounts && <MethodCountsLine counts={right.methodCounts} />}
      </ul>
      {right.last5 && <FormChips last5={right.last5} side="blue" />}
    </div>
  );
}
