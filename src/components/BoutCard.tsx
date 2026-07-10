import type { ReactNode } from "react";
import { findFighterSlugByName } from "@/lib/fighters";
import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import FighterStrip from "@/components/FighterStrip";
import { EventCommonOpponents } from "@/components/FighterVisuals";

// 選手名の文字数に応じた段階的font-size(長い名前ほど1行に収まりやすくする)。
// カード半分の実測カラム幅(375px幅で約134px)を基準に、12文字前後まで
// 1行に収まる縮小幅を実測で調整済み(events/[slug]で検証)。
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
export function FighterName({ name, visibleSlugs }: { name: string; visibleSlugs: Set<string> }) {
  const slug = findFighterSlugByName(name, undefined, visibleSlugs);
  return slug ? (
    <a href={`/fighters/${slug}`} className="opponent-link">
      {name}
    </a>
  ) : (
    <span>{name}</span>
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
// 戦績ブロック(戦績/フィニッシュ率/直近5戦/共通対戦相手)は両者ともDB登録済み
// (戦績データあり)の場合のみ表示。片方でも未登録なら階級・選手名・VSのみの
// ミニマル表示にする(表示条件はEventCommonOpponents側のガードとも一致させている)。
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
      <div className="bout-fighters">
        <span className="bout-fighter-a" style={{ fontSize: fighterNameFontSize(nameA) }}>
          <FighterName name={nameA} visibleSlugs={visibleSlugs} />
        </span>
        <span className="bout-vs">VS</span>
        <span className="bout-fighter-b" style={{ fontSize: fighterNameFontSize(nameB) }}>
          <FighterName name={nameB} visibleSlugs={visibleSlugs} />
        </span>
      </div>
      {bothRegistered && (
        <>
          <FighterStrip name={nameA} slug={slugA} entry={entryA} variant="full" />
          <FighterStrip name={nameB} slug={slugB} entry={entryB} variant="full" />
          <EventCommonOpponents
            nameA={nameA}
            entryA={entryA!}
            nameB={nameB}
            entryB={entryB!}
            visibleSlugs={visibleSlugs}
          />
        </>
      )}
      {resultLine && <div className="bout-result">{resultLine}</div>}
    </div>
  );
}
