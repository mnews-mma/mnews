// 指示書B-2: data/orgRankingsUnmatched.json(未一致ランカーの検知、
// scripts/update-org-rankings.tsが常設出力)の各名前について、同一団体の
// data/shootoRecords.json・data/pancraseRecords.json(構造化戦績DB)を突合し、
// fighters.ts挿入用の候補スニペットを生成する。読み取り専用
// (fighters.tsへの書き込みは行わない。scripts/roster-injection-94/generate.ts
// と同じ方式: 生成結果をJSON+レポートに出力し、人間が確認したうえで
// fighters.tsへの挿入は別途手動で行う)。
//
// 突合はライブ取得を一切行わない(決定論性のため、ローカルJSON同士の突合のみ)。
// 名前の正規化は src/lib/orgRankings.ts の norm()(matchSlug()と同じ基準)を
// そのまま再利用する(新規の正規化ロジックは作らない)。
//
// 各名前は以下のいずれか1バケットに分類される(優先順位順):
//   1. denylist   … NAME_COLLISION_DENYLIST_SET に該当。衝突多発名のため自動解決しない。
//   2. noLocalData … 同一団体の構造化戦績DBに一致bout が1件も無い。一次ソースの
//                    手動確認が必要(例: PR #394のエルナニ ペルペトゥオと同型)。
//   3. ambiguous  … 一致boutはあるが識別トークン(shooto: shootoId / pancrase:
//                    公式プロフィールURLトークン)が複数種類に分かれる。同姓同名の
//                    別人が構造化データ内に混在している疑い、人間判断が必要。
//   4. noStableId … 一致boutはあるがpancraseのURLが全件欠損で識別トークンが
//                    1つも取れない(レアケース)。
//   5. resolved   … 識別トークンが一意。wins/losses/draws/ko/sub/decision/historyを
//                    実測値から構築し、needsReview:trueの候補スニペットを生成する。
//                    ローマ字表記の一次ソースはこの突合では得られないため、nameEnは
//                    常に"Unconfirmed"のプレースホルダー(捏造ゼロ。roster-injection-94の
//                    ZERO_ROMAJI_OVERRIDES/unconfirmed_placeholderと同じ扱い)。
//
// 実行: npx tsx scripts/build-org-ranking-candidates.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { norm } from "../src/lib/orgRankings";
import { NAME_COLLISION_DENYLIST_SET } from "./lib/nameCollisionDenylist";
import { classifyMmaRuleType, buildRuleTypeHaystack, nonMmaRuleExcludedReason } from "../src/lib/mnewsRating/nonProBoutFilter";
import { tallyMethods } from "../src/lib/methodClassify";
import { ShootoRecordsEvent, ShootoRecordsBout } from "../src/lib/mnewsRating/shootoScraper";
import { PancraseRecordsEvent, PancraseRecordsBout } from "../src/lib/mnewsRating/pancraseRecordsTypes";

const UNMATCHED_PATH = path.join(process.cwd(), "data", "orgRankingsUnmatched.json");
const SHOOTO_PATH = path.join(process.cwd(), "data", "shootoRecords.json");
const PANCRASE_PATH = path.join(process.cwd(), "data", "pancraseRecords.json");
const OUT_DIR = path.join(process.cwd(), "out", "org-ranking-candidates");

interface UnmatchedEntry {
  weightClass: string;
  rank: string;
  officialName: string;
}
interface OrgRankingsUnmatchedFile {
  generatedDate: string;
  pancrase: UnmatchedEntry[];
  shooto: UnmatchedEntry[];
}

type BoutResult = "win" | "loss" | "draw" | "nc";

interface MatchedBout {
  id: string; // 識別トークン(shooto: shootoId文字列化 / pancrase: 公式URLトークン)
  date: string | null;
  event: string;
  opponentName: string;
  opponentSlug: string | null;
  result: BoutResult;
  method: string;
  round: string;
}
interface ExcludedBout {
  date: string | null;
  event: string;
  opponentName: string;
  reason: string;
}
interface MatchOutcome {
  matched: MatchedBout[];
  excluded: ExcludedBout[];
  ids: Set<string>;
}

