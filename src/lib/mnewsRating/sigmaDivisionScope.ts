// σディスカウント(computeSigmaDiscountedRating)の入力である「戦数」を、
// 複数階級にまたがる選手についてのみ現在の掲載階級のbout数に絞り込むための
// 判定ロジック(2026-08-13、指示書④の試算を受けての本実装)。
//
// rawRating/displayRatingの計算式(engine.ts computeRawRatings)には一切
// 手を入れない。ここで変わるのはbuildDivisionRankings(rankingsFile.ts)に
// 渡すeligibleEntriesのdisplay.fightsフィールドだけ(σディスカウントの
// 分母√fightsにのみ影響する)。
//
// 2026-08-13(2回目の改訂): 当初はキャッチウェイトを「掲載階級のリミット+
// トレランスkg以内」で救う設計(トレランス値は自由パラメータ)だったが、
// 自由パラメータをゼロにするため撤回した。現行の分類ルール(3段階、上から
// 順に判定):
// 1. 契約体重の生表記が明示的な階級名(「ライト級」等、NAMED_DIVISION_RE一致)
//    → その階級の1戦として数える。
// 2. 半端な契約体重(数値のみの表記、階級名の明示なし)→ 最も近いRIZIN階級
//    リミット(フライ57/バンタム61/フェザー66/ライト71kg。93kg以上はヘビー級)
//    の階級の1戦として数える。等距離の場合は軽い方の階級を採る。
//    リミットちょうどの値も同じ関数で自然に「最も近い」に含まれるため、
//    別ルールとして分ける必要がなくなった。
// 3. 契約体重の生表記が欠損している、または数値を抽出できないboutのみ中立
//    (分母から除外)。
//
// ルール1/2で現在の掲載階級と異なる階級が特定できた場合は、現在の掲載階級の
// 分母には含めない(=中立ではなく「別の実在階級のbout」として除外)。
// この区別(neutral vs other)はレポート集計(中立扱いbout数の集計)のために
// 保持する。
import { MnewsDivision, NAMED_DIVISION_RE, mapToDivision } from "./divisions";

// RIZIN公式の階級リミット(kg)。ヘビー級は上限が無い階級のため個別のリミット値を
// 持たず、93kg以上を一律ヘビー級とする(mapToDivision()のmapByKgと同じ閾値)。
export const RIZIN_DIVISION_LIMIT_KG: Record<Exclude<MnewsDivision, "ヘビー級">, number> = {
  フライ級: 57.0,
  バンタム級: 61.0,
  フェザー級: 66.0,
  ライト級: 71.0,
};

const HEAVYWEIGHT_FLOOR_KG = 93.0;

// 軽い順に並べる(同着時に軽い方を優先するため、走査順で先勝ちさせる)。
const ORDERED_LIMITS: [MnewsDivision, number][] = [
  ["フライ級", RIZIN_DIVISION_LIMIT_KG["フライ級"]],
  ["バンタム級", RIZIN_DIVISION_LIMIT_KG["バンタム級"]],
  ["フェザー級", RIZIN_DIVISION_LIMIT_KG["フェザー級"]],
  ["ライト級", RIZIN_DIVISION_LIMIT_KG["ライト級"]],
];

function nearestDivisionForKg(kg: number): MnewsDivision {
  if (kg >= HEAVYWEIGHT_FLOOR_KG) return "ヘビー級";
  let best = ORDERED_LIMITS[0][0];
  let bestDist = Math.abs(kg - ORDERED_LIMITS[0][1]);
  for (let i = 1; i < ORDERED_LIMITS.length; i++) {
    const [div, limit] = ORDERED_LIMITS[i];
    const dist = Math.abs(kg - limit);
    if (dist < bestDist) {
      bestDist = dist;
      best = div;
    }
  }
  return best;
}

