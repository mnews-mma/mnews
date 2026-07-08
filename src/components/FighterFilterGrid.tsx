"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { calcFighterRates } from "@/lib/fighters";
import { SOURCES } from "@/lib/sources";
import { ResolvedFighter } from "@/lib/feeds/resolveFighter";
import type { OrgTag, OrgTagKey } from "@/lib/orgTags";
import { weightSortKey } from "@/lib/weightClasses";

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

const TAG_COLOR: Record<OrgTagKey, string> = {
  ufc: SOURCES.ufc.color,
  rizin: SOURCES.rizin.color,
  deep: SOURCES.deep.color,
  pancrase: SOURCES.pancrase.color,
  shooto: SOURCES.shooto.color,
  one: SOURCES.one.color,
};

// 団体の並び順(選手ソートの第2キーにも使う): UFC → RIZIN → DEEP → パンクラス → 修斗 → ONE
const ORG_SORT_ORDER: Record<string, number> = {
  ufc: 0,
  rizin: 1,
  deep: 2,
  pancrase: 3,
  shooto: 4,
  one: 5,
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

// 半角/全角スペースを除いて正規化する(fighters.tsのnormNameForMatchと同じ思想)。
// DB内の一部選手(nameJaに「平良 達郎」のような半角スペースを含む)を、
// スペース無しで検索した時に取りこぼす不整合を防ぐため、クエリ・比較対象の
// 双方をこの関数に通してから比較する。
function normNameForSearch(s: string): string {
  return s.replace(/[\s　]/g, "");
}

// 検索用の事前正規化済みインデックス。選手ごとの文字列変換(カナ変換等)は
// fighters(props)が変わった時に1回だけ計算し、入力のたびには行わない
// (検索が重くなる主因になり得るため)。
interface SearchEntry {
  f: ResolvedFighter;
  nameJa: string;
  nameJaNorm: string;
  nameEn: string;
}
function buildSearchIndex(fighters: ResolvedFighter[]): SearchEntry[] {
  return fighters.map((f) => ({
    f,
    nameJa: f.nameJa,
    nameJaNorm: normNameForSearch(f.nameJa),
    nameEn: f.nameEn.toLowerCase(),
  }));
}

// 名前検索(日本語名・カナ・ローマ字を横断照合)。団体・階級は対象外(既存フィルタの役割)。
// qKata/qHira/qLower は呼び出し側で既にnormNameForSearch済みの値を渡すこと。
function matchesNameSearch(entry: SearchEntry, qRaw: string, qKata: string, qHira: string, qLower: string): boolean {
  if (!qRaw) return true;
  return (
    entry.nameJaNorm.includes(qRaw) ||
    entry.nameJaNorm.includes(qKata) ||
    entry.nameJaNorm.includes(qHira) ||
    entry.nameEn.includes(qLower)
  );
}

// フィルタ状態(階級/団体/検索語)はURLのクエリパラメータを唯一の情報源(source of
// truth)にする。チップの選択表示・実フィルタの両方をローカルstateから導出し、
// 戻る/進むではsearchParamsの変化を検知してローカルstateを再同期する。
//
// URL反映は Next の router.replace() ではなく history.replaceState() を直接使う。
// /fighters は dynamic="force-dynamic" のため、router.replace() で同一ルートへ
// 遷移すると毎回サーバでページ全体(getVisibleFighters等)が再実行され、
// 検索1文字ごとにサーバ往復が発生してスマホで顕著に遅くなっていた
// (フィルタ結果自体はクライアント側の fighters props だけで完結し、サーバ再取得は
// 本来不要)。history.replaceState はNextのナビゲーションを経由しないため、
// この不要な再取得を発生させない。戻る/進むは実ブラウザナビゲーションなので
// 従来どおりNext側のsearchParams変化として検知できる。
const PARAM_WEIGHT = "weight";
const PARAM_ORG = "org";
const PARAM_Q = "q";
const QUERY_SYNC_DEBOUNCE_MS = 200;

export default function FighterFilterGrid({
  fighters,
  tagsBySlug = {},
}: {
  fighters: ResolvedFighter[];
  tagsBySlug?: Record<string, OrgTag[]>;
}) {
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

  // 検索語は入力のたびにURL同期すると history.replaceState 呼び出しが増えるだけ
  // でなく、searchParams参照が変わるたびに依存する他処理も揺れるため、確定入力
  // まで少し待ってから反映する(体感速度そのものは下のfilteredがローカルstate
  // 直結で即時反映するため、ここは表示ではなくURL永続化専用の遅延)。
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => syncUrl({ q: v || null }), QUERY_SYNC_DEBOUNCE_MS);
  }
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

  const searchIndex = useMemo(() => buildSearchIndex(fighters), [fighters]);

  // 階級フィルタの選択肢は実際にDBへ存在する階級だけを、共有の体重ソートキーで
  // 並べて出す(配列順・追加順に依存しない。後から階級を足しても正しい位置に入る)。
  const weightOptions = useMemo(() => {
    const set = new Set(fighters.map((f) => f.weightClass === "メガトン級" ? "ヘビー級" : f.weightClass));
    return Array.from(set).sort((a, b) => weightSortKey(a) - weightSortKey(b));
  }, [fighters]);

  const filtered = useMemo(() => {
    // 検索クエリも比較対象(entry.nameJaNorm)と同じ基準でスペース除去してから
    // 照合する(M4: 「平良達郎」で「平良 達郎」がヒットしない取りこぼしの修正)。
    const qRaw = normNameForSearch(query.trim());
    const qKata = qRaw ? toKatakana(qRaw) : "";
    const qHira = qRaw ? toHiragana(qRaw) : "";
    const qLower = qRaw ? qRaw.toLowerCase() : "";

    return searchIndex
      .filter((entry) => {
        const f = entry.f;
        if (!matchesWeightFilter(f.weightClass, weightClass)) return false;
        if (tag && !(tagsBySlug[f.slug] || []).some((t) => t.key === tag)) return false;
        if (!matchesNameSearch(entry, qRaw, qKata, qHira, qLower)) return false;
        return true;
      })
      .map((entry) => entry.f)
      .sort((a, b) => {
        // 第1キー: 階級(共有の体重ソートキー) / 第2キー: 団体(UFC→RIZIN→DEEP→パンクラス→修斗→ONE)
        const wa = weightSortKey(a.weightClass);
        const wb = weightSortKey(b.weightClass);
        if (wa !== wb) return wa - wb;
        const orgA = ORG_SORT_ORDER[a.org] ?? 9;
        const orgB = ORG_SORT_ORDER[b.org] ?? 9;
        return orgA - orgB;
      });
  }, [searchIndex, weightClass, tag, tagsBySlug, query]);

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
          <button
            className={`fighter-filter-chip ${tag === null ? "active" : ""}`}
            onClick={() => handleOrgChange(null)}
          >
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
