// 4団体戦績data(rizinRecords.json・shootoRecords.json・pancraseRecords.json・
// deepRecords.json)の大会数/bout数/slug未解決数を1行ずつ出力する。
// update-org-records.ymlから「スクレイプ前後の差分比較」「新規bout数・
// 未解決slug数のログ出力」の2用途で呼ばれる(引数にファイルパスを渡すことで
// git show HEAD:... の一時ファイルにも、作業ツリー上の最新ファイルにも
// 同じロジックで対応する)。
//
// 実行: npx tsx scripts/report-records-counts.ts <label> <path1> [<path2> ...]
// 出力: 1ファイルにつき1行、タブ区切りで `label\tfile\tevents\tbouts\tunresolvedSlugs`
import fs from "fs";

interface RecordsBout {
  fighterASlug: string | null;
  fighterBSlug: string | null;
}
interface RecordsEvent {
  bouts?: RecordsBout[];
}

function main() {
  const [label, ...filePaths] = process.argv.slice(2);
  if (!label || filePaths.length === 0) {
    console.error("使い方: npx tsx scripts/report-records-counts.ts <label> <path1> [<path2> ...]");
    process.exit(1);
  }

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      console.log(`${label}\t${filePath}\t0\t0\t0`);
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as RecordsEvent[];
    const events = Array.isArray(data) ? data : Object.values(data);
    let bouts = 0;
    let unresolved = 0;
    for (const ev of events) {
      const evBouts = ev.bouts ?? [];
      bouts += evBouts.length;
      for (const b of evBouts) {
        if (!b.fighterASlug || !b.fighterBSlug) unresolved++;
      }
    }
    console.log(`${label}\t${filePath}\t${events.length}\t${bouts}\t${unresolved}`);
  }
}

main();
