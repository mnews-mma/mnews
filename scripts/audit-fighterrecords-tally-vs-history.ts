// data/fighterRecords.json の集計値(wins/losses/draws)とhistory配列の突合チェック
// (選手ページのヘッダー戦績とテーブル行数の食い違い調査(#359)でいう「パターンB」)。
// read-only、常駐スクリプトではなく手動実行の監査ツール。
//
// 2026-08-02(指示書R-9): 旧版の検出式は `wins+losses+draws === history.length` で、
// historyに含まれる result:"nc" 行(勝敗数には非算入という仕様。out/nc-audit-report.md
// 参照)を考慮していなかった。NC行を持つ選手は仕様通りでも必ず不一致判定になる欠陥が
// あった。本版は `wins+losses+draws+ncCount === history.length` で判定する
// (「集計値はNC非算入、historyはNC行を保持する」という確定仕様に合わせた式)。
//
// #359のPattern B定義(ヘッダー=1行目wins/losses/draws、テーブル=history.length)と
// 母集団を揃えるため、history.length===0の選手(例: 住村竜市朗。集計値のみで
// 対戦テーブル自体が記事に無い既知の正常状態)も対象に含める。ただし個別に
// isEmptyHistoryKnownCase フラグを立て、新規バグと混同しないようにする
// (checkFighterRecordIntegrity()はこのケースを除外して見ているが、#359のPattern B
// 集計はこのケースも1件として数えているため、あえて母集団を合わせる)。
//
// 実行: npx tsx scripts/audit-fighterrecords-tally-vs-history.ts
import fs from "fs";
import path from "path";
import type { FighterRecordsFile } from "../src/lib/fighterRecordsCache";

const DATA_PATH = path.join(process.cwd(), "data", "fighterRecords.json");

function main() {
  const data: FighterRecordsFile = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const mismatches: Array<{
    slug: string;
    wins: number;
    losses: number;
    draws: number;
    histLen: number;
    ncCount: number;
    expectedLen: number;
    diff: number;
    isEmptyHistoryKnownCase: boolean;
  }> = [];

  for (const [slug, entry] of Object.entries(data)) {
    const history = entry.history ?? [];
    const ncCount = history.filter((h) => h.result === "nc").length;
    const expectedLen = entry.wins + entry.losses + entry.draws + ncCount;
    const diff = history.length - expectedLen;
    // NC考慮版の式でdiff===0なら、NCの有無に関わらず内部整合しているため対象外
    // (旧版はncCountを見ていなかったため、NC行を持つだけの選手も誤って
    // ここに残ってしまっていた)。
    if (diff !== 0) {
      mismatches.push({
        slug,
        wins: entry.wins,
        losses: entry.losses,
        draws: entry.draws,
        histLen: history.length,
        ncCount,
        expectedLen,
        diff,
        isEmptyHistoryKnownCase: history.length === 0,
      });
    }
  }

  mismatches.sort((a, b) => a.slug.localeCompare(b.slug));

  console.log(`[B型監査(NC考慮版)] 対象: ${Object.keys(data).length}選手 / 不一致: ${mismatches.length}件`);
  for (const m of mismatches) {
    console.log(
      `  ${m.slug}: 集計(${m.wins}-${m.losses}-${m.draws}, nc=${m.ncCount}) 期待history総数=${m.expectedLen} vs 実際=${m.histLen} (diff=${m.diff > 0 ? "+" : ""}${m.diff})${m.isEmptyHistoryKnownCase ? " [既知: history空の記事]" : ""}`
    );
  }

  const outPath = path.join(process.cwd(), "out", "nc-audit-b-type-nc-aware.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(mismatches, null, 2) + "\n");
  console.log(`\n[B型監査(NC考慮版)] 結果を ${path.relative(process.cwd(), outPath)} に書き出しました。`);
}

main();
