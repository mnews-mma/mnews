"use client";

import { useMemo, useState, useEffect } from "react";
import CopyButton from "@/components/CopyButton";
import { ogImagePath } from "@/lib/ogShared";
import { SITE_URL } from "@/lib/seo";
import { rankChangeText, type RankChange } from "@/lib/rankingDiff";
import { buildMatchupContextPost } from "@/lib/xPost";
import { WEIGHT_KG, weightSortKey } from "@/lib/weightClasses";
import { computeFighterStripStats, computeWinMethodBreakdown, LAST5_SYMBOL } from "@/lib/fighterStrip";
import {
  buildFightSectionDraft,
  generateArticleCode,
  generateArticleAnnounceText,
  computeCommonOpponents,
  computeNotablePoints,
} from "@/lib/articleGenerator";
import type { FighterRecordsFile } from "@/lib/fighterRecordsCache";
import type { OriginalArticle, OriginalArticleFight } from "@/lib/originalArticles";
import { findFighterSlugByName } from "@/lib/fighters";
import AdminBackLink from "@/components/AdminBackLink";

export interface DraftFighterOption {
  slug: string;
  nameJa: string;
  weightClass: string;
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

function DraftCard({ text, imageUrl, replyText }: { text: string; imageUrl?: string; replyText?: string }) {
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
      {replyText && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>セルフリプライ</label>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, background: "var(--s2)", padding: 12, border: "1px solid var(--border)", margin: "0 0 10px" }}>
            {replyText}
          </pre>
          <CopyButton text={replyText} label="リプライコピー" />
        </div>
      )}
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
  // 階級で絞る(任意)。あくまで選手を探しやすくするための一覧フィルタで、
  // 選択そのものを制約しない(/dreamのDreamPickerと同じパターン)。
  const [classFilter, setClassFilter] = useState("");
  const weightClasses = useMemo(
    () => Array.from(new Set(fighters.map((f) => f.weightClass))).sort((a, b) => weightSortKey(a) - weightSortKey(b)),
    [fighters]
  );
  const filtered = useMemo(
    () =>
      fighters.filter(
        (f) => (!filter.trim() || f.nameJa.includes(filter.trim())) && (!classFilter || f.weightClass === classFilter)
      ),
    [fighters, filter, classFilter]
  );
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{label}</label>
      <select
        value={classFilter}
        onChange={(e) => setClassFilter(e.target.value)}
        style={{ display: "block", padding: "6px 10px", fontSize: 13, minWidth: 220, marginBottom: 4 }}
      >
        <option value="">階級で絞る: すべて</option>
        {weightClasses.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
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
  const [draft, setDraft] = useState<{ text: string; imageUrl?: string; replyText?: string } | null>(null);

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
    // 大会名/階級ラベル(自由入力)を画像に反映するには、公開・非認証の
    // /api/og/vs ではなく管理画面限定の/api/og/vs-compareを使う(こちらは
    // クエリの任意文字列を受け付けない設計にした。第三者が実在選手の公式風
    // 偽カード画像を作れる穴になるため)。プレビュー画像も従来と近い横長
    // 16:9で見えるようratio=16:9を指定する。
    const imgQuery = new URLSearchParams();
    if (eventName.trim()) imgQuery.set("ev", eventName.trim());
    if (weightClass) imgQuery.set("wc", weightClass);
    imgQuery.set("ratio", "16:9");
    setDraft({
      text: post.text,
      imageUrl: ogImagePath(`/api/og/vs-compare/${a.slug}/${b.slug}?${imgQuery.toString()}`),
      replyText: post.replyText,
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
      {draft && <DraftCard text={draft.text} imageUrl={draft.imageUrl} replyText={draft.replyText} />}
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
  // 新着フィード(「すべて」タブ)での並び順に使う実際の公開時刻。空欄(00:00扱い)だと
  // 当日中の他記事より常に古く扱われ48時間ウィンドウから溢れるため、実際にmainへ
  // マージ・デプロイする時刻に合わせて必ず入力する(originalArticles.ts参照)。
  const [publishedAtTime, setPublishedAtTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

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
          publishedAtTime,
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
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                公開時刻(JST・実際にmainへマージする時刻)
              </label>
              <input
                type="time"
                value={publishedAtTime}
                onChange={(e) => setPublishedAtTime(e.target.value)}
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

// ── タブ④: 対戦カード比較ビジュアル生成 ──
// 「共通対戦相手・直近5戦・相性」のSNS投稿画像(/api/og/vs-compare)を、大会選択
// または任意の2選手指定から生成する。データ算出はタブ③と同じ純関数
// (computeCommonOpponents/computeFighterStripStats/computeNotablePoints)を流用し、
// 二重実装はしない。画像自体の生成(共通対戦相手テーブル描画等)はOG画像ルート側
// (edge runtime)で行う。この画面はプレビュー・比率切替・PNGダウンロード・
// 投稿文の下書き表示のみ(自動投稿はしない=既存タブと同じ運用方針)。
const RATIO_OPTIONS: { key: "1:1" | "4:5" | "16:9"; label: string }[] = [
  { key: "4:5", label: "縦4:5" },
  { key: "1:1", label: "正方形1:1" },
  { key: "16:9", label: "横16:9" },
];

function VsCompareTab({
  fighters,
  events,
  fighterRecords,
}: {
  fighters: DraftFighterOption[];
  events: ArticleEventOption[];
  fighterRecords: FighterRecordsFile;
}) {
  const visibleSlugs = useMemo(() => new Set(fighters.map((f) => f.slug)), [fighters]);
  const resolveSlug = (name: string) => findFighterSlugByName(name, undefined, visibleSlugs);

  const [mode, setMode] = useState<"event" | "manual">("event");
  const [eventSlug, setEventSlug] = useState("");
  const [fightIndex, setFightIndex] = useState<number | null>(null);
  const [manualA, setManualA] = useState("");
  const [manualB, setManualB] = useState("");
  const [ratio, setRatio] = useState<"1:1" | "4:5" | "16:9">("4:5");

  const event = events.find((e) => e.slug === eventSlug);

  useEffect(() => {
    setFightIndex(null);
  }, [eventSlug]);

  // 大会モード: 選択中の試合から選手slug・階級・大会名を確定する。
  // 手動モード: プルダウンで直接指定した2選手(大会名・階級は入力しない=空欄)。
  const picked = useMemo(() => {
    if (mode === "event") {
      if (!event || fightIndex === null) return null;
      const f = event.fights[fightIndex];
      if (!f) return null;
      const slugA = resolveSlug(f.fighterA);
      const slugB = resolveSlug(f.fighterB);
      if (!slugA || !slugB) return null;
      return { slugA, nameA: f.fighterA, slugB, nameB: f.fighterB, wc: f.weightClass ?? "", ev: event.eventName };
    }
    if (!manualA || !manualB || manualA === manualB) return null;
    const a = fighters.find((f) => f.slug === manualA);
    const b = fighters.find((f) => f.slug === manualB);
    if (!a || !b) return null;
    return { slugA: manualA, nameA: a.nameJa, slugB: manualB, nameB: b.nameJa, wc: "", ev: "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, event, fightIndex, manualA, manualB, fighters]);

  const entryA = picked ? fighterRecords[picked.slugA] : undefined;
  const entryB = picked ? fighterRecords[picked.slugB] : undefined;
  const dataAvailable = !!entryA && !!entryB && !entryA.noRecordData && !entryB.noRecordData;

  const query = new URLSearchParams();
  if (picked?.wc) query.set("wc", picked.wc);
  if (picked?.ev) query.set("ev", picked.ev);
  query.set("ratio", ratio);
  const imagePath = picked ? ogImagePath(`/api/og/vs-compare/${picked.slugA}/${picked.slugB}?${query.toString()}`) : null;
  const imageUrl = imagePath ? `${SITE_URL}${imagePath}` : null;

  // 投稿文の下書き(あくまで下書き補助。投稿は手動)。共通対戦相手・直近5戦・
  // 注目点はタブ③と同じ純関数で算出する(このタブ独自のロジックは持たない)。
  const postText = useMemo(() => {
    if (!picked || !entryA || !entryB || entryA.noRecordData || entryB.noRecordData) return "";
    const statsA = computeFighterStripStats(entryA);
    const statsB = computeFighterStripStats(entryB);
    const commons = computeCommonOpponents(entryA, entryB);
    const uniqueCommons = new Set(commons.map((c) => c.name)).size;
    const notable = computeNotablePoints(picked.nameA, entryA, picked.nameB, entryB);
    const lines = [`【見どころ】${picked.nameA} vs ${picked.nameB}`];
    if (picked.ev) lines.push(picked.ev + (picked.wc ? `（${picked.wc}）` : ""));
    if (uniqueCommons > 0) lines.push(`共通対戦相手${uniqueCommons}人`);
    if (statsA.last5.length > 0 || statsB.last5.length > 0) {
      const l5 = (name: string, s: typeof statsA) => {
        if (s.last5.length === 0) return null;
        const w = s.last5.filter((r) => r === "win").length;
        const l = s.last5.filter((r) => r === "loss").length;
        return `${name} 直近${s.last5.length}戦${w}勝${l}敗`;
      };
      const parts = [l5(picked.nameA, statsA), l5(picked.nameB, statsB)].filter((x): x is string => !!x);
      if (parts.length > 0) lines.push(parts.join("／"));
    }
    for (const p of notable.slice(0, 2)) lines.push(`・${p}`);
    const tags = ["#RIZIN"];
    if (picked.ev) tags.push(`#${picked.ev.replace(/[\s　]/g, "")}`);
    lines.push(tags.join(" "));
    return lines.join("\n");
  }, [picked, entryA, entryB]);

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
        <div style={{ fontWeight: 700, marginBottom: 4 }}>使い方</div>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>大会から対戦カードを選ぶ(または任意の2選手を指定する)</li>
          <li>比率を選んでプレビューを確認する</li>
          <li>「画像をダウンロード」でPNGを保存し、Xに直接添付して投稿する</li>
          <li>投稿文の下書きは参考用。内容を確認してから手動で投稿してください</li>
        </ol>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={mode === "event" ? tabBtnActive : tabBtn} onClick={() => setMode("event")}>
          大会から選ぶ
        </button>
        <button style={mode === "manual" ? tabBtnActive : tabBtn} onClick={() => setMode("manual")}>
          任意の2選手
        </button>
      </div>

      {mode === "event" && (
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
          {event && (
            <div style={{ width: "100%" }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>対戦カード(1試合を選択)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {event.fights.map((f, i) => {
                  const hasData = !!resolveSlug(f.fighterA) && !!resolveSlug(f.fighterB);
                  return (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: hasData ? 1 : 0.5 }}>
                      <input
                        type="radio"
                        name="vs-compare-fight"
                        checked={fightIndex === i}
                        disabled={!hasData}
                        onChange={() => setFightIndex(i)}
                      />
                      {f.fighterA} vs {f.fighterB}
                      {f.weightClass && <span style={{ color: "var(--muted)" }}>({f.weightClass})</span>}
                      {!hasData && <span style={{ color: "var(--accent)", fontSize: 11 }}>戦績データなし・対象外</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <FighterPicker label="選手A" fighters={fighters} value={manualA} onChange={setManualA} />
          <FighterPicker label="選手B" fighters={fighters} value={manualB} onChange={setManualB} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {RATIO_OPTIONS.map((r) => (
          <button key={r.key} style={ratio === r.key ? tabBtnActive : tabBtn} onClick={() => setRatio(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      {picked && !dataAvailable && (
        <p style={{ color: "var(--accent)", fontSize: 13, marginBottom: 16 }}>
          選手いずれかの戦績データがありません。この組み合わせは画像化できません。
        </p>
      )}

      {picked && dataAvailable && imagePath && (
        <>
          <div style={{ marginBottom: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePath}
              alt="対戦カード比較プレビュー"
              style={{ width: "100%", maxWidth: 420, border: "1px solid var(--border)", display: "block" }}
            />
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <a
              href={imagePath}
              download={`${picked.slugA}-vs-${picked.slugB}-${ratio.replace(":", "x")}.png`}
              style={{ padding: "10px 20px", background: "var(--accent)", color: "#fff", borderRadius: 6, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
            >
              画像をダウンロード(PNG)
            </a>
            <CopyButton text={imageUrl ?? ""} label="画像URLをコピー" />
          </div>

          {postText && (
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                投稿文の下書き(参考用・手動で確認・編集してから投稿してください)
              </label>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  background: "var(--s2)",
                  padding: 12,
                  border: "1px solid var(--border)",
                  margin: "0 0 10px",
                }}
              >
                {postText}
              </pre>
              <CopyButton text={postText} label="投稿文をコピー" />
            </div>
          )}
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
  const [tab, setTab] = useState<"matchup" | "ranking" | "article" | "vscompare">("matchup");

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
        <button style={tab === "vscompare" ? tabBtnActive : tabBtn} onClick={() => setTab("vscompare")}>
          ④対戦カード比較ビジュアル
        </button>
      </div>
      {tab === "matchup" && <MatchupTab fighters={fighters} />}
      {tab === "ranking" && <RankingTab changes={changes} />}
      {tab === "article" && <ArticleGenTab fighters={fighters} events={events} fighterRecords={fighterRecords} />}
      {tab === "vscompare" && <VsCompareTab fighters={fighters} events={events} fighterRecords={fighterRecords} />}
    </div>
  );
}
