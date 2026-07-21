"use client";

import { useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { ogImagePath } from "@/lib/ogShared";
import { buildMatchupContextPost } from "@/lib/xPost";
import { normalizeVsSlugs } from "@/lib/vsPairing";
import { WEIGHT_KG, weightSortKey } from "@/lib/weightClasses";
import { computeCommonOpponents } from "@/lib/articleGenerator";
import type { FighterRecordEntry, FighterRecordsFile } from "@/lib/fighterRecordsCache";
import AdminBackLink from "@/components/AdminBackLink";

export interface DraftFighterOption {
  slug: string;
  nameJa: string;
  weightClass: string;
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  // フィニッシュ率の再分類(tallyMethods)に使う。空配列は「集計値のみ持つ選手」を表し、
  // 呼び出し側はko/subへフォールバックする。
  history: FighterRecordEntry["history"];
}

// 階級はドロップダウン(共有の体重ソートキーで整列)+自由入力(キャッチウェイト等)の両対応。
const WEIGHT_OPTIONS = Object.keys(WEIGHT_KG).sort((a, b) => WEIGHT_KG[a] - WEIGHT_KG[b]);
const CUSTOM_WEIGHT = "__custom__";

const chip: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
};

function DraftCard({ text, imageUrl, replyText }: { text: string; imageUrl?: string; replyText?: string }) {
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
      {replyText && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>セルフリプライ</label>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", margin: "0 0 10px" }}>
            {replyText}
          </pre>
          <CopyButton text={replyText} label="リプライコピー" />
        </div>
      )}
    </div>
  );
}

