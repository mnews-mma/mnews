// RIZIN王座戦(タイトルマッチ・王座決定戦)の勝利数を、戦績データ
// (data/fighterRecords.json)から機械的に導出する(2026-07-26追加)。
//
// なぜ手書きの「元王者リスト」を作らないか:
// - champions.ts は現王者のスナップショットしか持たず、元王者(王座を失った
//   選手)を表現できない。手書きの元王者リストを足すと保守コストが増え、
//   実データとの乖離(更新漏れ)も生む。
// - 一方で戦績データには、各boutの weightClass / event に
//   「【RIZINライト級タイトルマッチ】」「【初代RIZINライト級王座決定戦】」という
//   公式表記がそのまま入っている。ここから数えれば捏造ゼロで、今後の
//   タイトル戦にも自動追従する(人手の更新が不要)。
//
// 数え方: RIZIN王座戦での「勝利数」= 戴冠1回 + 防衛n回。
//   例) ホベルト・サトシ・ソウザ = 6
//       (2021-06-13 初代RIZINライト級王座決定戦○ + タイトルマッチ○×5)
// 王座戦での敗北(失冠・挑戦失敗)は減点しない。P4Pで評価したいのは
// 「ベルトを獲り、防衛した実績」そのものであり、失冠は現在のレート
// (rawRating)側に既に反映されているため二重に罰しない。
//
// 他団体(REAL / DEEP / Bellator 等)の王座は数えない。mnewsレーティングが
// RIZIN開催のMMA試合のみで算出されている以上、実績側だけ他団体を混ぜると
// 評価軸が食い違うため(例: 野村駿太のDEEPライト級王座はここでは数えない)。

// data/fighterRecords.json の history 要素のうち、王座判定に使う項目だけを
// 構造的に受ける(engine.ts の型に結合させない)。
export interface TitleBoutLike {
  result?: string;
  event?: string | null;
  weightClass?: string | null;
}

// RIZINの王座戦かどうか。weightClassとeventの両方を連結して判定する
// (どちらに公式表記が入るかはデータ由来で揺れがあるため)。
// 「RIZIN」を含むことを必須にして、他団体の王座戦を除外する。
export function isRizinTitleBout(bout: TitleBoutLike): boolean {
  const text = `${bout.weightClass ?? ""} ${bout.event ?? ""}`;
  if (!text.includes("RIZIN")) return false;
  return text.includes("タイトルマッチ") || text.includes("王座決定");
}

// RIZIN王座戦での勝利数(= 戴冠 + 防衛)。
export function countRizinTitleWins(history: TitleBoutLike[] | undefined | null): number {
  if (!history) return 0;
  let wins = 0;
  for (const bout of history) {
    if (bout.result === "win" && isRizinTitleBout(bout)) wins += 1;
  }
  return wins;
}

// slug -> RIZIN王座戦勝利数 の索引を作る。
export function buildTitleWinsIndex(
  records: Record<string, { history?: TitleBoutLike[] | null } | undefined>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [slug, entry] of Object.entries(records)) {
    if (!entry) continue;
    out.set(slug, countRizinTitleWins(entry.history));
  }
  return out;
}
