import type { FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { computeMethodSplit, computeFighterStripStats, LAST5_SYMBOL } from "@/lib/fighterStrip";
import { computeCommonOpponents, computeHeadToHead, groupCommonOpponents } from "@/lib/articleGenerator";
import { findFighterSlugByName } from "@/lib/fighters";
import { renderWrappableName } from "@/lib/renderWrappableName";

type Result = FighterRecordEntry["history"][number]["result"];

// 勝敗マークは直近5戦ドット(.fighter-strip-last5)と同じ意匠(緑地W/赤地L/
// グレー地D・N)の丸バッジに統一する。文字もLAST5_SYMBOLを共有し、記号の
// 二重定義を避ける。
const MARK_CLASS: Record<Result, string> = {
  win: "nf-mk--win",
  loss: "nf-mk--loss",
  draw: "nf-mk--draw",
  nc: "nf-mk--draw",
};

// 勝敗マス。resultがnull(同一相手との対戦回数が左右で異なり、片方に対戦が
// 無い回)の場合は、サイズ・形をW/Lと揃えたグレー地の「—」ドット表示にする。
function MarkCell({ result }: { result: Result | null }) {
  if (result === null) return <span className="nf-mk nf-mk--empty">—</span>;
  return <span className={`nf-mk ${MARK_CLASS[result]}`}>{LAST5_SYMBOL[result]}</span>;
}

// 共通対戦相手の行(選手ページ次戦カード・大会ページ両対応の共有部分)。
// 同一相手と複数回対戦がある場合は1相手=1行に集約し(groupCommonOpponents)、
// 結果マークを時系列順(古→新)に横に複数並べる。
// マーク仕様(W/L/D/N丸バッジ)の変更は1箇所への反映で両方に伝播する。
function CommonOpponentRows({
  commons,
  visibleSlugs,
}: {
  commons: ReturnType<typeof computeCommonOpponents>;
  visibleSlugs: Set<string>;
}) {
  const grouped = groupCommonOpponents(commons);
  return (
    <>
      {grouped.map((g) => {
        const cSlug = findFighterSlugByName(g.name, undefined, visibleSlugs);
        return (
          <div key={g.name} className="nf-common-row">
            {cSlug ? (
              <a href={`/fighters/${cSlug}`} className="nf-common-name">{g.name}</a>
            ) : (
              <span>{g.name}</span>
            )}
            <span className="nf-mk-group">
              {g.results.map((r, i) => (
                <MarkCell key={i} result={r.resultA} />
              ))}
            </span>
            <span className="nf-mk-group">
              {g.results.map((r, i) => (
                <MarkCell key={i} result={r.resultB} />
              ))}
            </span>
          </div>
        );
      })}
    </>
  );
}

// 決着方法(m.method)内の半角/全角スペースを非改行スペースに置き換え、通常時は
// 1塊の見た目を保つ(「5分3R終了 判定0-3」がスペース位置で泣き別れしない)。
// white-space:nowrapによる完全な改行禁止は、稀に存在する長い決着テキスト
// (旧団体の記録等)で320px幅の横オーバーフローを起こすため使わない。CSS側の
// word-break:normal;line-break:strict;と組み合わせ、収まらない極端なケースは
// 通常のCJK改行にフォールバックさせて安全性を優先する。
function nowrapMethodText(method: string): string {
  return method.replace(/[ 　]/g, " ");
}

// 直接対決(2選手が過去に対戦している場合の履歴)。共通対戦相手(第三者との対戦の
// 一致)とは概念が別物のため、独立した別枠として共通対戦相手テーブルの上に出す。
// 0件ならこの枠自体を出さない。複数回対戦がある場合は新しい順に全て列挙する。
// 1対戦=役割で2行に分ける(以前は3段、その前は無理に1行へ詰めていた):
// 1行目=日付+大会名、2行目=勝者マーク+勝者名+決着方法。決着方法(m.method)は
// historyの生テキストをそのまま使い、要約・言い換えはしない(捏造ゼロ)。
// 決着方法はwhite-space:nowrapで1塊にし(CSS側)、選手名が長い場合は名前側だけ
// 折り返す。勝者マークは直近5戦のW/Lドットと同じ丸バッジ意匠(.nf-h2h-badge)。
function HeadToHeadBlock({
  nameA,
  nameB,
  matches,
}: {
  nameA: string;
  nameB: string;
  matches: ReturnType<typeof computeHeadToHead>;
}) {
  if (matches.length === 0) return null;
  return (
    <div className="nf-h2h">
      <div className="nf-h2h-head">過去対戦 {matches.length}回</div>
      {matches.map((m, i) => {
        const winner = m.resultA === "win" ? nameA : m.resultA === "loss" ? nameB : null;
        return (
          <div key={i} className="nf-h2h-row">
            <div className="nf-h2h-line1">
              <span className="nf-h2h-date">{m.date}</span> <span className="nf-h2h-event">{m.event}</span>
            </div>
            <div className="nf-h2h-line2">
              {winner ? (
                <>
                  <span className="nf-h2h-badge nf-h2h-badge--win">W</span>
                  <span className="nf-h2h-winner">{winner}</span>
                  <span className="nf-h2h-method">{nowrapMethodText(m.method)}</span>
                </>
              ) : (
                <>
                  <span className="nf-h2h-badge nf-h2h-badge--draw">D</span>
                  <span className="nf-h2h-winner">引き分け</span>
                  <span className="nf-h2h-method">（{nowrapMethodText(m.method)}）</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 直近5戦を順序なしの集計テキストで返す(並び順の説明が要らない)。
function last5Text(entry: FighterRecordEntry): string | null {
  const last5 = computeFighterStripStats(entry).last5;
  if (last5.length === 0) return null;
  const w = last5.filter((r) => r === "win").length;
  const l = last5.filter((r) => r === "loss").length;
  const d = last5.length - w - l;
  return `直近${last5.length}戦 ${w}勝${l}敗${d > 0 ? `${d}分` : ""}`;
}

// 直近5戦の○●記号列。対戦カード(FighterStrip)と全く同じ算出(computeFighterStripStats
// のlast5・LAST5_SYMBOL)・同じCSSクラス(fighter-strip-last5*)を再利用し、見た目を一致させる。
function Last5Marks({ entry }: { entry: FighterRecordEntry }) {
  const { last5 } = computeFighterStripStats(entry);
  if (last5.length === 0) return null;
  return (
    <span className="fighter-strip-last5">
      {last5.map((r, i) => (
        <span key={i} className={`fighter-strip-last5-${r}`}>
          {LAST5_SYMBOL[r]}
        </span>
      ))}
    </span>
  );
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
  // 共通対戦相手(記事生成と同じロジックを流用。同一相手との複数対戦は行分割済み)。
  const commons = computeCommonOpponents(self, opponent).slice(0, 8);
  // 直接対決(2選手同士の対戦履歴)。共通対戦相手とは別枠でその上に表示する。
  const headToHead = computeHeadToHead(self, opponentName);

  return (
    <div className="nf-compare">
      {/* 名前・戦績・直近5戦を行グリッドで整列。名前は上端揃え(align-items:start)
          なので、名前が1行/2行いずれでも戦績以下の行は左右で揃う。名前の折り返しは
          renderWrappableName(BoutCard.tsxと共有)で中黒・スペース位置のみに限定し、
          「フ」のような1文字だけの孤立行を作らない。 */}
      <div className="nf-vs">
        <div className="nf-name nf-cell--nl">{renderWrappableName(selfName)}</div>
        <div className="nf-vs-mark">VS</div>
        <a href={`/fighters/${opponentSlug}`} className="nf-name nf-name--link nf-cell--nr">
          {renderWrappableName(opponentName)}
        </a>
        <div className="nf-record nf-cell--rl">{selfStats.record}</div>
        <div className="nf-record nf-cell--rr">{oppStats.record}</div>
        {selfLast5 && <div className="nf-last5 nf-cell--ll">{selfLast5}</div>}
        {oppLast5 && <div className="nf-last5 nf-cell--lr">{oppLast5}</div>}
        {selfLast5 && <div className="nf-cell--ml"><Last5Marks entry={self} /></div>}
        {oppLast5 && <div className="nf-cell--mr"><Last5Marks entry={opponent} /></div>}
      </div>

      <HeadToHeadBlock nameA={selfName} nameB={opponentName} matches={headToHead} />

      {commons.length > 0 && (
        <div className="nf-commons">
          <div className="nf-commons-head">
            <span>共通対戦相手</span>
            <span className="nf-col">{selfName}</span>
            <span className="nf-col">{opponentName}</span>
          </div>
          <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} />
        </div>
      )}
    </div>
  );
}

// 大会ページの対戦カード用・直接対決+共通対戦相手(共通対戦相手のみ折りたたみ)。
// ロジックは選手ページの次戦カードと同一(computeCommonOpponents/computeHeadToHead流用)。
// 両方0件、または片方が戦績データなし(noRecordData)の場合はnull(何も出さない)。
// 直接対決は基本情報として常時表示、共通対戦相手のみ折りたたみにする(方針通り)。
export function EventCommonOpponents({
  nameA,
  entryA,
  nameB,
  entryB,
  visibleSlugs,
}: {
  nameA: string;
  entryA: FighterRecordEntry;
  nameB: string;
  entryB: FighterRecordEntry;
  visibleSlugs: Set<string>;
}) {
  if (entryA.noRecordData || entryB.noRecordData) return null;
  const commons = computeCommonOpponents(entryA, entryB).slice(0, 8);
  const headToHead = computeHeadToHead(entryA, nameB);
  if (commons.length === 0 && headToHead.length === 0) return null;
  // 複数対戦は行分割されるため、summaryの人数はユニークな相手数で数える
  // (行数=対戦数とは別の指標)。
  const uniqueOpponentCount = new Set(commons.map((c) => c.name)).size;

  return (
    <>
      <HeadToHeadBlock nameA={nameA} nameB={nameB} matches={headToHead} />
      {commons.length > 0 && (
        <details className="bout-commons">
          <summary className="bout-commons-summary">共通対戦相手 {uniqueOpponentCount}人</summary>
          <div className="nf-commons-head">
            <span>共通対戦相手</span>
            <span className="nf-col">{nameA}</span>
            <span className="nf-col">{nameB}</span>
          </div>
          <CommonOpponentRows commons={commons} visibleSlugs={visibleSlugs} />
        </details>
      )}
    </>
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
