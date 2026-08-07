import { hasWikipediaRecord, type FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { GLOBAL_FIGHTER_NAME_SIZE, type BoutResult } from "@/lib/events";
import { getFighter, fighterDisplayName } from "@/lib/fighters";
import { computeCommonOpponents, computeHeadToHead } from "@/lib/articleGenerator";
import styles from "@/styles/matchup.module.css";
import MatchupTape, { FighterNameText } from "./MatchupTape";
import { CommonOpponentsToggle } from "./CommonOpponentsList";
import HeadToHeadBanner from "./HeadToHeadBanner";
import { buildTapeData, buildNoDataTapeData, type TapeFighterData } from "./matchupData";

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
  // 選手ごとに戦績データの有無を独立して判定する。
  // - 収録済みの側は他カードと同様に戦績/勝率/フィニッシュ率/直近5戦を出す。
  // - 未収録の側(デビュー戦など)は「データなし」表示にする。
  // 片方でもデータがあれば比較テープ(MatchupTape)を出し、両者とも無い場合のみ
  // 名前だけの簡易表示に倒す。
  const hasDataA = hasWikipediaRecord(entryA);
  const hasDataB = hasWikipediaRecord(entryB);
  const anyData = hasDataA || hasDataB;
  // 表示専用のリングネーム(displayNameJa)差し替え。nameA/nameBそのものは大会側の
  // 突合キー(結果の勝者判定・再戦/共通対戦相手の履歴突合)に使うため変更しない
  // (指示書B-1)。カード上の描画にのみ使う名前をここで解決する。
  const displayNameA = (slugA && getFighter(slugA) && fighterDisplayName(getFighter(slugA)!)) || nameA;
  const displayNameB = (slugB && getFighter(slugB) && fighterDisplayName(getFighter(slugB)!)) || nameB;
  // 直接対決(再戦バッジ)・共通対戦相手は両者の履歴が揃っている(=Wikipedia戦績が
  // 両方ある)時のみ算出可能。
  const bothRegistered = hasDataA && hasDataB;
  const headToHead = bothRegistered ? computeHeadToHead(entryA!, nameB) : [];
  const commons = bothRegistered ? computeCommonOpponents(entryA!, entryB!).slice(0, 8) : [];
  const isPendingLive = !cancelled && !result && !!isEventLive;

  // 両者ともデータ無しの簡易表示用。MatchupTapeと同じ全サイト単一サイズを使う
  // (この分岐だけ別サイズになる回帰が過去に発生している)。
  const sharedFallbackNameSize = GLOBAL_FIGHTER_NAME_SIZE;

  // 情報価値のあるバッジ(中止/TITLE/再戦)のみ出す。「注目カード」は廃止。
  let tag: { label: string; cls: string } | null = null;
  if (cancelled) {
    tag = { label: "中止", cls: styles.tagMain };
  } else if (isTitleMatch) {
    tag = { label: "TITLE", cls: styles.tagTitle };
  } else if (headToHead.length > 0) {
    tag = { label: "再戦", cls: styles.tagRe };
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
      {anyData ? (
        <MatchupTape
          left={
            hasDataA
              ? buildTapeData(displayNameA, slugA, entryA!, { withLast5: true, resultMark: resultMarkFor(nameA, result) })
              : buildNoDataTapeData(displayNameA, slugA, { resultMark: resultMarkFor(nameA, result) })
          }
          right={
            hasDataB
              ? buildTapeData(displayNameB, slugB, entryB!, { withLast5: true, resultMark: resultMarkFor(nameB, result) })
              : buildNoDataTapeData(displayNameB, slugB, { resultMark: resultMarkFor(nameB, result) })
          }
        />
      ) : (
        <div className={styles.tape}>
          {/* 両者ともDB未収録(戦績データ無し)の場合のみ、名前だけの簡易表示に
              倒す。片方でもデータがあればこの分岐には来ず、上のMatchupTape側で
              「データあり=通常表示 / データなし=データなし表示」を出す。
              未登録選手のミニマル表示も登録済みカード(MatchupTape)と同じ
              名前描画・サイズ規則(カード単体で左右共通サイズ、2026-07-22統一)に
              揃える。左右で別サイズ・別ロジックにしないこと。 */}
          <div className={`${styles.na} ${styles.cornerRed}`}>
            {slugA ? (
              <a href={`/fighters/${slugA}`}>
                <FighterNameText name={displayNameA} fontSize={sharedFallbackNameSize} />
              </a>
            ) : (
              <FighterNameText name={displayNameA} fontSize={sharedFallbackNameSize} />
            )}
          </div>
          <div className={styles.vs}>VS</div>
          <div className={`${styles.nb} ${styles.cornerBlue}`}>
            {slugB ? (
              <a href={`/fighters/${slugB}`}>
                <FighterNameText name={displayNameB} fontSize={sharedFallbackNameSize} />
              </a>
            ) : (
              <FighterNameText name={displayNameB} fontSize={sharedFallbackNameSize} />
            )}
          </div>
        </div>
      )}
      {result && !cancelled && <ResultBanner result={result} />}
      {!cancelled && <HeadToHeadBanner nameA={displayNameA} nameB={displayNameB} matches={headToHead} />}
      {note && !isTitleMatch && <div className={styles.emptyCommons}>{note}</div>}
      {bothRegistered && (
        <CommonOpponentsToggle leftName={displayNameA} rightName={displayNameB} commons={commons} visibleSlugs={visibleSlugs} />
      )}
    </article>
  );
}
