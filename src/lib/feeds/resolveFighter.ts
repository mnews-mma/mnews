import { Fighter, FightRecord } from "../fighters";
import { fetchWikiFighterRecord, fetchJaWikiFighterRecord, WikiFighterData } from "./wikipedia";
import { fetchUfcNickname } from "./ufc";
import { deriveHistoryFromEventResults } from "../fighterRecordFromResults";

export interface ResolvedFighter extends Fighter {
  history: FightRecord[];
  live: boolean;
  nickname?: string;
  birthPlace?: string;
  age?: number;
  // ja-wikiのフル戦績が取れず、生涯戦績を出せない選手。薄い自社数戦を生涯戦績の
  // ように見せず「データなし」を明示するためのフラグ(捏造ゼロ・集約思想)。
  noRecordData?: boolean;
}

// ja-wiki記事が「同一人物」かの検証: ja-wikiの戦績に、自社EVENT_RESULTS由来の
// 履歴と同じ相手(正規化名一致)が1件でも含まれるか。含まれれば同一人物と判断して
// フル戦績を採用、含まれなければ同名別人リスクとして棄却する(決定論的な同名別人ガード)。
function historiesOverlap(wikiHistory: FightRecord[], derived: FightRecord[]): boolean {
  if (derived.length === 0) return false;
  const norm = (s: string) => s.replace(/[\s　・☆]/g, "");
  const wikiOpp = new Set(wikiHistory.map((h) => norm(h.opponent)));
  return derived.some((h) => wikiOpp.has(norm(h.opponent)));
}

export async function resolveFighter(fighter: Fighter): Promise<ResolvedFighter> {
  // wikiTitleJa が未指定の選手も、日本語版Wikipediaの記事名は「姓名」の間に
  // スペースを含まないのが通例（MediaWiki APIはスペース付きタイトルを別物として
  // 扱い missingtitle エラーになる）ため、nameJa からスペースを除いたものを
  // デフォルトのタイトルとして試す。
  // recordFromResults 選手(DEEP等のスタブ)は wikiTitle を明示していない限り
  // 日本語版の既定タイトル推測をしない。同名(例「中村大介」)の別人記事を
  // 誤って戦績に注入するのを防ぐため。戦績は自社 EVENT_RESULTS から組み立てる。
  // 国内勢(recordFromResults)も ja-wiki を試す。既定タイトル(nameJaのスペース除去)で
  // 引き、同名別人は下の overlap ガードで弾く。これで DEEP/修斗/パンクラス勢にも生涯戦績を
  // 補完する(取れなければ no data)。
  const jaTitle = fighter.wikiTitleJa ?? fighter.nameJa.replace(/\s/g, "");
  const [enWiki, jaWikiRaw, ufcNickname] = await Promise.all([
    fighter.wikiTitleEn ? fetchWikiFighterRecord(fighter.wikiTitleEn).catch(() => null) : null,
    fetchJaWikiFighterRecord(jaTitle).catch(() => null),
    !fighter.nickname && fighter.ufcSlug ? fetchUfcNickname(fighter.ufcSlug).catch(() => null) : null,
  ]);

  // 同名別人ガード: wikiTitleJa を明示していない recordFromResults 選手は、既定タイトル推測で
  // 別人記事に当たる恐れがある。ja-wiki戦績が自社EVENT_RESULTS履歴と相手名で重なる時だけ採用。
  let jaWiki = jaWikiRaw;
  if (fighter.recordFromResults && !fighter.wikiTitleJa && jaWikiRaw) {
    const derived = deriveHistoryFromEventResults(fighter.nameJa);
    if (!historiesOverlap(jaWikiRaw.history, derived)) jaWiki = null; // 別人リスク→棄却
  }

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

  // recordFromResults 選手で ja-wiki のフル戦績が取れなかった場合は「データなし」。
  // 薄い自社数戦を生涯戦績のように見せない(捏造ゼロ・薄いものを出さない)。
  if (fighter.recordFromResults && !wikiHasRecord) {
    return {
      ...fighter,
      wins: 0,
      losses: 0,
      draws: 0,
      ko: 0,
      sub: 0,
      decision: 0,
      history: [],
      noRecordData: true,
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
