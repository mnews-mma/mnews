import styles from "@/styles/matchup.module.css";
import TugBar from "./TugBar";
import { fighterNameSize, insertNameBreaks } from "@/lib/vsMath";
import type { Result, TapeFighterData } from "./matchupData";

const FORM_LABEL: Record<Result, string> = { win: "W", loss: "L", draw: "D", nc: "D" };
const FORM_CLASS: Record<Result, string> = {
  win: styles.formW,
  loss: styles.formL,
  draw: styles.formD,
  nc: styles.formD,
};

// 選手名の表示用ノード。左右で同じfontSizeを受け取り、カード内は常に
// 左右同一サイズにする(長い方の名前が収まるサイズに両方揃える)。
// 「・」直後で改行できるようゼロ幅スペースを挿む(spec §4.3)。
function FighterNameText({ name, fontSize }: { name: string; fontSize: number }) {
  return (
    <h3 className={styles.fighterName} style={{ fontSize: `${fontSize}px` }}>
      {insertNameBreaks(name)}
    </h3>
  );
}

// 戦績(勝率)行の数値表示。「勝率」算出不能(未勝負)の場合は記録のみ、
// 記録自体が完全に空欄(データなし)の呼び出しは想定しない(呼び出し側でnoRecordData分岐済み)。
function recordDisplay(record: string, winRate: number | null): string {
  return winRate === null ? record : `${record}（勝率${winRate}%）`;
}

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
    <div className={styles.statsBreak}>
      KO<b className={styles.num}>{counts.ko}</b>一本<b className={styles.num}>{counts.sub}</b>判定
      <b className={styles.num}>{counts.decision}</b>
    </div>
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

// タレント・オブ・ザ・テープを、独立したgrid-area要素として描画する
// (名前=na/nb・戦績+勝率/フィニッシュ率バー=bar1/bar2(全幅)・内訳=ma/mb・
// 戦績ドット=fa/fb)。左右セットで同じ行に配置されることで、片方の名前が
// 2行に折り返しても次の行は両側とも同じ基準線から始まる
// (構造的な行揃え、目視調整に頼らない)。戦績・勝率・フィニッシュ率は
// spec §5の綱引きバーで表現し、絶対値(記録)はバーの数値行に統合する
// (旧デザインの ra/rb 独立行は廃止)。
export default function MatchupTape({
  left,
  right,
  compact,
}: {
  left: TapeFighterData;
  right: TapeFighterData;
  compact?: boolean;
}) {
  const hasMethodCounts = !!left.methodCounts || !!right.methodCounts;
  // 左右で別々のサイズにならないよう、長い方の名前が収まるサイズに揃える。
  const sharedNameSize = Math.min(fighterNameSize(left.name), fighterNameSize(right.name));

  return (
    <div className={`${styles.tape}${compact ? ` ${styles.tapeCompact}` : ""}`}>
      {/* 左(赤)コーナー: 通称行(nka)と名前行(na)を別areaにする(修正1)。
          通称が無い選手はnka側が空セル(高さ0)になるだけで、行の対応関係は
          崩れない。 */}
      <div className={`${styles.nka} ${styles.cornerRed}`}>
        {left.nickname && <span className={styles.nick}>{left.nickname}</span>}
      </div>
      <div className={`${styles.na} ${styles.cornerRed}`}>
        <div className={styles.tapeNameRow}>
          {left.resultMark && (
            <span className={`${styles.res} ${RESULT_MARK_CLASS[left.resultMark]}`}>{RESULT_MARK_SYMBOL[left.resultMark]}</span>
          )}
          {left.slug ? (
            <a href={`/fighters/${left.slug}`}>
              <FighterNameText name={left.name} fontSize={sharedNameSize} />
            </a>
          ) : (
            <FighterNameText name={left.name} fontSize={sharedNameSize} />
          )}
        </div>
      </div>

      {/* 右(青)コーナー */}
      <div className={`${styles.nkb} ${styles.cornerBlue}`}>
        {right.nickname && <span className={styles.nick}>{right.nickname}</span>}
      </div>
      <div className={`${styles.nb} ${styles.cornerBlue}`}>
        <div className={styles.tapeNameRow}>
          {right.resultMark && (
            <span className={`${styles.res} ${RESULT_MARK_CLASS[right.resultMark]}`}>{RESULT_MARK_SYMBOL[right.resultMark]}</span>
          )}
          {right.slug ? (
            <a href={`/fighters/${right.slug}`}>
              <FighterNameText name={right.name} fontSize={sharedNameSize} />
            </a>
          ) : (
            <FighterNameText name={right.name} fontSize={sharedNameSize} />
          )}
        </div>
      </div>

      <div className={styles.vs}>VS</div>

      <div className={styles.bar1}>
        <TugBar
          label="戦績"
          displayA={recordDisplay(left.record, left.winRate)}
          displayB={recordDisplay(right.record, right.winRate)}
        />
      </div>
      <div className={styles.bar2}>
        <TugBar
          label="フィニッシュ率"
          displayA={left.finishRate === null ? "—" : `${left.finishRate}%`}
          displayB={right.finishRate === null ? "—" : `${right.finishRate}%`}
        />
      </div>

      {hasMethodCounts && (
        <>
          <div className={styles.ma}>
            {left.methodCounts && <MethodCountsLine counts={left.methodCounts} />}
          </div>
          <div className={styles.mb}>
            {right.methodCounts && <MethodCountsLine counts={right.methodCounts} />}
          </div>
        </>
      )}

      {left.last5 && <FormChips last5={left.last5} side="red" />}
      {right.last5 && <FormChips last5={right.last5} side="blue" />}
    </div>
  );
}
