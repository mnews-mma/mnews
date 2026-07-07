"use client";

import { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { ogImagePath } from "@/lib/ogShared";
import { rankChangeText, type RankChange } from "@/lib/rankingDiff";
import { buildMatchupContextPost, buildManualResultPost } from "@/lib/xPost";

export interface DraftFighterOption {
  slug: string;
  nameJa: string;
  wins?: number;
  losses?: number;
  draws?: number;
}

const ORG_LABEL: Record<string, string> = { pancrase: "パンクラス", shooto: "修斗", deep: "DEEP" };

const METHODS = ["KO", "TKO", "一本", "判定", "ドロー", "無効試合"] as const;

const tabBtn: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  padding: "10px 18px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
};
const tabBtnActive: React.CSSProperties = { ...tabBtn, background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" };
const chip: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
};
const chipActive: React.CSSProperties = { ...chip, background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" };

function DraftCard({ text, imageUrl }: { text: string; imageUrl?: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", margin: "0 0 10px" }}>
        {text}
      </pre>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="カードプレビュー" style={{ width: "100%", maxWidth: 500, border: "1px solid var(--border)", display: "block", marginBottom: 10 }} />
      )}
      <CopyButton text={text} label="本文コピー" />
    </div>
  );
}

// フリーワード検索付きの選手セレクタ(既存/tools/fighter-cardと同じパターンを再利用)。
function FighterPicker({
  label,
  fighters,
  value,
  onChange,
}: {
  label: string;
  fighters: DraftFighterOption[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(
    () => (filter.trim() ? fighters.filter((f) => f.nameJa.includes(filter.trim())) : fighters),
    [fighters, filter]
  );
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{label}</label>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="選手名で検索"
        style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
      />
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}>
        <option value="">(未選択)</option>
        {filtered.map((f) => (
          <option key={f.slug} value={f.slug}>
            {f.nameJa}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── タブ②: ランキング変動ドラフト ──
function RankingTab({ changes }: { changes: RankChange[] }) {
  if (changes.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 13 }}>前回スナップショットとの差分はありません(変化ゼロ)。</p>;
  }
  return (
    <div>
      {changes.map((c, i) => {
        const orgLabel = ORG_LABEL[c.org] ?? c.org;
        const text = rankChangeText(c, orgLabel, "https://www.mnews.jp");
        const imageUrl = c.slug ? ogImagePath(`/api/og/fighter/${c.slug}`) : undefined;
        return <DraftCard key={i} text={text} imageUrl={imageUrl} />;
      })}
    </div>
  );
}

// ── タブ①: 対戦カード文脈ドラフト ──
function MatchupTab({ fighters }: { fighters: DraftFighterOption[] }) {
  const [slugA, setSlugA] = useState("");
  const [slugB, setSlugB] = useState("");
  const [eventName, setEventName] = useState("");
  const [draft, setDraft] = useState<{ text: string; imageUrl?: string } | null>(null);

  function generate() {
    const a = fighters.find((f) => f.slug === slugA);
    const b = fighters.find((f) => f.slug === slugB);
    if (!a || !b) return;
    const post = buildMatchupContextPost({
      fighterA: { nameJa: a.nameJa, slug: a.slug, wins: a.wins, losses: a.losses, draws: a.draws },
      fighterB: { nameJa: b.nameJa, slug: b.slug, wins: b.wins, losses: b.losses, draws: b.draws },
      eventName: eventName.trim() || undefined,
    });
    setDraft({ text: post.text, imageUrl: ogImagePath(`/api/og/vs/${a.slug}/${b.slug}`) });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <FighterPicker label="選手A" fighters={fighters} value={slugA} onChange={setSlugA} />
        <FighterPicker label="選手B" fighters={fighters} value={slugB} onChange={setSlugB} />
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>大会名(任意)</label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="例: RIZIN.54"
            style={{ padding: "8px 12px", fontSize: 14, minWidth: 200 }}
          />
        </div>
      </div>
      <button onClick={generate} disabled={!slugA || !slugB} style={{ ...chip, marginBottom: 16, opacity: !slugA || !slugB ? 0.5 : 1 }}>
        ドラフト生成
      </button>
      {draft && <DraftCard text={draft.text} imageUrl={draft.imageUrl} />}
    </div>
  );
}

// ── タブ③: 試合結果ドラフト(手入力・自動戦績なし) ──
function ResultTab({ fighters }: { fighters: DraftFighterOption[] }) {
  const [winnerSlug, setWinnerSlug] = useState("");
  const [loserName, setLoserName] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number] | null>(null);
  const [round, setRound] = useState("");
  const [time, setTime] = useState("");
  const [manualRecord, setManualRecord] = useState("");
  const [draft, setDraft] = useState<{ text: string; imageUrl?: string } | null>(null);

  function generate() {
    const winner = fighters.find((f) => f.slug === winnerSlug);
    if (!winner || !loserName.trim() || !method) return;
    const detail = [round, time].filter(Boolean).join(" ");
    const methodLabel = detail ? `${method}（${detail}）` : method;
    const post = buildManualResultPost({
      winnerName: winner.nameJa,
      winnerSlug: winner.slug,
      loserName: loserName.trim(),
      method: methodLabel,
      manualRecord: manualRecord.trim() || undefined,
    });
    setDraft({ text: post.text, imageUrl: ogImagePath(`/api/og/fighter/${winner.slug}`) });
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        戦績(W-L)の出典はWikipedia日次バッチ(JST 2:30)のため、試合直後は未更新のことが多いです。
        下の「戦績」欄は空欄なら本文に一切出ません。載せたい場合のみ手入力してください。
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <FighterPicker label="勝者" fighters={fighters} value={winnerSlug} onChange={setWinnerSlug} />
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>敗者(自由入力)</label>
          <input
            type="text"
            value={loserName}
            onChange={(e) => setLoserName(e.target.value)}
            placeholder="敗者名"
            style={{ padding: "8px 12px", fontSize: 14, minWidth: 200 }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {METHODS.map((m) => (
          <button key={m} style={method === m ? chipActive : chip} onClick={() => setMethod(m)}>
            {m}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="ラウンド(例: 2R)" style={{ padding: "8px 12px", fontSize: 14, width: 140 }} />
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="タイム(任意・例: 1:09)" style={{ padding: "8px 12px", fontSize: 14, width: 160 }} />
        <input
          value={manualRecord}
          onChange={(e) => setManualRecord(e.target.value)}
          placeholder="戦績を載せる場合のみ(例: 12勝3敗)"
          style={{ padding: "8px 12px", fontSize: 14, width: 240 }}
        />
      </div>
      <button
        onClick={generate}
        disabled={!winnerSlug || !loserName.trim() || !method}
        style={{ ...chip, marginBottom: 16, opacity: !winnerSlug || !loserName.trim() || !method ? 0.5 : 1 }}
      >
        ドラフト生成
      </button>
      {draft && <DraftCard text={draft.text} imageUrl={draft.imageUrl} />}
    </div>
  );
}

export default function DraftsTool({
  fighters,
  changes,
}: {
  fighters: DraftFighterOption[];
  changes: RankChange[];
}) {
  const [tab, setTab] = useState<"ranking" | "matchup" | "result">("ranking");

  return (
    <div style={{ padding: "20px 16px 60px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--os)", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        投稿ドラフト
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        下書き生成のみ。Xへの自動投稿はしません(常にコピー→手動ポスト)。
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button style={tab === "ranking" ? tabBtnActive : tabBtn} onClick={() => setTab("ranking")}>
          ②ランキング変動
        </button>
        <button style={tab === "matchup" ? tabBtnActive : tabBtn} onClick={() => setTab("matchup")}>
          ①対戦カード文脈
        </button>
        <button style={tab === "result" ? tabBtnActive : tabBtn} onClick={() => setTab("result")}>
          ③試合結果
        </button>
      </div>
      {tab === "ranking" && <RankingTab changes={changes} />}
      {tab === "matchup" && <MatchupTab fighters={fighters} />}
      {tab === "result" && <ResultTab fighters={fighters} />}
    </div>
  );
}
