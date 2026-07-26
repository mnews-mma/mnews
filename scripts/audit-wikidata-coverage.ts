/**
 * 指示書 W-1: Wikidata の日本人選手カバー率測定
 *
 * 読み取り専用の監査スクリプト。data/・src/ には一切書き込まない。
 * WDQS(https://query.wikidata.org/sparql)への実クエリは scripts/_wdqs_run.sh /
 * scripts/_wdqs_run_file.sh で事前に実行済みで、結果は out/wdqs-cache/*.json に
 * キャッシュ済み。本スクリプトはそのキャッシュを読み、
 *   - out/wikidata-jp-fighters.csv (層1: 日本国籍のMMA関連選手 全件)
 *   - out/wikidata-missing-match.csv (層2: missingとの突合結果)
 *   - out/wikidata-only-candidates.csv (逆方向: Wikidataにいるがmnewsに無い選手)
 *   - out/wikidata-coverage.md (サマリー)
 * を再生成する。再実行しても同じキャッシュを読む限り出力は同一になる
 * (自己検証: 2回実行して出力が一致することを確認済み)。
 *
 * 停止条件該当のため、本スクリプトは W1-1(プロパティID確定)・W1-2(層1件数)・
 * W1-3(層1CSV) までを実行し、W1-4(層2突合)以降は実行しない。
 * 理由: パンクラス・修斗missingの実件数が指示書の凍結値「100名」と一致せず
 * 「101名」だった(PR #208 out/roster-coverage-updated.csv を一次情報として
 * 実測)。これは指示書 §3 の明示された停止条件
 * 「入力のmissing件数が凍結値と一致しない(422 / 100との不一致。
 * 上記の既知の101件疑惑を含む)」に該当する。
 *
 * このファイルは"再実行可能なスクリプト"という提出物要件を満たすために
 * 手順を記録したものであり、W1-4以降のロジック(findFighterSlugByNameを
 * 使った突合)は意図的に未実装のまま(スタブ)。停止条件が解消されて
 * 再開する場合はここに追記する。
 */

import fs from "fs";
import path from "path";

const OUT_DIR = path.join(__dirname, "..", "out");
const CACHE_DIR = path.join(OUT_DIR, "wdqs-cache");

type SparqlBinding = Record<string, { value: string; type: string } | undefined>;
type SparqlResult = { results: { bindings: SparqlBinding[] } };

function readJson(name: string): SparqlResult {
  return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `${name}.json`), "utf8"));
}

function countOf(name: string): number {
  const r = readJson(name);
  return Number(r.results.bindings[0]?.c?.value ?? "0");
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function main() {
  // --- W1-1: プロパティID・職業Q番号(WDQSで確定済み。推測値ではない) ---
  const SHERDOG_PROP = "P2818"; // "SHERDOG選手識別子"
  const TAPOLOGY_PROP = "P9728"; // "Tapology選手識別子"
  const MMA_FIGHTER_Q = "Q11607585"; // "総合格闘家"

  // --- W1-2: 層1 絶対数 ---
  const sherdogTotal = countOf("w1-2-sherdog-total");
  const sherdogJp = countOf("w1-2-sherdog-jp");
  const sherdogJpJaLabel = countOf("w1-2-sherdog-jp-jalabel");
  const tapologyTotal = countOf("w1-2-tapology-total");
  const tapologyJp = countOf("w1-2-tapology-jp");
  const tapologyJpJaLabel = countOf("w1-2-tapology-jp-jalabel");
  const occupationJp = countOf("w1-2-occupation-jp");
  const occupationJpJaLabel = countOf("w1-2-occupation-jp-jalabel");

  // --- W1-3: 層1 CSV (日本国籍 かつ (総合格闘家 or SherdogID or TapologyID)) ---
  type Row = {
    qid: string;
    label_ja: string;
    label_en: string;
    alt_ja: string;
    sherdog_id: string;
    tapology_id: string;
    birth_year: string;
  };
  const rows: Row[] = [];
  for (let i = 0; i < 6; i++) {
    const r = readJson(`w1-3-details-${i}`);
    for (const b of r.results.bindings) {
      rows.push({
        qid: (b.p?.value ?? "").split("/").pop() ?? "",
        label_ja: b.labelJa?.value ?? "",
        label_en: b.labelEn?.value ?? "",
        alt_ja: b.altJa?.value ?? "",
        sherdog_id: b.sherdogId?.value ?? "",
        tapology_id: b.tapologyId?.value ?? "",
        birth_year: b.birth?.value ?? "",
      });
    }
  }
  rows.sort((a, b) => a.qid.localeCompare(b.qid));

  const csvHeader = "qid,label_ja,label_en,alt_ja,sherdog_id,tapology_id,birth_year";
  const csvLines = rows.map((r) =>
    [r.qid, r.label_ja, r.label_en, r.alt_ja, r.sherdog_id, r.tapology_id, r.birth_year]
      .map(csvEscape)
      .join(",")
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "wikidata-jp-fighters.csv"),
    [csvHeader, ...csvLines].join("\n") + "\n"
  );

  console.log("=== W1-1: プロパティID・職業Q番号(WDQS確定値) ===");
  console.log(`Sherdog ID = ${SHERDOG_PROP}`);
  console.log(`Tapology ID = ${TAPOLOGY_PROP}`);
  console.log(`総合格闘家 = ${MMA_FIGHTER_Q}`);
  console.log();
  console.log("=== W1-2: 層1 絶対数 ===");
  console.log(`Sherdog ID保有: 全体=${sherdogTotal} / 日本国籍=${sherdogJp} / うち日本語ラベルあり=${sherdogJpJaLabel}`);
  console.log(`Tapology ID保有: 全体=${tapologyTotal} / 日本国籍=${tapologyJp} / うち日本語ラベルあり=${tapologyJpJaLabel}`);
  console.log(`職業=総合格闘家 かつ 日本国籍: ${occupationJp} / うち日本語ラベルあり=${occupationJpJaLabel}`);
  console.log();
  console.log(`層1 CSV出力(重複排除後の母集団, 日本国籍 かつ (総合格闘家 or SherdogID or TapologyID)): ${rows.length}件`);
  console.log();
  console.log("=== 停止 ===");
  console.log(
    "パンクラス・修斗missingの実件数がPR #208時点で101件(凍結値100と不一致)のため、" +
      "指示書§3の停止条件に該当。W1-4(層2突合)以降は実行していない。詳細は out/wikidata-coverage.md 参照。"
  );
}

main();
