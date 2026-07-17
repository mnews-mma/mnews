import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import type { BoutResult } from "@/lib/events";
import { computeCommonOpponents, computeHeadToHead } from "@/lib/articleGenerator";
import styles from "@/styles/matchup.module.css";
import MatchupTape, { FighterNameText } from "./MatchupTape";
import { fighterNameSize } from "@/lib/vsMath";
import { CommonOpponentsToggle } from "./CommonOpponentsList";
import HeadToHeadBanner from "./HeadToHeadBanner";
import { buildTapeData, type TapeFighterData } from "./matchupData";

export interface EventBoutCardV2Props {
  nameA: string;
  nameB: string;
  slugA: string | null;
  slugB: string | null;
  entryA: FighterRecordEntry | null;
  entryB: FighterRecordEntry | null;
  visibleSlugs: Set<string>;
  weightClass?: string;
  isTitleMatch?: boolean;
  cancelled?: boolean;
  note?: string;
  // 確定結果(旧デザインのresultLineに相当)。undefined=未確定(試合前 or 開催中で未消化)。
  result?: BoutResult;
  // 大会全体が現在開催中(event.status==="live")かどうか。resultが無くこれがtrueの
  // 場合のみ「進行中(結果待ち)」インジケータを出す。
  isEventLive?: boolean;
}

const normSpace = (s: string) => s.replace(/[\s　]/g, "");

// resultLineが指す勝者名(nameA/nameBいずれかの表記)から、どちら側の勝敗マークかを
// 判定する。winner===nullは引き分け/NC/中止裁定。表記揺れ(全角/半角スペース)は
// 正規化して比較する(events/[slug]・fighters/[slug]の既存パターンと同じ)。
function resultMarkFor(name: string, result: BoutResult | undefined): TapeFighterData["resultMark"] {
  if (!result) return undefined;
  if (result.winner === null) return "draw";
  return normSpace(result.winner) === normSpace(name) ? "win" : "loss";
}

// 確定結果バナー: 勝者・決着方法・ラウンドを旧デザイン(resultLine)と同じ情報量で表示。
function ResultBanner({ result }: { result: BoutResult }) {
  const isDraw = result.winner === null;
  return (
    <div className={`${styles.resultBanner}${isDraw ? ` ${styles.resultBannerDraw}` : ""}`}>
      {result.winner ?? "引き分け"} ／ {result.method}
      {result.round && <> ／ {result.round}</>}
    </div>
  );
}

export default function EventBoutCardV2({
  nameA,
  nameB,
  slugA,
  slugB,
  entryA,
  entryB,
  visibleSlugs,
  weightClass,
  isTitleMatch,
  cancelled,
  note,
  result,
  isEventLive,
}: EventBoutCardV2Props) {
  const bothRegistered = !!entryA && !!entryB && !entryA.noRecordData && !entryB.noRecordData;
  const headToHead = bothRegistered ? computeHeadToHead(entryA!, nameB) : [];
  const commons = bothRegistered ? computeCommonOpponents(entryA!, entryB!).slice(0, 8) : [];
  const isPendingLive = !cancelled && !result && !!isEventLive;

  let tag: { label: string; cls: string } | null = null;
  if (cancelled) {
    tag = { label: "中止・変更", cls: styles.tagMain };
  } else if (isTitleMatch) {
    tag = { label: "TITLE", cls: styles.tagTitle };
  } else if (headToHead.length > 0) {
    tag = { label: "再戦", cls: styles.tagRe };
  } else {
    tag = { label: "注目カード", cls: styles.tagMain };
  }

  return (
    <article className={`${styles.card}${isTitleMatch ? ` ${styles.cardTitle}` : ""}`}>
      {(weightClass || tag || note || isPendingLive) && (
        <div className={styles.meta}>
          {weightClass && <span className={styles.weight}>{weightClass}</span>}
          {(tag || isPendingLive) && (
            <span className={styles.tagGroup}>
              {isPendingLive && (
                <span className={`${styles.tag} ${styles.tagLive}`}>
                  <span className={styles.liveDot} />
                  進行中
                </span>
              )}
              {tag && <span className={`${styles.tag} ${tag.cls}`}>{tag.label}</span>}
            </span>
          )}
        </div>
      )}
      {bothRegistered ? (
        <MatchupTape
          left={buildTapeData(nameA, slugA, entryA!, { withLast5: true, resultMark: resultMarkFor(nameA, result) })}
          right={buildTapeData(nameB, slugB, entryB!, { withLast5: true, resultMark: resultMarkFor(nameB, result) })}
        />
      ) : (
        <div className={styles.tape}>
          {/* 未登録選手のミニマル表示も登録済みカード(MatchupTape)と同じ
              名前描画・サイズ規則(左右同一・長い側基準)に揃える */}
          <div className={`${styles.na} ${styles.cornerRed}`}>
            <FighterNameText name={nameA} fontSize={Math.min(fighterNameSize(nameA), fighterNameSize(nameB))} />
          </div>
          <div className={styles.vs}>VS</div>
          <div className={`${styles.nb} ${styles.cornerBlue}`}>
            <FighterNameText name={nameB} fontSize={Math.min(fighterNameSize(nameA), fighterNameSize(nameB))} />
          </div>
        </div>
      )}
      {result && !cancelled && <ResultBanner result={result} />}
      {!cancelled && <HeadToHeadBanner nameA={nameA} nameB={nameB} matches={headToHead} />}
      {note && !isTitleMatch && !cancelled && <div className={styles.emptyCommons}>{note}</div>}
      {bothRegistered && (
        <CommonOpponentsToggle leftName={nameA} rightName={nameB} commons={commons} visibleSlugs={visibleSlugs} />
      )}
    </article>
  );
}
