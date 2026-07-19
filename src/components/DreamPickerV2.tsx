"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { weightSortKey, WEIGHT_KG } from "@/lib/weightClasses";
import styles from "@/styles/matchup.module.css";

interface FighterOption {
  slug: string;
  nameJa: string;
  weightClass: string;
}

const CARD_WEIGHT_OPTIONS = Object.keys(WEIGHT_KG).sort((a, b) => WEIGHT_KG[a] - WEIGHT_KG[b]);
const EVENT_NAME_MAX_LEN = 60;

// 夢のカードv2ピッカー: 「階級→選手」の2段選択のみ(全選手からの直接検索はしない、§3-2)。
// slug単位でstateを持つ既存パターン(DreamPicker.tsx)を踏襲し、フィルタ変更で選択中の
// slugが候補から消えた場合は表示中の先頭候補へ明示的に同期する(同じ過去バグ対策)。
export default function DreamPickerV2({
  fighters,
  initialA,
  initialB,
  initialEvent,
  initialWeight,
  preview,
}: {
  fighters: FighterOption[];
  initialA: string;
  initialB: string;
  initialEvent?: string;
  initialWeight?: string;
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

  // カード用の任意入力(大会名・階級)。両選手が同一階級なら階級の初期値としてのみ
  // プリフィルする(継続的な自動追従はしない。ユーザーが選び直した値を上書きしない)。
  const [eventName, setEventName] = useState(initialEvent ?? "");
  const [cardWeight, setCardWeight] = useState(
    () => initialWeight ?? (classFilterA && classFilterA === classFilterB ? classFilterA : "")
  );
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

  // URL(?a=&b=&event=&weight=)への反映は1つのeffectにまとめてデバウンスする。
  // 大会名は自由入力(=キー入力毎の更新)なので、都度router.replaceすると
  // ナビゲーションが多発する。選手/階級セレクトの変更も含め400ms待ってから
  // まとめて1回のURL更新にする。
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!slugA || !slugB) return;
    const params = new URLSearchParams({ a: slugA, b: slugB });
    if (preview) params.set("ui", "new");
    const ev = eventName.trim();
    if (ev) params.set("event", ev);
    if (cardWeight) params.set("weight", cardWeight);
    const t = setTimeout(() => {
      router.replace(`/dream?${params.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [slugA, slugB, preview, eventName, cardWeight, router]);

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
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "0 16px 16px" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>大会名(任意)</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value.replace(/[\r\n]+/g, " ").slice(0, EVENT_NAME_MAX_LEN))}
              placeholder="例: RIZIN LANDMARK 16"
              style={{ padding: "8px 12px", fontSize: 14, minWidth: 200 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>階級(任意)</label>
            <select value={cardWeight} onChange={(e) => setCardWeight(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, minWidth: 160 }}>
              <option value="">（なし）</option>
              {CARD_WEIGHT_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
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
