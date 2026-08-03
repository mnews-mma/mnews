// 4団体戦績data(rizinRecords.json・shootoRecords.json・pancraseRecords.json・
// deepRecords.json)の大会数/bout数/slug未解決数を1行ずつ出力する。
// update-org-records.ymlから「スクレイプ前後の差分比較」「新規bout数・
// 未解決slug数のログ出力」の2用途で呼ばれる(引数にファイルパスを渡すことで
// git show HEAD:... の一時ファイルにも、作業ツリー上の最新ファイルにも
// 同じロジックで対応する)。
//
// 実行: npx tsx scripts/report-records-counts.ts <label> <path1> [<path2> ...]
// 出力: 2種類の行をタブ区切りで出す(呼び出し側はプレフィックスでgrep分離する)。
//   COUNT\tlabel\tfile\tevents\tbouts\tunresolvedSlugs   … 1ファイルにつき1行
//   ZEROBOUT\tlabel\tfile\teventName\tdate                … bout数0の大会1件につき1行
// bout数0はスタブ化(公式ページはあるが個別bout抽出が構造的に不可能等)の
// 正常な状態でもあるため、このスクリプト自体は異常終了しない(検出して
// 一覧化するのみ。判断は呼び出し側/人間に委ねる)。
import fs from "fs";

interface RecordsBout {
  fighterASlug: string | null;
  fighterBSlug: string | null;
}
interface RecordsEvent {
  eventName?: string;
  date?: string;
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
      console.log(`COUNT\t${label}\t${filePath}\t0\t0\t0`);
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const events = JSON.parse(raw) as RecordsEvent[];
    let bouts = 0;
    let unresolved = 0;
    for (const ev of events) {
      const evBouts = ev.bouts ?? [];
      bouts += evBouts.length;
      for (const b of evBouts) {
        if (!b.fighterASlug || !b.fighterBSlug) unresolved++;
      }
      if (evBouts.length === 0) {
        console.log(`ZEROBOUT\t${label}\t${filePath}\t${ev.eventName ?? "(不明)"}\t${ev.date ?? "(不明)"}`);
      }
    }
    console.log(`COUNT\t${label}\t${filePath}\t${events.length}\t${bouts}\t${unresolved}`);
  }
}

main();
