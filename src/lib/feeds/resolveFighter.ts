import { Fighter, FightRecord } from "../fighters";
import { fetchWikiFighterRecord } from "./wikipedia";
import { fetchUfcNickname } from "./ufc";

export interface ResolvedFighter extends Fighter {
  history: FightRecord[];
  live: boolean;
  nickname?: string;
  birthPlace?: string;
  age?: number;
}

export async function resolveFighter(fighter: Fighter): Promise<ResolvedFighter> {
  const [wiki, ufcNickname] = await Promise.all([
    fighter.wikiTitleEn ? fetchWikiFighterRecord(fighter.wikiTitleEn).catch(() => null) : null,
    fighter.ufcSlug ? fetchUfcNickname(fighter.ufcSlug).catch(() => null) : null,
  ]);

  // UFC公式プロフィールのニックネームを優先する（Wikipediaの other_names は
  // 古い/誤った通称が残っていることがあるため）。
  const nickname = ufcNickname ?? wiki?.infobox.nickname;

  if (wiki && wiki.history.length > 0) {
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
