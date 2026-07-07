// パンクラス/修斗/DEEPのランキングJSON(今回のスナップショット vs 前回)を
// 団体×階級で比較し、変化のあった項目だけ抽出する(投稿ドラフト①タブ②用)。
// 捏造ゼロ: 両スナップショットに実在するデータの差分のみを返す。
import type { OrgRankingData, RankEntry } from "./orgRankings";

const norm = (s: string) => s.replace(/[\s　・☆]/g, "");

export type RankChangeKind =
  | "champion_change" // 王者交代
  | "vacant_to_champion" // 空位→新王者
  | "champion_to_vacant" // 王者→空位
  | "rank_up" // 順位上昇
  | "rank_down" // 順位下降
  | "new_entry" // 新規ランクイン
  | "dropped_out"; // ランク外

export interface RankChange {
  org: OrgRankingData["org"];
  weightClass: string;
  kind: RankChangeKind;
  name: string; // 対象選手の公式表記名
  slug: string | null;
  // rank_up/rank_down用(数値順位の前後比較)
  fromRank?: string;
  toRank?: string;
}

function isVacant(name: string): boolean {
  return name === "空位" || name === "";
}

function championEntry(entries: RankEntry[]): RankEntry | null {
  return entries.find((e) => /^王者$/.test(e.rank)) ?? null;
}

function numericEntries(entries: RankEntry[]): RankEntry[] {
  return entries.filter((e) => /^\d+$/.test(e.rank));
}

function diffClass(org: OrgRankingData["org"], weightClass: string, prevEntries: RankEntry[], curEntries: RankEntry[]): RankChange[] {
  const changes: RankChange[] = [];

  // 王者交代・空位絡み
  const prevChamp = championEntry(prevEntries);
  const curChamp = championEntry(curEntries);
  const prevChampName = prevChamp && !isVacant(prevChamp.officialName) ? prevChamp.officialName : null;
  const curChampName = curChamp && !isVacant(curChamp.officialName) ? curChamp.officialName : null;

  if (prevChampName && curChampName && norm(prevChampName) !== norm(curChampName)) {
    changes.push({ org, weightClass, kind: "champion_change", name: curChampName, slug: curChamp!.slug });
  } else if (!prevChampName && curChampName) {
    changes.push({ org, weightClass, kind: "vacant_to_champion", name: curChampName, slug: curChamp!.slug });
  } else if (prevChampName && !curChampName) {
    changes.push({ org, weightClass, kind: "champion_to_vacant", name: prevChampName, slug: prevChamp!.slug });
  }

  // 数値順位の変動(王者/暫定は対象外。名前一致で前後の順位を比較)
  const prevNum = numericEntries(prevEntries);
  const curNum = numericEntries(curEntries);
  const prevByName = new Map(prevNum.map((e) => [norm(e.officialName), e]));
  const curByName = new Map(curNum.map((e) => [norm(e.officialName), e]));

  for (const [key, cur] of curByName) {
    const prev = prevByName.get(key);
    if (!prev) {
      changes.push({ org, weightClass, kind: "new_entry", name: cur.officialName, slug: cur.slug, toRank: cur.rank });
      continue;
    }
    const prevN = parseInt(prev.rank, 10);
    const curN = parseInt(cur.rank, 10);
    if (curN < prevN) {
      changes.push({ org, weightClass, kind: "rank_up", name: cur.officialName, slug: cur.slug, fromRank: prev.rank, toRank: cur.rank });
    } else if (curN > prevN) {
      changes.push({ org, weightClass, kind: "rank_down", name: cur.officialName, slug: cur.slug, fromRank: prev.rank, toRank: cur.rank });
    }
  }
  for (const [key, prev] of prevByName) {
    if (!curByName.has(key)) {
      changes.push({ org, weightClass, kind: "dropped_out", name: prev.officialName, slug: prev.slug, fromRank: prev.rank });
    }
  }

  return changes;
}

export function diffRankings(prev: OrgRankingData | undefined, cur: OrgRankingData | undefined): RankChange[] {
  if (!cur) return [];
  if (!prev) return []; // 前回データが無い(初回)は「変化」を出さない(誤検知防止)
  const changes: RankChange[] = [];
  const prevClasses = new Map(prev.classes.map((c) => [c.weightClass, c.entries]));
  for (const c of cur.classes) {
    const prevEntries = prevClasses.get(c.weightClass);
    if (!prevEntries) continue; // 新設階級は初回のため比較対象なし(誤検知防止)
    changes.push(...diffClass(cur.org, c.weightClass, prevEntries, c.entries));
  }
  return changes;
}

// ドラフト本文用の定型文テンプレート
export function rankChangeText(c: RankChange, orgLabel: string, siteUrl: string): string {
  const url = c.slug ? `${siteUrl}/fighters/${c.slug}` : "";
  const suffix = url ? `\n${url}` : "";
  switch (c.kind) {
    case "champion_change":
      return `【${orgLabel} ${c.weightClass}】新王者${c.name}が誕生。${suffix}`;
    case "vacant_to_champion":
      return `【${orgLabel} ${c.weightClass}】空位から${c.name}が新王者に。${suffix}`;
    case "champion_to_vacant":
      return `【${orgLabel} ${c.weightClass}】王座が空位に(前王者:${c.name})。`;
    case "rank_up":
      return `【${orgLabel} ${c.weightClass}】${c.name}が${c.fromRank}位→${c.toRank}位に上昇。${suffix}`;
    case "rank_down":
      return `【${orgLabel} ${c.weightClass}】${c.name}が${c.fromRank}位→${c.toRank}位に後退。${suffix}`;
    case "new_entry":
      return `【${orgLabel} ${c.weightClass}】${c.name}がランクイン(${c.toRank}位)。${suffix}`;
    case "dropped_out":
      return `【${orgLabel} ${c.weightClass}】${c.name}がランク外に(前回${c.fromRank}位)。`;
  }
}
