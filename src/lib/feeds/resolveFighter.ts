import { Fighter, FightRecord } from "../fighters";
import { fetchWikiFighterRecord } from "./wikipedia";

export interface ResolvedFighter extends Fighter {
  history: FightRecord[];
  live: boolean;
}

export async function resolveFighter(fighter: Fighter): Promise<ResolvedFighter> {
  if (!fighter.wikiTitleEn) return { ...fighter, live: false };

  try {
    const wiki = await fetchWikiFighterRecord(fighter.wikiTitleEn);
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
      };
    }
  } catch {
    // fall back to seed data below
  }
  return { ...fighter, live: false };
}

export async function resolveFighters(fighters: Fighter[]): Promise<ResolvedFighter[]> {
  return Promise.all(fighters.map(resolveFighter));
}
