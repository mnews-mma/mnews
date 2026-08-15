"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
}

const MAX_RESULTS = 30;

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
  const [open, setOpen] = useState(false);
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

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q || !index) return [];
    const hits: SearchEntry[] = [];
    for (const f of index) {
      if (
        normalize(f.name).includes(q) ||
        (f.kana && normalize(f.kana).includes(q)) ||
        (f.romaji && normalize(f.romaji).includes(q)) ||
        (f.gym && normalize(f.gym).includes(q)) ||
        (f.realname && normalize(f.realname).includes(q))
      ) {
        hits.push(f);
        if (hits.length >= MAX_RESULTS) break;
      }
    }
    return hits;
  }, [query, index]);

  const totalCount = useMemo(() => {
    if (!query.trim() || !index) return 0;
    const q = normalize(query.trim());
    let n = 0;
    for (const f of index) {
      if (
        normalize(f.name).includes(q) ||
        (f.kana && normalize(f.kana).includes(q)) ||
        (f.romaji && normalize(f.romaji).includes(q)) ||
        (f.gym && normalize(f.gym).includes(q)) ||
        (f.realname && normalize(f.realname).includes(q))
      ) {
        n++;
      }
    }
    return n;
  }, [query, index]);

  return (
    <div className="kick-search" ref={boxRef}>
      <input
        type="search"
        className="kick-search__input"
        placeholder={index ? "選手名・かな・ローマ字・所属で検索" : "検索を読み込み中…"}
        value={query}
        disabled={!index}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="選手検索"
      />
      {open && query.trim() && (
        <div className="kick-search__panel">
          {results.length === 0 ? (
            <p className="kick-search__empty">「{query}」に一致する選手が見つかりません。</p>
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
                <p className="kick-search__more">
                  ほか{(totalCount - results.length).toLocaleString("ja-JP")}件。絞り込みを続けてください。
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
