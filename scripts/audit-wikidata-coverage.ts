/**
 * 指示書 W-1: Wikidata の日本人選手カバー率測定
 *
 * 読み取り専用の監査スクリプト。data/・src/ には一切書き込まない
 * (src/lib/fighters.ts から FIGHTERS を import するが、これは読み取りのみで
 * fighters.ts 自体を変更しない)。
 *
 * WDQS(https://query.wikidata.org/sparql)への実クエリは scripts/_wdqs_run.sh /
 * scripts/_wdqs_run_file.sh で事前に実行済みで、結果は out/wdqs-cache/*.json に
 * キャッシュ済み。本スクリプトはそのキャッシュと、PR #208(feat/roster-loose-ends)
 * out/ から取得した一次情報(out/pr208-input/*.csv)を読み、以下を再生成する:
 *   - out/wikidata-jp-fighters.csv (層1: 日本国籍のMMA関連選手 全件)
 *   - out/wikidata-missing-match.csv (層2: missing 523名との突合結果)
 *   - out/wikidata-only-candidates.csv (逆方向: Wikidataにいるがmnewsに無い選手)
 * (out/wikidata-coverage.md はサマリー文書のため本スクリプトでは生成せず手動作成)
 *
 * 実行: npx tsx scripts/audit-wikidata-coverage.ts
 *
 * ---
 * 【missingの凍結値についての注記(2026-07-26 訂正)】
 * 指示書原文は「パンクラス・修斗missing 100名」としていたが、これは
 * PR #208(②-c)より前の値(必達セット186件・網羅率A 22.0%時点)であり、
 * ②-c後の実際の凍結値は189件/missing101件/網羅率A 22.8%(女子無差別級王者
 * アマンダ・ルーカス追加分+1)。ユーザー確認の上、101を正として扱う。
 *
 * 【名寄せ正規化についての注記】
 * 指示書は「findFighterSlugByName を使う」「同じ正規化を通す」「新規正規化関数を
 * 書かない」ことを要求している。findFighterSlugByName 自体とその正規化ヘルパー
 * (normNameForMatch/toKatakana/toHiragana/stripDecorativeNickname)は
 * src/lib/fighters.ts にあるが、いずれも export されていない private 関数のため、
 * src/ を一切変更しない制約下ではこのスクリプトから import できない。
 * そのため、同じロジックをこのファイル内に逐語コピーして使う(下記参照)。
 * 新しい・独自の正規化基準を発明しているわけではなく、fighters.ts の該当行
 * (1467-1479行の normNameForMatch、1459-1465行の stripDecorativeNickname、
 * 1468-1473行の toKatakana/toHiragana)をそのまま複製している。
 *
 * さらに、W1-6(逆方向)では hidden を含む全FIGHTERSに対して照合する必要があるが、
 * findFighterSlugByName は仕様上 hidden を常に除外するため、この用途には使えない
 * (orgRankings.ts が同じ理由で独自の全FIGHTERS索引を持っているのと同型の制約。
 * src/lib/orgRankings.ts:32-33のコメント参照)。W1-6専用に、同じ正規化ロジックを
 * 使った「hidden込みの索引」を別途構築する。
 *
 * 【部分一致の禁止・自動確定の禁止】
 * 候補文字列同士は正規化後の完全一致(===)でのみ判定する。あいまい一致・編集距離
 * 等は一切使わない。また、正規化後の同一文字列が複数の異なるWikidata QIDに
 * またがる場合(衝突)は、findFighterSlugByNameのAMBIGUOUS_NAMESガードと同じ
 * 考え方で、その候補文字列では自動確定させず none 扱いにする。
 */

import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";

const OUT_DIR = path.join(__dirname, "..", "out");
const CACHE_DIR = path.join(OUT_DIR, "wdqs-cache");
const INPUT_DIR = path.join(OUT_DIR, "pr208-input");

