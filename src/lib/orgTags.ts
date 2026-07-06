// 団体タグの付与ロジック(基盤)。"所属歴"ではなく"現在の立場/直近の実態"で付ける。
//   パンクラス … 現ランカーのみ(公式ランキング掲載選手)
//   修斗       … 現ランカーのみ(同上)
//   DEEP       … 2026以降のナンバーシリーズ(DEEP.### 本戦)出場者のみ
//   RIZIN      … 2026年1月以降にRIZIN主催のMMA興行に出場した選手のみ
// 順位はパンクラス/修斗タグにのみ紐づく付加情報。DEEP/RIZINは階級のみ(順位なし)。
// 順位・タグは静的に選手へ書かず、ランキングデータ+EVENT_RESULTSから毎回導出する
// (＝既存公開選手のデータを一切書き換えない)。
import { EVENT_RESULTS } from "./eventResults";
import type { OrgRankingsFile } from "./orgRankingsData";

export type OrgTagKey = "ufc" | "rizin" | "deep" | "pancrase" | "shooto";

export const ORG_TAG_LABEL: Record<OrgTagKey, string> = {
  ufc: "UFC",
  rizin: "RIZIN",
  deep: "DEEP",
  pancrase: "パンクラス",
  shooto: "修斗",
};

export interface OrgTag {
  key: OrgTagKey;
  label: string;
  weightClass?: string; // タグに紐づく階級(パンクラス/修斗=順位の階級、他=選手の主戦階級)
  rank?: string; // パンクラス/修斗のみ(王者/暫定王者/番号)。UFC/RIZIN/DEEPは無し
}

const norm = (s: string) => s.replace(/[\s　・☆]/g, "");

// 二次PR以降に hidden→公開昇格した「新規表示分」の選手集合。
// 注: 団体タグ付与のゲートとしては使わない(computeFighterTagsは全選手に一律適用)。
// 現在は /deep-2026 の一覧を「新規昇格分のDEEP2026出場者」に絞る用途のみで参照する。
export const NEW_TAGGED_SLUGS = new Set<string>([
  "ohara-juri", "kuramoto-daigo", "shimada-ibuki", "sakai-ryo", "sekihara-sho", "rikiya",
  "gomyo-hiroto", "tsubaki-asuka", "hibino-junya", "kenshiro", "nakatani-yuga", "suzuki-taisei",
  "ushiku-kentaro", "muramoto-yutaro", "hiramatsu-sho", "sugiyama-sora", "abe-daiji", "takizawa-kenta",
  "nakamura-daisuke", "izumi-takeshi", "kindaichi-kosuke", "kubota-taito", "kozaki-ren", "seigo",
  "suwabe-teppei", "sugino-aren", "daiya", "strasser-kiichi", "kinoshita-karate", "naito-tank",
  "arato-hidetaka", "terasaki-ryu", "miyabi-shunsuke", "karino-yu", "yamamoto-soushi", "kadono-kohei",
  "ryoga", "takaoka-hiroki", "nakamura-yusaku", "nagai-kanata", "saito-shoji", "nose-shohei",
  "sasuke", "hikaru", "aoi-taichi", "tateo", "toma", "goto-ryo", "captain-africa", "nishio-shinsuke",
  "barboza-rafael", "kamiya-daichi", "kasuya-yusuke", "yanagawa-yuito", "rajabov-otabek", "hirata-naoki",
  "tajima-ryo", "matsui-ryo", "imura-rui",
  "shimizu-hiroto", "otsuka-tomoki",
  // DEEP133 IMPACT突合(2026-07)で追加した新規DEEP選手
  "nishitani-taisei", "shibisai-shoma", "kitakata-daichi", "kaito", "mitsui-shunki",
  "shirakawa-rikuto", "kitaoka-satoru", "yamasaki-yajuro", "nakatsukasa-taiyo", "max-yoshida",
  "okumura-airu",
  // 手動追加6名(2026-07)
  "park-siwoo", "lee-yeji", "miyake-kisa", "aoi-jin", "hamada-takumi", "tenya",
]);

// DEEP 2026以降のナンバー本戦出場者(名前集合)
const DEEP_2026_SLUGS = new Set(["deep-130-impact", "deep-131-impact", "deep-132-impact"]);
const deep2026Names = new Set<string>();
for (const e of EVENT_RESULTS) {
  if (!DEEP_2026_SLUGS.has(e.slug)) continue;
  for (const f of e.fights) {
    if (f.fighterA) deep2026Names.add(norm(f.fighterA));
    if (f.fighterB) deep2026Names.add(norm(f.fighterB));
  }
}

