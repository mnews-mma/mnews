// PR-G(2026-08-17、追加ゲート): 「再生成の入力に含まれない手動編集値が、パイプラインの
// 再生成のたびに無言で巻き戻る」型のサイレント失敗を検知するゲート。
//
// 実例(調査結果): PR-18(#554)は data/kick/bouts_wikipedia.json
// (scripts/standup-pipeline/ingest_wikipedia.pyが生成するファイルであり、同時に
// build-kick-data.tsの直接の入力でもある)を手動編集し、改名選手5人
// (アマラ忍→忍アマラ―等)の壊れたfighter_slug(誰の識別子にも一致しない値)を
// 正しい識別子へ書き換えた。しかしこの修正はingest_wikipedia.py /
// build_coverage_population_v2.pyのロジックには反映されておらず、後日(#563)これらの
// スクリプトを再実行してbouts_wikipedia.jsonを再生成した際、5人分の修正が無言で
// 巻き戻っていた(#563の調査で発覚)。#563はbuild_coverage_population_v2.pyに
// LEG3_NAME_RENAMESという恒久的なリネーム表を追加し根治した。
//
// なお、このアーカイブ復元はビルド全体のunmatchedBoutsBaseline.json(ratchet、集計値)
// では検知できていなかった: #563は同時に母集団を718→833人へ拡張しており、新規に
// マッチするようになったbout数の方が、この5人の巻き戻りによる増分より大きく、
// 集計全体としては悪化して見えなかった(集計値のratchetが個別の回帰をマスクする穴)。
// 本ゲートは集計値ではなく個別の既知の値を直接検証することでこの穴を塞ぐ。
//
// 検査1(レジストリ、ゼロ件ゲート): data/kick/manualOverrides.json に登録された
// 「既知の手動修正」が、現在も data/kick/bouts_wikipedia.json に正しく反映されているかを
// 検証する。登録した新名義の行が0件(消失)、または旧名義の行が再出現(1件以上)していれば
// 巻き戻りとみなし、ビルドを失敗させる。
//
// 検査2(未登録の同型ドリフトの検知、診断値・ratchetベースライン): 上記レジストリに載って
// いない行でも、fighter_slugがfighters.jsonのどのidentity(name|gym|source)にも一致しない
// のに、fighter_name自体はfighters.jsonに実在する選手の表記名と完全一致する行を検出する。
// これは「名前は知っているのに識別子だけが古い/壊れている」状態であり、同型の巻き戻り・
// 手動編集漏れの候補になりうる。現状の件数をベースラインとして記録し、増加したら
// ビルドを失敗させる。
//
// 実行方法: npx tsx scripts/check-kick-manual-edit-drift.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");
const REGISTRY_PATH = path.join(SRC, "manualOverrides.json");
const DIAG_BASELINE_PATH = path.join(SRC, "kickManualEditDriftBaseline.json");

interface Fighter {
  name: string;
  gym: string | null;
  sources: string[];
}
interface WikiBout {
  fighter_slug: string;
  fighter_name: string;
}
interface RenameEntry {
  oldFighterName: string;
  newFighterName: string;
  reason: string;
  fixedInCommit: string;
}
interface CorrectedBoutResultEntry {
  sourceFile: string;
  boutId: string;
  correctedField: string;
  originalValue: string;
  correctedValue: string;
  reason: string;
  fixedInCommit: string;
}

const fighters: Fighter[] = JSON.parse(fs.readFileSync(path.join(SRC, "fighters.json"), "utf8"));
const identity = (f: Fighter) => `${f.name}|${f.gym ?? ""}|${f.sources[0] ?? ""}`;
const knownIdentities = new Set(fighters.map(identity));
const knownNames = new Set(fighters.map((f) => f.name));

const wikiBouts: WikiBout[] = fs.existsSync(path.join(SRC, "bouts_wikipedia.json"))
  ? JSON.parse(fs.readFileSync(path.join(SRC, "bouts_wikipedia.json"), "utf8"))
  : [];

const registry: {
  renamedFighterWikipediaIdentity: RenameEntry[];
  correctedBoutResults?: CorrectedBoutResultEntry[];
} = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));

// ---------- 検査1: レジストリ済みの手動修正が今も反映されているか(ゼロ件ゲート) ----------
const reverted: string[] = [];
for (const entry of registry.renamedFighterWikipediaIdentity) {
  const oldCount = wikiBouts.filter((b) => b.fighter_name === entry.oldFighterName).length;
  const newCount = wikiBouts.filter((b) => b.fighter_name === entry.newFighterName).length;
  if (oldCount > 0) {
    reverted.push(
      `${entry.oldFighterName}→${entry.newFighterName}: 旧名義の行が${oldCount}件再出現しています` +
        `(巻き戻り。${entry.fixedInCommit}参照)`,
    );
  }
  if (newCount === 0) {
    reverted.push(
      `${entry.oldFighterName}→${entry.newFighterName}: 新名義の行が0件です` +
        `(データごと消失した可能性。${entry.fixedInCommit}参照)`,
    );
  }
}

