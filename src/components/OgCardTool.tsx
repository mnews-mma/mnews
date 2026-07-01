"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface FighterOption {
  slug: string;
  nameJa: string;
}

const SITE_URL = "https://www.mnews.jp";

export default function OgCardTool({ fighters }: { fighters: FighterOption[] }) {
  const searchParams = useSearchParams();
  const initialFighter = searchParams.get("fighter") ?? fighters[0]?.slug ?? "";
  const [mode, setMode] = useState<"single" | "vs">("single");
  const [slugA, setSlugA] = useState(initialFighter);
  const [slugB, setSlugB] = useState(fighters[1]?.slug ?? "");

  useEffect(() => {
    const f = searchParams.get("fighter");
    if (f && fighters.some((x) => x.slug === f)) setSlugA(f);
  }, [searchParams, fighters]);
  const [copied, setCopied] = useState<"image" | "page" | null>(null);

  const imagePath = mode === "single" ? `/api/og/fighter/${slugA}` : `/api/og/vs/${slugA}/${slugB}`;
  const pagePath = mode === "single" ? `/fighters/${slugA}` : null;
  const imageUrl = `${SITE_URL}${imagePath}`;
  const pageUrl = pagePath ? `${SITE_URL}${pagePath}` : null;

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
          <select
            value={slugA}
            onChange={(e) => setSlugA(e.target.value)}
            style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}
          >
            {fighters.map((f) => (
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
              <select
                value={slugB}
                onChange={(e) => setSlugB(e.target.value)}
                style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}
              >
                {fighters.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.nameJa}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
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
                value={imageUrl}
                style={{ flex: 1, padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 13 }}
                onFocus={(e) => e.target.select()}
              />
              <button onClick={() => copy(imageUrl, "image")} style={{ padding: "8px 16px" }}>
                {copied === "image" ? "コピーしました" : "コピー"}
              </button>
              <button
                onClick={() => postToX(imageUrl)}
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
