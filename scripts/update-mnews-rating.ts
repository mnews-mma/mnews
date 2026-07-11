// mnewsレーティング rankings.json 生成バッチ。
// data/fighterRecords.json(前段のupdate-fighter-records.tsが更新した最新版)を
// 読み、階級別ランキングを算出してdata/rankings.jsonへ書き出す。
// 上書き前のdata/rankings.jsonはdata/rankings.prev.jsonへ退避し(次回バッチの
// delta算出に使う)、1階級でも順位変動があった日はその日の全階級スナップショットを
// data/rankings/archive/YYYY-MM-DD.jsonへ永続保存する(機関としての歴史的記録)。
//
// 実行: npx tsx scripts/update-mnews-rating.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import {
  buildBouts,
  buildDisplayEntries,
  computeRawRatings,
  detectWeighInMiss,
  filterPublishableStates,
  isRizinMmaEvent,
  FighterRecordsInput,
} from "../src/lib/mnewsRating/engine";
import { buildOpponentResolver } from "../src/lib/mnewsRating/nameIndex";
import { MNEWS_DIVISIONS, mapToDivision } from "../src/lib/mnewsRating/divisions";
import {
  buildDivisionRankings,
  divisionRankingsKey,
  hasRankingChange,
  RankingsFile,
} from "../src/lib/mnewsRating/rankingsFile";

const RECORDS_PATH = path.join(process.cwd(), "data", "fighterRecords.json");
const OUT = path.join(process.cwd(), "data", "rankings.json");
const OUT_PREV = path.join(process.cwd(), "data", "rankings.prev.json");
const ARCHIVE_DIR = path.join(process.cwd(), "data", "rankings", "archive");

// 既存JSONの読み込み。破損している場合は空({})にフォールバックして続行する
// (update-org-rankings.tsと同じ思想: 破損ファイルでのクラッシュループを避ける)。
function loadRankingsFile(file: string): RankingsFile {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as RankingsFile;
  } catch (e) {
    console.warn(`[WARN] ${file} の読み込みに失敗(JSON破損の疑い)。前回値なしとして続行: ${e}`);
    return {};
  }
}

function lastRizinMmaWeighInMiss(records: FighterRecordsInput, slug: string): boolean {
  const history = (records[slug]?.history ?? []).filter((h) => isRizinMmaEvent(h.event));
  const latest = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  return latest ? detectWeighInMiss(latest) : false;
}

function main() {
  if (!fs.existsSync(RECORDS_PATH)) {
    console.log("[mnewsレーティング] data/fighterRecords.json が存在しないためスキップ");
    return;
  }

  const records: FighterRecordsInput = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const prevOut = loadRankingsFile(OUT);

  const resolve = buildOpponentResolver(records);
  const { bouts, warnings } = buildBouts(records, resolve);
  const states = computeRawRatings(bouts);
  const publishable = filterPublishableStates(states, records);
  const asOf = new Date();
  const display = buildDisplayEntries(publishable, asOf);

  const divisionBySlug = new Map(FIGHTERS.map((f) => [f.slug, mapToDivision(f.weightClass)]));

  const out: RankingsFile = {};
  for (const division of MNEWS_DIVISIONS) {
    const eligibleEntries = [...display.entries()]
      .filter(([slug, e]) => e.eligible && divisionBySlug.get(slug) === division)
      .map(([slug, e]) => ({
        meta: { slug, division, weighInMiss: lastRizinMmaWeighInMiss(records, slug) },
        display: e,
      }));
    const key = divisionRankingsKey(division);
    out[key] = buildDivisionRankings(division, eligibleEntries, asOf, prevOut[key]);
  }

  // 1階級でも順位変動があれば、その日の全階級スナップショットをアーカイブする。
  const changed = Object.entries(out).some(([key, div]) => hasRankingChange(div, prevOut[key]));
  if (changed) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const dateKey = asOf.toISOString().slice(0, 10);
    fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateKey}.json`), JSON.stringify(out, null, 2) + "\n");
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT_PREV, JSON.stringify(prevOut, null, 2) + "\n");
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`=== mnewsレーティング rankings.json 更新 (asOf=${asOf.toISOString()}) ===`);
  for (const division of MNEWS_DIVISIONS) {
    const key = divisionRankingsKey(division);
    console.log(`  ${division}: ${out[key].entries.length}名掲載`);
  }
  console.log(`除外warning: ${warnings.length}件 / アーカイブ保存: ${changed ? "あり(" + asOf.toISOString().slice(0, 10) + ")" : "なし(変動なし)"}`);
}

// main()は同期関数だが、他のバッチスクリプト(update-fighter-records.ts等)と
// 同じ規約で明示的にcatch→process.exit(1)する。data/rankings.jsonへの書き込みは
// mainの最後(全計算完了後)にしかないため、途中で例外が飛べば何も書き込まれず
// 前回のrankings.jsonがそのまま残る(中途半端なファイルを書かない)。
// CI(update-fighter-records.yml)は前段のupdate-fighter-records.tsが失敗すれば
// GitHub Actionsのデフォルト挙動でこのステップ自体が実行されない。
try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