// AとBの選手slugを入れ替えるボタン。赤/青コーナーは正規のa/b順そのもので
// 一元管理されており(表示専用の反転フラグは持たない)、a↔bを入れ替えれば
// カード画像・投稿文のコーナー表示が全面で一緒に反転する(2026-07-20)。
function SwapCornersButton({ onSwap, disabled }: { onSwap: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onSwap}
      disabled={disabled}
      title="AとBを入れ替え"
      aria-label="AとBを入れ替え"
      style={{
        alignSelf: "flex-end",
        marginBottom: 8,
        padding: "8px 12px",
        fontSize: 16,
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 6,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      ⇄
    </button>
  );
}

// フリーワード検索付きの選手セレクタ(既存/tools/fighter-cardと同じパターンを再利用)。
// nodata選手(戦績データ無し)はfighters配列に含めない運用(呼び出し側で除外済み)。
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
  // 階級で絞る(任意)。あくまで選手を探しやすくするための一覧フィルタで、
  // 選択そのものを制約しない(/dreamのDreamPickerと同じパターン)。
  const [classFilter, setClassFilter] = useState("");
  const weightClasses = useMemo(
    () => Array.from(new Set(fighters.map((f) => f.weightClass))).sort((a, b) => weightSortKey(a) - weightSortKey(b)),
    [fighters]
  );
  const filtered = useMemo(() => {
    const base = fighters.filter(
      (f) => (!filter.trim() || f.nameJa.includes(filter.trim())) && (!classFilter || f.weightClass === classFilter)
    );
    // 選択中のslugが絞り込みで消えても<select>から見失わないよう、常に
    // 先頭へ含める(⇄で入れ替えた直後、旧フィルタのままだと新しい選手が
    // 一覧から消えて選択内容が空欄化してしまうのを防ぐ)。
    if (value && !base.some((f) => f.slug === value)) {
      const selected = fighters.find((f) => f.slug === value);
      if (selected) return [selected, ...base];
    }
    return base;
  }, [fighters, filter, classFilter, value]);
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{label}</label>
      <select
        value={classFilter}
        onChange={(e) => setClassFilter(e.target.value)}
        style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
      >
        <option value="">階級で絞る: すべて</option>
        {weightClasses.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
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

// 対戦カード決定のX投稿文ドラフト生成。カード画像は本文末尾の/vs URLをXの
// OGPアンフルで出す(画像直貼りはしない=/dreamと同方式)。
function MatchupTab({
  fighters,
  fighterRecords,
}: {
  fighters: DraftFighterOption[];
  fighterRecords: FighterRecordsFile;
}) {
  const [slugA, setSlugA] = useState("");
  const [slugB, setSlugB] = useState("");
  const [eventName, setEventName] = useState("");
  const [weightPreset, setWeightPreset] = useState("");
  const [weightCustom, setWeightCustom] = useState("");
  const [draft, setDraft] = useState<{ text: string; imageUrl?: string } | null>(null);

  const weightClass = (weightPreset === CUSTOM_WEIGHT ? weightCustom : weightPreset).trim();

  function generate() {
    const a = fighters.find((f) => f.slug === slugA);
    const b = fighters.find((f) => f.slug === slugB);
    if (!a || !b) return;

    // CTA文言の出し分け(zero-fabrication): 共通の対戦相手が実際に1名以上
    // いる場合のみtrueにする(/vsのcomputeCommonOpponentsをそのまま流用)。
    const entryA = fighterRecords[a.slug];
    const entryB = fighterRecords[b.slug];
    const hasCommonOpponents = !!entryA && !!entryB && computeCommonOpponents(entryA, entryB).length > 0;

    const post = buildMatchupContextPost({
      fighterA: { nameJa: a.nameJa, slug: a.slug, wins: a.wins, losses: a.losses, draws: a.draws, ko: a.ko, sub: a.sub, history: a.history },
      fighterB: { nameJa: b.nameJa, slug: b.slug, wins: b.wins, losses: b.losses, draws: b.draws, ko: b.ko, sub: b.sub, history: b.history },
      eventName: eventName.trim() || undefined,
      weightClass: weightClass || undefined,
      hasCommonOpponents,
    });
    // 2026-07-20〜: 画像は直貼りせず、本文末尾の/vs URLをXのOGPアンフルで
    // 出す(/dreamと同方式)。プレビューも実際にアンフルされるのと同じ公開
    // /api/og/vs(スラッグ辞書順+?red=、本文のURL組み立てと同じロジック)を
    // 使う。大会名/階級ラベル(自由入力)は/api/og/vsが受け付けない
    // (公開・非認証ルートのため任意文字列を拒否する設計、route.tsx側の
    // コメント参照)ため画像には反映されない。
    const norm = normalizeVsSlugs(a.slug, b.slug);
    const redParam = norm.a !== a.slug ? `?red=${a.slug}` : "";
    setDraft({
      text: post.text,
      imageUrl: ogImagePath(`/api/og/vs/${norm.a}/${norm.b}${redParam}`),
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <FighterPicker label="選手A" fighters={fighters} value={slugA} onChange={setSlugA} />
        <SwapCornersButton onSwap={() => { setSlugA(slugB); setSlugB(slugA); }} disabled={!slugA && !slugB} />
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
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>階級(任意)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={weightPreset}
              onChange={(e) => setWeightPreset(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 14, minWidth: 160 }}
            >
              <option value="">（なし）</option>
              {WEIGHT_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
              <option value={CUSTOM_WEIGHT}>自由入力…</option>
            </select>
            {weightPreset === CUSTOM_WEIGHT && (
              <input
                type="text"
                value={weightCustom}
                onChange={(e) => setWeightCustom(e.target.value)}
                placeholder="例: キャッチウェイト70kg"
                style={{ padding: "8px 12px", fontSize: 14, minWidth: 200 }}
              />
            )}
          </div>
        </div>
      </div>
      <button onClick={generate} disabled={!slugA || !slugB} style={{ ...chip, marginBottom: 16, opacity: !slugA || !slugB ? 0.5 : 1 }}>
        ドラフト生成
      </button>
      {draft && <DraftCard text={draft.text} imageUrl={draft.imageUrl} />}
    </div>
  );
}

export default function DraftsTool({
  fighters,
  fighterRecords,
}: {
  fighters: DraftFighterOption[];
  fighterRecords: FighterRecordsFile;
}) {
  return (
    <div style={{ padding: "20px 16px 60px", maxWidth: 720, margin: "0 auto" }}>
      <AdminBackLink />
      <h1 style={{ fontFamily: "var(--os)", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        対戦カード決定投稿
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        対戦決定のX投稿文を生成します。Xへの自動投稿はしません(常にコピー→手動ポスト)。
        試合結果の下書きは「🔴X結果速報投稿」で行ってください。
      </p>
      <MatchupTab fighters={fighters} fighterRecords={fighterRecords} />
    </div>
  );
}