function urlToken(url: string | null): string | null {
  if (!url) return null;
  const base = url.split("/").pop();
  if (!base) return null;
  const token = base.replace(/\.html?$/i, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return token || null;
}

function buildRoundField(round: string | null, time: string | null): string {
  const r = (round ?? "").trim();
  const t = (time ?? "").trim();
  return r && t ? `${r} ${t}` : r;
}

function resultTypeToResult(resultType: string, isWin: boolean): BoutResult | null {
  if (resultType === "nc") return "nc";
  if (resultType === "draw") return "draw";
  if (resultType === "decisive") return isWin ? "win" : "loss";
  return null; // cancelled/unknown は勝敗・NCいずれにも数えない(捏造ゼロ)
}

function matchShooto(officialName: string, events: ShootoRecordsEvent[]): MatchOutcome {
  const matched: MatchedBout[] = [];
  const excluded: ExcludedBout[] = [];
  const ids = new Set<string>();
  for (const ev of events) {
    for (const b of ev.bouts as ShootoRecordsBout[]) {
      const isA = norm(b.fighterAName) === norm(officialName);
      const isB = norm(b.fighterBName) === norm(officialName);
      if (!isA && !isB) continue;
      const id = String(isA ? b.fighterAShootoId : b.fighterBShootoId);
      const opponentName = isA ? b.fighterBName : b.fighterAName;
      const opponentSlug = isA ? b.fighterBSlug : b.fighterASlug;

      const ruleType = classifyMmaRuleType(buildRuleTypeHaystack(b));
      if (ruleType !== "MMA" && ruleType !== "unknown") {
        excluded.push({ date: ev.date, event: ev.eventName, opponentName, reason: nonMmaRuleExcludedReason(ruleType) });
        continue;
      }
      const isWin = (isA && b.winnerName === b.fighterAName) || (isB && b.winnerName === b.fighterBName);
      const result = resultTypeToResult(b.resultType, isWin);
      if (!result) {
        excluded.push({ date: ev.date, event: ev.eventName, opponentName, reason: `resultType:${b.resultType}(未確定)` });
        continue;
      }
      ids.add(id);
      matched.push({
        id,
        date: ev.date,
        event: ev.eventName,
        opponentName,
        opponentSlug,
        result,
        method: b.methodRaw,
        round: buildRoundField(b.round, b.time),
      });
    }
  }
  return { matched, excluded, ids };
}

function matchPancrase(officialName: string, events: PancraseRecordsEvent[]): MatchOutcome {
  const matched: MatchedBout[] = [];
  const excluded: ExcludedBout[] = [];
  const ids = new Set<string>();
  for (const ev of events) {
    for (const b of ev.bouts as PancraseRecordsBout[]) {
      const isA = norm(b.fighterAName) === norm(officialName);
      const isB = norm(b.fighterBName) === norm(officialName);
      if (!isA && !isB) continue;
      const token = urlToken(isA ? b.leftUrl : b.rightUrl);
      const opponentName = isA ? b.fighterBName : b.fighterAName;
      const opponentSlug = isA ? b.fighterBSlug : b.fighterASlug;

      const ruleType = classifyMmaRuleType(buildRuleTypeHaystack(b));
      if (ruleType !== "MMA" && ruleType !== "unknown") {
        excluded.push({ date: ev.date, event: ev.eventName, opponentName, reason: nonMmaRuleExcludedReason(ruleType) });
        continue;
      }
      const isWin = (isA && b.winnerName === b.fighterAName) || (isB && b.winnerName === b.fighterBName);
      const result = resultTypeToResult(b.resultType, isWin);
      if (!result) {
        excluded.push({ date: ev.date, event: ev.eventName, opponentName, reason: `resultType:${b.resultType}(未確定)` });
        continue;
      }
      if (!token) {
        excluded.push({ date: ev.date, event: ev.eventName, opponentName, reason: "公式プロフィールURL欠損(識別トークン不明)" });
        continue;
      }
      ids.add(token);
      matched.push({
        id: token,
        date: ev.date,
        event: ev.eventName,
        opponentName,
        opponentSlug,
        result,
        method: b.methodRaw,
        round: buildRoundField(b.round, b.time),
      });
    }
  }
  return { matched, excluded, ids };
}

interface ResolvedCandidate {
  nameJa: string;
  org: "shooto" | "pancrase";
  weightClass: string;
  slug: string;
  slugConfidence: "shooto_id_placeholder" | "url_token_pancrase_unsegmented";
  slugNote: string;
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  decision: number;
  history: { date: string; opponent: string; result: BoutResult; method: string; event: string; round: string }[];
  excludedBouts: ExcludedBout[];
  existingSlugCollision: boolean;
}

interface ReportEntry {
  nameJa: string;
  org: "shooto" | "pancrase";
  weightClass: string;
  rank: string;
  reason?: string;
}

function buildResolvedCandidate(
  entry: UnmatchedEntry,
  org: "shooto" | "pancrase",
  outcome: MatchOutcome,
  existingSlugs: Set<string>
): ResolvedCandidate {
  const id = [...outcome.ids][0];
  const slug = org === "shooto" ? `unconfirmed-shooto-${id}` : `unconfirmed-pancrase-${id}`;
  const slugConfidence = org === "shooto" ? "shooto_id_placeholder" : "url_token_pancrase_unsegmented";
  const slugNote =
    org === "shooto"
      ? `修斗公式ID(${id})のプレースホルダーslug。ローマ字表記の一次ソースが今回の突合では得られていないため人間確認が必要(roster-injection-94のunconfirmed_placeholderと同じ扱い)。`
      : `パンクラス公式プロフィールURLトークン(${id}、語境界未確定)のプレースホルダーslug。姓名の切れ目・nameEnとも人間確認が必要。`;

  const sorted = [...outcome.matched].sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));
  const history = sorted.map((m) => ({
    date: m.date ?? "",
    opponent: m.opponentName,
    result: m.result,
    method: m.method,
    event: m.event,
    round: m.round,
  }));
  const wins = history.filter((h) => h.result === "win").length;
  const losses = history.filter((h) => h.result === "loss").length;
  const draws = history.filter((h) => h.result === "draw").length;
  const methodCounts = tallyMethods(history.filter((h) => h.result === "win"));

  return {
    nameJa: entry.officialName,
    org,
    weightClass: entry.weightClass,
    slug,
    slugConfidence,
    slugNote,
    wins,
    losses,
    draws,
    ko: methodCounts.ko,
    sub: methodCounts.sub,
    decision: methodCounts.decision,
    history,
    excludedBouts: outcome.excluded,
    existingSlugCollision: existingSlugs.has(slug),
  };
}

