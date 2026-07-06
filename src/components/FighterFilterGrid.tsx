"use client";

import { useMemo, useState } from "react";
import { calcFighterRates } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { ResolvedFighter } from "@/lib/feeds/resolveFighter";
import type { OrgTag, OrgTagKey } from "@/lib/orgTags";

// 団体フィルタ(並び順固定)。UFC/RIZINは既存公開選手のみ、DEEP/パンクラス/修斗は
// 新規公開昇格分に付与(computeFighterTags側で制御)。
const TAG_OPTIONS: { key: OrgTagKey; label: string }[] = [
  { key: "ufc", label: "UFC" },
  { key: "rizin", label: "RIZIN" },
  { key: "deep", label: "DEEP" },
  { key: "pancrase", label: "パンクラス" },
  { key: "shooto", label: "修斗" },
];

const TAG_COLOR: Record<OrgTagKey, string> = {
  ufc: SOURCES.ufc.color,
  rizin: SOURCES.rizin.color,
  deep: SOURCES.deep.color,
  pancrase: SOURCES.pancrase.color,
  shooto: SOURCES.shooto.color,
};

const WEIGHT_OPTIONS = ["女子アトム級", "ストロー級", "フライ級", "バンタム級", "フェザー級", "ライト級", "ウェルター級", "ヘビー級"];

const WEIGHT_ORDER: Record<string, number> = {
  "ストロー級": 0,
  "フェザー級": 1,
  "フライ級": 2,
  "バンタム級": 3,
  "ライト級": 4,
  "ウェルター級": 5,
  "女子アトム級": 6,
  "ヘビー級": 7,
};

// 「ヘビー級」を選ぶとDEEPの無差別級(メガトン級)も一緒に絞れるようにする
// (DEEPにはヘビー級表記が無くメガトン級が実質最上級のため)。
function matchesWeightFilter(fighterWeightClass: string, selected: string | null): boolean {
  if (!selected) return true;
  if (selected === "ヘビー級") return fighterWeightClass === "ヘビー級" || fighterWeightClass === "メガトン級";
  return fighterWeightClass === selected;
}

// ひらがな⇔カタカナの単純変換(Unicode範囲シフト)。入力の表記ゆれ(「ぐすたぼ」/
// 「グスタボ」)を吸収するために使う。読み仮名データを持たない漢字名は対象外
// (例:「平良達郎」はひらがな入力では引っかからない=データが無い以上の裏取りはしない)。
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// 名前検索(日本語名・カナ・ローマ字を横断照合)。団体・階級は対象外(既存フィルタの役割)。
function matchesNameSearch(f: ResolvedFighter, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const qLower = q.toLowerCase();
  const qKata = toKatakana(q);
  const qHira = toHiragana(q);
  return (
    f.nameJa.includes(q) ||
    f.nameJa.includes(qKata) ||
    f.nameJa.includes(qHira) ||
    f.nameEn.toLowerCase().includes(qLower)
  );
}

export default function FighterFilterGrid({
  fighters,
  tagsBySlug = {},
}: {
  fighters: ResolvedFighter[];
  tagsBySlug?: Record<string, OrgTag[]>;
}) {
  const [weightClass, setWeightClass] = useState<string | null>(null);
  const [tag, setTag] = useState<OrgTagKey | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return fighters
      .filter((f) => {
        if (!matchesWeightFilter(f.weightClass, weightClass)) return false;
        if (tag && !(tagsBySlug[f.slug] || []).some((t) => t.key === tag)) return false;
        if (!matchesNameSearch(f, query)) return false;
        return true;
      })
      .sort((a, b) => {
        const orgA = a.org === "ufc" ? 0 : 1;
        const orgB = b.org === "ufc" ? 0 : 1;
        if (orgA !== orgB) return orgA - orgB;
        const wa = WEIGHT_ORDER[a.weightClass] ?? 9;
        const wb = WEIGHT_ORDER[b.weightClass] ?? 9;
        return wa - wb;
      });
  }, [fighters, weightClass, tag, tagsBySlug, query]);

  return (
    <>
      <div className="fighter-filter-bar">
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">検索</span>
          <input
            type="text"
            className="fighter-search-input"
            placeholder="選手名で検索（日本語・カナ・ローマ字）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">階級</span>
          <button
            className={`fighter-filter-chip ${weightClass === null ? "active" : ""}`}
            onClick={() => setWeightClass(null)}
          >
            すべて
          </button>
          {WEIGHT_OPTIONS.map((w) => (
            <button
              key={w}
              className={`fighter-filter-chip ${weightClass === w ? "active" : ""}`}
              onClick={() => setWeightClass(w)}
            >
              {w.replace("級", "")}
            </button>
          ))}
        </div>
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">団体</span>
          <button
            className={`fighter-filter-chip ${tag === null ? "active" : ""}`}
            onClick={() => setTag(null)}
          >
            すべて
          </button>
          {TAG_OPTIONS.map((t) => (
            <button
              key={t.key}
              className={`fighter-filter-chip ${tag === t.key ? "active" : ""}`}
              onClick={() => setTag(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          該当なし
        </div>
      ) : (
      <div className="fighter-grid">
        {filtered.map((f) => {
          const { winRate, finishRate } = calcFighterRates(f);
          return (
            <a
              key={f.slug}
              href={`/fighters/${f.slug}`}
              className="fighter-card"
              style={{ borderLeftColor: SOURCES[f.org].color }}
            >
              {/* 団体はタグ1系統に統一(org由来の重複バッジは出さない)。タグ＋階級を上部に。 */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 2 }}>
                {(tagsBySlug[f.slug] || []).map((t) => (
                  <span
                    key={t.key}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 4,
                      color: "#fff",
                      background: TAG_COLOR[t.key],
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.label}
                  </span>
                ))}
                {/* 階級も団体タグと同じチップ体裁に統一(区切り"/"や細字添字は廃止)。
                    色はorgと区別する中立チップ(枠線＋muted)。 */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    color: "var(--muted)",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.weightClass}
                </span>
              </div>
              <div className="fighter-name">{f.nameJa}</div>
              {f.nickname && <div className="fighter-card-nickname">「{f.nickname}」</div>}
              {f.noRecordData ? (
                <div className="fighter-record" style={{ fontSize: 14, color: "var(--muted)" }}>
                  データなし
                </div>
              ) : (
                <>
                  <div className="fighter-record">
                    {f.wins}-{f.losses}-{f.draws}
                  </div>
                  <div className="fighter-breakdown">
                    KO {f.ko} / 一本 {f.sub} / 判定 {f.decision}
                  </div>
                  <div className="fighter-rates">
                    {winRate !== null && <span>勝率 {winRate}%</span>}
                    {finishRate !== null && <span>フィニッシュ率 {finishRate}%</span>}
                  </div>
                </>
              )}
            </a>
          );
        })}
      </div>
      )}
    </>
  );
}