// 2026年1月以降にRIZIN主催MMA興行に出場した選手(名前集合)。
// EVENT_RESULTS の org==="rizin" はMMA興行のみ(キック=RIZIN FIGHTは含まれない)。
const rizin2026Names = new Set<string>();
for (const e of EVENT_RESULTS) {
  if (e.org !== "rizin" || e.date < "2026-01-01") continue;
  for (const f of e.fights) {
    if (f.fighterA) rizin2026Names.add(norm(f.fighterA));
    if (f.fighterB) rizin2026Names.add(norm(f.fighterB));
  }
}

// 選手の weightClass ラベルを Mニュース5階級へ。5階級外(ストロー/ウェルター/ミドル/
// 女子)は null。DEEPメガトン等はヘビー級に寄せる。DEEP一覧のグルーピングに使う。
export type FiveClass = "フライ級" | "バンタム級" | "フェザー級" | "ライト級" | "ヘビー級";
export const FIVE_CLASSES: FiveClass[] = ["フライ級", "バンタム級", "フェザー級", "ライト級", "ヘビー級"];
export function toFiveClass(weightClass: string): FiveClass | null {
  const w = weightClass;
  if (/女子|アトム/.test(w)) return null;
  if (/メガトン|スーパーヘビー|ヘビー級/.test(w)) return "ヘビー級";
  if (/ストロー|ウェルター|ミドル|ライトヘビー/.test(w)) return null;
  if (/フライ級/.test(w)) return "フライ級";
  if (/バンタム級/.test(w)) return "バンタム級";
  if (/フェザー級/.test(w)) return "フェザー級";
  if (/ライト級/.test(w)) return "ライト級";
  return null;
}

export function isDeep2026(nameJa: string): boolean {
  return deep2026Names.has(norm(nameJa));
}
export function isRizin2026(nameJa: string): boolean {
  return rizin2026Names.has(norm(nameJa));
}

export interface TaggableFighter {
  slug: string;
  nameJa: string;
  weightClass: string;
  org: string;
}

// 選手の団体タグを導出。orgRankings は fetchOrgRankings() の結果。
// 全選手に同じ基準で一律適用する(旧NEW_TAGGED_SLUGSゲートは撤去)。団体表示は
// このタグ1系統に統一され、/fighters・選手ページ・Xカードで同じ結果になる。
// 付与ルール("所属歴"ではなく"現在の立場/直近の実態"で付ける):
//   UFC       … fighter.org === "ufc"(UFC所属/出場)。
//   RIZIN     … 2026年以降にRIZIN主催MMA興行へ出場(EVENT_RESULTS由来)。過去の単発
//               出場者や2026未出場者には付けない(fighter.orgでは判定しない)。
//   DEEP      … 2026以降ナンバー本戦出場(EVENT_RESULTS由来) または fighter.org === "deep"。
//   パンクラス … 現ランカー(公式ランキングに slug 一致で掲載・順位つき)。
//   修斗       … 現ランカー(同上)。
// 並び順は表示フィルタと揃える: UFC / RIZIN / DEEP / パンクラス / 修斗。
export function computeFighterTags(f: TaggableFighter, orgRankings: OrgRankingsFile): OrgTag[] {
  const tags: OrgTag[] = [];

  if (f.org === "ufc") {
    tags.push({ key: "ufc", label: ORG_TAG_LABEL.ufc, weightClass: f.weightClass });
  }
  if (isRizin2026(f.nameJa)) {
    tags.push({ key: "rizin", label: ORG_TAG_LABEL.rizin, weightClass: f.weightClass });
  }
  if (isDeep2026(f.nameJa) || f.org === "deep") {
    tags.push({ key: "deep", label: ORG_TAG_LABEL.deep, weightClass: f.weightClass });
  }
  // パンクラス/修斗 = 現ランカー(公式ランキングに slug 一致で載っている)
  for (const key of ["pancrase", "shooto"] as const) {
    const data = orgRankings[key];
    if (!data) continue;
    for (const c of data.classes) {
      const hit = c.entries.find((e) => e.slug === f.slug);
      if (hit) {
        tags.push({ key, label: ORG_TAG_LABEL[key], weightClass: c.weightClass, rank: hit.rank });
        break;
      }
    }
  }

  return tags;
}
