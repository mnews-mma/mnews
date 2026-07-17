import styles from "@/styles/matchup.module.css";
import { computeHeadToHead } from "@/lib/articleGenerator";

// 直接対決バナー: 最新の対戦(先頭=新しい順)のみ表示。判定スコア等の未保有データは
// 捏造せず出さない(日付・大会名・決着方法・勝者名のみ、いずれも実データ)。
// EventBoutCardV2・VsCardで共用(重複実装しない)。
export default function HeadToHeadBanner({
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
