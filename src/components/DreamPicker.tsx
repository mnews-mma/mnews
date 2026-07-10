"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

interface FighterOption {
  slug: string;
  nameJa: string;
}

// 夢のカードの選手A/B選択UI。既存のXカードツール(OgCardTool.tsx)の対戦カード
// (VS)モードで実運用済み・過去のindex取り違えバグ修正済みのパターンをそのまま
// 踏襲する: 選択は必ずslug単位でstate保持(single source of truth)し、配列indexは
// 一切使わない。カード生成もシェアURLもこのslugA/slugBから導く(表示用stateと
// 生成用stateを分けない)。
export default function DreamPicker({
  fighters,
  initialA,
  initialB,
}: {
  fighters: FighterOption[];
  initialA: string;
  initialB: string;
}) {
  const router = useRouter();
  const [slugA, setSlugA] = useState(initialA);
  const [slugB, setSlugB] = useState(initialB);
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

  // 検索フィルタで選択肢を絞り込んだ結果、現在選択中のslugがフィルタ後のリストから
  // 消えると、ネイティブ<select>は残った先頭optionを勝手に表示してしまい、見た目は
  // 選択済みでもstate(=カード/URL生成に使う値)は古いままになる(過去のドリーム
  // マッチジェネレーターで実際に発生したバグ)。フィルタ変更のたびに「表示される
  // 先頭候補」へstateを明示的に同期する。
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

  // slugA/slugBの変更をURL(?a=&b=)に反映し、サーバー側の対戦カード生成を
  // 再実行させる。初回マウント時(サーバーから渡された初期値と同一)は
  // 無駄なnavigationを起こさないためスキップする。
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!slugA || !slugB) return;
    const params = new URLSearchParams({ a: slugA, b: slugB });
    router.replace(`/dream?${params.toString()}`, { scroll: false });
  }, [slugA, slugB, router]);

  const swap = () => {
    const a = slugA;
    const b = slugB;
    setSlugA(b);
    setSlugB(a);
    // フィルタ文字列も一緒に入れ替える。入れ替えないと、片方の検索窓の絞り込み
    // テキストが新しい選手と一致せず、直後の自動補正effectがスワップ結果を
    // 即座に上書きしてしまう(OgCardToolと同じ対策)。
    setFilterA(filterB);
    setFilterB(filterA);
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "16px 24px" }}>
      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>選手A</label>
        <input
          id="dream-filter-a"
          type="text"
          value={filterA}
          onChange={(e) => setFilterA(e.target.value)}
          placeholder="選手名で検索"
          style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
        />
        <select
          id="dream-select-a"
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

      <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
        <button type="button" onClick={swap} title="AとBを入れ替え" style={{ padding: "8px 10px", fontSize: 16, lineHeight: 1 }}>
          ⇄
        </button>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>選手B</label>
        <input
          id="dream-filter-b"
          type="text"
          value={filterB}
          onChange={(e) => setFilterB(e.target.value)}
          placeholder="選手名で検索"
          style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
        />
        <select
          id="dream-select-b"
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
    </div>
  );
}
