import type { CSSProperties, ReactNode } from "react";
import { findFighterSlugByName } from "@/lib/fighters";
import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import FighterStrip from "@/components/FighterStrip";
import { EventCommonOpponents } from "@/components/FighterVisuals";

// 選手名の文字数に応じた段階的font-size(長い名前ほど1行に収まりやすくする)。
// カード半分の実測カラム幅(375px幅で約150px前後)を基準に調整済み。
export function fighterNameFontSize(name: string): string {
  const len = name.length;
  if (len <= 6) return "15px";
  if (len <= 8) return "13.5px";
  if (len <= 10) return "12px";
  if (len <= 12) return "10.5px";
  return "9.5px";
}

// 戦績データが無い(no-data)/hiddenの選手はリンクにせずテキスト表示にする
// (visibleSlugsで判定・判定ロジックの二重定義はしない)。
export function FighterName({
  name,
  visibleSlugs,
  className,
  style,
}: {
  name: string;
  visibleSlugs: Set<string>;
  className?: string;
  style?: CSSProperties;
}) {
  const slug = findFighterSlugByName(name, undefined, visibleSlugs);
  return slug ? (
    <a href={`/fighters/${slug}`} className={className ? `opponent-link ${className}` : "opponent-link"} style={style}>
      {name}
    </a>
  ) : (
    <span className={className} style={style}>{name}</span>
  );
}

export interface BoutCardProps {
  nameA: string;
  nameB: string;
  slugA: string | null;
  slugB: string | null;
  entryA: FighterRecordEntry | null;
  entryB: FighterRecordEntry | null;
  visibleSlugs: Set<string>;
  weightClass?: string;
  rule?: string;
  isTitleMatch?: boolean;
  cancelled?: boolean;
  note?: string;
  resultLine?: ReactNode;
}

// 対戦カード1枚分の表示(events/[slug]の対戦カード欄と/dreamで共用)。
// 選手名は各選手ブロックに1回だけ出し(旧: 上段「A VS B」+下段戦績行の名前
// 二重表示を廃止)、戦績・フィニッシュ率・勝率・直近5戦はその選手名の直下に
// 縦集約する(横に散らして幅を食う構成をやめた)。
// 戦績ブロックは両者ともDB登録済み(戦績データあり)の場合のみ表示。片方でも
// 未登録なら階級・選手名・VSのみのミニマル表示にする(表示条件はEventCommon
// Opponents側のガードとも一致させている)。
export default function BoutCard({
  nameA,
  nameB,
  slugA,
  slugB,
  entryA,
  entryB,
  visibleSlugs,
  weightClass,
  rule,
  isTitleMatch,
  cancelled,
  note,
  resultLine,
}: BoutCardProps) {
  const bothRegistered = !!entryA && !!entryB && !entryA.noRecordData && !entryB.noRecordData;
  const hasMeta = !!weightClass || !!rule || !!isTitleMatch || !!cancelled || !!note;

  return (
    <div
      className={`bout-card${isTitleMatch ? " bout-card--title" : ""}${cancelled ? " bout-card--cancelled" : ""}`}
    >
      {hasMeta && (
        <div className="bout-card-meta">
          {weightClass && <span className="bout-weight">{weightClass}</span>}
          {rule && <span className="bout-rule">{rule}</span>}
          {isTitleMatch && <span className="bout-title-badge">TITLE</span>}
          {cancelled && <span className="bout-cancelled-badge">中止・変更</span>}
          {note && !isTitleMatch && !cancelled && <span className="bout-note">{note}</span>}
        </div>
      )}
      <div className="bout-pair">
        <div className="bout-side">
          <FighterName
            name={nameA}
            visibleSlugs={visibleSlugs}
            className="bout-side-name"
            style={{ fontSize: fighterNameFontSize(nameA) }}
          />
          {bothRegistered && <FighterStrip name={nameA} slug={slugA} entry={entryA} variant="full" />}
        </div>
        <span className="bout-vs">VS</span>
        <div className="bout-side bout-side--right">
          <FighterName
            name={nameB}
            visibleSlugs={visibleSlugs}
            className="bout-side-name"
            style={{ fontSize: fighterNameFontSize(nameB) }}
          />
          {bothRegistered && <FighterStrip name={nameB} slug={slugB} entry={entryB} variant="full" />}
        </div>
      </div>
      {bothRegistered && (
        <EventCommonOpponents
          nameA={nameA}
          entryA={entryA!}
          nameB={nameB}
          entryB={entryB!}
          visibleSlugs={visibleSlugs}
        />
      )}
      {resultLine && <div className="bout-result">{resultLine}</div>}
    </div>
  );
}
