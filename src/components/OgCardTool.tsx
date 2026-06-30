"use client";

import { useState } from "react";

interface FighterOption {
  slug: string;
  nameJa: string;
}

const SITE_URL = "https://www.mnews.jp";

export default function OgCardTool({ fighters }: { fighters: FighterOption[] }) {
  const [mode, setMode] = useState<"single" | "vs">("single");
  const [slugA, setSlugA] = useState(fighters[0]?.slug ?? "");
  const [slugB, setSlugB] = useState(fighters[1]?.slug ?? "");
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
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            画像URL（X投稿に直接貼ると画像がそのままカード表示されます）
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
          </div>
        </div>

        {pageUrl && (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              選手ページURL（こちらを貼ると上の画像が自動でカード表示されます。通常はこちらを共有してください）
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
            </div>
          </div>
        )}

        {mode === "vs" && (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            ※ 対戦カードはまだ専用ページがないため、画像URLを直接貼り付けてください
            （Xはリンク末尾が画像ファイルだと自動でカード表示します）。
          </p>
        )}
      </div>
    </div>
  );
}
