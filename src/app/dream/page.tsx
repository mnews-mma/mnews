import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BoutCard from "@/components/BoutCard";
import DreamPicker from "@/components/DreamPicker";
import DreamPickerV2 from "@/components/DreamPickerV2";
import VsCard from "@/components/matchup/VsCard";
import XShareLink from "@/components/XShareLink";
import { getFighter } from "@/lib/fighters";
import { getVisibleFighters } from "@/lib/visibleFighters";
import { fetchFighterRecords } from "@/lib/fighterRecordsCache";
import { isNewMatchupUiEnabled } from "@/lib/matchupUi";
import { normalizeVsSlugs, buildVsShareText, buildDreamShareText } from "@/lib/vsPairing";
import { pageMetadata } from "@/lib/seo";
import { ogImagePath } from "@/lib/ogShared";

const SITE_URL = "https://www.mnews.jp";

export const dynamic = "force-dynamic";

function param(sp: Record<string, string | string[] | undefined>, key: string): string {
  const raw = sp[key];
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

// 自由入力(大会名・階級)の無害化。改行除去・トリム・長さ上限のみ
// (表示崩れ対策。/api/og/dream側のsanitizeLabelと同じ方針)。
function sanitizeParam(raw: string, maxLen: number): string {
  return raw.replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
}

// 選択候補・a/bの解決はgenerateMetadata/ページ本体の両方で必要なため共通化する。
async function resolveDreamSlugs(sp: Record<string, string | string[] | undefined>) {
  const visible = await getVisibleFighters();
  const fighters = visible.map((f) => ({ slug: f.slug, nameJa: f.nameJa, weightClass: f.weightClass }));
  const visibleSlugs = new Set(fighters.map((f) => f.slug));
  const reqA = param(sp, "a");
  const reqB = param(sp, "b");
  const slugA = visibleSlugs.has(reqA) ? reqA : (fighters[0]?.slug ?? "");
  const slugB = visibleSlugs.has(reqB) ? reqB : (fighters[1]?.slug ?? "");
  return { fighters, visibleSlugs, slugA, slugB };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { slugA, slugB } = await resolveDreamSlugs(sp);
  const fighterA = slugA ? getFighter(slugA) : undefined;
  const fighterB = slugB ? getFighter(slugB) : undefined;
  const eventName = sanitizeParam(param(sp, "event"), 60);
  const weightClass = sanitizeParam(param(sp, "weight"), 20);
  const hasParams = !!(param(sp, "a") || param(sp, "b") || eventName || weightClass);

  const title =
    fighterA && fighterB
      ? `もし${eventName ? `${eventName}で` : ""}「${fighterA.nameJa} vs ${fighterB.nameJa}」が実現したら | 夢のカード - Mニュース`
      : "夢のカード | 任意の2選手でVS対戦カードを作る - Mニュース";
  const description =
    fighterA && fighterB
      ? `${fighterA.nameJa} vs ${fighterB.nameJa}の夢の対戦カード。戦績・フィニッシュ率・直近5戦を比較。実現したら見てみたい組み合わせをXでシェアできます。`
      : "任意の2選手を選んで仮想の対戦カードを作成。戦績・フィニッシュ率・直近5戦・共通対戦相手を並べて比較し、Xでシェアできます。";

  const image =
    fighterA && fighterB
      ? (() => {
          const q = new URLSearchParams();
          if (eventName) q.set("event", eventName);
          if (weightClass) q.set("weight", weightClass);
          const qs = q.toString();
          return {
            url: ogImagePath(`/api/og/dream/${fighterA.slug}/${fighterB.slug}${qs ? `?${qs}` : ""}`),
            width: 1200,
            height: 630,
            alt: `${fighterA.nameJa} vs ${fighterB.nameJa}(夢のカード)`,
          };
        })()
      : undefined;

  const meta = pageMetadata({ title, description, path: "/dream", image });
  // a/b/event/weight付きの組み合わせは無数に生成されうるプログラマティックページ
  // なので、ベースの/dream(パラメータ無し)のみをindexableとし、それ以外は
  // noindex,followにする(/vsのisVsPairIndexableと同じ考え方)。
  meta.robots = hasParams ? { index: false, follow: true } : undefined;
  return meta;
}

export default async function DreamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const isV2 = isNewMatchupUiEnabled(sp);

  // 選択候補は公開母集団(hidden除外・戦績データあり)のみ。/fighters・Xカードツールと
  // 同じgetVisibleFighters()経由なので、未登録選手は最初から候補に出ない。
  // URLのa/bが未指定・不正な場合は候補の先頭2人にフォールバックする
  // (Xカードツールの初期選択と同じ挙動)。
  const { fighters, visibleSlugs, slugA, slugB } = await resolveDreamSlugs(sp);
  const eventName = sanitizeParam(param(sp, "event"), 60);
  const weightClass = sanitizeParam(param(sp, "weight"), 20);

  const fighterA = slugA ? getFighter(slugA) : undefined;
  const fighterB = slugB ? getFighter(slugB) : undefined;
  const records = await fetchFighterRecords();
  const entryA = fighterA ? (records[fighterA.slug] ?? null) : null;
  const entryB = fighterB ? (records[fighterB.slug] ?? null) : null;

  const canGenerate = !!fighterA && !!fighterB && !!entryA && !!entryB && fighterA.slug !== fighterB.slug;
  const canGenerateV2 = canGenerate && !entryA!.noRecordData && !entryB!.noRecordData;

  // 夢のカードはデータ比較(戦績・勝率・共通対戦相手)が主役で、階級跨ぎOKの
  // 設計上そもそも階級表記は不要(実在の対戦であるかのように誤読させないため
  // 見出しから階級を外す)。表示用の見出しラベルのみで、階級パラメータ(wc)は
  // シェアURLに含めない(長大なURLエンコードを避ける)。
  const weightLabel = fighterA && fighterB ? "夢のマッチ" : undefined;

  // 共有先・「このカードのページへ」リンクは正規順(スラッグ辞書順)の/vs URLに統一する
  // (spec §1.2)。/dream側の画面表示順(A/B選択順)は変えない。
  const normalized = canGenerate && fighterA && fighterB ? normalizeVsSlugs(fighterA.slug, fighterB.slug) : null;
  const vsPagePath = normalized ? `/vs/${normalized.a}/${normalized.b}` : null;
  const shareUrl = vsPagePath ? `${SITE_URL}${vsPagePath}` : null;
  const shareText =
    canGenerate && fighterA && fighterB ? buildVsShareText(fighterA.nameJa, fighterB.nameJa) : "";

  // v2(dreamMode)フローのシェアは、大会名・階級を反映した専用OGP
  // (/api/og/dream)を持つ/dream自身のパラメータ付きURLに向ける(/vsの
  // 実カードOGPとは意図的に別ブランド)。文言も夢のカード専用のものを使う。
  let dreamShareUrl: string | null = null;
  let dreamShareText = "";
  if (canGenerateV2 && fighterA && fighterB) {
    const q = new URLSearchParams({ a: fighterA.slug, b: fighterB.slug });
    if (eventName) q.set("event", eventName);
    if (weightClass) q.set("weight", weightClass);
    dreamShareUrl = `${SITE_URL}/dream?${q.toString()}`;
    dreamShareText = buildDreamShareText(fighterA.nameJa, fighterB.nameJa, eventName || undefined);
  }

  return (
    <>
      <Nav />
      <div className="page-head">
        <div className="page-title">夢のカード</div>
        <div className="page-sub">
          任意の2選手を選んで、実現したら見てみたい対戦カードを作れます。階級をまたいだ組み合わせもOKです。
        </div>
      </div>

      {isV2 ? (
        <DreamPickerV2
          fighters={fighters}
          initialA={slugA}
          initialB={slugB}
          initialEvent={eventName}
          initialWeight={weightClass}
          preview={isV2}
        />
      ) : (
        <DreamPicker fighters={fighters} initialA={slugA} initialB={slugB} />
      )}

      <div id="dream-card-v2" style={{ padding: "0 24px 40px" }}>
        {isV2 ? (
          canGenerateV2 && fighterA && fighterB ? (
            <>
              <VsCard
                nameA={fighterA.nameJa}
                nameB={fighterB.nameJa}
                slugA={fighterA.slug}
                slugB={fighterB.slug}
                nicknameA={fighterA.nickname}
                nicknameB={fighterB.nickname}
                entryA={entryA!}
                entryB={entryB!}
                visibleSlugs={visibleSlugs}
                dreamMode
                eventName={eventName || undefined}
                weightClass={weightClass || undefined}
              />
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <XShareLink
                  text={dreamShareText}
                  url={dreamShareUrl!}
                  style={{
                    display: "inline-block",
                    padding: "10px 20px",
                    background: "#000",
                    color: "#fff",
                    fontWeight: 700,
                    borderRadius: 4,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  𝕏 でシェア
                </XShareLink>
              </div>
            </>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
              選手を2人選ぶとカードが表示されます。
            </p>
          )
        ) : canGenerate && fighterA && fighterB ? (
          <>
            <BoutCard
              nameA={fighterA.nameJa}
              nameB={fighterB.nameJa}
              slugA={fighterA.slug}
              slugB={fighterB.slug}
              entryA={entryA}
              entryB={entryB}
              visibleSlugs={visibleSlugs}
              weightClass={weightLabel}
            />
            <div style={{ marginTop: 16 }}>
              <XShareLink
                text={shareText}
                url={shareUrl!}
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  background: "#000",
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: 4,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                𝕏 でシェア
              </XShareLink>
            </div>
          </>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 13, padding: "24px 0" }}>
            選手を2人選ぶとカードが表示されます。
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}
