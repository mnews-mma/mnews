import { Fighter, FightRecord } from "../fighters";
import { fetchWikiFighterRecord, fetchJaWikiFighterRecord, WikiFighterData } from "./wikipedia";
import { fetchUfcNickname } from "./ufc";
import { deriveHistoryFromEventResults, deriveRecordCounts } from "../fighterRecordFromResults";

export interface ResolvedFighter extends Fighter {
  history: FightRecord[];
  live: boolean;
  nickname?: string;
  birthPlace?: string;
  age?: number;
}

export async function resolveFighter(fighter: Fighter): Promise<ResolvedFighter> {
  // wikiTitleJa が未指定の選手も、日本語版Wikipediaの記事名は「姓名」の間に
  // スペースを含まないのが通例（MediaWiki APIはスペース付きタイトルを別物として
  // 扱い missingtitle エラーになる）ため、nameJa からスペースを除いたものを
  // デフォルトのタイトルとして試す。
  // recordFromResults 選手(DEEP等のスタブ)は wikiTitle を明示していない限り
  // 日本語版の既定タイトル推測をしない。同名(例「中村大介」)の別人記事を
  // 誤って戦績に注入するのを防ぐため。戦績は自社 EVENT_RESULTS から組み立てる。
  const jaTitle =
    fighter.wikiTitleJa ??
    (fighter.recordFromResults ? null : fighter.nameJa.replace(/\s/g, ""));
  const [enWiki, jaWiki, ufcNickname] = await Promise.all([
    fighter.wikiTitleEn ? fetchWikiFighterRecord(fighter.wikiTitleEn).catch(() => null) : null,
    jaTitle ? fetchJaWikiFighterRecord(jaTitle).catch(() => null) : null,
    !fighter.nickname && fighter.ufcSlug ? fetchUfcNickname(fighter.ufcSlug).catch(() => null) : null,
  ]);

  // 戦績テーブルは日本語版Wikipediaを優先し、無ければ英語版にフォールバックする。
  const wiki: WikiFighterData | null = jaWiki && jaWiki.history.length > 0 ? jaWiki : enWiki;

  // Wikipediaの戦績を「有効」とみなす条件を厳しめに: 履歴が1件以上あり、かつ
  // 勝敗引き分けの合計が1以上。記事が同名別人・曖昧回避ページ・戦績表の無い
  // 記事に解決してしまうと wins/losses が 0 のゴミレコードが注入されるため、
  // その場合は wiki を無効扱いにして recordFromResults(自社結果)へフォールバックする。
  const wikiHasRecord =
    !!wiki && wiki.history.length > 0 && wiki.wins + wiki.losses + wiki.draws > 0;

  // ニックネームの優先順位:
  // 1. fighter.nickname（固定値・直接指定）
  // 2. noNickname フラグが立っていれば非表示
  // 3. UFC公式 → 英語版Wikipedia → 日本語版Wikipedia の自動取得
  const nicknameWiki = enWiki ?? jaWiki;
  const nickname =
    fighter.nickname ?? (fighter.noNickname ? undefined : ufcNickname ?? nicknameWiki?.infobox.nickname);

  // recordFromResults 選手(Wikipedia記事の無いDEEP等のスタブ)は、自社
  // EVENT_RESULTS を選手軸に組み替えた戦績を注入する。Wikipediaの戦績テーブルが
  // 取れた場合はそちら(生涯戦績)を優先する。
  if (fighter.recordFromResults && !wikiHasRecord) {
    const history = deriveHistoryFromEventResults(fighter.nameJa);
    const counts = deriveRecordCounts(history);
    return {
      ...fighter,
      ...counts,
      history,
      live: false,
      nickname,
    };
  }

  if (wikiHasRecord && wiki) {
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
