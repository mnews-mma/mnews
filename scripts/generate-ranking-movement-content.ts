// AIランキング変動ネタ化(Task B、2026-07-15 全自動化)。大会結果投入→
// update-mnews-rating.ts(mode=new-results、デフォルト)再計算後にCIから
// 実行され、bout由来のランキング変動を抽出し、事実の定型フォーマットで
// src/lib/rankingMovementArticles.ts へ自動追記する。人間のレビュー・
// 貼り付け作業は無い(Operator-Zero)。
//
// 【外部発信の暴発を防ぐガード(必須・変更しないこと)】
// 1. 出力元はbout由来のみ: rankings.jsonのdeltaフィールドはdata-correction
//    モードでは常に0へ強制される設計(rankingsFile.ts suppressRippleDelta)
//    のため、delta!==0のエントリは構造的に必ずbout由来。correction由来が
//    ここに紛れ込む経路は存在しない(新規タグは持たず、この不変条件のみで
//    切り分ける)。
// 2. 文面は完全固定テンプレート: AIによる自由文生成は一切行わない。
//    数値・選手名・相手名・決着方法という構造化フィールドの穴埋めのみ
//    (buildTitle関数参照)。
// 3. 異常値ガード: 順位変動±10位以上、rawRating差分の絶対値100pt超、
//    掲載人数の増減、王者の変動——のいずれかを検知したら自動掲載を止め、
//    GitHub Actions annotation(::warning::)でKainaに通知するのみで、
//    rankingMovementArticles.tsへの書き込みは行わない(非ブロッキング=
//    fighterRecords/rankings.json側の通常コミットは妨げない)。
//
// 実行: npx tsx scripts/generate-ranking-movement-content.ts [--event="RIZIN.54"]
import fs from "fs";
import path from "path";
import { RankingsFile } from "../src/lib/mnewsRating/rankingsFile";
import { FighterRecordsFile } from "../src/lib/fighterRecordsCache";
import { FIGHTERS } from "../src/lib/fighters";
import { MNEWS_DIVISIONS, DIVISION_SLUG } from "../src/lib/mnewsRating/divisions";
import { EVENT_RESULTS } from "../src/lib/eventResults";

const RANKINGS_PATH = path.join(process.cwd(), "data", "rankings.json");
const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const PREV_PATH = path.join(process.cwd(), "data", "rankings.prev.json");
const ARTICLES_PATH = path.join(process.cwd(), "src", "lib", "rankingMovementArticles.ts");

const RANK_JUMP_THRESHOLD = 10; // 順位変動の異常値しきい値(絶対値)
const RATING_DIFF_THRESHOLD = 100; // rawRating差分の異常値しきい値(絶対値・単発試合のK上限=40×1.8=72を上回る水準)

const eventArg = process.argv.find((a) => a.startsWith("--event="))?.split("=")[1];

function warn(message: string) {
  // GitHub Actions annotation構文。Actionsのサマリ画面に警告として表示される
  // (repo通知設定次第でメール等にも波及)。ローカル実行時は通常のwarnログとして
  // 見える。
  console.log(`::warning::${message}`);
}

const rankings: RankingsFile = JSON.parse(fs.readFileSync(RANKINGS_PATH, "utf8"));
const records: FighterRecordsFile = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
const nameBySlug = new Map(FIGHTERS.map((f) => [f.slug, f.nameJa]));
const prevRankings: RankingsFile | null = fs.existsSync(PREV_PATH) ? JSON.parse(fs.readFileSync(PREV_PATH, "utf8")) : null;

interface BoutDrivenMovement {
  fighterSlug: string;
  fighterName: string;
  division: string;
  divisionSlug: string;
  rankBefore: number | null;
  rankAfter: number;
  rawDelta: number;
  opponentName: string | null;
  result: "win" | "loss" | "draw" | "nc" | null;
  method: string | null;
  event: string | null;
  date: string | null;
}

// ── 1. bout由来の変動を抽出 ──────────────────────────────────────
const movements: BoutDrivenMovement[] = [];
const anomalies: string[] = [];

