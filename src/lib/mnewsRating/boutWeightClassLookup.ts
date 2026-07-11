// 試合単位の階級(weightClass)を、自社の手動キュレーション結果データ
// (EVENT_RESULTS、/resultsの一次ソース)から突合する。
//
// 【重要な前提】Wikipedia戦績表({{Fight-cont}}テンプレート)には階級フィールドが
// 存在しない(勝敗|対戦相手|決着方法|大会名|開催日の5項目のみ)。RIZIN公式サイトの
// 試合単位階級表記を新たにスクレイピングする実装は行っていない(新規スクレイピング
// 面の追加は本タスクのスコープ外)。そのためEVENT_RESULTSが実在する唯一の
// bout単位階級データソースであり、これは直近(概ね18ヶ月分)のイベントのみ収録して
// いるため、古い試合は突合できず null のままになる(推測補完はしない)。
import { EVENT_RESULTS } from "../eventResults";

const norm = (s: string) => s.replace(/[\s　・]/g, "");

// 選手名(自分)・対戦相手名・試合日から、EVENT_RESULTS内のRIZIN大会の該当bout
// を探しweightClass文字列を返す。見つからなければnull(存在しない試合を捏造しない)。
export function lookupBoutWeightClass(fighterName: string, opponentName: string, date: string): string | null {
  const fName = norm(fighterName);
  const oName = norm(opponentName);
  for (const event of EVENT_RESULTS) {
    if (event.org !== "rizin") continue;
    if (event.date !== date) continue;
    for (const fight of event.fights) {
      const a = norm(fight.fighterA);
      const b = norm(fight.fighterB);
      if ((a === fName && b === oName) || (b === fName && a === oName)) {
        return fight.weightClass;
      }
    }
  }
  return null;
}
