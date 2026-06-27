"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { SOURCE_LIST } from "@/lib/sources";

const TABS = [
  { key: "all", label: "ALL", color: "var(--accent)" },
  ...SOURCE_LIST.filter((s) => s.type === "official").map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
  })),
];

export default function Nav({
  active,
  onChange,
}: {
  active?: string;
  onChange?: (key: string) => void;
}) {
  const [internalActive, setInternalActive] = useState("all");
  const current = active ?? internalActive;

  function handleClick(key: string) {
    setInternalActive(key);
    onChange?.(key);
  }

  return (
    <nav>
      <div className="nav-top">
        <Link href="/" className="logo">
          <Image src="/logo.png" alt="Mニュース" width={28} height={28} className="logo-img" />
          <span className="logo-mix">M</span>
          <span className="logo-news">ニュース</span>
          <span className="logo-dot">·</span>
        </Link>
        <div className="nav-search">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="選手名・大会名で検索..." />
        </div>
        <div className="nav-right">
          <button className="nav-cta">通知をON</button>
        </div>
      </div>

      <div className="source-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`stab${current === t.key ? " active" : ""}`}
            onClick={() => handleClick(t.key)}
          >
            <span className="stab-dot" style={{ background: t.color }} />
            {t.label}
          </button>
        ))}
        <Link
          href="/fighters"
          className="stab"
          style={{ marginLeft: "auto", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}
        >
          👤 選手戦績
        </Link>
      </div>
    </nav>
  );
}
