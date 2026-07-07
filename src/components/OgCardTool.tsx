"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ogImagePath } from "@/lib/ogShared";

interface FighterOption {
  slug: string;
  nameJa: string;
}

const SITE_URL = "https://www.mnews.jp";

// カードに手指定できる階級プルダウンの5階級。加えて「自由入力」で任意テキスト可。
const WEIGHT_PRESETS = ["フライ級", "バンタム級", "フェザー級", "ライト級", "ヘビー級"];
const CUSTOM = "__custom__";

export default function OgCardTool({ fighters }: { fighters: FighterOption[] }) {
  const searchParams = useSearchParams();
  const initialFighter = searchParams.get("fighter") ?? fighters[0]?.slug ?? "";
  const [mode, setMode] = useState<"single" | "vs">("single");
  const [slugA, setSlugA] = useState(initialFighter);
  const [slugB, setSlugB] = useState(fighters[1]?.slug ?? "");
  // 階級ラベル(手指定)。プルダウン(5階級 or 自由入力)＋自由記述テキスト。
  const [wcPreset, setWcPreset] = useState<string>("");
  const [wcCustom, setWcCustom] = useState<string>("");
  // 選手増加でプルダウンが長くなったため、フリーワード検索(部分一致)で絞り込む。
  // 選択肢自体は既存のプルダウンのまま(絞り込みは表示するoptionを減らすだけ)。
  const [filterA, setFilterA] = useState("");
  const [filterB, setFilterB] = useState("");
  const fightersA = useMemo(
    () => (filterA.trim() ? fighters.filter((f) => f.nameJa.includes(filterA.trim())) : fighters),
    [fighters, filterA]
  );
  const fightersB = useMemo(
    () => (filterB.trim() ? fighters.filter((f) => f.nameJa.includes(filterB.trim())) : fighters),
    [fighters, filterB]
  );

  useEffect(() => {
    const f = searchParams.get("fighter");
    if (f && fighters.some((x) => x.slug === f)) setSlugA(f);
  }, [searchParams, fighters]);
  const [copied, setCopied] = useState<"image" | "page" | null>(null);

  // 空欄なら wc パラメータを付けない → OG画像側は階級行を出さない。
  const wcLabel = (wcPreset === CUSTOM ? wcCustom : wcPreset).trim();
  const wcQuery = wcLabel ? `?wc=${encodeURIComponent(wcLabel)}` : "";

  const imagePath = ogImagePath(
    (mode === "single" ? `/api/og/fighter/${slugA}` : `/api/og/vs/${slugA}/${slugB}`) + wcQuery
  );
  const pagePath = (mode === "single" ? `/fighters/${slugA}` : `/vs/${slugA}/${slugB}`) + wcQuery;
  const imageUrl = `${SITE_URL}${imagePath}`;
  const pageUrl = `${SITE_URL}${pagePath}`;

  const copy = (text: string, which: "image" | "page") => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const postToX = (url: string) => {
    window.open(`https://x.com/intent/post?url=${encodeURIComponent(url)}`, "_blank");
  };

  return (
    <div style={{ padding: "0 24px 40px" }}>
      <div className="fighter-filter-bar">
        <div className="fighter-filter-group">
          <span className="fighter-filter-label">種類</span>
          <button
            className={`fighter-filter-chip ${mode === "single" ? "active" : ""}`}
            onClick={() => setMode("single")}
          >
            選手1人カード
          </button>
          <button className={`fighter-filter-chip ${mode === "vs" ? "active" : ""}`} onClick={() => setMode("vs")}>
            対戦カード（VS）
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "16px 24px" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
            選手{mode === "vs" ? "A" : ""}
          </label>
          <input
            type="text"
            value={filterA}
            onChange={(e) => setFilterA(e.target.value)}
            placeholder="選手名で検索"
            style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
          />
          <select
            value={slugA}
            onChange={(e) => setSlugA(e.target.value)}
            style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}
          >
            {fightersA.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.nameJa}
              </option>
            ))}
          </select>
        </div>

        {mode === "vs" && (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <button
                onClick={() => { setSlugA(slugB); setSlugB(slugA); }}
                title="AとBを入れ替え"
                style={{ padding: "8px 10px", fontSize: 16, lineHeight: 1 }}
              >
                ⇄
              </button>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>選手B</label>
              <input
                type="text"
                value={filterB}
                onChange={(e) => setFilterB(e.target.value)}
                placeholder="選手名で検索"
                style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
              />
              <select
                value={slugB}
                onChange={(e) => setSlugB(e.target.value)}
                style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}
              >
                {fightersB.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.nameJa}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* 階級ラベル(手指定)。5階級をワンタップ or 自由入力で任意テキスト。空欄=カードに階級を出さない。 */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
            階級ラベル（任意）
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={wcPreset}
              onChange={(e) => setWcPreset(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 14, minWidth: 160 }}
            >
              <option value="">（なし）</option>
              {WEIGHT_PRESETS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
              <option value={CUSTOM}>自由入力…</option>
            </select>
            {wcPreset === CUSTOM && (
              <input
                type="text"
                value={wcCustom}
                onChange={(e) => setWcCustom(e.target.value)}
                placeholder="例: フライ級マッチ / キャッチウェイト"
                style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px" }}>
        <img
          src={imagePath}
          alt="OGプレビュー"
          style={{ width: "100%", maxWidth: 800, border: "1px solid var(--border)", display: "block" }}
        />
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {mode === "single" && pageUrl && (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              シェアURL（Xに貼るとカードが自動で表示されます）
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={pageUrl}
                style={{ flex: 1, padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 13 }}
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => copy(pageUrl, "page")} style={{ padding: "8px 16px" }}>
                {copied === "page" ? "コピーしました" : "コピー"}
              </button>
              <button
                onClick={() => postToX(pageUrl)}
                style={{ padding: "8px 16px", background: "#000", color: "#fff", border: "none", cursor: "pointer", borderRadius: 4, fontWeight: 700 }}
              >
                𝕏 に投稿
              </button>
            </div>
          </div>
        )}

        {mode === "vs" && (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              シェアURL（Xに貼るとカードが自動で表示されます）
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={pageUrl}
                style={{ flex: 1, padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 13 }}
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => copy(pageUrl, "page")} style={{ padding: "8px 16px" }}>
                {copied === "page" ? "コピーしました" : "コピー"}
              </button>
              <button
                onClick={() => postToX(pageUrl)}
                style={{ padding: "8px 16px", background: "#000", color: "#fff", border: "none", cursor: "pointer", borderRadius: 4, fontWeight: 700 }}
              >
                𝕏 に投稿
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
