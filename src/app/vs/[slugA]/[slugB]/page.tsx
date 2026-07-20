import { notFound, permanentRedirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import XShareLink from "@/components/XShareLink";
import VsCard from "@/components/matchup/VsCard";
import { getFighter } from "@/lib/fighters";
import { GLOBAL_FIGHTER_NAME_SIZE } from "@/lib/events";
import { ogImagePath } from "@/lib/ogShared";
import { pageMetadata } from "@/lib/seo";
import { fetchFighterRecordsStrict, type FighterRecordEntry } from "@/lib/fighterRecordsCache";
import { getVisibleFighters } from "@/lib/visibleFighters";
import { normalizeVsSlugs, isVsPairIndexable, buildVsShareText } from "@/lib/vsPairing";

const SITE_URL = "https://www.mnews.jp";

// 以前はここで?wc=/?ev=のクエリを受け取りOG画像へ手指定の階級・大会名を
// 反映していたが、公開・非認証のこのページ経由で誰でも実在選手の公式風
// 偽カード画像を作れる穴になっていたため廃止した。大会名は/api/og/vs側の
// findMatchupEvent()によるDB由来の自動判定のみを使う(セキュリティ境界の
// 詳細はsrc/app/api/og/vs/[slugA]/[slugB]/route.tsxのコメント参照)。
// 任意の大会名・階級を画像に出したい場合は管理画面限定の
// /api/og/vs-compareを使うこと。
function vsOgPath(slugA: string, slugB: string): string {
  return `/api/og/vs/${slugA}/${slugB}`;
}

// 空エントリ(戦績データ未取得時)のフォールバック。捏造しない0値で、
// VsCard/MatchupTape側は winRate/finishRate が null になり「—」表示に倒れる。
function emptyEntry(): FighterRecordEntry {
  return { wins: 0, losses: 0, draws: 0, ko: 0, sub: 0, decision: 0, history: [], live: false, noRecordData: true };
}

// ?red={slug}: 赤コーナーに置く選手をnorm.b側に指定する(2026-07-20)。
// norm.a/norm.bのいずれとも一致しない場合(未指定・不正値含む)はnorm.a
// (スラッグ辞書順で先)をデフォルトの赤とする(organic/SEO訪問への影響ゼロ)。
// canonicalは常にクエリ無しのクリーンURL(下のpageMetadata呼び出し参照)に
// 固定し、インデックス対象は1ペア1URLを維持する。?red=は表示専用。
function resolveRedSlug(searchParams: Record<string, string | string[] | undefined>, norm: { a: string; b: string }): string {
  const raw = searchParams.red;
  const redParam = Array.isArray(raw) ? raw[0] : raw;
  return redParam === norm.b ? norm.b : norm.a;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slugA: string; slugB: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slugA, slugB } = await params;
  const norm = normalizeVsSlugs(slugA, slugB);
  const fighterA = getFighter(norm.a);
  const fighterB = getFighter(norm.b);
  if (!fighterA || !fighterB) return { title: "対戦カード | Mニュース", robots: { index: false, follow: false } };

  const title = `${fighterA.nameJa} vs ${fighterB.nameJa} 対戦比較｜戦績・共通対戦相手 - Mニュース`;

  const recordsResult = await fetchFighterRecordsStrict();
  const entryA = recordsResult.ok ? (recordsResult.records[norm.a] ?? emptyEntry()) : emptyEntry();
  const entryB = recordsResult.ok ? (recordsResult.records[norm.b] ?? emptyEntry()) : emptyEntry();
  const indexable = recordsResult.ok && isVsPairIndexable(fighterA, fighterB, entryA, entryB);

  const commonCount =
    recordsResult.ok && !entryA.noRecordData && !entryB.noRecordData
      ? new Set(
          entryA.history
            .map((h) => h.opponent)
            .filter((name) => entryB.history.some((h2) => h2.opponent === name))
        ).size
      : 0;
  const description = `${fighterA.nameJa}（${entryA.wins}勝${entryA.losses}敗）vs ${fighterB.nameJa}（${entryB.wins}勝${entryB.losses}敗）の対戦カード。共通対戦相手${commonCount}人。`;

  const sp = await searchParams;
  const redSlug = resolveRedSlug(sp, norm);
  const imagePath = vsOgPath(norm.a, norm.b) + (redSlug !== norm.a ? `?red=${redSlug}` : "");

  const meta = pageMetadata({
    title,
    description,
    // canonicalはpathのみから組み立てられる(pageMetadata参照)ため、
    // ?red=を渡さないことで常にクエリ無しのクリーンURLに固定される。
    path: `/vs/${norm.a}/${norm.b}`,
    image: {
      url: ogImagePath(imagePath),
      width: 1200,
      height: 630,
      alt: `${fighterA.nameJa} vs ${fighterB.nameJa}`,
    },
  });
  // 組み合わせは選手数の二乗のオーダーで発生する(spec §4)。過去対戦・共通対戦相手・
  // 同一団体同一階級のいずれも無ければ薄いプログラマティックページとしてnoindexにする
  // (デフォルトnoindex,follow。sitemapにも載せない=sitemap.ts側で同じ判定を共有)。
  meta.robots = indexable ? undefined : { index: false, follow: true };
  return meta;
}

