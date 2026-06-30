import { Fighter, FightRecord } from "../fighters";
import { fetchWikiFighterRecord, fetchJaWikiFighterRecord, WikiFighterData } from "./wikipedia";
import { fetchUfcNickname } from "./ufc";

export interface ResolvedFighter extends Fighter {
  history: FightRecord[];
  live: boolean;
  nickname?: string;
  birthPlace?: string;
  age?: number;
}

export async function resolveFighter(fighter: Fighter): Promise<ResolvedFighter> {
  // wikiTitleJa が未指定の選手も、日本語版Wikipediaは大半が日本語表記名と
  // 同じページ名で存在するため nameJa をデフォルトのタイトルとして試す。
  const jaTitle = fighter.wikiTitleJa ?? fighter.nameJa;
  const [enWiki, jaWiki, ufcNickname] = await Promise.all([
    fighter.wikiTitleEn ? fetchWikiFighterRecord(fighter.wikiTitleEn).catch(() => null) : null,
    fetchJaWikiFighterRecord(jaTitle).catch(() => null),
    fighter.ufcSlug ? fetchUfcNickname(fighter.ufcSlug).catch(() => null) : null,
  ]);

  // 戦績テーブルは日本語版Wikipediaを優先し、無ければ英語版にフォールバックする。
  const wiki: WikiFighterData | null = jaWiki && jaWiki.history.length > 0 ? jaWiki : enWiki;

  // ニックネームはこれまで通り「UFC公式 → 英語版Wikipedia → 日本語版Wikipedia」
  // の優先順を維持する（戦績の参照元を変えても通称表示は変えない）。
  const nicknameWiki = enWiki ?? jaWiki;
  const nickname = fighter.noNickname ? undefined : ufcNickname ?? nicknameWiki?.infobox.nickname;

  if (wiki) {
    return {
      ...fighter,
      wins: wiki.wins,
      losses: wiki.losses,
      draws: wiki.draws,
      ko: wiki.ko,
      sub: wiki.sub,
      decision: wiki.decision,
      history: wiki.history,
      live: true,
      nickname,
      birthPlace: wiki.infobox.birthPlace,
      age: wiki.infobox.age,
    };
  }

  return { ...fighter, live: false, nickname };
}

export async function resolveFighters(fighters: Fighter[]): Promise<ResolvedFighter[]> {
  return Promise.all(fighters.map(resolveFighter));
}
