"use client";

import { useEffect, useMemo, useState } from "react";
import { fullWidthLength, stripLeadingLabel } from "@/lib/tweetDigest";
import { toJstDateStr, shiftDateStr } from "@/lib/eventCountdown";
import CopyButton from "@/components/CopyButton";

// JST暦日文字列("YYYY-MM-DD")を投稿文用の"M/D"表記に整形する(tz非依存の
// 文字列パースのみ、Dateオブジェクトを経由しない)。
function jstIsoToMD(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 朝まとめの手動選択ワークフロー:
// 過去24時間の全ニュースをテキスト一覧で表示 → 手動でチェック →
// 選んだ記事だけをX投稿文(テキストのみ・画像なし)に変換する。
// 自動選定(digestScore)は「候補」のプリセレクトにだけ使い、最終判断は人間。
// Xプレミアム前提のため文字数上限は設けない(カウンタは参考表示のみ)。
export interface PickerArticle {
  id: string;
  title: string;
  url: string;
  origin: string; // via表記(メディア名/公式名)
  label: string; // バッジ表示(団体名 or メディア)
  color: string; // バッジ色
  tag: string; // 投稿行の【タグ】(大会/団体。空なら無し)
  orgHashtag: string; // "#RIZIN"等。該当なしは""
  timeJa: string; // "3時間前"
  suggested: boolean; // digestScore上位=候補(初期チェック)
}

export default function DigestPicker({
  articles,
  dateIso,
}: {
  articles: PickerArticle[];
  dateIso: string; // サーバ算出の「昨日(JST)」YYYY-MM-DD(唯一の元。M/D表記はここから導出する)
}) {
  // 「昨日(JST)」はブラウザ側でも算出し直す。サーバレンダのキャッシュや
  // 開きっぱなしタブ/bfcache復帰で日付が前日のまま固定されるのを防ぎ、
  // 閲覧時点の昨日を常に自動反映する。初期値はpropsのdateIsoをそのまま
  // useStateの初期値に使う(クライアント側でDate.now()を初期render時に
  // 呼ばない)ため、サーバーHTMLとクライアント初回レンダーが一致し
  // hydration mismatchが起きない(PR#196のEventCountdownBadgeと同じ型)。
  const [dayIso, setDayIso] = useState(dateIso);
  const dayLabel = jstIsoToMD(dayIso);
  useEffect(() => {
    const recompute = () => {
      // page.tsx側と同じ式(toJstDateStr→shiftDateStr、いずれもマシンtz
      // 非依存)で「昨日(JST)」を再計算する。
      setDayIso(shiftDateStr(toJstDateStr(), -1));
    };
    recompute();
    window.addEventListener("pageshow", recompute); // bfcache復帰時も再計算
    return () => window.removeEventListener("pageshow", recompute);
  }, []);

  // 選択は「順序付き」で保持する(投稿の行順=この順序)。チェックした順に
  // 末尾へ追加され、↑↓で自由に入れ替えられる。
  const [order, setOrder] = useState<string[]>(() =>
    articles.filter((a) => a.suggested).map((a) => a.id)
  );

  function toggle(id: string) {
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const chosen = useMemo(
    () =>
      order
        .map((id) => articles.find((a) => a.id === id))
        .filter((a): a is PickerArticle => !!a),
    [order, articles]
  );

  // 各行の本文(編集可能)。初期値はタイトルから先頭【】ラベルを除いたもの
  // (ラベルはa.tagとして別途・行頭に固定表示するため、二重表示を避ける)。
  // 未編集の行はここに持たず、表示側でstripLeadingLabel(a.title)にフォール
  // バックする(記事一覧が差し替わってもキー不整合で古い文言が残らない)。
  const [lineText, setLineText] = useState<Record<string, string>>({});
  function lineTextFor(a: PickerArticle): string {
    return lineText[a.id] ?? stripLeadingLabel(a.title);
  }

  // 本文末尾に添える自前データ1行(任意)。空なら出力しない。
  const [dataLine, setDataLine] = useState("");

  // リンク先はその日のニュースだけを一覧表示する専用ページ(/archive/[date]、
  // xPost.tsのbuildDigestPostと同じ参照先)。日付ごとにURLが自然に異なるため、
  // Xの投稿リンク単位OGPキャッシュも常に新規URLとして扱われ、その日のダイジェスト
  // 用OGP(canonical/og:title/og:image共に日付固有)が表示される。
  const digestLink = `https://mnews.jp/archive/${dayIso}`;

  // 並び順は固定: 見出し / 箇条書き / データ1行 / ハッシュタグ。
  // URLは本文に含めない(セルフリプライ側にのみ載せる。②の投稿手順参照)。
  const { text, count } = useMemo(() => {
    if (chosen.length === 0) return { text: "", count: 0 };
    const lines = chosen.map((a) => {
      const prefix = a.tag ? `【${a.tag}】` : "";
      const body = lineText[a.id] ?? stripLeadingLabel(a.title);
      return `・${prefix}${body}`;
    });
    // ハッシュタグ: 選択記事の団体タグを重複排除で最大3つ(#MMAは付けない)
    const tags = [...new Set(chosen.map((a) => a.orgHashtag).filter(Boolean))].slice(0, 3);
    const parts = [`🥊 昨日のMMAニュースまとめ(${dayLabel})`, ...lines];
    const trimmedDataLine = dataLine.trim();
    if (trimmedDataLine) parts.push(trimmedDataLine);
    if (tags.length > 0) parts.push(tags.join(" "));
    const body = parts.join("\n");
    return { text: body, count: Math.ceil(fullWidthLength(body)) };
  }, [chosen, lineText, dataLine, dayLabel]);

  // セルフリプライ用(①へのリプ)。全件数はOGPカード(/api/og/digest)と同じ
  // articles.length(その日のニュース全件、選択件数=chosen.lengthではない)を
  // 参照する。新たに数え直さない。
  const replyText = `${dayLabel}のMMAニュースまとめ、全${articles.length}件はこちら👇\n${digestLink}`;

  return (
    <div>
      {/* 記事一覧(全件・チェックで選択) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {articles.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>過去24時間の記事がありません。</p>
        )}
        {articles.map((a) => {
          const on = order.includes(a.id);
          return (
            <label
              key={a.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 8,
                background: on ? "rgba(232,0,45,0.04)" : "var(--s1)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(a.id)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "1.5px 7px",
                      borderRadius: 4,
                      background: a.color,
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.label}
                  </span>
                  {a.suggested && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}>候補</span>
                  )}
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--dim)", marginLeft: "auto", whiteSpace: "nowrap" }}>
                    {a.timeJa}
                  </span>
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.5, display: "block" }}>{a.title}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>via {a.origin}</span>
              </span>
            </label>
          );
        })}
      </div>

      {/* 投稿順の並び替え+行本文の編集(選択済みのみ) */}
      {chosen.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            投稿順(↑↓で入れ替え・本文は編集可)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {chosen.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", width: 16 }}>
                  {i + 1}.
                </span>
                {a.tag && (
                  <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                    【{a.tag}】
                  </span>
                )}
                <input
                  type="text"
                  value={lineTextFor(a)}
                  onChange={(e) =>
                    setLineText((prev) => ({ ...prev, [a.id]: e.target.value }))
                  }
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    padding: "5px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--s1)",
                    color: "inherit",
                  }}
                />
                <button
                  onClick={() => move(a.id, -1)}
                  disabled={i === 0}
                  style={{ border: "1px solid var(--border)", background: "var(--s1)", borderRadius: 6, padding: "2px 9px", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.35 : 1, fontSize: 13 }}
                  aria-label="上へ"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(a.id, 1)}
                  disabled={i === chosen.length - 1}
                  style={{ border: "1px solid var(--border)", background: "var(--s1)", borderRadius: 6, padding: "2px 9px", cursor: i === chosen.length - 1 ? "default" : "pointer", opacity: i === chosen.length - 1 ? 0.35 : 1, fontSize: 13 }}
                  aria-label="下へ"
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
              データ1行(任意)
            </label>
            <input
              type="text"
              value={dataLine}
              onChange={(e) => setDataLine(e.target.value)}
              placeholder="例: 秋元はこれで13勝1敗、勝率93%。"
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12,
                padding: "5px 8px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--s1)",
                color: "inherit",
              }}
            />
          </div>
        </div>
      )}

      {/* 生成されたX投稿(テキストのみ・画像なし・単一ツイート) */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            X投稿文({chosen.length}件選択)
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, marginLeft: 8, color: "var(--muted)" }}>
              全角換算 {count}(プレミアム前提・上限なし)
            </span>
          </span>
          <CopyButton text={text} label="本文をコピー" />
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "var(--mono)",
            fontSize: 13,
            background: "var(--s2)",
            padding: 12,
            border: "1px solid var(--border)",
            margin: 0,
            minHeight: 60,
          }}
        >
          {text || "(記事を選択すると投稿文が生成されます)"}
        </pre>

        {/* ①へのセルフリプライ用(URLはこちらにのみ載せる) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 6px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>リプライ用</span>
          <CopyButton text={replyText} label="リプライ用をコピー" />
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "var(--mono)",
            fontSize: 13,
            background: "var(--s2)",
            padding: 12,
            border: "1px dashed var(--border)",
            margin: 0,
          }}
        >
          {replyText}
        </pre>
      </div>
    </div>
  );
}
