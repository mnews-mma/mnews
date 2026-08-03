// 指示書⑤: data/shootoRecords.json・data/pancraseRecords.jsonに、
// 非プロ/非MMA bout(src/lib/mnewsRating/nonProBoutFilter.ts の各カテゴリ)
// が1件でも残っていたら異常終了するゲート。
//
// 背景: .github/workflows/update-org-records.ymlは生スクレイパーを実行後
// scripts/filter-nonpro-bouts.tsで除外する構成になっているが、将来この
// 呼び出しが(リファクタ等で)誤って外れても、除外済みのはずのboutが
// 再混入したことに気づけない。このスクリプトはフィルタ実行の有無に
// 依存せず、コミット直前のdata/の中身そのものを検査することで、
// フィルタ工程が抜けた場合を独立に検知する。
//
// 対象を修斗/パンクラスの2団体に限定している理由: RIZIN/DEEPは
// scripts/update-rizin-records.ts・scripts/build-deep-records.tsの
// スクレイパー内で取得時点からinline除外しており、この2団体は本来
// 本ゲートの対象にする必要がない。加えてRIZIN/DEEPのinline除外は
// 判定対象フィールドを意図的に絞っている(RIZIN: noteRawのみ、
// DEEP: weightClassRaw/eventNameのみ)。修斗/パンクラスと同じ
// headingText等を含むフルhaystackで判定すると、選手名の部分一致で
// 誤検知する(例: RIZIN.40「スダリオ剛 vs. ジュニア・タファ」の
// 対戦相手名「ジュニア・タファ」がnon_mma_kids_shootoの
// キーワード「ジュニア」に部分一致し、実在の対戦が除外対象と
// 誤判定される)。このため本ゲートは実際に巻き戻りバグがある
// 修斗/パンクラスのみを対象にする。
//
// 実行方法: npx tsx scripts/check-nonpro-bout-gate.ts
import fs from "fs";
import path from "path";
import { classifyNonProBout, NonProBoutCategory } from "../src/lib/mnewsRating/nonProBoutFilter";

const ROOT = path.join(__dirname, "..");

const TARGETS = [
  { label: "修斗", file: "shootoRecords.json" },
  { label: "パンクラス", file: "pancraseRecords.json" },
];

interface Violation {
  org: string;
  eventName: string;
  date: string | null;
  category: NonProBoutCategory;
  haystack: string;
}

const violations: Violation[] = [];

for (const target of TARGETS) {
  const filePath = path.join(ROOT, "data", target.file);
  if (!fs.existsSync(filePath)) continue;
  const events: any[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  for (const ev of events) {
    for (const b of ev.bouts || []) {
      const category = classifyNonProBout(b);
      if (category) {
        violations.push({
          org: target.label,
          eventName: ev.eventName,
          date: ev.date ?? null,
          category,
          haystack: [b.headingText, b.strapTitle, b.noteRaw, b.namedDivision]
            .filter(Boolean)
            .join(" / "),
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    `::error::非プロ/非MMA boutが${violations.length}件、除外されずにdata/内に残っています。` +
      `scripts/filter-nonpro-bouts.tsの除外工程が抜けている可能性があります。`
  );
  for (const v of violations) {
    console.error(
      `  - [${v.org}] ${v.date ?? "date不明"} ${v.eventName} / ${v.category} / ${v.haystack.slice(0, 80)}`
    );
  }
  process.exit(1);
}

console.log(`OK: 非プロ/非MMA bout混入 0件(対象: ${TARGETS.map((t) => t.label).join("・")})。`);
