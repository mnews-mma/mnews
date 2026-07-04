"use client";

import { useState } from "react";
import { buildWeighInPost, type WeighInBoutInput } from "@/lib/xPost";
import CopyButton from "@/components/CopyButton";

interface BoutOption {
  fighterA: string;
  fighterB: string;
}
interface EventOption {
  slug: string;
  eventName: string;
  date: string;
  bouts: BoutOption[];
}

interface Row extends WeighInBoutInput {
  id: number;
}

let nextId = 1;

function emptyRow(): Row {
  return { id: nextId++, fighterA: "", fighterB: "", resultA: "pass", resultB: "pass", weightA: "", weightB: "" };
}

const btn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
};
const btnActive: React.CSSProperties = {
  ...btn,
  background: "#16a34a",
  color: "#fff",
  border: "1px solid #16a34a",
};
const btnFailActive: React.CSSProperties = {
  ...btn,
  background: "var(--accent)",
  color: "#fff",
  border: "1px solid var(--accent)",
};

export default function WeighInTool({ events }: { events: EventOption[] }) {
  const [eventIdx, setEventIdx] = useState(0);
  const event = events[eventIdx];
  const [weighInDate, setWeighInDate] = useState(() => {
    // 大会前日をデフォルトに
    if (!event) return "";
    const d = new Date(`${event.date}T00:00:00+09:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [rows, setRows] = useState<Row[]>(() =>
    event && event.bouts.length > 0
      ? event.bouts.map((b) => ({ ...emptyRow(), fighterA: b.fighterA, fighterB: b.fighterB }))
      : [emptyRow()]
  );

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, emptyRow()]);
  }
  function removeRow(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  const filledRows = rows.filter((r) => r.fighterA.trim() && r.fighterB.trim());
  const post =
    event && filledRows.length > 0
      ? buildWeighInPost({ eventName: event.eventName, weighInDate, bouts: filledRows })
      : null;

  return (
    <div style={{ padding: "20px 16px 60px", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        計量結果まとめ
      </h1>
      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
        公式の計量結果を見ながら手入力してください。出力は下書きのみ(手動コピー→投稿)。
      </p>

      <select
        value={eventIdx}
        onChange={(e) => {
          const idx = Number(e.target.value);
          setEventIdx(idx);
          const ev = events[idx];
          setRows(
            ev.bouts.length > 0
              ? ev.bouts.map((b) => ({ ...emptyRow(), fighterA: b.fighterA, fighterB: b.fighterB }))
              : [emptyRow()]
          );
          const d = new Date(`${ev.date}T00:00:00+09:00`);
          d.setDate(d.getDate() - 1);
          setWeighInDate(d.toISOString().slice(0, 10));
        }}
        style={{ width: "100%", fontSize: 15, padding: "12px", borderRadius: 8, marginBottom: 12 }}
      >
        {events.map((e, i) => (
          <option key={e.slug} value={i}>
            {e.date} {e.eventName}
          </option>
        ))}
      </select>

      <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>計量日</label>
      <input
        type="date"
        value={weighInDate}
        onChange={(e) => setWeighInDate(e.target.value)}
        style={{ width: "100%", fontSize: 15, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 16, boxSizing: "border-box" }}
      />

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>対戦カードごとの結果</div>
      {rows.map((row) => (
        <div key={row.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input
              value={row.fighterA}
              onChange={(e) => updateRow(row.id, { fighterA: e.target.value })}
              placeholder="選手A"
              style={{ fontSize: 14, padding: "8px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
            <input
              value={row.fighterB}
              onChange={(e) => updateRow(row.id, { fighterB: e.target.value })}
              placeholder="選手B"
              style={{ fontSize: 14, padding: "8px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={row.resultA === "pass" ? btnActive : btn} onClick={() => updateRow(row.id, { resultA: "pass" })}>
                パス
              </button>
              <button style={row.resultA === "fail" ? btnFailActive : btn} onClick={() => updateRow(row.id, { resultA: "fail" })}>
                失敗
              </button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={row.resultB === "pass" ? btnActive : btn} onClick={() => updateRow(row.id, { resultB: "pass" })}>
                パス
              </button>
              <button style={row.resultB === "fail" ? btnFailActive : btn} onClick={() => updateRow(row.id, { resultB: "fail" })}>
                失敗
              </button>
            </div>
          </div>
          {(row.resultA === "fail" || row.resultB === "fail") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input
                value={row.weightA}
                onChange={(e) => updateRow(row.id, { weightA: e.target.value })}
                placeholder={row.resultA === "fail" ? "超過幅(例: +1.2kg)" : ""}
                disabled={row.resultA !== "fail"}
                style={{ fontSize: 13, padding: "8px", borderRadius: 6, border: "1px solid var(--border)", opacity: row.resultA === "fail" ? 1 : 0.4 }}
              />
              <input
                value={row.weightB}
                onChange={(e) => updateRow(row.id, { weightB: e.target.value })}
                placeholder={row.resultB === "fail" ? "超過幅(例: +1.2kg)" : ""}
                disabled={row.resultB !== "fail"}
                style={{ fontSize: 13, padding: "8px", borderRadius: 6, border: "1px solid var(--border)", opacity: row.resultB === "fail" ? 1 : 0.4 }}
              />
            </div>
          )}
          <button onClick={() => removeRow(row.id)} style={{ ...btn, fontSize: 11, color: "var(--muted)" }}>
            この行を削除
          </button>
        </div>
      ))}
      <button onClick={addRow} style={{ ...btn, width: "100%", marginBottom: 20 }}>
        + カードを追加
      </button>

      {post && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>投稿文プレビュー</span>
            <CopyButton text={post.text} label="コピー" />
          </div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", margin: 0 }}>
            {post.text}
          </pre>
        </div>
      )}
    </div>
  );
}
