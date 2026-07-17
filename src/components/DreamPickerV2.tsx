"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { weightSortKey } from "@/lib/weightClasses";
import styles from "@/styles/matchup.module.css";

interface FighterOption {
  slug: string;
  nameJa: string;
  weightClass: string;
}

// 夢のカードv2ピッカー: 「階級→選手」の2段選択のみ(全選手からの直接検索はしない、§3-2)。
// slug単位でstateを持つ既存パターン(DreamPicker.tsx)を踏襲し、フィルタ変更で選択中の
// slugが候補から消えた場合は表示中の先頭候補へ明示的に同期する(同じ過去バグ対策)。
export default function DreamPickerV2({
  fighters,
  initialA,
  initialB,
  preview,
}: {
  fighters: FighterOption[];
  initialA: string;
  initialB: string;
  preview: boolean;
}) {
  const router = useRouter();
  const [slugA, setSlugA] = useState(initialA);
  const [slugB, setSlugB] = useState(initialB);

  const weightClasses = useMemo(
    () => Array.from(new Set(fighters.map((f) => f.weightClass))).sort((a, b) => weightSortKey(a) - weightSortKey(b)),
    [fighters]
  );

  const findInitialClass = (slug: string) => fighters.find((f) => f.slug === slug)?.weightClass ?? weightClasses[0] ?? "";
  const [classFilterA, setClassFilterA] = useState(() => findInitialClass(initialA));
  const [classFilterB, setClassFilterB] = useState(() => findInitialClass(initialB));
  // 選手名フリーワード検索(部分一致)。/tools/fighter-cardから移植(§6統合)。
  // 選択肢自体は既存のプルダウンのまま、絞り込みは表示するoptionを減らすだけ。
  const [nameFilterA, setNameFilterA] = useState("");
  const [nameFilterB, setNameFilterB] = useState("");

  const fightersA = useMemo(
    () =>
      fighters.filter(
        (f) => f.weightClass === classFilterA && (!nameFilterA.trim() || f.nameJa.includes(nameFilterA.trim()))
      ),
    [fighters, classFilterA, nameFilterA]
  );
  const fightersB = useMemo(
    () =>
      fighters.filter(
        (f) => f.weightClass === classFilterB && (!nameFilterB.trim() || f.nameJa.includes(nameFilterB.trim()))
      ),
    [fighters, classFilterB, nameFilterB]
  );

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

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!slugA || !slugB) return;
    const params = new URLSearchParams({ a: slugA, b: slugB });
    if (preview) params.set("ui", "new");
    router.replace(`/dream?${params.toString()}`, { scroll: false });
  }, [slugA, slugB, preview, router]);

  const swap = () => {
    setClassFilterA(classFilterB);
    setClassFilterB(classFilterA);
    // 検索文字列も一緒に入れ替える。入れ替えないと、片方の検索窓の絞り込み
    // テキストが新しい選手と一致せず、直後の自動補正effectがスワップ結果を
    // 即座に上書きしてしまう(OgCardTool.tsxと同じ理由)。
    setNameFilterA(nameFilterB);
    setNameFilterB(nameFilterA);
    setSlugA(slugB);
    setSlugB(slugA);
  };

  return (
    <div className={styles.mv2}>
      <div className={styles.buildBox}>
        <div className={styles.buildTitle}>好きな2人で組む</div>
        <div className={styles.buildRow}>
          <div className={styles.slot}>
            <label className={styles.sel} style={{ display: "block" }}>
              <select
                aria-label="選手Aの階級"
                value={classFilterA}
                onChange={(e) => setClassFilterA(e.target.value)}
                style={{ width: "100%", border: "none", background: "transparent", font: "inherit", color: "inherit" }}
              >
                {weightClasses.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              aria-label="選手Aを検索"
              value={nameFilterA}
              onChange={(e) => setNameFilterA(e.target.value)}
              placeholder="選手名で検索"
              className={styles.sel}
            />
            <label className={styles.sel} style={{ display: "block" }}>
              <select
                aria-label="選手Aを選ぶ"
                value={slugA}
                onChange={(e) => setSlugA(e.target.value)}
                style={{ width: "100%", border: "none", background: "transparent", font: "inherit", color: "inherit" }}
              >
                {fightersA.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.nameJa}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" onClick={swap} title="AとBを入れ替え" className={styles.buildVsLabel} style={{ background: "none", border: "none", cursor: "pointer" }}>
            VS
          </button>
          <div className={styles.slot}>
            <label className={styles.sel} style={{ display: "block" }}>
              <select
                aria-label="選手Bの階級"
                value={classFilterB}
                onChange={(e) => setClassFilterB(e.target.value)}
                style={{ width: "100%", border: "none", background: "transparent", font: "inherit", color: "inherit" }}
              >
                {weightClasses.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              aria-label="選手Bを検索"
              value={nameFilterB}
              onChange={(e) => setNameFilterB(e.target.value)}
              placeholder="選手名で検索"
              className={styles.sel}
            />
            <label className={styles.sel} style={{ display: "block" }}>
              <select
                aria-label="選手Bを選ぶ"
                value={slugB}
                onChange={(e) => setSlugB(e.target.value)}
                style={{ width: "100%", border: "none", background: "transparent", font: "inherit", color: "inherit" }}
              >
                {fightersB.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.nameJa}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button
          type="button"
          className={styles.buildBtn}
          onClick={() => document.getElementById("dream-card-v2")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          この2人を比較する
        </button>
      </div>
    </div>
  );
}
