import { FightRecord } from "./fighters";
import { EVENT_RESULTS } from "./eventResults";

// DEEP 130/131 出場選手のうち、ローマ字読みが確定できず投入を保留した16名。
// 表記ゆれ(リングネームのカナ+漢字混在) / 読み(漢字の読み不確定) /
// 取得不可(読み自体が推定不能)で分類。人間の判断でローマ字を確定してから
// FIGHTERS にスタブ投入する。戦績は EVENT_RESULTS に事実として既に格納済み
// (deriveHistoryFromEventResults で名前照合すれば取り出せる)。
export interface HeldFighter {
  nameJa: string;
  reason: "表記ゆれ" | "読み" | "取得不可";
  note: string;
}
export const DEEP_HELD_FIGHTERS: HeldFighter[] = [
  { nameJa: "ストラッサー起一", reason: "表記ゆれ", note: "リングネーム(カナ+漢字「起一」混在)" },
  { nameJa: "木下カラテ", reason: "表記ゆれ", note: "リングネーム「カラテ」" },
  { nameJa: "魚井フルスイング", reason: "表記ゆれ", note: "リングネーム「フルスイング」" },
  { nameJa: "タンク内藤", reason: "表記ゆれ", note: "リングネーム「タンク」" },
  { nameJa: "荒東英貴", reason: "読み", note: "姓「荒東」の読み不確定(Arato/Kōtō 等)" },
  { nameJa: "寺崎昇龍", reason: "読み", note: "「昇龍」の読み不確定(Shoryu/Noboru 等)" },
  { nameJa: "山本有人", reason: "読み", note: "「有人」の読み不確定(Aruto/Yuto/Arihito 等)" },
  { nameJa: "奥村歩生", reason: "読み", note: "「歩生」の読み不確定(Ayumu/Ao 等)" },
  { nameJa: "角野晃平", reason: "読み", note: "姓「角野」の読み不確定(Kadono/Sumino/Tsunono 等)" },
  { nameJa: "雅駿介", reason: "読み", note: "「雅」の名としての扱い・読み不確定" },
  { nameJa: "狩野優", reason: "読み", note: "「優」の読み不確定(Yu/Yutaka/Suguru 等)" },
  { nameJa: "山本颯志", reason: "読み", note: "「颯志」の読み不確定(Soshi/Satoshi 等)" },
  { nameJa: "赤沢幸典", reason: "読み", note: "「幸典」の読み不確定(Yukinori/Kosuke 等)" },
  { nameJa: "石坂空志", reason: "読み", note: "「空志」の読み不確定(Soshi/Takashi 等)" },
  { nameJa: "知名昴海", reason: "取得不可", note: "姓「知名」+名「昴海」とも読み推定不能" },
  { nameJa: "猿寿健太", reason: "取得不可", note: "「猿寿」の読み推定不能" },
];

// 大会結果(EVENT_RESULTS)を「選手軸」に組み替えるための決定論的ロジック。
// Mレーティングの燃料となる戦績データの背骨。自社が記録した事実のみを使い、
// 推測・生成は一切しない(ソースに無い試合は作らない)。EVENT_RESULTS が
// 育つほど各選手の戦績も自動的に増える(「運用するほど育つDB」設計)。

// スペース・全角スペースを除いた正規化名で照合する(fighters.ts の
// findFighterSlugByName と同じ正規化)。
const norm = (s: string) => s.replace(/[\s　]/g, "");

// round文字列("1R 3:22" 等)から決着時間 mm:ss を取り出す。取れなければ undefined。
function extractTime(round?: string): string | undefined {
  if (!round) return undefined;
  const m = round.match(/(\d+):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : undefined;
}

// 決着方法(method)から KO / 一本(sub) / 判定(decision) を決定論的に分類する。
// どれにも当てはまらない決着(失格・ドクターストップ等)は null を返す。
export function classifyMethod(method: string): "ko" | "sub" | "decision" | null {
  const m = method;
  if (/判定/.test(m)) return "decision";
  if (/KO|TKO/.test(m)) return "ko";
  // 一本(サブミッション)系: 絞め/締め/固め/十字/チョーク/三角/アームバー/
  // ヒールフック/膝十字/ツイスター/一本/サブミッション 等
  if (/絞|締|固め|十字|チョーク|三角|アーム|ヒール|フック|ツイスター|一本|サブミッション|リアネイキッド|スリーパー|ギロチン|バック/.test(m))
    return "sub";
  return null;
}

// 指定選手(日本語名)の戦績を EVENT_RESULTS から新しい順に組み立てる。
export function deriveHistoryFromEventResults(nameJa: string): FightRecord[] {
  const target = norm(nameJa);
  const records: FightRecord[] = [];

  for (const event of EVENT_RESULTS) {
    for (const fight of event.fights) {
      const a = norm(fight.fighterA);
      const b = norm(fight.fighterB);
      const isA = a === target;
      const isB = b === target;
      if (!isA && !isB) continue;

      const opponent = isA ? fight.fighterB : fight.fighterA;
      const w = fight.winner;

      let result: FightRecord["result"];
      if (w === "中止" || w === null || w === undefined) {
        // 試合不成立(計量失格による中止・結果未確定)は戦績に含めない。
        continue;
      } else if (w === "NC") {
        result = "nc";
      } else if (w === "引き分け") {
        result = "draw";
      } else if (norm(w) === target) {
        result = "win";
      } else {
        result = "loss";
      }

      records.push({
        date: event.date,
        opponent,
        result,
        method: fight.method,
        event: event.eventName,
        round: fight.round ?? "",
        time: extractTime(fight.round),
        weightClass: fight.weightClass,
      });
    }
  }

  // 新しい順(既存の history 表示と同じ並び)
  records.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  return records;
}

export interface DerivedRecordCounts {
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  decision: number;
}

// 組み立てた戦績から現戦績(○-○-○)と決着内訳を集計する。
// 注意: これは「自社が記録した試合のみ」の集計であり、選手の生涯通算戦績では
// ない(欠損を捏造しないため)。hidden な新規投入選手の暫定表示に使う。
export function deriveRecordCounts(history: FightRecord[]): DerivedRecordCounts {
  const c: DerivedRecordCounts = { wins: 0, losses: 0, draws: 0, ko: 0, sub: 0, decision: 0 };
  for (const r of history) {
    if (r.result === "win") {
      c.wins++;
      const k = classifyMethod(r.method);
      if (k) c[k]++;
    } else if (r.result === "loss") {
      c.losses++;
    } else if (r.result === "draw") {
      c.draws++;
    }
    // nc は勝敗数に含めない(標準的なMMA戦績の扱い)
  }
  return c;
}
