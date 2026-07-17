import styles from "@/styles/matchup.module.css";
import { computeTugShare } from "@/lib/vsMath";

// 綱引きバー1行(spec §5)。数値行(絶対値)+バー(相対優劣)を1セットで描く。
// バーは相対優劣のみを表す(5vs5と80vs80は同じ見た目)。絶対値は数値行が担う。
export default function TugBar({
  label,
  valueA,
  valueB,
  displayA,
  displayB,
}: {
  label: string;
  valueA: number | null;
  valueB: number | null;
  displayA: string;
  displayB: string;
}) {
  const hasBoth = valueA !== null && valueB !== null;
  const share = hasBoth ? computeTugShare(valueA!, valueB!) : null;

  return (
    <div className={styles.tugRow}>
      <div className={styles.tugValues}>
        <span className={`${styles.tugValA} ${styles.num}`}>{displayA}</span>
        <span className={styles.tugLabel}>{label}</span>
        <span className={`${styles.tugValB} ${styles.num}`}>{displayB}</span>
      </div>
      {hasBoth ? (
        <div className={styles.tugBarWrap}>
          <span className={styles.tugMidLabel}>50%</span>
          <div className={styles.tugBar}>
            {share!.neutral ? (
              <div className={styles.tugNeutral} />
            ) : (
              <>
                <div className={styles.tugSegA} style={{ width: `${share!.shareA * 100}%` }} />
                <div className={styles.tugSegB} style={{ width: `${share!.shareB * 100}%` }} />
                <div className={styles.tugMidLine} />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.tugBarEmpty} />
      )}
    </div>
  );
}
