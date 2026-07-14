// AIランキング変動ネタ化(Task B①)。大会結果投入→update-mnews-rating.ts
// (mode=new-results、デフォルト)再計算後に手動実行し、bout由来のランキング
// 変動を抽出してORIGINAL_ARTICLES同様の「コードをコピペして
// rankingMovementArticles.tsへ貼る」形式で出力する。
//
// 「変動理由フラグ bout由来/correction由来」: rankings.json のdelta フィールドは
// data-correctionモードでは常に0へ強制される設計(rankingsFile.ts
// suppressRippleDelta)のため、delta!==0のエントリは構造的に必ずbout由来
// (correction由来がここに紛れ込むことは仕様上ありえない)。よって新規タグ
// フィールドは持たず、「delta!==0を抽出する」という一点のみで
// bout由来/correction由来を機械的に切り分ける。correction由来は
// このスクリプトの対象に一切現れない(=外部出力ゼロ、既定挙動としてサイレント)。
//
// 実行: npx tsx scripts/generate-ranking-movement-content.ts [--event="RIZIN.54"]
// --eventはfighterRecords.json history側の表示イベント名(例: "RIZIN.54")で
// 指定する(選手の直近試合とのマッチに使うキーがこの表記のため)。出力の
// eventSlugフィールドは、EVENT_RESULTS(結果投入後の正式データ)を突合して
// ルーティング用slug(例: "rizin-54")に解決してから書き出す
// (表示イベント名とURL slugを混同しない)。
import fs from "fs";
import path from "path";
import { RankingsFile } from "../src/lib/mnewsRating/rankingsFile";
import { FighterRecordsFile } from "../src/lib/fighterRecordsCache";
import { FIGHTERS } from "../src/lib/fighters";
import { MNEWS_DIVISIONS, DIVISION_SLUG } from "../src/lib/mnewsRating/divisions";
import { EVENT_RESULTS } from "../src/lib/eventResults";

const RANKINGS_PATH = path.join(process.cwd(), "data", "rankings.json");
const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");

const eventArg = process.argv.find((a) => a.startsWith("--event="))?.split("=")[1];

const rankings: RankingsFile = JSON.parse(fs.readFileSync(RANKINGS_PATH, "utf8"));
const records: FighterRecordsFile = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));

interface BoutDrivenMovement {
  fighterSlug: string;
  fighterName: string;
  division: string;
  rankBefore: number | null;
  rankAfter: number;
  opponentName: string | null;
  result: "win" | "loss" | "draw" | "nc" | null;
  method: string | null;
  event: string | null;
  date: string | null;
}

const movements: BoutDrivenMovement[] = [];

for (const division of MNEWS_DIVISIONS) {
  const key = DIVISION_SLUG[division];
  const div = rankings[key];
  if (!div) continue;
  for (const e of div.entries) {
    if (e.delta === null || e.delta === 0) continue; // correction由来(常にdelta=0)はここで自動的に除外される
    const history = records[e.fighterId]?.history ?? [];
    const lastBout = e.lastFight ? history.find((h) => h.date === e.lastFight) : undefined;
    movements.push({
      fighterSlug: e.fighterId,
      fighterName: nameBySlug.get(e.fighterId) ?? e.fighterId,
      division,
      rankBefore: e.delta !== null ? null : null, // rank自体の前回値はrankings.prev.jsonから別途突合が必要(下記で補完)
      rankAfter: e.rank,
      opponentName: lastBout?.opponent ?? null,
      result: lastBout?.result ?? null,
      method: lastBout?.method ?? null,
      event: lastBout?.event ?? null,
      date: e.lastFight,
    });
  }
}

// rankBeforeの補完: data/rankings.prev.json(直前の状態)と突合する。
const PREV_PATH = path.join(process.cwd(), "data", "rankings.prev.json");
if (fs.existsSync(PREV_PATH)) {
  const prev: RankingsFile = JSON.parse(fs.readFileSync(PREV_PATH, "utf8"));
  for (const m of movements) {
    const division = MNEWS_DIVISIONS.find((d) => d === m.division);
    if (!division) continue;
    const key = DIVISION_SLUG[division];
    const prevEntry = prev[key]?.entries.find((e) => e.fighterId === m.fighterSlug);
    m.rankBefore = prevEntry?.rank ?? null;
  }
}

// eventフィルタ(指定時): その大会の試合に由来する変動のみに絞る
const filtered = eventArg ? movements.filter((m) => m.event === eventArg) : movements;

if (filtered.length === 0) {
  console.log(`[INFO] bout由来のランキング変動0件${eventArg ? `(--event=${eventArg}で絞り込み)` : ""}。correction由来のみ、または変動なし。出力なし(サイレント)。`);
  process.exit(0);
}

console.log(`[INFO] bout由来のランキング変動 ${filtered.length}件を検出:\n`);
for (const m of filtered) {
  console.log(
    `${m.fighterName}(${m.division}) ${m.rankBefore ?? "?"}位→${m.rankAfter}位 | vs ${m.opponentName ?? "?"} ${m.result ?? "?"} ${m.method ?? ""} | ${m.event ?? "?"}(${m.date ?? "?"})`
  );
}

// eventSlug解決: fighterRecords.json history側の表示イベント名(例:"RIZIN.53")を
// EVENT_RESULTSのeventNameと突合し、ルーティング用slug(例:"rizin-53")を得る。
// 複数の変動が異なる大会由来である可能性は考慮せず(--eventで単一大会に絞る
// 運用が前提)、代表として最初のmovementのeventで解決する。見つからない場合
// (結果がまだEVENT_RESULTSに入っていない等)はTODOのまま出力し、人間の確認を
// 必須にする(捏造しない)。
const representativeEventName = filtered[0]?.event ?? null;
const resolvedEventResult = representativeEventName
  ? EVENT_RESULTS.find((r) => r.eventName === representativeEventName)
  : undefined;
const resolvedEventSlug = resolvedEventResult?.slug ?? null;
if (representativeEventName && !resolvedEventSlug) {
  console.log(`[WARN] イベント名"${representativeEventName}"に一致するEVENT_RESULTSエントリが見つかりません。eventSlugはTODOのまま出力します(結果投入が先に必要な可能性)。`);
}

console.log("\n--- rankingMovementArticles.ts へ貼り付けるコード(要レビュー・手動確認の上で反映) ---\n");
const entries = filtered.map(
  (m) => `      {
        fighterSlug: "${m.fighterSlug}",
        fighterName: "${m.fighterName}",
        division: "${m.division}",
        rankBefore: ${m.rankBefore ?? "null"},
        rankAfter: ${m.rankAfter},
        opponentName: ${m.opponentName ? `"${m.opponentName}"` : "null"},
        result: ${m.result ? `"${m.result}"` : "null"},
        method: ${m.method ? `"${m.method}"` : "null"},
      },`
);
console.log(
  `  {
    slug: "ranking-movement-${resolvedEventSlug ?? "TODO"}",
    title: "TODO: 大会名を入れてタイトルを書く",
    eventSlug: "${resolvedEventSlug ?? "TODO"}",
    publishedAt: "${new Date().toISOString().slice(0, 10)}",
    entries: [
${entries.join("\n")}
    ],
  },`
);
