import { hasWikipediaRecord, type FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { GLOBAL_FIGHTER_NAME_SIZE, type BoutResult } from "@/lib/events";
import { computeCommonOpponents, computeHeadToHead } from "@/lib/articleGenerator";
import {
  hasMultiOrgRecord,
  MULTI_ORG_RECORD_LABEL_SHORT,
  type MultiOrgSideRecord,
} from "@/lib/mnewsRating/multiOrgRecord";
import styles from "@/styles/matchup.module.css";
import MatchupTape, { FighterNameText } from "./MatchupTape";
import { CommonOpponentsToggle } from "./CommonOpponentsList";
import HeadToHeadBanner from "./HeadToHeadBanner";
import { buildTapeData, buildNoDataTapeData, buildMultiOrgTapeData, type TapeFighterData } from "./matchupData";

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
  // 指示書(戦績スコープ出し分け): 大会がRIZINかどうか(event.org==="rizin")。
  // RIZIN大会は出自が混在するため4団体通算の意味が薄く、片方のみWikipedia
  // (mixed)の場合は4団体通算へのフォールバックをしない(既存のNo data表示のまま)。
  // 両者ともWikipediaが無い場合(org問わず)はRIZIN大会でも4団体通算にフォール
  // バックする(下のuseMultiOrgMode参照)。
  isRizin?: boolean;
  // 4団体合算データ(片側ぶん)。Wikipedia戦績が無い/片方しかない場合の
  // フォールバック描画にのみ使う。null/undefinedは「4団体データも無い」扱い。
  multiOrgA?: MultiOrgSideRecord | null;
  multiOrgB?: MultiOrgSideRecord | null;
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
  isRizin,
  multiOrgA,
  multiOrgB,
}: EventBoutCardV2Props) {
  // 選手ごとに戦績データの有無を独立して判定する。
  // - 収録済みの側は他カードと同様に戦績/勝率/フィニッシュ率/直近5戦を出す。
  // - 未収録の側(デビュー戦など)は「データなし」表示にする。
  // 片方でもデータがあれば比較テープ(MatchupTape)を出し、両者とも無い場合のみ
  // 名前だけの簡易表示に倒す。
  const hasDataA = hasWikipediaRecord(entryA);
  const hasDataB = hasWikipediaRecord(entryB);
  const anyData = hasDataA || hasDataB;
  // 直接対決(再戦バッジ)・共通対戦相手は両者の履歴が揃っている(=Wikipedia戦績が
  // 両方ある)時のみ算出可能。4団体通算フォールバック(useMultiOrgMode)側には
  // 相当する実装が無いため、この判定は意図的にWikipedia限定のまま(指示書:
  // 4団体通算モードではH2H・共通対戦相手を出さない)。
  const bothRegistered = hasDataA && hasDataB;
  const headToHead = bothRegistered ? computeHeadToHead(entryA!, nameB) : [];
  const commons = bothRegistered ? computeCommonOpponents(entryA!, entryB!).slice(0, 8) : [];
  const isPendingLive = !cancelled && !result && !!isEventLive;

  // 指示書(戦績スコープ出し分け): 両者ともWikipedia戦績が揃っている場合(bothRegistered)
  // は常に現状どおりWikipedia表示。それ以外で、RIZIN大会かつ片方だけWikipedia
  // (mixed)の場合は4団体通算にフォールバックしない(既存のNo data表示のまま)。
  // 上記以外(非RIZIN大会のmixed、または大会問わず両者ともWikipediaが無いケース)
  // で、両者とも4団体通算データ(Wikipedia or 4団体合算のいずれか)が揃っていれば
  // 4団体通算表示に切り替える。
  const hasMultiOrgA = !!multiOrgA && hasMultiOrgRecord(multiOrgA.record);
  const hasMultiOrgB = !!multiOrgB && hasMultiOrgRecord(multiOrgB.record);
  const displayableA = hasDataA || hasMultiOrgA;
  const displayableB = hasDataB || hasMultiOrgB;
  const neitherWiki = !hasDataA && !hasDataB;
  const useMultiOrgMode =
    !bothRegistered && displayableA && displayableB && (!isRizin || neitherWiki);
  // 両者ともデータ無しの簡易表示用。MatchupTapeと同じ全サイト単一サイズを使う
  // (この分岐だけ別サイズになる回帰が過去に発生している)。
  const sharedFallbackNameSize = GLOBAL_FIGHTER_NAME_SIZE;

  // 情報価値のあるバッジ(中止・変更/TITLE/再戦)のみ出す。「注目カード」は廃止。
  let tag: { label: string; cls: string } | null = null;
  if (cancelled) {
    tag = { label: "中止・変更", cls: styles.tagMain };
  } else if (isTitleMatch) {
    tag = { label: "TITLE", cls: styles.tagTitle };
  } else if (headToHead.length > 0) {
    tag = { label: "再戦", cls: styles.tagRe };
  }

  return (
    <article className={`${styles.card}${isTitleMatch ? ` ${styles.cardTitle}` : ""}`}>
      {(weightClass || tag || note || isPendingLive || useMultiOrgMode) && (
        <div className={styles.meta}>
          {weightClass && <span className={styles.weight}>{weightClass}</span>}
          {(tag || isPendingLive || useMultiOrgMode) && (
            <span className={styles.tagGroup}>
              {isPendingLive && (
                <span className={`${styles.tag} ${styles.tagLive}`}>
                  <span className={styles.liveDot} />
                  進行中
                </span>
              )}
              {tag && <span className={`${styles.tag} ${tag.cls}`}>{tag.label}</span>}
              {useMultiOrgMode && (
                <span className={`${styles.tag} ${styles.tagSource}`}>{MULTI_ORG_RECORD_LABEL_SHORT}</span>
              )}
            </span>
          )}
        </div>
      )}
      {useMultiOrgMode ? (
        <MatchupTape
          left={
            hasMultiOrgA
              ? buildMultiOrgTapeData(nameA, slugA, multiOrgA!.record, multiOrgA!.rates, multiOrgA!.rows, {
                  withLast5: true,
                  withMethodCounts: true,
                  resultMark: resultMarkFor(nameA, result),
                })
              : buildNoDataTapeData(nameA, slugA, { resultMark: resultMarkFor(nameA, result) })
          }
          right={
            hasMultiOrgB
              ? buildMultiOrgTapeData(nameB, slugB, multiOrgB!.record, multiOrgB!.rates, multiOrgB!.rows, {
                  withLast5: true,
                  withMethodCounts: true,
                  resultMark: resultMarkFor(nameB, result),
                })
              : buildNoDataTapeData(nameB, slugB, { resultMark: resultMarkFor(nameB, result) })
          }
        />
      ) : anyData ? (
        <MatchupTape
          left={
            hasDataA
              ? buildTapeData(nameA, slugA, entryA!, { withLast5: true, resultMark: resultMarkFor(nameA, result) })
              : buildNoDataTapeData(nameA, slugA, { resultMark: resultMarkFor(nameA, result) })
          }
          right={
            hasDataB
              ? buildTapeData(nameB, slugB, entryB!, { withLast5: true, resultMark: resultMarkFor(nameB, result) })
              : buildNoDataTapeData(nameB, slugB, { resultMark: resultMarkFor(nameB, result) })
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
                <FighterNameText name={nameA} fontSize={sharedFallbackNameSize} />
              </a>
            ) : (
              <FighterNameText name={nameA} fontSize={sharedFallbackNameSize} />
            )}
          </div>
          <div className={styles.vs}>VS</div>
          <div className={`${styles.nb} ${styles.cornerBlue}`}>
            {slugB ? (
              <a href={`/fighters/${slugB}`}>
                <FighterNameText name={nameB} fontSize={sharedFallbackNameSize} />
              </a>
            ) : (
              <FighterNameText name={nameB} fontSize={sharedFallbackNameSize} />
            )}
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
