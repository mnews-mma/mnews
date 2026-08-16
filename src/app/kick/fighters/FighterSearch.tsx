"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * /kick/fighters の検索UI。
 *
 * - 索引(public/kick/search-index.json)はビルド時に scripts/build-kick-data.ts が焼き込む
 *   静的アセット。ここではクライアント側でfetchして絞り込むだけで、サーバー処理は増やさない。
 * - 下に並ぶ五十音順の全選手リスト(サーバーでレンダリングされる2,482件の<a href>)は一切変更しない。
 *   このコンポーネントはその上に載る検索窓+結果パネルのみで、JSが動かないクローラーには
 *   入力欄が見えるだけで実質何もしない(既存の生HTMLリストがそのまま到達可能であり続ける)。
 */

interface SearchEntry {
  slug: string;
  name: string;
  kana: string | null;
  romaji: string | null;
  gym: string | null;
  /** ja.wikipedia|realname=由来の本名。一致キーとしてのみ使い、画面には出さない。 */
  realname?: string;
  /** 出場団体(戦績の出典団体、build-kick-data.tsのtag)。未出場の場合はキー自体を持たない。
   *  名簿の掲載元(6ソース)とは別概念 — 選手が実際にboutを持つ団体の一覧。 */
  orgs?: string[];
}

const MAX_RESULTS = 30;

/** 出場団体フィルタの選択肢。scripts/build-kick-data.ts の boutFiles と同じ tag・順序。
 *  クライアント側にfsを持ち込めないため(@/lib/kick/data.tsはNode専用)、ここで複製する。 */
const ORG_OPTIONS: { tag: string; label: string }[] = [
  { tag: "sb", label: "SHOOT BOXING" },
  { tag: "rise", label: "RISE" },
  { tag: "knockout", label: "KNOCK OUT" },
  { tag: "k1", label: "K-1 / Krush / Krush-EX" },
  { tag: "rizin", label: "RIZIN" },
  { tag: "one", label: "ONE Championship" },
  { tag: "deepkick", label: "DEEP☆KICK" },
  { tag: "njkf", label: "NJKF" },
  { tag: "hoostcup", label: "HoostCup" },
  { tag: "nkb", label: "NKB" },
  { tag: "bigbang", label: "Bigbang" },
  { tag: "standup", label: "Stand up" },
  { tag: "krossover", label: "KROSS×OVER" },
  { tag: "snka", label: "新日本キックボクシング協会(SNKA)" },
  { tag: "jka", label: "JKA" },
];

function normalize(s: string): string {
  // ひらがな→カタカナに寄せてから比較する(索引側のかなは全てカタカナのため、
  // ひらがな入力でも「かな」検索がヒットするようにする)。姓名間のスペース(半角/全角)は
  // 索引側の値(「愛鷹 亮」「後藤 亮」等、姓名間にスペースが入る)と入力側の有無が揃わない
  // ことが多いため除去して比較する(「愛鷹亮」でも「愛鷹 亮」でもヒットするようにする)。
  return s
    .normalize("NFKC")
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s　]/g, "")
    .toLowerCase();
}

export default function FighterSearch() {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [org, setOrg] = useState(""); // "" = 団体指定なし(全団体)
  const [open, setOpen] = useState(false);
  // 候補パネルに表示する件数の上限。「もっと見る」で30件ずつ広げる(検索条件を変えたら
  // MAX_RESULTSへ戻す)。団体のみでの絞り込み(例: RIZIN 111人)でも、クリックを重ねれば
  // 全員に到達できるようにするため、totalCountで頭打ちにはしない。
  const [visibleCount, setVisibleCount] = useState(MAX_RESULTS);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/kick/search-index.json")
      .then((r) => r.json())
      .then((data: SearchEntry[]) => {
        if (!cancelled) setIndex(data);
      })
      .catch(() => {
        // 索引の取得に失敗しても下の静的リストは無傷なので、検索欄を黙って諦めるだけでよい。
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // テキスト未入力でも団体だけでの絞り込みを許す(単独フィルタ)。両方指定時はAND。
  const matches = useCallback(
    (f: SearchEntry, q: string): boolean => {
      if (org && !f.orgs?.includes(org)) return false;
      if (!q) return true;
      return (
        normalize(f.name).includes(q) ||
        (f.kana != null && normalize(f.kana).includes(q)) ||
        (f.romaji != null && normalize(f.romaji).includes(q)) ||
        (f.gym != null && normalize(f.gym).includes(q)) ||
        (f.realname != null && normalize(f.realname).includes(q))
      );
    },
    [org],
  );

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!index || (!q && !org)) return [];
    const hits: SearchEntry[] = [];
    for (const f of index) {
      if (matches(f, q)) {
        hits.push(f);
        if (hits.length >= visibleCount) break;
      }
    }
    return hits;
  }, [query, org, index, matches, visibleCount]);

  const totalCount = useMemo(() => {
    const q = normalize(query.trim());
    if (!index || (!q && !org)) return 0;
    let n = 0;
    for (const f of index) if (matches(f, q)) n++;
    return n;
  }, [query, org, index, matches]);

  const queryTrimmed = query.trim();
  const orgLabel = ORG_OPTIONS.find((o) => o.tag === org)?.label ?? "";
  const emptyMessage = queryTrimmed && org
    ? `${orgLabel}に出場していて「${queryTrimmed}」に一致する選手が見つかりません。`
    : queryTrimmed
      ? `「${queryTrimmed}」に一致する選手が見つかりません。`
      : `${orgLabel}に出場した選手が見つかりません。`;

  return (
    <div className="kick-search" ref={boxRef}>
      <div className="kick-search__row">
        <input
          type="search"
          className="kick-search__input"
          placeholder={index ? "選手名・かな・ローマ字・所属で検索" : "検索を読み込み中…"}
          value={query}
          disabled={!index}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleCount(MAX_RESULTS);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="選手検索"
        />
        <select
          className="kick-search__org"
          value={org}
          disabled={!index}
          onChange={(e) => {
            setOrg(e.target.value);
            setVisibleCount(MAX_RESULTS);
            setOpen(true);
          }}
          aria-label="出場団体で絞り込み"
        >
          <option value="">すべての団体</option>
          {ORG_OPTIONS.map((o) => (
            <option key={o.tag} value={o.tag}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {open && (queryTrimmed || org) && (
        <div className="kick-search__panel">
          {results.length === 0 ? (
            <p className="kick-search__empty">{emptyMessage}</p>
          ) : (
            <>
              <ul className="kick-search__list">
                {results.map((f) => (
                  <li key={f.slug}>
                    <Link href={`/kick/fighters/${encodeURIComponent(f.slug)}`} onClick={() => setOpen(false)}>
                      <span className="kick-search__name">{f.name}</span>
                      {f.kana && <span className="kick-search__kana">{f.kana}</span>}
                      {f.gym && <span className="kick-search__gym">{f.gym}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              {totalCount > results.length && (
                <button
                  type="button"
                  className="kick-search__more"
                  onClick={() => setVisibleCount((n) => n + MAX_RESULTS)}
                >
                  もっと見る(あと{(totalCount - results.length).toLocaleString("ja-JP")}件)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