for (const division of MNEWS_DIVISIONS) {
  const key = DIVISION_SLUG[division];
  const div = rankings[key];
  const prevDiv = prevRankings?.[key];
  if (!div) continue;

  // 異常値ガード: 王者の変動
  if (prevDiv && div.champion?.fighterId !== prevDiv.champion?.fighterId) {
    anomalies.push(`${division}: 王者が変動(${prevDiv.champion?.fighterId ?? "なし"} → ${div.champion?.fighterId ?? "なし"})`);
  }
  // 異常値ガード: 掲載人数の増減(顔ぶれが変わった)
  if (prevDiv) {
    const prevIds = new Set(prevDiv.entries.map((e) => e.fighterId));
    const currIds = new Set(div.entries.map((e) => e.fighterId));
    const added = [...currIds].filter((s) => !prevIds.has(s));
    const removed = [...prevIds].filter((s) => !currIds.has(s));
    if (added.length > 0 || removed.length > 0) {
      anomalies.push(`${division}: 掲載選手の顔ぶれが変動(追加${added.length}名/除外${removed.length}名: +[${added.join(",")}] -[${removed.join(",")}])`);
    }
  }

  for (const e of div.entries) {
    if (e.delta === null || e.delta === 0) continue; // correction由来(常にdelta=0)はここで自動的に除外される

    const prevEntry = prevDiv?.entries.find((p) => p.fighterId === e.fighterId);
    const rankBefore = prevEntry?.rank ?? null;
    const rankJump = rankBefore !== null ? Math.abs(rankBefore - e.rank) : 0;

    // 異常値ガード: 順位ジャンプ・rawRating差分
    if (rankJump >= RANK_JUMP_THRESHOLD) {
      anomalies.push(`${division}:${e.fighterId} 順位が${rankJump}位動いた(${rankBefore}位→${e.rank}位、しきい値${RANK_JUMP_THRESHOLD})`);
    }
    if (Math.abs(e.delta) >= RATING_DIFF_THRESHOLD) {
      anomalies.push(`${division}:${e.fighterId} rawRating差分が${e.delta}(しきい値±${RATING_DIFF_THRESHOLD})`);
    }

    const history = records[e.fighterId]?.history ?? [];
    const lastBout = e.lastFight ? history.find((h) => h.date === e.lastFight) : undefined;
    movements.push({
      fighterSlug: e.fighterId,
      fighterName: nameBySlug.get(e.fighterId) ?? e.fighterId,
      division,
      divisionSlug: key,
      rankBefore,
      rankAfter: e.rank,
      rawDelta: e.delta,
      opponentName: lastBout?.opponent ?? null,
      result: lastBout?.result ?? null,
      method: lastBout?.method ?? null,
      event: lastBout?.event ?? null,
      date: e.lastFight,
    });
  }
}

// ── 2. 異常値ガード: 1件でも検知したら自動掲載を止める(非ブロッキング) ──
if (anomalies.length > 0) {
  warn(`ランキング変動の異常値を${anomalies.length}件検知したため、自動掲載を停止しました(rankingMovementArticles.tsへの書き込みなし)。人手での確認が必要です。`);
  for (const a of anomalies) warn(a);
  process.exit(0);
}

// ── 3. イベント絞り込み・大会ごとにグルーピング ───────────────────────
// --event未指定時(=通常のCI自動実行)、1回の実行で複数大会分の変動が
// 同時に検出されるケース(cronが数日止まっていた等)に備え、event(表示
// イベント名)単位でグルーピングして大会ごとに別記事として処理する
// (代表1件のイベント名にまとめてしまうと、別大会の変動が誤って同じ記事に
// 混ざるバグの元になるため)。
const filtered = eventArg ? movements.filter((m) => m.event === eventArg) : movements;

if (filtered.length === 0) {
  console.log(`[INFO] bout由来のランキング変動0件${eventArg ? `(--event=${eventArg}で絞り込み)` : ""}。correction由来のみ、または変動なし。出力なし(サイレント)。`);
  process.exit(0);
}

const byEvent = new Map<string, BoutDrivenMovement[]>();
for (const m of filtered) {
  const key = m.event ?? "__unknown__";
  if (!byEvent.has(key)) byEvent.set(key, []);
  byEvent.get(key)!.push(m);
}

