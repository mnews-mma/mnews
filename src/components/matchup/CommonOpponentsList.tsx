import styles from "@/styles/matchup.module.css";
import { findFighterSlugByName } from "@/lib/fighters";
import { groupCommonOpponents } from "@/lib/articleGenerator";
import type { CommonOpponent } from "@/lib/originalArticles";

// 共通対戦相手1人分の勝敗マーク。直近戦績ドット(MatchupTape.tsxのFormChips、
// styles.formChip/formW/formL/formD)と同じ意匠に統一する(勝ち=緑地W、
// 負け=赤地L、引き分け/NC=グレー地D)。片側のみ対戦(対戦なし)は同じ
// サイズ・形のグレー地「—」ドットにする(styles.formN)。
function markFor(result: CommonOpponent["resultA"]): { symbol: string; cls: string } {
  if (result === null) return { symbol: "—", cls: styles.formN };
  if (result === "win") return { symbol: "W", cls: styles.formW };
  if (result === "loss") return { symbol: "L", cls: styles.formL };
  return { symbol: "D", cls: styles.formD };
}

function ResMark({ result }: { result: CommonOpponent["resultA"] }) {
  const { symbol, cls } = markFor(result);
  return <span className={`${styles.formChip} ${styles.resChip} ${cls}`}>{symbol}</span>;
}

// 列見出し(自分/相手をテキストではなく赤・青のコーナー色ドットで区別する。
// 文字切れを避けるため、フルネームはtitle/aria-labelにのみ保持する)。
// 全カード(大会/夢のカード/選手)で共通に使う。
function CommonOpponentsHeaderRow({ leftName, rightName }: { leftName: string; rightName: string }) {
  return (
    <div className={styles.chead}>
      <span className={styles.cheadLbl}>対戦相手</span>
      <span
        className={`${styles.cheadDot} ${styles.cheadR}`}
        role="img"
        aria-label={leftName}
        title={leftName}
      />
      <span
        className={`${styles.cheadDot} ${styles.cheadB}`}
        role="img"
        aria-label={rightName}
        title={rightName}
      />
    </div>
  );
}

// 同一相手と複数回対戦している場合は1相手=1行に集約し、結果ドットを時系列順
// (古→新)に横に並べる(groupCommonOpponents)。片側だけ対戦回数が多い場合も
// 同じ行数のドットを両側に並べ、対戦していない回はResMarkが「—」で埋める。
function CommonOpponentRows({ commons, visibleSlugs }: { commons: CommonOpponent[]; visibleSlugs: Set<string> }) {
  const grouped = groupCommonOpponents(commons);
  return (
    <>
      {grouped.map((g) => {
        const cSlug = findFighterSlugByName(g.name, undefined, visibleSlugs);
        const nameNode = <span className={styles.crowName}>{g.name}</span>;
        const nameLink = cSlug ? <a href={`/fighters/${cSlug}`}>{nameNode}</a> : nameNode;
        return (
          <div key={g.name} className={styles.crowHeader}>
            {nameLink}
            <span className={styles.resGroup}>
              {g.results.map((r, i) => (
                <ResMark key={i} result={r.resultA} />
              ))}
            </span>
            <span className={styles.resGroup}>
              {g.results.map((r, i) => (
                <ResMark key={i} result={r.resultB} />
              ))}
            </span>
          </div>
        );
      })}
    </>
  );
}

// 大会ページ用: <details>で開閉(JS無しでも動作・prefers-reduced-motionでも機能低下しない)。
// 0件の場合はトグル自体を出さない(大会カードに空の折りたたみを置かない)。
export function CommonOpponentsToggle({
  leftName,
  rightName,
  commons,
  visibleSlugs,
}: {
  leftName: string;
  rightName: string;
  commons: CommonOpponent[];
  visibleSlugs: Set<string>;
}) {
  if (commons.length === 0) return null;
  const uniqueCount = new Set(commons.map((c) => c.name)).size;
  return (
    <details className={styles.detailsRoot}>
      <summary className={styles.commonsToggle}>
        <span>
          共通対戦相手 <span className={styles.num}>{uniqueCount}</span>人
        </span>
        <span className={styles.chev}>▾</span>
      </summary>
      <div className={styles.commonsInner}>
        <CommonOpponentsHeaderRow leftName={leftName} rightName={rightName} />
        <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} />
      </div>
    </details>
  );
}

// 選手ページ次戦ブロック用。
export function CommonOpponentsHeader({
  selfName,
  opponentName,
  commons,
  visibleSlugs,
}: {
  selfName: string;
  opponentName: string;
  commons: CommonOpponent[];
  visibleSlugs: Set<string>;
}) {
  if (commons.length === 0) return null;
  return (
    <div className={styles.commonsHead}>
      <h4>共通の対戦相手</h4>
      <CommonOpponentsHeaderRow leftName={selfName} rightName={opponentName} />
      <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} />
    </div>
  );
}

// 夢のカード用: 見出し行付き・折りたたみなし。0件時も同じ枠内に空状態テキストを
// 収める(中央ポツン置きにしない、§3-2)。
export function CommonOpponentsInline({
  leftName,
  rightName,
  commons,
  visibleSlugs,
}: {
  leftName: string;
  rightName: string;
  commons: CommonOpponent[];
  visibleSlugs: Set<string>;
}) {
  if (commons.length === 0) {
    return (
      <div className={styles.commonsInner}>
        <div className={styles.emptyCommonsRow}>共通の対戦相手なし</div>
      </div>
    );
  }
  return (
    <div className={styles.commonsInner}>
      <CommonOpponentsHeaderRow leftName={leftName} rightName={rightName} />
      <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} />
    </div>
  );
}
