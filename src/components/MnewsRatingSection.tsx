"use client";

import { useState } from "react";
import RankPositionDeltaBadge, { RankPositionDeltaValue } from "@/components/RankPositionDeltaBadge";
import { DIVISION_SLUG } from "@/lib/mnewsRating/divisions";

interface RatingRecord {
  wins: number;
  losses: number;
  draws: number;
}

interface RatingEntry {
  fighterId: string;
  nameJa: string;
  displayRank: number;
  delta: number | null;
  rankPositionDelta?: RankPositionDeltaValue | null;
  record: RatingRecord;
}

interface ChampionEntry {
  fighterId: string;
  nameJa: string;
  record: RatingRecord | null;
}

interface DivisionView {
  champion: ChampionEntry | null;
  contenders: RatingEntry[];
}

const DIVISIONS = ["フライ級", "バンタム級", "フェザー級", "ライト級"] as const;
type Division = (typeof DIVISIONS)[number];

// P4P(パウンドフォーパウンド、2026-07-22追加)はMnewsDivisionではない疑似区分
// なので、既存のDivision型(プルダウンの選択肢の型)には含めない。プルダウンの
// 選択状態はSelectableKeyで扱い、P4P選択時だけ別経路(p4pView prop・
// /rankings/pound-for-pound へのリンク)を通す。P4Pは王者4名がP4P1〜4位に
// 固定表示される設計のため、王者ティア(champion:null固定)のような別枠行は
// 無く、contenders(先頭3件)がそのまま王者を含む順位付きリストになる
// (既存のview.champion有無で分岐するレンダリングをそのまま流用できる)。
const P4P_KEY = "パウンドフォーパウンド" as const;
type SelectableKey = Division | typeof P4P_KEY;

// トップページのヒーロー「AI RIZINランキング」カード(データ資産ブロック。
// mnews-homepage-instructions.md §2.1)。4階級ぶんの{champion, contenders}を
// サーバー側(resolveDivisionRankingView経由)で選手名解決・スラッグ生表示
// フォールバック排除・繰り上げ済みの状態で受け取り、階級切替はクライアント側の
// state切り替えのみ(追加fetch無し)で行う。デフォルトはフェザー級。
// ランキングページ本体と同じ共有セレクタ由来のデータなので、王者行の有無・並びが
// 常に一致する(ここで独自に組み立てない)。未公開階級はdivisionsに含まれない
// (プルダウンの選択肢に出さない=グレーで見せない)。fighters.tsに解決できなかった選手は
// サーバー側で既に除外済みのため、ここでは生スラッグへのフォールバックを行わない
// (fighterIdをそのまま表示に使わない)。レート数値は外向き表示に出さない方針の
// ため、順位・選手名・戦績・前回比のみ表示する(値自体もサーバー側で除去済み)。
// 前回比(▲▼—/NEW)はA-4(2026-07-18)で実装した順位差分パイプライン
// (rankPositionDelta.ts)の出力をそのまま表示する。「順位番号」の前回比較で
// あり、レート点数の増減(RankingDelta)とは別概念(スコア計算ロジックには
// 一切関与しない後処理)。王者行は「順位番号」を持たない事実表示のため、常に—。
export default function MnewsRatingSection({
  divisions,
  p4pView,
}: {
  divisions: Record<Division, DivisionView>;
  // P4Pは母集団・順位ロジックが階級別ランキングと別物のため、既存のdivisions
  // propの型(Record<Division, DivisionView>)は変えずオプション引数で渡す
  // (未指定時はプルダウンにP4Pを出さない=段階的ロールアウト・障害切り分けが
  // 容易になる)。
  p4pView?: DivisionView | null;
}) {
  const [selected, setSelected] = useState<SelectableKey>("フェザー級");
  const isP4P = selected === P4P_KEY;
  const view = isP4P ? (p4pView ?? { champion: null, contenders: [] }) : divisions[selected as Division] ?? { champion: null, contenders: [] };
  const availableDivisions = DIVISIONS.filter((d) => (divisions[d]?.contenders.length ?? 0) > 0 || divisions[d]?.champion);
  const p4pAvailable = (p4pView?.contenders.length ?? 0) > 0;
  const availableSelectables: SelectableKey[] = p4pAvailable ? [...availableDivisions, P4P_KEY] : availableDivisions;

  if (availableSelectables.length === 0) return null;

  const top3 = view.contenders.slice(0, 3);

  return (
    <section className="hero-ranking-card">
      <div className="hero-ranking-head">
        <div>
          <div className="hero-ranking-title">AI RIZINランキング</div>
          <div className="hero-ranking-subtitle">独自AIが大会翌日に更新</div>
        </div>
        <select
          className="hero-ranking-select"
          aria-label="階級を選択"
          value={selected}
          onChange={(e) => setSelected(e.target.value as SelectableKey)}
        >
          {availableSelectables.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      {top3.length > 0 || view.champion ? (
        <div className="hero-ranking-list">
          {view.champion && (
            <a href={`/fighters/${view.champion.fighterId}`} className="hero-ranking-row">
              <span className="hero-ranking-rank hero-ranking-rank-champion">王者</span>
              <span className="hero-ranking-name">{view.champion.nameJa}</span>
              <RankPositionDeltaBadge delta={null} />
            </a>
          )}
          {top3.map((e) => (
            <a key={e.fighterId} href={`/fighters/${e.fighterId}`} className="hero-ranking-row">
              <span className={`hero-ranking-rank ${e.displayRank <= 3 ? "hero-ranking-rank-top" : ""}`}>{e.displayRank}</span>
              <span className="hero-ranking-name">{e.nameJa}</span>
              <RankPositionDeltaBadge delta={e.rankPositionDelta ?? null} />
            </a>
          ))}
        </div>
      ) : (
        <p className="hero-ranking-empty">この階級のデータは準備中です。</p>
      )}
      <div className="hero-ranking-foot">
        <a href={isP4P ? "/rankings/pound-for-pound" : `/rankings/${DIVISION_SLUG[selected as Division]}`}>全ランキング →</a>
        <a href="/rankings/methodology">算出方法</a>
      </div>
    </section>
  );
}