function main() {
  const unmatched: OrgRankingsUnmatchedFile = JSON.parse(fs.readFileSync(UNMATCHED_PATH, "utf8"));
  const shootoEvents: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(SHOOTO_PATH, "utf8"));
  const pancraseEvents: PancraseRecordsEvent[] = JSON.parse(fs.readFileSync(PANCRASE_PATH, "utf8"));
  const existingSlugs = new Set(FIGHTERS.map((f) => f.slug));

  const resolved: ResolvedCandidate[] = [];
  const denylist: ReportEntry[] = [];
  const noLocalData: ReportEntry[] = [];
  const ambiguous: ReportEntry[] = [];
  const noStableId: ReportEntry[] = [];

  const process1 = (entries: UnmatchedEntry[], org: "shooto" | "pancrase") => {
    for (const entry of entries) {
      if (NAME_COLLISION_DENYLIST_SET.has(entry.officialName)) {
        denylist.push({ nameJa: entry.officialName, org, weightClass: entry.weightClass, rank: entry.rank, reason: "nameCollisionDenylist該当" });
        continue;
      }
      const outcome = org === "shooto" ? matchShooto(entry.officialName, shootoEvents) : matchPancrase(entry.officialName, pancraseEvents);
      if (outcome.matched.length === 0) {
        noLocalData.push({ nameJa: entry.officialName, org, weightClass: entry.weightClass, rank: entry.rank, reason: "構造化戦績DBに一致bout 0件" });
        continue;
      }
      if (outcome.ids.size > 1) {
        ambiguous.push({
          nameJa: entry.officialName,
          org,
          weightClass: entry.weightClass,
          rank: entry.rank,
          reason: `識別トークン${outcome.ids.size}種(${[...outcome.ids].join(", ")})。同姓同名の別人混在の疑い`,
        });
        continue;
      }
      if (outcome.ids.size === 0) {
        noStableId.push({ nameJa: entry.officialName, org, weightClass: entry.weightClass, rank: entry.rank, reason: "一致boutはあるが識別トークンが1件も取れない" });
        continue;
      }
      resolved.push(buildResolvedCandidate(entry, org, outcome, existingSlugs));
    }
  };
  process1(unmatched.pancrase, "pancrase");
  process1(unmatched.shooto, "shooto");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "candidates.json"),
    JSON.stringify({ generatedFrom: unmatched.generatedDate, resolved, denylist, noLocalData, ambiguous, noStableId }, null, 2) + "\n"
  );

  const snippet = (c: ResolvedCandidate): string => {
    const lines = [
      `  {`,
      `    slug: "${c.slug}",`,
      `    nameJa: "${c.nameJa}",`,
      `    nameEn: "Unconfirmed",`,
      `    org: "${c.org}",`,
      `    weightClass: "${c.weightClass}",`,
      `    wins: ${c.wins},`,
      `    losses: ${c.losses},`,
      `    draws: ${c.draws},`,
      `    ko: ${c.ko},`,
      `    sub: ${c.sub},`,
      `    decision: ${c.decision},`,
      `    history: [`,
      ...c.history
        .slice()
        .reverse()
        .map(
          (h) =>
            `      { date: "${h.date}", opponent: "${h.opponent}", result: "${h.result}", method: "${h.method.replace(/"/g, '\\"')}", event: "${h.event.replace(/"/g, '\\"')}", round: "${h.round}" },`
        ),
      `    ],`,
      `    needsReview: true,`,
      `  },`,
    ];
    return lines.join("\n");
  };

  const md: string[] = [];
  md.push(`# 未登録ランカー候補生成レポート`);
  md.push(``);
  md.push(`入力: data/orgRankingsUnmatched.json(生成日 ${unmatched.generatedDate})`);
  md.push(``);
  md.push(`## resolved(${resolved.length}件) — fighters.ts挿入候補`);
  md.push(``);
  md.push(`識別トークンは一意だが、ローマ字表記(nameEn)は未確認。挿入前に一次ソースで裏取りが必要(PR #394と同じ手順)。`);
  md.push(``);
  for (const c of resolved) {
    md.push(`### ${c.nameJa}(${c.org} / ${c.weightClass})`);
    md.push(`- slug候補: \`${c.slug}\`(confidence: ${c.slugConfidence})`);
    md.push(`- ${c.slugNote}`);
    if (c.existingSlugCollision) md.push(`- ⚠️ 既存FIGHTERSに同名slugが存在(要確認、そのまま挿入しない)`);
    md.push(`- 実測: ${c.wins}勝${c.losses}敗${c.draws}分(${c.history.length}戦、除外${c.excludedBouts.length}件)`);
    md.push("```ts");
    md.push(snippet(c));
    md.push("```");
    md.push(``);
  }
  const dumpBucket = (title: string, bucket: ReportEntry[]) => {
    md.push(`## ${title}(${bucket.length}件)`);
    md.push(``);
    for (const e of bucket) md.push(`- ${e.nameJa}(${e.org} / ${e.weightClass} / ${e.rank}位): ${e.reason}`);
    md.push(``);
  };
  dumpBucket("denylist — 衝突多発名(要人間判断)", denylist);
  dumpBucket("ambiguous — 識別トークン複数(要人間判断)", ambiguous);
  dumpBucket("noStableId — 識別トークン0件(要人間判断)", noStableId);
  dumpBucket("noLocalData — 構造化戦績DBに該当bout無し(一次ソース手動確認が必要)", noLocalData);

  fs.writeFileSync(path.join(OUT_DIR, "report.md"), md.join("\n") + "\n");

  console.log(`resolved: ${resolved.length}  denylist: ${denylist.length}  ambiguous: ${ambiguous.length}  noStableId: ${noStableId.length}  noLocalData: ${noLocalData.length}`);
  console.log(`出力: ${OUT_DIR}/candidates.json, ${OUT_DIR}/report.md`);
}

main();
