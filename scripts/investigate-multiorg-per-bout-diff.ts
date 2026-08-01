// 指示書R-3(2026-08-01, read-only調査専用): 指定選手について、1行目
// (fighterRecords.jsonのhistory)と2行目(4団体生データから集計したbout)を
// 日付キーで突合し、[突合](日付一致・結果比較→MISMATCH検出)・[1行目のみ]
// (2行目に対応する日付の試合が無い)・[2行目のみ](1行目に対応する日付が無い、
// =超過)の3種にラベル付けして出力する。data/・src/への書き込みは一切
// 行わない(read-only)。
//
// 実行: npx tsx scripts/investigate-multiorg-per-bout-diff.ts
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
// R-3a(45名中needsReview=false/recordFromResults=falseの真正Wikipedia選手6名)
// + R-3b(欠落側、KAREN・山上幹臣)。
const TARGETS = ["isao", "kate-lotus", "goto-joji", "ito-yuki", "noel", "kubo-yuta", "karen", "yamagami-mikihito"];

interface RawBout {
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  ruleType: string;
  resultType: string;
  winnerName: string | null;
  methodRaw: string;
}
interface RawEvent {
  eventName: string;
  date: string | null;
  bouts: RawBout[];
}
function loadEvents(file: string): RawEvent[] {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as RawEvent[];
}
const rizinEvents = loadEvents("rizinRecords.json");
const shootoEvents = loadEvents("shootoRecords.json");
const pancraseEvents = loadEvents("pancraseRecords.json");
const deepEvents = loadEvents("deepRecords.json");
const MMA_RULE_TYPES = new Set(["MMA"]);

function gatherAll(org: string, events: RawEvent[], slug: string, requireMma: boolean) {
  const result: Array<{ org: string; event: string; date: string | null; resultType: string; isWin: boolean; opponentRaw: string; ownRaw: string; methodRaw: string; ruleType: string }> = [];
  for (const ev of events) {
    for (const b of ev.bouts) {
      const isA = b.fighterASlug === slug;
      const isB = b.fighterBSlug === slug;
      if (!isA && !isB) continue;
      const opponentRaw = isA ? b.fighterBName : b.fighterAName;
      const ownRaw = isA ? b.fighterAName : b.fighterBName;
      const isWin = (isA && b.winnerName === b.fighterAName) || (isB && b.winnerName === b.fighterBName);
      result.push({ org, event: ev.eventName, date: ev.date, resultType: b.resultType, isWin, opponentRaw, ownRaw, methodRaw: b.methodRaw, ruleType: b.ruleType });
    }
  }
  return result;
}

interface HistoryEntry {
  date: string;
  opponent: string;
  result: string;
  method: string;
  event: string;
}
const fighterRecords = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "fighterRecords.json"), "utf8")) as Record<
  string,
  { wins: number; losses: number; draws: number; history?: HistoryEntry[] }
>;

const lines: string[] = [];
function out(s: string) {
  console.log(s);
  lines.push(s);
}

for (const slug of TARGETS) {
  out(`\n\n########## ${slug} ##########`);
  const first = fighterRecords[slug];
  out(`1行目: ${first.wins}-${first.losses}-${first.draws}`);
  const history = first.history ?? [];

  const allBouts = [
    ...gatherAll("RIZIN", rizinEvents, slug, true),
    ...gatherAll("修斗", shootoEvents, slug, false),
    ...gatherAll("パンクラス", pancraseEvents, slug, true),
    ...gatherAll("DEEP", deepEvents, slug, false),
  ];
  // ruleType除外も含めて全件表示(MMA以外か対象外かも分かるように)
  const countedBouts = allBouts.filter((b) => {
    if ((b.org === "RIZIN" || b.org === "パンクラス") && !MMA_RULE_TYPES.has(b.ruleType)) return false;
    return b.resultType === "decisive" || b.resultType === "draw";
  });

  const byDate = new Map<string, typeof countedBouts>();
  for (const b of countedBouts) {
    if (!b.date) continue;
    if (!byDate.has(b.date)) byDate.set(b.date, []);
    byDate.get(b.date)!.push(b);
  }

  out("\n--- 1行目historyの各試合と、同日付の2行目bout(あれば)を突合 ---");
  const matchedDates = new Set<string>();
  for (const h of history) {
    const matches = byDate.get(h.date) ?? [];
    if (matches.length === 0) {
      out(`[1行目のみ] ${h.date} vs ${h.opponent} -> ${h.result} (${h.event}) : 2行目に同日付の試合なし`);
    } else {
      matchedDates.add(h.date);
      for (const m of matches) {
        const secondResult = m.resultType === "draw" ? "draw" : m.isWin ? "win" : "loss";
        const mismatch = secondResult !== h.result ? " *** MISMATCH ***" : "";
        out(
          `[突合] ${h.date} 1行目:${h.opponent}->${h.result}(${h.event}) | 2行目:${m.org}:${m.opponentRaw}->${secondResult}(${m.event}, resultType=${m.resultType})${mismatch}`
        );
      }
    }
  }
  out("\n--- 2行目にあって1行目に同日付が無い試合(超過) ---");
  for (const [date, bs] of byDate) {
    if (matchedDates.has(date)) continue;
    for (const b of bs) {
      out(`[2行目のみ] ${date} ${b.org}:${b.opponentRaw} -> ${b.resultType === "draw" ? "draw" : b.isWin ? "win" : "loss"} (${b.event})`);
    }
  }
}

if (!fs.existsSync(path.join(process.cwd(), "out"))) fs.mkdirSync(path.join(process.cwd(), "out"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "out", "multiorg-discrepancy-per-bout-diff.txt"), lines.join("\n") + "\n");
console.log(`\n出力: out/multiorg-discrepancy-per-bout-diff.txt`);
