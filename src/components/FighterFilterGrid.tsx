"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { OrgTagKey } from "@/lib/orgTags";

// 団体フィルタ(並び順固定)。UFC/RIZINは既存公開選手のみ、DEEP/パンクラス/修斗/ONEは
// 新規公開昇格分に付与(computeFighterTags側で制御)。
const TAG_OPTIONS: { key: OrgTagKey; label: string }[] = [
  { key: "ufc", label: "UFC" },
  { key: "rizin", label: "RIZIN" },
  { key: "deep", label: "DEEP" },
  { key: "pancrase", label: "パンクラス" },
  { key: "shooto", label: "修斗" },
  { key: "one", label: "ONE" },
];

// ひらがな⇔カタカナの単純変換(Unicode範囲シフト)。入力の表記ゆれ(「ぐすたぼ」/
// 「グスタボ」)を吸収するために使う。読み仮名データを持たない漢字名は対象外
// (例:「平良達郎」はひらがな入力では引っかからない=データが無い以上の裏取りはしない)。
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// 半角/全角スペースを除いて正規化する(FighterCardGrid.tsxのdata-name-ja属性と
// 同じ正規化ルール)。DB内の一部選手(nameJaに「平良 達郎」のような半角スペースを
// 含む)を、スペース無しで検索した時に取りこぼす不整合を防ぐため、クエリ側もこの
// 関数を通してから比較する。
function normNameForSearch(s: string): string {
  return s.replace(/[\s　]/g, "");
}

// フィルタ状態(階級/団体/検索語)はURLのクエリパラメータを唯一の情報源(source of
// truth)にする。チップの選択表示・実フィルタの両方をローカルstateから導出し、
// 戻る/進むではsearchParamsの変化を検知してローカルstateを再同期する。
//
// URL反映は Next の router.replace() ではなく history.replaceState() を直接使う。
// /fighters は revalidate=3600(ISR)のため、router.replace() で同一ルートへ
// 遷移すると毎回サーバでページ全体(getVisibleFighters等)が再実行され、
// 検索1文字ごとにサーバ往復が発生してスマホで顕著に遅くなっていた
// (フィルタ結果自体はこのコンポーネントのローカルstateとDOM操作だけで完結し、
// サーバ再取得は本来不要)。history.replaceState はNextのナビゲーションを経由
// しないため、この不要な再取得を発生させない。戻る/進むは実ブラウザナビゲーション
// なので従来どおりNext側のsearchParams変化として検知できる。
const PARAM_WEIGHT = "weight";
const PARAM_ORG = "org";
const PARAM_Q = "q";
const QUERY_SYNC_DEBOUNCE_MS = 200;

// カードグリッドの実描画はFighterCardGrid.tsx(Server Component、Suspense境界の
// 外)が担う。このコンポーネントは検索入力・階級/団体チップ(UI+フィルタ状態管理)
// のみを持ち、フィルタの適用は既存DOM(.fighter-card)のdata属性を見て
// classList.toggle("is-filtered-out", ...)する方式に切り替える
// (out/fighters-index-ssr-feasibility.md 案1)。
function applyFiltersToDom(weightClass: string | null, tag: OrgTagKey | null, query: string) {
  if (typeof document === "undefined") return;

  const qRaw = normNameForSearch(query.trim());
  const qKata = qRaw ? toKatakana(qRaw) : "";
  const qHira = qRaw ? toHiragana(qRaw) : "";
  const qLower = qRaw ? qRaw.toLowerCase() : "";

  const cards = document.querySelectorAll<HTMLElement>(".fighter-card");
  let visibleCount = 0;
  cards.forEach((card) => {
    const w = card.dataset.weight ?? "";
    const orgs = (card.dataset.orgs ?? "").split(",").filter(Boolean);
    const nameJa = card.dataset.nameJa ?? "";
    const nameEn = card.dataset.nameEn ?? "";

    const matchesWeight = !weightClass || w === weightClass;
    const matchesOrg = !tag || orgs.includes(tag);
    const matchesQuery =
      !qRaw || nameJa.includes(qRaw) || nameJa.includes(qKata) || nameJa.includes(qHira) || nameEn.includes(qLower);
    const visible = matchesWeight && matchesOrg && matchesQuery;

    card.classList.toggle("is-filtered-out", !visible);
    if (visible) visibleCount++;
  });

  const gridEl = document.getElementById("fighter-grid");
  if (gridEl) gridEl.style.display = visibleCount === 0 ? "none" : "";
  const emptyEl = document.getElementById("fighter-empty-message");
  if (emptyEl) emptyEl.style.display = visibleCount === 0 ? "" : "none";
}