// ── 4. 完全固定テンプレートでタイトルを組み立てる(自由文生成なし) ──────
const RESULT_LABEL: Record<string, string> = { win: "勝利", loss: "敗北", draw: "引き分け", nc: "ノーコンテスト" };
function buildTitle(m: BoutDrivenMovement, eventName: string): string {
  let diffLabel: string;
  if (m.rankBefore === null) {
    diffLabel = `新規${m.rankAfter}位にランクイン`;
  } else if (m.rankBefore === m.rankAfter) {
    // 順位は変わらずレートのみ動いたケース。「▼0」のような無意味な表記を
    // 避け、順位維持であることだけを明示する。
    diffLabel = `${m.rankAfter}位を維持`;
  } else {
    const arrow = m.rankAfter < m.rankBefore ? "▲" : "▼";
    diffLabel = `${m.rankBefore}位→${m.rankAfter}位（${arrow}${Math.abs(m.rankBefore - m.rankAfter)}）`;
  }
  const oppLabel = m.opponentName && m.result ? ` — ${m.opponentName}に${RESULT_LABEL[m.result] ?? m.result}（${m.method ?? "詳細不明"}）` : "";
  return `【AI RIZINランキング変動】${m.division} ${m.fighterName} ${diffLabel}${oppLabel}（${eventName}反映）`;
}

let fileContent = fs.readFileSync(ARTICLES_PATH, "utf8");
const marker = "export const RANKING_MOVEMENT_ARTICLES: RankingMovementArticle[] = [";
let totalPublished = 0;

for (const [eventName, eventMovements] of byEvent) {
  if (eventName === "__unknown__") {
    warn(`直近試合日が判明しない選手が${eventMovements.length}名検出されました(fighterRecords.jsonのhistoryとlastFightが突合できず)。この分は自動掲載を停止しました。`);
    continue;
  }
  const resolvedEventResult = EVENT_RESULTS.find((r) => r.eventName === eventName);
  const resolvedEventSlug = resolvedEventResult?.slug ?? null;
  if (!resolvedEventSlug) {
    warn(`イベント名"${eventName}"に一致するEVENT_RESULTSエントリが見つかりません。この大会分の自動掲載を停止しました(結果投入が先に必要な可能性)。`);
    continue;
  }

  const slug = `ranking-movement-${resolvedEventSlug}`;
  if (fileContent.includes(`slug: "${slug}"`)) {
    console.log(`[INFO] slug="${slug}"は既に登録済みのためスキップ(冪等性: 同じ大会に対して重複掲載しない)。`);
    continue;
  }

  const entriesCode = eventMovements
    .map(
      (m) => `      {
        fighterSlug: "${m.fighterSlug}",
        fighterName: "${m.fighterName}",
        division: "${m.division}",
        rankBefore: ${m.rankBefore ?? "null"},
        rankAfter: ${m.rankAfter},
        opponentName: ${m.opponentName ? JSON.stringify(m.opponentName) : "null"},
        result: ${m.result ? `"${m.result}"` : "null"},
        method: ${m.method ? JSON.stringify(m.method) : "null"},
      },`
    )
    .join("\n");

  // 代表1件(その大会内の最初の変動)のタイトルを記事タイトルとして採用。
  // 同一大会で複数変動がある場合、残りはentries配列に事実として含まれる
  // (タイトルには出ないが構造化データとしては保持される)。
  const title = buildTitle(eventMovements[0], eventName);

  const newArticleCode = `  {
    slug: "${slug}",
    title: ${JSON.stringify(title)},
    eventSlug: "${resolvedEventSlug}",
    publishedAt: "${new Date().toISOString().slice(0, 10)}",
    entries: [
${entriesCode}
    ],
  },`;

  const idx = fileContent.indexOf(marker);
  if (idx === -1) {
    warn(`rankingMovementArticles.tsに配列の宣言が見つかりません(marker="${marker}")。自動掲載を停止しました。ファイル構造が変わった可能性があります。`);
    break;
  }
  const closeIdx = fileContent.indexOf("];", idx);
  if (closeIdx === -1) {
    warn(`rankingMovementArticles.tsで配列の終端(];)が見つかりません。自動掲載を停止しました。`);
    break;
  }
  const before = fileContent.slice(0, idx + marker.length);
  const inner = fileContent.slice(idx + marker.length, closeIdx).replace(/\s*$/, "");
  const after = fileContent.slice(closeIdx);
  const newInner = inner === "" ? `\n${newArticleCode}\n` : `${inner}\n${newArticleCode}\n`;
  fileContent = before + newInner + after;

  console.log(`[INFO] bout由来のランキング変動${eventMovements.length}件を自動掲載しました(slug="${slug}"):`);
  console.log(`  ${title}`);
  totalPublished++;
}

if (totalPublished > 0) {
  fs.writeFileSync(ARTICLES_PATH, fileContent);
} else {
  console.log("[INFO] 新規掲載0件(全て既掲載済み・イベント未解決・または直近試合日不明のいずれか)。ファイルへの書き込みは行いませんでした。");
}
