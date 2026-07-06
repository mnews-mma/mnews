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

// タグを付与してよい選手 = 二次PRで hidden→公開昇格した「新規表示分」だけ。
// 既存公開選手(シード原選手・chunk3外国人など、二次以前から hidden=false)は
// タグ付与しない(不可侵)。既存公開でタグ該当する選手はレポートで人間判断へ回す。
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

// 選手のタグを導出。orgRankings は fetchOrgRankings() の結果。
// 付与ルール:
//   - 新規公開昇格分(NEW_TAGGED_SLUGS) … DEEP / パンクラス / 修斗(現ランカーは順位つき)。
//   - それ以外(=追加前の既存公開選手) … UFC / RIZIN のみ(今回の明示例外)。新規分・スタブには
//     UFC/RIZINを付けない。DEEP/パンクラス/修斗を既存公開に付けない(不可侵)。
export function computeFighterTags(f: TaggableFighter, orgRankings: OrgRankingsFile): OrgTag[] {
  const tags: OrgTag[] = [];

  if (NEW_TAGGED_SLUGS.has(f.slug)) {
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
    // DEEP = 2026以降ナンバー本戦出場(階級のみ・順位なし)
    if (isDeep2026(f.nameJa)) {
      tags.push({ key: "deep", label: ORG_TAG_LABEL.deep, weightClass: f.weightClass });
    }
  } else {
    // 既存公開選手(不可侵の明示例外): UFC / RIZIN のみ付与。
    if (f.org === "ufc") {
      tags.push({ key: "ufc", label: ORG_TAG_LABEL.ufc, weightClass: f.weightClass });
    }
    if (isRizin2026(f.nameJa)) {
      tags.push({ key: "rizin", label: ORG_TAG_LABEL.rizin, weightClass: f.weightClass });
    }
  }

  return tags;
}
