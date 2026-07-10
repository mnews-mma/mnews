"use client";

import { useMemo, useState, useEffect } from "react";
import CopyButton from "@/components/CopyButton";
import { ogImagePath } from "@/lib/ogShared";
import { SITE_URL } from "@/lib/seo";
import { rankChangeText, type RankChange } from "@/lib/rankingDiff";
import { buildMatchupContextPost } from "@/lib/xPost";
import { WEIGHT_KG } from "@/lib/weightClasses";
import { computeFighterStripStats, computeWinMethodBreakdown, LAST5_SYMBOL } from "@/lib/fighterStrip";
import { buildFightSectionDraft, generateArticleCode, generateArticleAnnounceText } from "@/lib/articleGenerator";
import type { FighterRecordsFile } from "@/lib/fighterRecordsCache";
import type { OriginalArticle, OriginalArticleFight } from "@/lib/originalArticles";
import { findFighterSlugByName } from "@/lib/fighters";
import AdminBackLink from "@/components/AdminBackLink";

export interface DraftFighterOption {
  slug: string;
  nameJa: string;
  wins: number;
  losses: number;
  ko: number;
  sub: number;
}

// タブ③(数字で見る記事生成)用: 大会選択の候補(events.ts/eventResults.tsを
// 共通形状に正規化したもの。page.tsx側で生成)。
export interface ArticleEventOption {
  slug: string;
  eventName: string;
  fights: { fighterA: string; fighterB: string; weightClass?: string; isTitleMatch?: boolean }[];
}

const ORG_LABEL: Record<string, string> = { pancrase: "パンクラス", shooto: "修斗", deep: "DEEP" };

// 階級はドロップダウン(共有の体重ソートキーで整列)+自由入力(キャッチウェイト等)の両対応。
const WEIGHT_OPTIONS = Object.keys(WEIGHT_KG).sort((a, b) => WEIGHT_KG[a] - WEIGHT_KG[b]);
const CUSTOM_WEIGHT = "__custom__";

const tabBtn: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  padding: "10px 18px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
};
const tabBtnActive: React.CSSProperties = { ...tabBtn, background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" };
const chip: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--s1)",
  cursor: "pointer",
};

function DraftCard({ text, imageUrl }: { text: string; imageUrl?: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", margin: "0 0 10px" }}>
        {text}
      </pre>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="カードプレビュー" style={{ width: "100%", maxWidth: 500, border: "1px solid var(--border)", display: "block", marginBottom: 10 }} />
      )}
      <CopyButton text={text} label="本文コピー" />
    </div>
  );
}