if (reverted.length) {
  console.error(
    `[kick-manual-edit-drift] ★data/kick/manualOverrides.json に登録済みの手動修正が` +
      `巻き戻っています。デプロイをブロックします:\n` +
      reverted.map((r) => `  - ${r}`).join("\n") +
      `\n  対処法: ingest_wikipedia.py / build_coverage_population_v2.py 側の恒久修正` +
      `(LEG3_NAME_RENAMES等)が外れていないか確認してください。`,
  );
  process.exit(1);
}
console.log(
  `[kick-manual-edit-drift] 検査1: レジストリ${registry.renamedFighterWikipediaIdentity.length}件、巻き戻りなし(OK)`,
);

// ---------- 検査2: 未登録の同型ドリフトの検知(診断・ratchet) ----------
const registeredNames = new Set(
  registry.renamedFighterWikipediaIdentity.flatMap((e) => [e.oldFighterName, e.newFighterName]),
);
let unmatchedButNameKnown = 0;
const samples: string[] = [];
for (const b of wikiBouts) {
  if (knownIdentities.has(b.fighter_slug)) continue; // 正しく解決済み
  if (registeredNames.has(b.fighter_name)) continue; // レジストリで別途扱っている名前は検査1の管轄
  if (knownNames.has(b.fighter_name)) {
    unmatchedButNameKnown++;
    if (samples.length < 15) samples.push(`${b.fighter_name}(slug="${b.fighter_slug}")`);
  }
}

console.log(
  `[kick-manual-edit-drift] 検査2: 識別子不一致だが表記名は既知の選手と一致する行 = ${unmatchedButNameKnown}件`,
);
if (samples.length) console.log(`[kick-manual-edit-drift] 例: ${samples.join(", ")}`);

const prevDiagBaseline: number = fs.existsSync(DIAG_BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(DIAG_BASELINE_PATH, "utf8")).count
  : unmatchedButNameKnown;

if (unmatchedButNameKnown > prevDiagBaseline) {
  console.error(
    `[kick-manual-edit-drift] ★検査2の件数が前回ビルド時点の基準(${prevDiagBaseline}件)から` +
      `${unmatchedButNameKnown}件に増加しました。表記名は既知なのに識別子が一致しない行が` +
      `新たに発生しています(選手の改名・所属変更等でidentityが変わった、または手動編集が` +
      `パイプラインに反映されないまま巻き戻った可能性)。デプロイをブロックします。`,
  );
  process.exit(1);
}

fs.writeFileSync(DIAG_BASELINE_PATH, JSON.stringify({ count: unmatchedButNameKnown }, null, 1) + "\n");

// ---------- 検査3: correctedBoutResults(bouts_*.json全般のフィールド単位の手動修正)の巻き戻り検知(ゼロ件ゲート) ----------
// renamedFighterWikipediaIdentity(検査1)は選手identity専用・bouts_wikipedia.json専用だが、
// こちらは「特定の1試合(boutId)の特定の1フィールドが、公式サイト自体の誤り等を理由に
// 手動で上書きされている」ケースを対象にした汎用版。sourceFileはエントリごとに指定する
// (T-1のraw/キャッシュ退避検証で見つかったRISE 1件〈PR#588〉が最初の登録例)。
const correctedBoutResults = registry.correctedBoutResults ?? [];
const boutResultReverted: string[] = [];
const boutFileCache = new Map<string, Record<string, unknown>[]>();
for (const entry of correctedBoutResults) {
  const filePath = path.join(SRC, entry.sourceFile);
  if (!boutFileCache.has(entry.sourceFile)) {
    boutFileCache.set(
      entry.sourceFile,
      fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : [],
    );
  }
  const bouts = boutFileCache.get(entry.sourceFile)!;
  const bout = bouts.find((b) => b.bout_id === entry.boutId);
  if (!bout) {
    boutResultReverted.push(
      `${entry.sourceFile}: bout_id="${entry.boutId}" が見つかりません(行ごと消失した可能性。${entry.fixedInCommit}参照)`,
    );
    continue;
  }
  const current = bout[entry.correctedField];
  if (current !== entry.correctedValue) {
    boutResultReverted.push(
      `${entry.sourceFile}: bout_id="${entry.boutId}" の${entry.correctedField}が` +
        `"${entry.correctedValue}"(登録済みの修正値)ではなく"${String(current)}"になっています` +
        `(巻き戻り。${entry.fixedInCommit}参照)`,
    );
  }
}

if (boutResultReverted.length) {
  console.error(
    `[kick-manual-edit-drift] ★data/kick/manualOverrides.json の correctedBoutResults に` +
      `登録済みの手動修正が巻き戻っています。デプロイをブロックします:\n` +
      boutResultReverted.map((r) => `  - ${r}`).join("\n") +
      `\n  対処法: 対象sourceFileを再生成した際にこの修正が反映されているか確認してください` +
      `(raw HTML自体が誤っている場合はパーサ側では直せません。手動修正を再適用してください)。`,
  );
  process.exit(1);
}

console.log(
  `[kick-manual-edit-drift] OK(検査1: 巻き戻り0件 / 検査2: ${unmatchedButNameKnown}件、基準以下 / ` +
    `検査3: 登録${correctedBoutResults.length}件、巻き戻りなし)`,
);