// ============================================================
// fighters.ts の private 正規化ヘルパーの逐語コピー
// ============================================================
function stripDecorativeNickname(s: string): string {
  return s
    .replace(/["“”][^"“”]*["“”]/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .trim();
}
function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
function normNameForMatch(s: string): string {
  return s.replace(/[\s　]/g, "");
}
// findFighterSlugByName と同じ候補生成(raw name + カッコ・ニックネーム除去後、各々かな/カナ変換)
function buildCandidates(name: string): Set<string> {
  const candidates = new Set<string>();
  const cleaned = stripDecorativeNickname(name);
  for (const raw of [name, cleaned]) {
    const n = normNameForMatch(raw);
    if (!n) continue;
    candidates.add(n);
    candidates.add(toKatakana(n));
    candidates.add(toHiragana(n));
  }
  return candidates;
}

// ============================================================
// CSV util(簡易パーサ。ダブルクォート囲み・カンマ内包に対応)
// ============================================================
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r\n|\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => (row[h] = cells[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}
function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// ============================================================
// WDQSキャッシュ読み込み
// ============================================================
type SparqlBinding = Record<string, { value: string; type: string } | undefined>;
type SparqlResult = { results: { bindings: SparqlBinding[] } };
function readJson(name: string): SparqlResult {
  return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `${name}.json`), "utf8"));
}
function countOf(name: string): number {
  const r = readJson(name);
  return Number(r.results.bindings[0]?.c?.value ?? "0");
}

