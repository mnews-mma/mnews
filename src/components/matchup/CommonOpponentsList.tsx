import styles from "@/styles/matchup.module.css";
import { findFighterSlugByName } from "@/lib/fighters";
import type { CommonOpponent } from "@/lib/originalArticles";

// 共通対戦相手1人分の勝敗マーク(◯✕は実データ、△は引き分け/NC、—は片側のみ対戦の空欄)。
function markFor(result: CommonOpponent["resultA"]): { symbol: string; cls: string } {
  if (result === null) return { symbol: "—", cls: styles.resN };
  if (result === "win") return { symbol: "◯", cls: styles.resW };
  if (result === "loss") return { symbol: "✕", cls: styles.resL };
  return { symbol: "△", cls: styles.resN };
}

function ResMark({ result }: { result: CommonOpponent["resultA"] }) {
  const { symbol, cls } = markFor(result);
  return <span className={`${styles.res} ${cls}`}>{symbol}</span>;
}

// 同一相手との複数対戦は commons 配列側で既に行分割済み(1行=1対戦)のため、
// ここでは連番から「(2戦目)」等のラベルを付けるだけでよい。
// layout="side": res-name-res(見出し行なし、event/dream用)。
// layout="header": name-res-res(chead見出しと列を揃える、fighter用)。
function CommonOpponentRows({
  commons,
  visibleSlugs,
  layout,
}: {
  commons: CommonOpponent[];
  visibleSlugs: Set<string>;
  layout: "side" | "header";
}) {
  const nameCount = new Map<string, number>();
  const rowClass = layout === "side" ? styles.crowSide : styles.crowHeader;
  return (
    <>
      {commons.map((c, i) => {
        const seenBefore = nameCount.get(c.name) ?? 0;
        nameCount.set(c.name, seenBefore + 1);
        const cSlug = findFighterSlugByName(c.name, undefined, visibleSlugs);
        const nameNode = seenBefore > 0 ? (
          <span className={`${styles.crowName} ${styles.crowNameSub}`}>{c.name}（{seenBefore + 1}戦目）</span>
        ) : (
          <span className={styles.crowName}>{c.name}</span>
        );
        const nameLink = cSlug ? <a href={`/fighters/${cSlug}`}>{nameNode}</a> : nameNode;
        return (
          <div key={c.name + i} className={rowClass}>
            {layout === "side" ? (
              <>
                <ResMark result={c.resultA} />
                {nameLink}
                <ResMark result={c.resultB} />
              </>
            ) : (
              <>
                {nameLink}
                <ResMark result={c.resultA} />
                <ResMark result={c.resultB} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

// 大会ページ用: <details>で開閉(JS無しでも動作・prefers-reduced-motionでも機能低下しない)。
export function CommonOpponentsToggle({
  commons,
  visibleSlugs,
}: {
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
        <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} layout="side" />
      </div>
    </details>
  );
}

// 選手ページ次戦ブロック用: 列見出し(自分/相手の名前を赤・青で色分け、
// 収まらない場合は省略記号+title属性でフルネーム保持。§5-4対応)。
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
      <div className={styles.chead}>
        <span className={styles.cheadLbl}>対戦相手</span>
        <span className={styles.cheadR} title={selfName}>
          {selfName}
        </span>
        <span className={styles.cheadB} title={opponentName}>
          {opponentName}
        </span>
      </div>
      <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} layout="header" />
    </div>
  );
}

// 夢のカード用: 見出し行なし・折りたたみなし。0件時は空状態テキストを出す(§3-2)。
export function CommonOpponentsInline({
  commons,
  visibleSlugs,
}: {
  commons: CommonOpponent[];
  visibleSlugs: Set<string>;
}) {
  if (commons.length === 0) {
    return <div className={styles.emptyCommons}>共通の対戦相手なし</div>;
  }
  return (
    <div className={styles.commonsInner}>
      <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} layout="side" />
    </div>
  );
}