export type BoutDivisionScopeClass =
  | { kind: "current" } // 現在の掲載階級の1戦として数える
  | { kind: "other"; division: MnewsDivision } // 別の実在階級のboutと特定できた(現階級の分母には含めない)
  | { kind: "neutral"; reason: "missing" | "unparseable" }; // 分母から完全除外

export function classifyBoutForDivisionScope(
  weightClass: string | undefined,
  currentDivision: MnewsDivision
): BoutDivisionScopeClass {
  if (!weightClass) return { kind: "neutral", reason: "missing" };

  // ルール1: 明示的な階級名
  if (NAMED_DIVISION_RE.test(weightClass)) {
    const named = mapToDivision(weightClass);
    if (named === currentDivision) return { kind: "current" };
    if (named) return { kind: "other", division: named };
    return { kind: "neutral", reason: "unparseable" }; // 非対応階級名(ウェルター等)
  }

  const m = weightClass.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (!m) return { kind: "neutral", reason: "unparseable" };
  const kg = Number(m[1]);

  // ルール2: 最も近いリミット(ちょうどの値も自然にここへ含まれる)
  const nearest = nearestDivisionForKg(kg);
  return nearest === currentDivision ? { kind: "current" } : { kind: "other", division: nearest };
}

// 個々のbout単位のピンポイント訂正(rizinRecordsOverride.tsのRIZIN_RECORDS_RULE_TYPE_OVERRIDES
// と同じ思想: 機械分類が実際の試合区分と食い違うことが確認できた場合、その1戦だけを
// 選手slug+日付で特定して訂正する)。推測での指定は禁止。根拠(source)を必ず添える。
// 書面の一次ソースが取れない場合は「無い」こと自体を明記する(捏造しない)。
export interface DivisionScopeBoutOverride {
  fighterSlug: string;
  date: string;
  opponentName: string; // history.opponentそのまま(ドキュメント用途。照合キーはslug+dateのみ)
  correctedDivision: MnewsDivision;
  source: string;
  fetchedDate: string;
  note: string;
}

export const DIVISION_SCOPE_BOUT_OVERRIDES: DivisionScopeBoutOverride[] = [
  {
    fighterSlug: "naoki",
    date: "2026-08-11",
    opponentName: "細川一颯",
    correctedDivision: "フェザー級",
    source:
      "書面の一次ソースなし。rizinRecords.json(公式サイトスクレイピング)はnamedDivision:null・" +
      "weightKg:69、fighterRecords.json(Wikipedia由来)は「69.0kg契約」、RIZIN公式個別試合結果" +
      "ページ(https://jp.rizinff.com/_ct/17857737)も「RIZIN MMAルール:5分3R(69.0kg)」のみで" +
      "いずれも階級名の明示なし。会場での実況アナウンス(映像)が「フェザー級マッチ」だったとの" +
      "ユーザー申告にもとづく訂正。機械分類(最も近いリミット規則)では69kgはフェザー66kg" +
      "(距離3)よりライト71kg(距離2)の方が近くライト級になるが、この1戦のみ上書きする。",
    fetchedDate: "2026-08-13",
    note: "書面ソース不在のピンポイント訂正である旨、報告時にも明記済み。",
  },
];

function applyDivisionScopeBoutOverride(fighterSlug: string, date: string): MnewsDivision | null {
  const o = DIVISION_SCOPE_BOUT_OVERRIDES.find((o) => o.fighterSlug === fighterSlug && o.date === date);
  return o ? o.correctedDivision : null;
}

export interface DivisionScopeBoutInput {
  date: string;
  weightClass: string | undefined;
}

export function countDivisionScopedFights(
  fighterSlug: string,
  bouts: DivisionScopeBoutInput[],
  currentDivision: MnewsDivision
): number {
  return bouts.filter((b) => {
    const overridden = applyDivisionScopeBoutOverride(fighterSlug, b.date);
    if (overridden) return overridden === currentDivision;
    return classifyBoutForDivisionScope(b.weightClass, currentDivision).kind === "current";
  }).length;
}
