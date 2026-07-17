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
import { normalizeVsSlugs, buildVsShareText } from "@/lib/vsPairing";
import { pageMetadata } from "@/lib/seo";

const SITE_URL = "https://www.mnews.jp";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "夢のカード | 任意の2選手でVS対戦カードを作る - Mニュース",
  description:
    "任意の2選手を選んで仮想の対戦カードを作成。戦績・フィニッシュ率・直近5戦・共通対戦相手を並べて比較し、Xでシェアできます。",
  path: "/dream",
});

function param(sp: Record<string, string | string[] | undefined>, key: string): string {
  const raw = sp[key];
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
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
  const visible = await getVisibleFighters();
  const fighters = visible.map((f) => ({ slug: f.slug, nameJa: f.nameJa, weightClass: f.weightClass }));
  const visibleSlugs = new Set(fighters.map((f) => f.slug));

  // URLのa/bが未指定・不正な場合は候補の先頭2人にフォールバックする
  // (Xカードツールの初期選択と同じ挙動)。
  const reqA = param(sp, "a");
  const reqB = param(sp, "b");
  const slugA = visibleSlugs.has(reqA) ? reqA : (fighters[0]?.slug ?? "");
  const slugB = visibleSlugs.has(reqB) ? reqB : (fighters[1]?.slug ?? "");

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
        <DreamPickerV2 fighters={fighters} initialA={slugA} initialB={slugB} preview={isV2} />
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
              />
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
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
