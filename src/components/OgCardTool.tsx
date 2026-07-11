"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ogImagePath } from "@/lib/ogShared";
import { weightSortKey } from "@/lib/weightClasses";
import { openXShare } from "@/lib/xShare";

interface FighterOption {
  slug: string;
  nameJa: string;
}

const SITE_URL = "https://www.mnews.jp";

// カードに手指定できる階級プルダウン。/fighters と同じ並び順(共有のweightSortKey)。
// 加えて「自由入力」で任意テキストも可。
// 女子2階級(アトム級・女子スーパーアトム級)はweightSortKeyのキー("女子アトム級"等)と
// 表記が異なるため個別ソート対象外(=男子階級のみソートし、女子2階級は末尾に軽い→
// 重いの順で固定)。ラベルはこのプルダウン選択肢限定の見せ方であり、選手/イベントの
// 階級マスタ(fighters.ts等)には触れない。
const WEIGHT_PRESETS = [
  ...["ストロー級", "フライ級", "バンタム級", "フェザー級", "ライト級", "ウェルター級", "ヘビー級"].sort(
    (a, b) => weightSortKey(a) - weightSortKey(b)
  ),
  "アトム級",
  "女子スーパーアトム級（49.0kg）",
];
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
  // 大会名(手指定・任意)。例: 超RIZIN.5。空欄ならカードに大会名行を出さない。
  const [eventName, setEventName] = useState<string>("");
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

  // 検索フィルタで選択肢を絞り込んだ結果、現在選択中のslugがフィルタ後のリストから
  // 消えると、ネイティブ<select>は残った先頭optionを勝手に表示してしまう(ブラウザの
  // 挙動でReactのonChangeを経由しない)。表示とstateが乖離し、見た目は選択済みでも
  // 実際のstate(=カード/URL生成に使う値)は古いままになるバグがあったため、
  // フィルタ変更のたびに「表示される先頭候補」へstateを明示的に同期する。
  useEffect(() => {
    if (fightersA.length > 0 && !fightersA.some((f) => f.slug === slugA)) {
      setSlugA(fightersA[0].slug);
    }
  }, [fightersA, slugA]);
  useEffect(() => {
    if (fightersB.length > 0 && !fightersB.some((f) => f.slug === slugB)) {
      setSlugB(fightersB[0].slug);
    }
  }, [fightersB, slugB]);
  const [copied, setCopied] = useState<"image" | "page" | null>(null);

  // 空欄なら wc/ev パラメータを付けない → OG画像側はその行を出さない。
  // 大会名(ev)は対戦カード(VS)専用(個人カードのOGルートは非対応のため送らない)。
  const wcLabel = (wcPreset === CUSTOM ? wcCustom : wcPreset).trim();
  const query = new URLSearchParams();
  if (wcLabel) query.set("wc", wcLabel);
  if (mode === "vs" && eventName.trim()) query.set("ev", eventName.trim());
  const qs = query.toString();
  const queryStr = qs ? `?${qs}` : "";

  const imagePath = ogImagePath(
    (mode === "single" ? `/api/og/fighter/${slugA}` : `/api/og/vs/${slugA}/${slugB}`) + queryStr
  );
  const pagePath = (mode === "single" ? `/fighters/${slugA}` : `/vs/${slugA}/${slugB}`) + queryStr;
  const imageUrl = `${SITE_URL}${imagePath}`;
  const pageUrl = `${SITE_URL}${pagePath}`;

  // VSモード専用のX投稿文。「もし{大会名}で「A vs B」が実現したら——」
  // (大会名未入力なら「もし「A vs B」が実現したら——」に短縮)。
  const nameA = fighters.find((f) => f.slug === slugA)?.nameJa ?? slugA;
  const nameB = fighters.find((f) => f.slug === slugB)?.nameJa ?? slugB;
  const vsPostText = eventName.trim()
    ? `もし${eventName.trim()}で「${nameA} vs ${nameB}」が実現したら——`
    : `もし「${nameA} vs ${nameB}」が実現したら——`;

  const copy = (text: string, which: "image" | "page") => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const postToX = (url: string) => {
    openXShare({ url });
  };

  // VSモード専用。本文(text)とシェアURL(url)を分離してintentに渡す
  // (urlはXがOGカードを描画するために必須なので必ず末尾に付ける)。
  const postToXWithText = (text: string, url: string) => {
    openXShare({ text, url });
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
                onClick={() => {
                  setSlugA(slugB);
                  setSlugB(slugA);
                  // フィルタ文字列も一緒に入れ替える。入れ替えないと、片方の検索窓の
                  // 絞り込みテキストが新しい選手と一致せず、直後の自動補正effectが
                  // スワップ結果を即座に上書きしてしまう。
                  setFilterA(filterB);
                  setFilterB(filterA);
                }}
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

        {/* 大会名(手指定・任意)。対戦カード(VS)専用。MATCH UPラベルの上に
            軽量なサブラインとして表示される。空欄ならカードに出さない。 */}
        {mode === "vs" && (
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              大会名（任意）
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="例: 超RIZIN.5"
              style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}
            />
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
                onClick={() => postToXWithText(vsPostText, pageUrl)}
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
