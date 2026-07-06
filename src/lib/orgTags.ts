// 団体タグの付与ロジック(基盤)。"所属歴"ではなく"現在の立場/直近の実態"で付ける。
//   パンクラス … 現ランカーのみ(公式ランキング掲載選手)
//   しゅうと   … 現ランカーのみ(同上)
//   DEEP       … 2026以降のナンバーシリーズ(DEEP.### 本戦)出場者のみ
//   RIZIN      … 2026年1月以降にRIZIN主催のMMA興行に出場した選手のみ
// 順位はパンクラス/修斗タグにのみ紐づく付加情報。DEEP/RIZINは階級のみ(順位なし)。
// 順位・タグは静的に選手へ書かず、ランキングデータ+EVENT_RESULTSから毎回導出する
// (＝既存公開選手のデータを一切書き換えない)。
import { EVENT_RESULTS } from "./eventResults";
import type { OrgRankingsFile } from "./orgRankingsData";

export type OrgTagKey = "pancrase" | "shooto" | "deep" | "rizin";

export const ORG_TAG_LABEL: Record<OrgTagKey, string> = {
  pancrase: "パンクラス",
  shooto: "しゅうと",
  deep: "DEEP",
  rizin: "RIZIN",
};

export interface OrgTag {
  key: OrgTagKey;
  label: string;
  weightClass?: string; // タグに紐づく階級(パンクラス/修斗=順位の階級、DEEP/RIZIN=選手の主戦階級)
  rank?: string; // パンクラス/修斗のみ(王者/暫定王者/番号)。DEEP/RIZINは無し
}

const norm = (s: string) => s.replace(/[\s　・☆]/g, "");

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
}

// 選手のタグを導出。orgRankings は fetchOrgRankings() の結果。
export function computeFighterTags(f: TaggableFighter, orgRankings: OrgRankingsFile): OrgTag[] {
  const tags: OrgTag[] = [];

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
  // RIZIN = 2026以降RIZIN MMA出場(階級のみ・順位なし)
  if (isRizin2026(f.nameJa)) {
    tags.push({ key: "rizin", label: ORG_TAG_LABEL.rizin, weightClass: f.weightClass });
  }

  return tags;
}
