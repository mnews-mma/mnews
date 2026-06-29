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
  const [enWiki, jaWiki, ufcNickname] = await Promise.all([
    fighter.wikiTitleEn ? fetchWikiFighterRecord(fighter.wikiTitleEn).catch(() => null) : null,
    fighter.wikiTitleJa ? fetchJaWikiFighterRecord(fighter.wikiTitleJa).catch(() => null) : null,
    fighter.ufcSlug ? fetchUfcNickname(fighter.ufcSlug).catch(() => null) : null,
  ]);

  // 英語版に戦績テーブルがあればそれを優先し、無ければ日本語版
  // （{{Fight-cont}}）にフォールバックする。
  const wiki: WikiFighterData | null = enWiki && enWiki.history.length > 0 ? enWiki : jaWiki;

  // UFC公式プロフィールのニックネームを優先する（Wikipediaの other_names は
  // 古い/誤った通称が残っていることがあるため）。
  // fighter.noNickname を立てた選手は常に通称を非表示にする。
  const nickname = fighter.noNickname ? undefined : ufcNickname ?? wiki?.infobox.nickname;

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