// フリーワード検索付きの選手セレクタ(既存/tools/fighter-cardと同じパターンを再利用)。
// nodata選手(戦績データ無し)はfighters配列に含めない運用(呼び出し側で除外済み)。
function FighterPicker({
  label,
  fighters,
  value,
  onChange,
}: {
  label: string;
  fighters: DraftFighterOption[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(
    () => (filter.trim() ? fighters.filter((f) => f.nameJa.includes(filter.trim())) : fighters),
    [fighters, filter]
  );
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{label}</label>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="選手名で検索"
        style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
      />
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, minWidth: 220 }}>
        <option value="">(未選択)</option>
        {filtered.map((f) => (
          <option key={f.slug} value={f.slug}>
            {f.nameJa}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── タブ①: 対戦カード文脈ドラフト ──
function MatchupTab({ fighters }: { fighters: DraftFighterOption[] }) {
  const [slugA, setSlugA] = useState("");
  const [slugB, setSlugB] = useState("");
  const [eventName, setEventName] = useState("");
  const [weightPreset, setWeightPreset] = useState("");
  const [weightCustom, setWeightCustom] = useState("");
  const [draft, setDraft] = useState<{ text: string; imageUrl?: string } | null>(null);

  const weightClass = (weightPreset === CUSTOM_WEIGHT ? weightCustom : weightPreset).trim();

  function generate() {
    const a = fighters.find((f) => f.slug === slugA);
    const b = fighters.find((f) => f.slug === slugB);
    if (!a || !b) return;
    const post = buildMatchupContextPost({
      fighterA: { nameJa: a.nameJa, slug: a.slug, wins: a.wins, losses: a.losses, ko: a.ko, sub: a.sub },
      fighterB: { nameJa: b.nameJa, slug: b.slug, wins: b.wins, losses: b.losses, ko: b.ko, sub: b.sub },
      eventName: eventName.trim() || undefined,
      weightClass: weightClass || undefined,
    });
    // 大会名/階級ラベルを画像URLにも反映する(OgCardTool.tsxと同じ方式)。
    // 以前はテキスト本文にだけ反映され、画像プレビューには渡っておらず
    // MATCH UPのみの版になっていた(パラメータ渡し漏れ)。
    const imgQuery = new URLSearchParams();
    if (eventName.trim()) imgQuery.set("ev", eventName.trim());
    if (weightClass) imgQuery.set("wc", weightClass);
    const imgQs = imgQuery.toString();
    setDraft({
      text: post.text,
      imageUrl: ogImagePath(`/api/og/vs/${a.slug}/${b.slug}${imgQs ? `?${imgQs}` : ""}`),
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <FighterPicker label="選手A" fighters={fighters} value={slugA} onChange={setSlugA} />
        <FighterPicker label="選手B" fighters={fighters} value={slugB} onChange={setSlugB} />
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>大会名(任意)</label>
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="例: RIZIN.54"
            style={{ padding: "8px 12px", fontSize: 14, minWidth: 200 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>階級(任意)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={weightPreset}
              onChange={(e) => setWeightPreset(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 14, minWidth: 160 }}
            >
              <option value="">（なし）</option>
              {WEIGHT_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
              <option value={CUSTOM_WEIGHT}>自由入力…</option>
            </select>
            {weightPreset === CUSTOM_WEIGHT && (
              <input
                type="text"
                value={weightCustom}
                onChange={(e) => setWeightCustom(e.target.value)}
                placeholder="例: キャッチウェイト70kg"
                style={{ padding: "8px 12px", fontSize: 14, minWidth: 200 }}
              />
            )}
          </div>
        </div>
      </div>
      <button onClick={generate} disabled={!slugA || !slugB} style={{ ...chip, marginBottom: 16, opacity: !slugA || !slugB ? 0.5 : 1 }}>
        ドラフト生成
      </button>
      {draft && <DraftCard text={draft.text} imageUrl={draft.imageUrl} />}
    </div>
  );
}

// ── タブ②: ランキング変動ドラフト ──
function RankingTab({ changes }: { changes: RankChange[] }) {
  if (changes.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 13 }}>前回スナップショットとの差分はありません(変化ゼロ)。</p>;
  }
  return (
    <div>
      {changes.map((c, i) => {
        const orgLabel = ORG_LABEL[c.org] ?? c.org;
        const text = rankChangeText(c, orgLabel, "https://www.mnews.jp");
        const imageUrl = c.slug ? ogImagePath(`/api/og/fighter/${c.slug}`) : undefined;
        return <DraftCard key={i} text={text} imageUrl={imageUrl} />;
      })}
    </div>
  );
}

// ── タブ③: 数字で見る記事生成 ──
// 生成結果はコピー用の完成コード(originalArticles.tsに貼り付ける配列要素1件分)を
// 表示するだけで、この画面から直接公開(書き込み)はしない(既存タブと同じ
// 「生成→コピー→人間が手動でコミット」運用。DBやgit書き込みトークンを持たない)。
function ArticleGenTab({
  fighters,
  events,
  fighterRecords,
}: {
  fighters: DraftFighterOption[];
  events: ArticleEventOption[];
  fighterRecords: FighterRecordsFile;
}) {
  // 選手名→slug解決は自作の完全一致Mapではなく、表記ゆれ(姓名スペース有無等)を
  // 吸収する既存の findFighterSlugByName を使う(results/[slug]等と同じロジックに揃える)。
  const visibleSlugs = useMemo(() => new Set(fighters.map((f) => f.slug)), [fighters]);
  const resolveSlug = (name: string) => findFighterSlugByName(name, undefined, visibleSlugs);

  const [eventSlug, setEventSlug] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const event = events.find((e) => e.slug === eventSlug);

  // 大会切り替え時は選択・タイトル・スラッグをリセット(前の大会の値を引きずらない)。
  useEffect(() => {
    setSelected(new Set());
    setTitle("");
    setSlug("");
  }, [eventSlug]);

  function toggleFight(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // 選択中の試合を、選手DBに存在し戦績データがある組み合わせのみ抽出して
  // OriginalArticleFight(共通対戦相手・注目点のスナップショット込み)に変換する。
  const fightDrafts: OriginalArticleFight[] = useMemo(() => {
    if (!event) return [];
    const drafts: OriginalArticleFight[] = [];
    for (const i of selected) {
      const f = event.fights[i];
      if (!f) continue;
      const slugA = resolveSlug(f.fighterA);
      const slugB = resolveSlug(f.fighterB);
      const entryA = slugA ? fighterRecords[slugA] : undefined;
      const entryB = slugB ? fighterRecords[slugB] : undefined;
      if (!slugA || !slugB || !entryA || !entryB) continue; // 戦績データが無い選手は記事化しない
      drafts.push(
        buildFightSectionDraft(
          { slug: slugA, nameJa: f.fighterA },
          entryA,
          { slug: slugB, nameJa: f.fighterB },
          entryB,
          f.weightClass,
          f.isTitleMatch
        )
      );
    }
    return drafts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, selected, visibleSlugs, fighterRecords]);

  // 未選択分のうち戦績データが無く記事化できなかった試合(注意喚起用)
  const skippedCount = selected.size - fightDrafts.length;

  const suggestedTitle =
    event && fightDrafts[0]
      ? `数字で見る対戦カード: ${event.eventName} ${fightDrafts[0].fighterA.nameJa} vs ${fightDrafts[0].fighterB.nameJa}`
      : "";
  const suggestedSlug =
    event && fightDrafts[0] ? `${event.slug}-${fightDrafts[0].fighterA.slug}-${fightDrafts[0].fighterB.slug}` : "";

  const article: OriginalArticle | null =
    event && fightDrafts.length > 0
      ? {
          slug: slug || suggestedSlug,
          title: title || suggestedTitle,
          eventSlug: event.slug,
          publishedAt,
          fights: fightDrafts,
        }
      : null;

  const code = article ? generateArticleCode(article) : "";
  const announceText = article ? generateArticleAnnounceText(article, SITE_URL) : "";

  return (
    <div>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 20,
          background: "var(--s2)",
          fontSize: 13,
          lineHeight: 1.8,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>記事公開の手順(この画面からワンクリック公開はできません)</div>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>下で大会・対象試合を選び、プレビューを確認する</li>
          <li>「コードをコピー」でコードをコピーする</li>
          <li>コピーしたコードをClaude Codeに貼り付けて「これで記事作って」と送る(originalArticles.tsへの反映・tsc/build確認・コミット・デプロイ・本番確認まで代行してもらえる)</li>
          <li>デプロイ後 /articles/[slug] の表示を確認する</li>
          <li>「告知テキストをコピー」でX告知文をコピーし、記事URL有効化後に手動投稿する</li>
        </ol>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>大会</label>
          <select value={eventSlug} onChange={(e) => setEventSlug(e.target.value)} style={{ padding: "8px 12px", fontSize: 14, minWidth: 260 }}>
            <option value="">(未選択)</option>
            {events.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.eventName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {event && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>対象試合(複数選択可)</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {event.fights.map((f, i) => {
              const hasData = !!resolveSlug(f.fighterA) && !!resolveSlug(f.fighterB);
              return (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: hasData ? 1 : 0.5 }}>
                  <input type="checkbox" checked={selected.has(i)} disabled={!hasData} onChange={() => toggleFight(i)} />
                  {f.fighterA} vs {f.fighterB}
                  {f.weightClass && <span style={{ color: "var(--muted)" }}>({f.weightClass})</span>}
                  {!hasData && <span style={{ color: "var(--accent)", fontSize: 11 }}>戦績データなし・対象外</span>}
                </label>
              );
            })}
          </div>
          {skippedCount > 0 && (
            <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 6 }}>
              選択中{selected.size}件のうち{skippedCount}件は戦績データが無いため記事から除外されます。
            </p>
          )}
        </div>
      )}

      {article && (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={suggestedTitle}
                style={{ padding: "8px 12px", fontSize: 14, minWidth: 360 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>スラッグ</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={suggestedSlug}
                style={{ padding: "8px 12px", fontSize: 14, minWidth: 260 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>公開日</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                style={{ padding: "8px 12px", fontSize: 14 }}
              />
            </div>
          </div>

          {/* プレビュー: computeFighterStripStats/computeWinMethodBreakdown は
              /articles/[slug]表示側と同じ関数を使い、ロジックの二重実装を避ける
              (戦績・フィニッシュ率・直近5戦はここでもライブ算出、共通対戦相手・
              注目点は上でスナップショット済みの値をそのまま表示)。 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>プレビュー</div>
            {article.fights.map((f, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  {f.fighterA.nameJa} vs {f.fighterB.nameJa}
                  {f.weightClass && <span style={{ color: "var(--muted)", fontWeight: 400 }}> ({f.weightClass})</span>}
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
                  {[f.fighterA, f.fighterB].map((ref) => {
                    const entry = fighterRecords[ref.slug];
                    if (!entry) return null;
                    const stats = computeFighterStripStats(entry);
                    const breakdown = computeWinMethodBreakdown(entry);
                    return (
                      <div key={ref.slug} style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 700 }}>{ref.nameJa}</div>
                        <div>{stats.record}</div>
                        {stats.finishRate !== null && <div>フィニッシュ率{stats.finishRate}%</div>}
                        {breakdown && (
                          <div>
                            KO{breakdown.koPct}% / 一本{breakdown.subPct}% / 判定{breakdown.decisionPct}%
                          </div>
                        )}
                        {stats.last5.length > 0 && (
                          <div>{stats.last5.map((r) => LAST5_SYMBOL[r]).join("")}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {f.commonOpponents && f.commonOpponents.length > 0 && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    共通対戦相手: {f.commonOpponents.map((o) => o.name).join("、")}
                  </div>
                )}
                {f.notablePoints && f.notablePoints.length > 0 && (
                  <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
                    {f.notablePoints.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              originalArticles.ts に貼り付けるコード
            </label>
            <textarea
              readOnly
              value={code}
              rows={16}
              style={{ width: "100%", fontFamily: "var(--mono)", fontSize: 12, padding: 10, border: "1px solid var(--border)", background: "var(--s2)" }}
            />
            <div style={{ marginTop: 8 }}>
              <CopyButton text={code} label="コードをコピー" />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              X告知テキスト(公開後、記事URLが有効になってから投稿)
            </label>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", margin: "0 0 10px" }}>
              {announceText}
            </pre>
            <CopyButton text={announceText} label="告知テキストをコピー" />
          </div>
        </>
      )}
    </div>
  );
}

export default function DraftsTool({
  fighters,
  changes,
  events,
  fighterRecords,
}: {
  fighters: DraftFighterOption[];
  changes: RankChange[];
  events: ArticleEventOption[];
  fighterRecords: FighterRecordsFile;
}) {
  const [tab, setTab] = useState<"matchup" | "ranking" | "article">("matchup");

  return (
    <div style={{ padding: "20px 16px 60px", maxWidth: 720, margin: "0 auto" }}>
      <AdminBackLink />
      <h1 style={{ fontFamily: "var(--os)", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        投稿ドラフト
      </h1>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        下書き生成のみ。Xへの自動投稿はしません(常にコピー→手動ポスト)。試合結果の下書きは
        「🔴ライブ結果入力」で行ってください。
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button style={tab === "matchup" ? tabBtnActive : tabBtn} onClick={() => setTab("matchup")}>
          ①対戦カード文脈
        </button>
        <button style={tab === "ranking" ? tabBtnActive : tabBtn} onClick={() => setTab("ranking")}>
          ②ランキング変動
        </button>
        <button style={tab === "article" ? tabBtnActive : tabBtn} onClick={() => setTab("article")}>
          ③数字で見る記事生成
        </button>
      </div>
      {tab === "matchup" && <MatchupTab fighters={fighters} />}
      {tab === "ranking" && <RankingTab changes={changes} />}
      {tab === "article" && <ArticleGenTab fighters={fighters} events={events} fighterRecords={fighterRecords} />}
    </div>
  );
}
