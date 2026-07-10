import { buildFormStrip, type FormStripFight } from "@/lib/fighterStrip";
import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";

// 勝敗色チップ。モバイル(hoverなし)前提で「色のみ」で流れを見せる。詳細は
// title(デスクトップのおまけ)とページ下部の戦績テーブルに委ねる。緑=勝ち/赤=負け/
// グレー=分・無効。
const CHIP_CLASS: Record<FormStripFight["result"], string> = {
  win: "form-chip--win",
  loss: "form-chip--loss",
  draw: "form-chip--draw",
  nc: "form-chip--draw",
};
const RESULT_JA: Record<FormStripFight["result"], string> = {
  win: "勝ち",
  loss: "負け",
  draw: "分け",
  nc: "無効試合",
};

// キャリアの流れ(フォームストリップ)。1試合=1マス、古い→新しい順。
// history が空 / noRecordData の選手は呼び出し側で非表示にする。
export default function FighterFormStrip({ history }: { history: FighterRecordEntry["history"] }) {
  const fights = buildFormStrip({ history } as FighterRecordEntry);
  if (fights.length === 0) return null;

  return (
    <div className="form-strip-block">
      <div className="form-strip-label">キャリアの流れ（古い → 新しい）</div>
      <div className="form-strip">
        {fights.map((f, i) => (
          <span
            key={i}
            className={`form-chip ${CHIP_CLASS[f.result]}`}
            title={`${f.date}　${f.opponent}｜${RESULT_JA[f.result]}｜${f.method}`}
            aria-label={`${f.date} ${f.opponent} ${RESULT_JA[f.result]}`}
          />
        ))}
      </div>
      <div className="form-strip-legend">
        <span className="fsl fsl-win" />勝ち
        <span className="fsl fsl-loss" />負け
        <span className="fsl fsl-draw" />分・無効
      </div>
    </div>
  );
}
