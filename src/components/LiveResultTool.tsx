"use client";

import { useState } from "react";
import { ogImagePath } from "@/lib/ogShared";
import { buildResultPost } from "@/lib/xPost";

interface BoutLite {
  index: number;
  weightClass: string;
  fighterA: string;
  fighterB: string;
  isTitleMatch: boolean;
  cancelled: boolean;
}
interface EventLite {
  slug: string;
  eventName: string;
  date: string;
  org: string;
  bouts: BoutLite[];
}

const METHODS = ["KO", "TKO", "一本", "判定", "ドロー", "ノーコンテスト"] as const;
type Method = (typeof METHODS)[number];

// 一本の定番技(タップ選択用)。その他は自由入力
const SUB_TECHS = [
  "リアネイキドチョーク",
  "ギロチンチョーク",
  "腕ひしぎ十字固め",
  "三角絞め",
  "肩固め",
  "ヒールフック",
  "フロントチョーク",
];

const btn: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
  textAlign: "center",
};
const btnActive: React.CSSProperties = {
  ...btn,
  background: "var(--accent)",
  color: "#fff",
  border: "1px solid var(--accent)",
};

export default function LiveResultTool({ events }: { events: EventLite[] }) {
  const [eventSlug, setEventSlug] = useState(events[0]?.slug ?? "");
  const [boutIndex, setBoutIndex] = useState<number | null>(null);
  const [winner, setWinner] = useState<"A" | "B" | "draw" | null>(null);
  const [method, setMethod] = useState<Method | null>(null);
  const [subTech, setSubTech] = useState("");
  const [judgeScore, setJudgeScore] = useState("");
  const [round, setRound] = useState("");
  const [time, setTime] = useState("");
  const [generated, setGenerated] = useState<{ img: string; text: string } | null>(null);
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const event = events.find((e) => e.slug === eventSlug);
  const bout = event && boutIndex !== null ? event.bouts[boutIndex] : null;

  function resetBout() {
    setWinner(null);
    setMethod(null);
    setSubTech("");
    setJudgeScore("");
    setRound("");
    setTime("");
    setGenerated(null);
    setCopied(false);
  }

  function methodLabel(): string {
    if (!method) return "";
    if (method === "一本") return subTech ? `一本（${subTech}）` : "一本";
    if (method === "判定") return judgeScore ? `判定（${judgeScore}）` : "判定";
    return method;
  }

  function generate() {
    if (!event || !bout || !winner || !method) return;
    const m = methodLabel();
    const params = new URLSearchParams({
      e: event.slug,
      b: String(bout.index),
      w: winner === "draw" ? "draw" : winner,
      m,
    });
    if (round) params.set("r", round);
    if (time) params.set("t", time);
    const img = ogImagePath(`/api/og/result?${params.toString()}`);
    const isDraw = winner === "draw";
    const post = buildResultPost({
      org: event.org,
      winner: winner === "B" ? bout.fighterB : bout.fighterA,
      loser: winner === "B" ? bout.fighterA : bout.fighterB,
      method: m,
      isDraw,
    });
    setGenerated({ img, text: post.text });
    setDoneSet(new Set(doneSet).add(`${event.slug}:${bout.index}`));
  }

  async function copyText() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ padding: "20px 16px 60px", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        ライブ結果入力
      </h1>
      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
        暫定版: 結果カード画像の生成まで（Xへは画像を保存して手動ポスト）。
        サイト反映・自動ポストは7/13までに実装。
      </p>

      {/* イベント選択 */}
      <select
        value={eventSlug}
        onChange={(e) => {
          setEventSlug(e.target.value);
          setBoutIndex(null);
          resetBout();
        }}
        style={{ width: "100%", fontSize: 15, padding: "12px", borderRadius: 8, marginBottom: 16 }}
      >
        {events.map((e) => (
          <option key={e.slug} value={e.slug}>
            {e.date} {e.eventName}
          </option>
        ))}
      </select>

      {/* 試合一覧 */}
      {boutIndex === null && event && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {event.bouts.map((b) => {
            const done = doneSet.has(`${event.slug}:${b.index}`);
            return (
              <button
                key={b.index}
                onClick={() => {
                  if (b.cancelled) return;
                  setBoutIndex(b.index);
                  resetBout();
                }}
                style={{
                  ...btn,
                  textAlign: "left",
                  opacity: b.cancelled ? 0.4 : 1,
                  borderLeft: done ? "4px solid #16a34a" : "4px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
                  {b.weightClass}
                  {b.isTitleMatch ? " ★TITLE" : ""}
                  {done ? " ✓生成済み" : ""}
                  {b.cancelled ? " (中止)" : ""}
                </div>
                {b.fighterA} vs {b.fighterB}
              </button>
            );
          })}
        </div>
      )}

      {/* 入力フロー */}
      {bout && event && (
        <div>
          <button onClick={() => setBoutIndex(null)} style={{ ...btn, fontSize: 12, padding: "6px 12px", marginBottom: 12 }}>
            ← 試合一覧へ
          </button>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>{bout.weightClass}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
            {bout.fighterA} vs {bout.fighterB}
          </div>

          {/* 勝者選択 */}
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>勝者</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
            <button style={winner === "A" ? btnActive : btn} onClick={() => setWinner("A")}>
              {bout.fighterA}
            </button>
            <button style={winner === "B" ? btnActive : btn} onClick={() => setWinner("B")}>
              {bout.fighterB}
            </button>
          </div>
          <button
            style={{ ...(winner === "draw" ? btnActive : btn), width: "100%", fontSize: 12, padding: "8px", marginBottom: 16 }}
            onClick={() => setWinner("draw")}
          >
            ドロー/NC
          </button>

          {/* 決着方法 */}
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>決着方法</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
            {METHODS.map((m) => (
              <button key={m} style={method === m ? btnActive : btn} onClick={() => setMethod(m)}>
                {m}
              </button>
            ))}
          </div>
          {method === "一本" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {SUB_TECHS.map((t) => (
                  <button
                    key={t}
                    style={{ ...(subTech === t ? btnActive : btn), fontSize: 12, padding: "6px 10px" }}
                    onClick={() => setSubTech(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                value={subTech}
                onChange={(e) => setSubTech(e.target.value)}
                placeholder="技名(自由入力可)"
                style={{ width: "100%", fontSize: 15, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", boxSizing: "border-box" }}
              />
            </div>
          )}
          {method === "判定" && (
            <input
              value={judgeScore}
              onChange={(e) => setJudgeScore(e.target.value)}
              placeholder="スコア(例: 3-0、29-28×3)"
              style={{ width: "100%", fontSize: 15, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", boxSizing: "border-box", marginBottom: 10 }}
            />
          )}

          {/* R・タイム(任意) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <input
              value={round}
              onChange={(e) => setRound(e.target.value)}
              placeholder="R(例: 2R)"
              style={{ fontSize: 15, padding: "10px", borderRadius: 8, border: "1px solid var(--border)" }}
            />
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="タイム(例: 1:09)"
              style={{ fontSize: 15, padding: "10px", borderRadius: 8, border: "1px solid var(--border)" }}
            />
          </div>

          <button
            onClick={generate}
            disabled={!winner || !method}
            style={{
              width: "100%",
              fontSize: 16,
              fontWeight: 700,
              padding: "14px",
              borderRadius: 8,
              border: "none",
              background: !winner || !method ? "#999" : "var(--accent)",
              color: "#fff",
              cursor: !winner || !method ? "default" : "pointer",
            }}
          >
            結果カードを生成
          </button>

          {generated && (
            <div style={{ marginTop: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={generated.img} alt="結果カード" style={{ width: "100%", border: "1px solid var(--border)", display: "block" }} />
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 12px" }}>
                画像を長押し(スマホ)または右クリックで保存 → Xに添付して投稿
              </p>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", userSelect: "all" }}>
                {generated.text}
              </pre>
              <button onClick={copyText} style={{ ...btn, width: "100%", marginTop: 8 }}>
                {copied ? "✓ コピーしました" : "投稿文をコピー"}
              </button>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                修正する場合は入力を変えて再度「結果カードを生成」(上書き)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