export default async function VsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slugA: string; slugB: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slugA, slugB } = await params;
  const norm = normalizeVsSlugs(slugA, slugB);
  const sp = await searchParams;

  // 非正規順(/vs/b/a)は正規順(/vs/a/b、スラッグ辞書順)へ308恒久リダイレクト(spec §1.2)。
  // ?red=はクエリを含めたリダイレクトでNext.jsが自動的に引き継がない(定番の穴)ため、
  // 明示的に転記する(2026-07-20)。redはスラッグそのものを指すので、パス順が
  // 入れ替わっても値自体は変えずにそのまま引き継げばよい。
  if (norm.wasSwapped) {
    const rawRed = sp.red;
    const redParam = Array.isArray(rawRed) ? rawRed[0] : rawRed;
    const qs = redParam ? `?red=${encodeURIComponent(redParam)}` : "";
    permanentRedirect(`/vs/${norm.a}/${norm.b}${qs}`);
  }

  const fighterA = getFighter(norm.a);
  const fighterB = getFighter(norm.b);
  if (!fighterA || !fighterB) notFound();

  const recordsResult = await fetchFighterRecordsStrict();
  const entryA = recordsResult.ok ? (recordsResult.records[norm.a] ?? emptyEntry()) : emptyEntry();
  const entryB = recordsResult.ok ? (recordsResult.records[norm.b] ?? emptyEntry()) : emptyEntry();
  const bothRegistered = !entryA.noRecordData && !entryB.noRecordData;

  const visible = await getVisibleFighters();
  const visibleSlugs = new Set(visible.map((f) => f.slug));

  const shareUrl = `${SITE_URL}/vs/${norm.a}/${norm.b}`;
  const shareText = buildVsShareText(fighterA.nameJa, fighterB.nameJa);
  const dreamReselectPath = `/dream?a=${norm.a}&b=${norm.b}`;

  // ?red=に応じてカードの赤/青(左/右)を入れ替える。デフォルト(未指定・不正値)は
  // norm.a(辞書順先)が赤のまま=既存挙動不変。
  const redSlug = resolveRedSlug(sp, norm);
  const swapCorners = redSlug === norm.b;
  const cardRed = swapCorners ? fighterB : fighterA;
  const cardBlue = swapCorners ? fighterA : fighterB;
  const cardRedEntry = swapCorners ? entryB : entryA;
  const cardBlueEntry = swapCorners ? entryA : entryB;

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">対戦カード</div>
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 640 }}>
        {bothRegistered ? (
          <VsCard
            nameA={cardRed.nameJa}
            nameB={cardBlue.nameJa}
            slugA={cardRed.slug}
            slugB={cardBlue.slug}
            nicknameA={cardRed.nickname}
            nicknameB={cardBlue.nickname}
            entryA={cardRedEntry}
            entryB={cardBlueEntry}
            visibleSlugs={visibleSlugs}
            nameSizeOverride={GLOBAL_FIGHTER_NAME_SIZE}
          />
        ) : (
          <img
            src={ogImagePath(vsOgPath(norm.a, norm.b) + (swapCorners ? `?red=${redSlug}` : ""))}
            alt={`${fighterA.nameJa} vs ${fighterB.nameJa}`}
            style={{ width: "100%", border: "1px solid var(--border)", display: "block", marginBottom: 16 }}
          />
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 32, flexWrap: "wrap" }}>
          <XShareLink
            text={shareText}
            url={shareUrl}
            style={{ padding: "10px 20px", background: "#000", color: "#fff", fontWeight: 700, borderRadius: 4, fontSize: 14, textDecoration: "none" }}
          >
            𝕏 に投稿
          </XShareLink>
          <a
            href={dreamReselectPath}
            style={{ padding: "10px 20px", border: "1px solid var(--border)", color: "inherit", fontWeight: 700, borderRadius: 4, fontSize: 14, textDecoration: "none" }}
          >
            選手を入れ替えて再選択
          </a>
          <a
            href="/dream"
            style={{ padding: "10px 20px", border: "1px solid var(--border)", color: "inherit", fontWeight: 700, borderRadius: 4, fontSize: 14, textDecoration: "none" }}
          >
            別のカードを作る
          </a>
        </div>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`/fighters/${fighterA.slug}`} className="fighter-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="fighter-name">{fighterA.nameJa}の選手ページへ</div>
          </a>
          <a href={`/fighters/${fighterB.slug}`} className="fighter-card" style={{ flex: 1, minWidth: 140 }}>
            <div className="fighter-name">{fighterB.nameJa}の選手ページへ</div>
          </a>
        </div>
      </div>
      <Footer />
    </>
  );
}