// ============================================================
// メイン
// ============================================================
function main() {
  // ---------- W1-1 ----------
  const SHERDOG_PROP = "P2818"; // "SHERDOG選手識別子"
  const TAPOLOGY_PROP = "P9728"; // "Tapology選手識別子"
  const MMA_FIGHTER_Q = "Q11607585"; // "総合格闘家"

  // ---------- W1-2 ----------
  const sherdogTotal = countOf("w1-2-sherdog-total");
  const sherdogJp = countOf("w1-2-sherdog-jp");
  const sherdogJpJaLabel = countOf("w1-2-sherdog-jp-jalabel");
  const tapologyTotal = countOf("w1-2-tapology-total");
  const tapologyJp = countOf("w1-2-tapology-jp");
  const tapologyJpJaLabel = countOf("w1-2-tapology-jp-jalabel");
  const occupationJp = countOf("w1-2-occupation-jp");
  const occupationJpJaLabel = countOf("w1-2-occupation-jp-jalabel");

  // ---------- W1-3: 層1 CSV ----------
  type WdRow = {
    qid: string;
    label_ja: string;
    label_en: string;
    alt_ja: string[];
    sherdog_id: string;
    tapology_id: string;
    birth_year: string;
  };
  const wdRows: WdRow[] = [];
  for (let i = 0; i < 6; i++) {
    const r = readJson(`w1-3-details-${i}`);
    for (const b of r.results.bindings) {
      wdRows.push({
        qid: (b.p?.value ?? "").split("/").pop() ?? "",
        label_ja: b.labelJa?.value ?? "",
        label_en: b.labelEn?.value ?? "",
        alt_ja: (b.altJa?.value ?? "").split("|").filter(Boolean),
        sherdog_id: b.sherdogId?.value ?? "",
        tapology_id: b.tapologyId?.value ?? "",
        birth_year: b.birth?.value ?? "",
      });
    }
  }
  wdRows.sort((a, b) => a.qid.localeCompare(b.qid));

  const wdCsvHeader = "qid,label_ja,label_en,alt_ja,sherdog_id,tapology_id,birth_year";
  const wdCsvLines = wdRows.map((r) =>
    [r.qid, r.label_ja, r.label_en, r.alt_ja.join("|"), r.sherdog_id, r.tapology_id, r.birth_year]
      .map(csvEscape)
      .join(",")
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "wikidata-jp-fighters.csv"),
    [wdCsvHeader, ...wdCsvLines].join("\n") + "\n"
  );

  // ---------- W1-4 前提確認: PR #208 入力件数の実カウント ----------
  const rosterCsv = parseCsv(
    fs.readFileSync(path.join(INPUT_DIR, "roster-coverage-updated.csv"), "utf8")
  );
  const deepCsv = parseCsv(
    fs.readFileSync(path.join(INPUT_DIR, "deep-event-participants-updated.csv"), "utf8")
  );

  const rosterListed = rosterCsv.filter((r) => r.status === "listed").length;
  const rosterHidden = rosterCsv.filter((r) => r.status === "hidden").length;
  const rosterMissing = rosterCsv.filter((r) => r.status === "missing").length;
  const rosterTotal = rosterCsv.length;

  // DEEPイベント名簿はbout単位(1行=1出場)。name_normalizedでユニーク化する。
  const deepByName = new Map<string, typeof deepCsv>();
  for (const row of deepCsv) {
    const key = row.name_normalized;
    if (!deepByName.has(key)) deepByName.set(key, []);
    deepByName.get(key)!.push(row);
  }
  let deepListed = 0,
    deepHidden = 0,
    deepMissing = 0;
  for (const rows of deepByName.values()) {
    const statuses = new Set(rows.map((r) => r.status));
    if (statuses.size > 1) {
      console.warn(
        `[警告] DEEP名簿で同一name_normalizedに複数status混在: ${rows[0].name_normalized} -> ${[...statuses]}`
      );
    }
    const s = rows[0].status;
    if (s === "listed") deepListed++;
    else if (s === "hidden") deepHidden++;
    else if (s === "missing") deepMissing++;
  }
  const deepUniqueTotal = deepByName.size;

  console.log("=== W1-1: プロパティID・職業Q番号(WDQS確定値) ===");
  console.log(`Sherdog ID = ${SHERDOG_PROP} / Tapology ID = ${TAPOLOGY_PROP} / 総合格闘家 = ${MMA_FIGHTER_Q}`);
  console.log();
  console.log("=== W1-2: 層1 絶対数 ===");
  console.log(`Sherdog ID保有: 全体=${sherdogTotal} / 日本国籍=${sherdogJp} / うち日本語ラベルあり=${sherdogJpJaLabel}`);
  console.log(`Tapology ID保有: 全体=${tapologyTotal} / 日本国籍=${tapologyJp} / うち日本語ラベルあり=${tapologyJpJaLabel}`);
  console.log(`職業=総合格闘家 かつ 日本国籍: ${occupationJp} / うち日本語ラベルあり=${occupationJpJaLabel}`);
  console.log(`層1 CSV(和集合): ${wdRows.length}件`);
  console.log();
  console.log("=== 入力確認(PR #208, 一次情報を実カウント) ===");
  console.log(
    `roster-coverage-updated.csv: listed=${rosterListed} hidden=${rosterHidden} missing=${rosterMissing} 合計=${rosterTotal}`
  );
  console.log(
    `deep-event-participants-updated.csv: unique=${deepUniqueTotal} listed=${deepListed} hidden=${deepHidden} missing=${deepMissing}`
  );
  const rosterCheck = rosterListed + rosterHidden + rosterMissing === 189 && rosterMissing === 101;
  const deepCheck = deepMissing === 422;
  console.log(
    `検算(2026-07-26訂正後の凍結値): パンクラス・修斗(listed43+hidden45+missing101=189) -> ${
      rosterCheck ? "OK" : "NG"
    } / DEEP missing=422 -> ${deepCheck ? "OK" : "NG"}`
  );
  if (!rosterCheck || !deepCheck) {
    console.error("入力件数の検算に失敗。ここで停止する(自分で数字を訂正して先に進まない)。");
    process.exit(1);
  }

  // ---------- W1-4: 層2突合 ----------
  // Wikidata側索引: normalize(label_ja / alt_ja) -> Set<qid>(衝突検知のため)
  type WdMatch = { qid: string; label_ja: string; sherdog_id: string };
  const byExactCandidate = new Map<string, WdMatch[]>();
  const byAliasCandidate = new Map<string, WdMatch[]>();
  const addTo = (map: Map<string, WdMatch[]>, cand: string, m: WdMatch) => {
    if (!cand) return;
    if (!map.has(cand)) map.set(cand, []);
    const arr = map.get(cand)!;
    if (!arr.some((x) => x.qid === m.qid)) arr.push(m);
  };
  for (const row of wdRows) {
    const m: WdMatch = { qid: row.qid, label_ja: row.label_ja, sherdog_id: row.sherdog_id };
    if (row.label_ja) {
      for (const c of buildCandidates(row.label_ja)) addTo(byExactCandidate, c, m);
    }
    for (const alt of row.alt_ja) {
      for (const c of buildCandidates(alt)) addTo(byAliasCandidate, c, m);
    }
  }
  // 衝突(同一正規化文字列が複数QIDにまたがる)は自動確定させない
  const ambiguousExact = new Set(
    [...byExactCandidate.entries()].filter(([, v]) => v.length > 1).map(([k]) => k)
  );
  const ambiguousAlias = new Set(
    [...byAliasCandidate.entries()].filter(([, v]) => v.length > 1).map(([k]) => k)
  );

  type MissingEntry = {
    org: string;
    weightClass: string;
    appearances: string; // 出場回数。roster-coverage側は該当データが無いため空欄
    nameMnews: string;
  };
  const missingEntries: MissingEntry[] = [];

  // DEEP側 422名(org="deep")
  for (const [name, rows] of deepByName) {
    if (rows[0].status !== "missing") continue;
    const sorted = [...rows].sort((a, b) => (a.event_date > b.event_date ? -1 : 1));
    missingEntries.push({
      org: "deep",
      weightClass: sorted[0].weight_class_raw,
      appearances: String(rows.length),
      nameMnews: name,
    });
  }
  // パンクラス・修斗+DEEP王座枠側 101名
  // (org="deep"のrosterCsv行はDEEPイベント名簿の422名とは別集計=王座枠なので
  //  混同を避けるため org="deep_champion_slot" とラベルし直す)
  for (const row of rosterCsv) {
    if (row.status !== "missing") continue;
    missingEntries.push({
      org: row.org === "deep" ? "deep_champion_slot" : row.org,
      weightClass: row.weight_class_mnews || row.weight_class_raw,
      appearances: "",
      nameMnews: row.name_official,
    });
  }

  if (missingEntries.length !== 523) {
    console.error(`missing総数が523と一致しない(実際: ${missingEntries.length})。停止する。`);
    process.exit(1);
  }

  type MatchResult = MissingEntry & {
    qid: string;
    label_ja: string;
    sherdog_id: string;
    match_confidence: "exact" | "alias" | "none";
  };
  const matchResults: MatchResult[] = missingEntries.map((entry) => {
    const candidates = buildCandidates(entry.nameMnews);
    // exact(label_ja一致)を優先
    for (const c of candidates) {
      if (ambiguousExact.has(c)) continue;
      const hit = byExactCandidate.get(c);
      if (hit && hit.length === 1) {
        return {
          ...entry,
          qid: hit[0].qid,
          label_ja: hit[0].label_ja,
          sherdog_id: hit[0].sherdog_id,
          match_confidence: "exact",
        };
      }
    }
    // alias(alt_ja一致)
    for (const c of candidates) {
      if (ambiguousAlias.has(c)) continue;
      const hit = byAliasCandidate.get(c);
      if (hit && hit.length === 1) {
        return {
          ...entry,
          qid: hit[0].qid,
          label_ja: hit[0].label_ja,
          sherdog_id: hit[0].sherdog_id,
          match_confidence: "alias",
        };
      }
    }
    return { ...entry, qid: "", label_ja: "", sherdog_id: "", match_confidence: "none" };
  });

  const missMatchHeader = "org,階級,出場回数,name_mnews,qid,label_ja,sherdog_id,match_confidence";
  const missMatchLines = matchResults.map((r) =>
    [r.org, r.weightClass, r.appearances, r.nameMnews, r.qid, r.label_ja, r.sherdog_id, r.match_confidence]
      .map(csvEscape)
      .join(",")
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "wikidata-missing-match.csv"),
    [missMatchHeader, ...missMatchLines].join("\n") + "\n"
  );

  // ---------- W1-5: カバー率集計 ----------
  const countBy = (rows: MatchResult[]) => {
    const exact = rows.filter((r) => r.match_confidence === "exact").length;
    const alias = rows.filter((r) => r.match_confidence === "alias").length;
    const none = rows.filter((r) => r.match_confidence === "none").length;
    return { total: rows.length, exact, alias, none, hit: exact + alias };
  };
  const deepRows = matchResults.filter((r) => r.org === "deep");
  const pancraseShootoRows = matchResults.filter((r) => r.org !== "deep");
  const overallStats = countBy(matchResults);
  const deepStats = countBy(deepRows);
  const psStats = countBy(pancraseShootoRows);

  // ブランド別(DEEPのみ; 本戦=IMPACT系+JEWELS / 育成=FIGHT CHALLENGE+その他若手大会)
  const brandOf = (name: string): "本戦" | "育成" | "不明" => {
    const rows = deepByName.get(name);
    if (!rows) return "不明";
    const brands = new Set(rows.map((r) => r.brand));
    const isHonsen = [...brands].some((b) => b.includes("IMPACT") || b === "DEEP JEWELS");
    const isIkusei = [...brands].some((b) => b === "DEEP FIGHT CHALLENGE" || b === "other");
    if (isHonsen) return "本戦"; // 本戦経験が一度でもあれば本戦扱い(育成→本戦昇格を含む)
    if (isIkusei) return "育成";
    return "不明";
  };
  const brandBuckets: Record<string, MatchResult[]> = { 本戦: [], 育成: [], 不明: [] };
  for (const r of deepRows) brandBuckets[brandOf(r.nameMnews)].push(r);
  const brandStats = Object.fromEntries(Object.entries(brandBuckets).map(([k, v]) => [k, countBy(v)]));

  // 出場回数別(DEEPのみ; パンクラス・修斗側は公式ランキングのスナップショットで出場回数データを持たないため対象外)
  const apBuckets: Record<string, MatchResult[]> = { "3回以上": [], "2回": [], "1回のみ": [] };
  for (const r of deepRows) {
    const n = Number(r.appearances);
    if (n >= 3) apBuckets["3回以上"].push(r);
    else if (n === 2) apBuckets["2回"].push(r);
    else apBuckets["1回のみ"].push(r);
  }
  const apStats = Object.fromEntries(Object.entries(apBuckets).map(([k, v]) => [k, countBy(v)]));

  // ---------- W1-6: 逆方向(Wikidataにいるがmnewsに無い) ----------
  // FIGHTERS(listed+hidden両方)の索引。findFighterSlugByNameはhiddenを除外するため
  // ここでは使えず、同じ正規化関数で独自の全FIGHTERS索引を構築する(orgRankings.tsと同型の理由)。
  const fighterCandidateSet = new Set<string>();
  for (const f of FIGHTERS as Fighter[]) {
    for (const c of buildCandidates(f.nameJa)) fighterCandidateSet.add(c);
    for (const a of f.aliases ?? []) {
      for (const c of buildCandidates(a)) fighterCandidateSet.add(c);
    }
  }
  const wikidataOnly = wdRows.filter((row) => {
    const allNames = [row.label_ja, ...row.alt_ja].filter(Boolean);
    for (const n of allNames) {
      for (const c of buildCandidates(n)) {
        if (fighterCandidateSet.has(c)) return false; // mnewsに何らかの形で存在(listed/hidden問わず)
      }
    }
    return true;
  });
  const onlyHeader = "qid,label_ja,label_en,alt_ja,sherdog_id,tapology_id,birth_year";
  const onlyLines = wikidataOnly.map((r) =>
    [r.qid, r.label_ja, r.label_en, r.alt_ja.join("|"), r.sherdog_id, r.tapology_id, r.birth_year]
      .map(csvEscape)
      .join(",")
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "wikidata-only-candidates.csv"),
    [onlyHeader, ...onlyLines].join("\n") + "\n"
  );

  // ---------- 自己検証・レポート用ログ ----------
  console.log();
  console.log("=== W1-4/5: 層2突合 ===");
  console.log(
    `全体(523名): exact=${overallStats.exact} alias=${overallStats.alias} none=${overallStats.none} hit=${overallStats.hit} カバー率=${((overallStats.hit / overallStats.total) * 100).toFixed(1)}%`
  );
  console.log(
    `DEEP(422名): exact=${deepStats.exact} alias=${deepStats.alias} none=${deepStats.none} hit=${deepStats.hit} カバー率=${((deepStats.hit / deepStats.total) * 100).toFixed(1)}%`
  );
  console.log(
    `パンクラス・修斗(101名): exact=${psStats.exact} alias=${psStats.alias} none=${psStats.none} hit=${psStats.hit} カバー率=${((psStats.hit / psStats.total) * 100).toFixed(1)}%`
  );
  console.log();
  console.log("=== ブランド別(DEEP) ===");
  for (const [k, v] of Object.entries(brandStats)) {
    console.log(`${k}: ${v.total}名 hit=${v.hit} カバー率=${v.total ? ((v.hit / v.total) * 100).toFixed(1) : "0.0"}%`);
  }
  console.log();
  console.log("=== 出場回数別(DEEP) ===");
  for (const [k, v] of Object.entries(apStats)) {
    console.log(`${k}: ${v.total}名 hit=${v.hit} カバー率=${v.total ? ((v.hit / v.total) * 100).toFixed(1) : "0.0"}%`);
  }
  console.log();
  console.log(`W1-6 逆方向候補: ${wikidataOnly.length}件`);
  console.log();
  // 自己検証: missing総数=hit+非hit
  const noneCount = matchResults.filter((r) => r.match_confidence === "none").length;
  console.log(
    `自己検証: missing総数(${matchResults.length}) = hit(${overallStats.hit}) + none(${noneCount}) -> ${
      matchResults.length === overallStats.hit + noneCount ? "OK" : "NG"
    }`
  );
}

main();
