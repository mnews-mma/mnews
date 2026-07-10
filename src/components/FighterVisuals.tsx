import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { computeMethodSplit, computeFighterStripStats } from "@/lib/fighterStrip";
import { computeCommonOpponents } from "@/lib/articleGenerator";
import { findFighterSlugByName } from "@/lib/fighters";

// 勝敗記号は ○ / ✗(U+2717) / △ のみ。方向・凡例の概念が無く説明不要で読める。
const MARK: Record<FighterRecordEntry["history"][number]["result"], string> = {
  win: "○",
  loss: "✗",
  draw: "△",
  nc: "△",
};
const MARK_CLASS: Record<FighterRecordEntry["history"][number]["result"], string> = {
  win: "mk-win",
  loss: "mk-loss",
  draw: "mk-draw",
  nc: "mk-draw",
};

// 直近5戦を順序なしの集計テキストで返す(並び順の説明が要らない)。
function last5Text(entry: FighterRecordEntry): string | null {
  const last5 = computeFighterStripStats(entry).last5;
  if (last5.length === 0) return null;
  const w = last5.filter((r) => r === "win").length;
  const l = last5.filter((r) => r === "loss").length;
  const d = last5.length - w - l;
  return `直近${last5.length}戦 ${w}勝${l}敗${d > 0 ? `${d}分` : ""}`;
}

// 次戦プレビュー: 次の対戦相手との比較 + 共通対戦相手の明暗。
// 大会データ(次戦)と選手間の突合はmnewsだけが持つ文脈で、選手単体の
// 静的ビジュアライザには構造的に作れないセクション。
// 相手がDB外/データなしの場合は呼び出し側が描画しない(バナーのみに自動格下げ)。
export function NextFightCompare({
  selfName,
  self,
  opponentName,
  opponentSlug,
  opponent,
  visibleSlugs,
}: {
  selfName: string;
  self: FighterRecordEntry;
  opponentName: string;
  opponentSlug: string;
  opponent: FighterRecordEntry;
  visibleSlugs: Set<string>;
}) {
  const selfStats = computeFighterStripStats(self);
  const oppStats = computeFighterStripStats(opponent);
  const selfLast5 = last5Text(self);
  const oppLast5 = last5Text(opponent);
  // 共通対戦相手(記事生成と同じロジックを流用・名前正規化つき重複除去済み)。
  const commons = computeCommonOpponents(self, opponent).slice(0, 8);

  return (
    <div className="nf-compare">
      <div className="nf-vs">
        <div className="nf-side">
          <div className="nf-name">{selfName}</div>
          <div className="nf-record">{selfStats.record}</div>
          {selfLast5 && <div className="nf-last5">{selfLast5}</div>}
        </div>
        <div className="nf-vs-mark">VS</div>
        <div className="nf-side nf-side--right">
          <a href={`/fighters/${opponentSlug}`} className="nf-name nf-name--link">
            {opponentName}
          </a>
          <div className="nf-record">{oppStats.record}</div>
          {oppLast5 && <div className="nf-last5">{oppLast5}</div>}
        </div>
      </div>

      {commons.length > 0 && (
        <div className="nf-commons">
          <div className="nf-commons-head">
            <span>共通対戦相手</span>
            <span className="nf-col">{selfName}</span>
            <span className="nf-col">{opponentName}</span>
          </div>
          {commons.map((c) => {
            const cSlug = findFighterSlugByName(c.name, undefined, visibleSlugs);
            return (
              <div key={c.name} className="nf-common-row">
                {cSlug ? (
                  <a href={`/fighters/${cSlug}`} className="nf-common-name">{c.name}</a>
                ) : (
                  <span>{c.name}</span>
                )}
                <span className={`nf-mk ${MARK_CLASS[c.resultA]}`}>{MARK[c.resultA]}</span>
                <span className={`nf-mk ${MARK_CLASS[c.resultB]}`}>{MARK[c.resultB]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 勝ち方 と 負け方: 決着方法を行にした左右対比(バタフライ)。
// 1行=1決着方法なので「KOで4回勝ち1回負け」が同じ物差しで読める。
// すべてhistoryのraw method再解析(勝ち負け同一ロジック・捏造ゼロ)。
export function MethodButterfly({ history }: { history: FighterRecordEntry["history"] }) {
  const { win, loss } = computeMethodSplit({ history } as FighterRecordEntry);
  if (!win && !loss) return null;
  const w = win ?? { ko: 0, sub: 0, decision: 0, other: 0 };
  const l = loss ?? { ko: 0, sub: 0, decision: 0, other: 0 };
  const rows: { label: string; w: number; l: number }[] = [
    { label: "KO", w: w.ko, l: l.ko },
    { label: "一本", w: w.sub, l: l.sub },
    { label: "判定", w: w.decision, l: l.decision },
  ];
  if (w.other + l.other > 0) rows.push({ label: "その他", w: w.other, l: l.other });
  const max = Math.max(1, ...rows.map((r) => Math.max(r.w, r.l)));
  const winTotal = w.ko + w.sub + w.decision + w.other;
  const lossTotal = l.ko + l.sub + l.decision + l.other;

  // 見出しは付けない。直上の通算戦績(例 11-15-1)と同じ数字を「11勝/15敗」として
  // 左右の柱に置くことで、バーが「その数字の内訳」であることが言葉なしで伝わる。
  return (
    <div className="fighter-viz-block">
      <div className="bf-head">
        <span />
        <span className="bf-head-win">{winTotal}勝</span>
        <span />
        <span className="bf-head-loss">{lossTotal}敗</span>
        <span />
      </div>
      {rows.map((r) => (
        <div key={r.label} className="bf-row">
          <span className="bf-num">{r.w > 0 ? r.w : ""}</span>
          <span className="bf-track bf-track--left">
            {r.w > 0 && <span className="bf-fill bf-fill--win" style={{ width: `${Math.round((r.w / max) * 100)}%` }} />}
          </span>
          <span className="bf-label">{r.label}</span>
          <span className="bf-track">
            {r.l > 0 && <span className="bf-fill bf-fill--loss" style={{ width: `${Math.round((r.l / max) * 100)}%` }} />}
          </span>
          <span className="bf-num bf-num--right">{r.l > 0 ? r.l : ""}</span>
        </div>
      ))}
    </div>
  );
}