export default function FighterFilterGrid({ weightOptions }: { weightOptions: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [weightClass, setWeightClass] = useState<string | null>(searchParams.get(PARAM_WEIGHT));
  const [tag, setTag] = useState<OrgTagKey | null>(searchParams.get(PARAM_ORG) as OrgTagKey | null);
  const [query, setQuery] = useState<string>(searchParams.get(PARAM_Q) ?? "");

  // 戻る/進む(実ナビゲーション)でURLが変わった時だけローカルstateを再同期する。
  useEffect(() => {
    setWeightClass(searchParams.get(PARAM_WEIGHT));
    setTag(searchParams.get(PARAM_ORG) as OrgTagKey | null);
    setQuery(searchParams.get(PARAM_Q) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // フィルタ状態が変わるたびに実DOM(FighterCardGrid.tsxが描画した.fighter-card群)
  // へ反映する。useLayoutEffectでペイント前に適用し、マウント直後の「全件表示→
  // フィルタ後に絞り込み」のちらつきを最小化する。
  useLayoutEffect(() => {
    applyFiltersToDom(weightClass, tag, query);
  }, [weightClass, tag, query]);

  // 検索語は入力のたびにURL同期すると history.replaceState 呼び出しが増えるだけ
  // でなく、searchParams参照が変わるたびに依存する他処理も揺れるため、確定入力
  // まで少し待ってから反映する(体感速度そのものはuseLayoutEffectでローカルstate
  // 直結・即時反映するため、ここは表示ではなくURL永続化専用の遅延)。
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => syncUrl({ q: v || null }), QUERY_SYNC_DEBOUNCE_MS);
  }

  function syncUrl(next: { weight?: string | null; org?: string | null; q?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    const apply = (key: string, v: string | null | undefined) => {
      if (v === undefined) return;
      if (v) params.set(key, v);
      else params.delete(key);
    };
    apply(PARAM_WEIGHT, next.weight);
    apply(PARAM_ORG, next.org);
    apply(PARAM_Q, next.q);
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(window.history.state, "", url);
  }

  // ヘッダーの虫眼鏡アイコン(/fighters?focus=1)からの着地時のみ検索入力に
  // オートフォーカスする(mnews-homepage-instructions.md §4.1)。他の遷移元
  // (関連選手タグ等)からの通常アクセスでは、モバイルで意図せずキーボードが
  // 開くのを避けるためフォーカスしない。
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (searchParams.get("focus") === "1") searchInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleWeightChange(v: string | null) {
    setWeightClass(v);
    syncUrl({ weight: v });
  }
  function handleOrgChange(v: OrgTagKey | null) {
    setTag(v);
    syncUrl({ org: v });
  }

  return (
    <div className="fighter-filter-bar">
      <div className="fighter-filter-group">
        <span className="fighter-filter-label">検索</span>
        <input
          ref={searchInputRef}
          type="text"
          className="fighter-search-input"
          placeholder="選手名で検索（日本語・カナ・ローマ字）"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
      </div>
      <div className="fighter-filter-group">
        <span className="fighter-filter-label">階級</span>
        <button
          className={`fighter-filter-chip ${weightClass === null ? "active" : ""}`}
          onClick={() => handleWeightChange(null)}
        >
          すべて
        </button>
        {weightOptions.map((w) => (
          <button
            key={w}
            className={`fighter-filter-chip ${weightClass === w ? "active" : ""}`}
            onClick={() => handleWeightChange(w)}
          >
            {w.replace("級", "")}
          </button>
        ))}
      </div>
      <div className="fighter-filter-group">
        <span className="fighter-filter-label">団体</span>
        <button className={`fighter-filter-chip ${tag === null ? "active" : ""}`} onClick={() => handleOrgChange(null)}>
          すべて
        </button>
        {TAG_OPTIONS.map((t) => (
          <button
            key={t.key}
            className={`fighter-filter-chip ${tag === t.key ? "active" : ""}`}
            onClick={() => handleOrgChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
