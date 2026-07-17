import styles from "@/styles/matchup.module.css";

// 戦績・勝率・フィニッシュ率の数値行(綱引きバーは廃止。数値+ラベルのみの
// シンプル構成にする)。左は赤・右は青で色分けし、右側は行末に右揃え。
export default function TugBar({
  label,
  displayA,
  displayB,
}: {
  label: string;
  displayA: string;
  displayB: string;
}) {
  return (
    <div className={styles.tugRow}>
      <span className={`${styles.tugValA} ${styles.num}`}>{displayA}</span>
      <span className={styles.tugLabel}>{label}</span>
      <span className={`${styles.tugValB} ${styles.num}`}>{displayB}</span>
    </div>
  );
}
