// PR #575: 大会名文字列に埋め込まれた年(西暦4桁)と日付フィールドの年が食い違う行を
// ビルド時にゼロ件で検知するゲート。
//
// 背景: NJKF公式サイトのURL自体に古い年が紛れ込んだページ
// (https://www.njkf.info/result/njkf2012_west_kyoto_result.html。ページ本文の
// 「日時：2021年12月5日」で裏取り済み、実際の開催は2021年)があり、
// scripts/standup-pipeline/ingest_njkf.pyの日付抽出フォールバックがURL側の誤った年(2012)を
// 採用してしまっていた。この1ページだけで6行が影響を受け、うち2行(山川敏弘×鈴木力登、
// エミNFC×AYA)は正しい日付の行が別ソース(RISE公式)にも存在するため、日付が食い違ったまま
// 二重計上されていた(50人検品2周目、#572で発覚)。
//
// scripts/build-kick-data.tsのcorrectEventEmbeddedYearMismatch()が、この検出ロジックと
// 同じ条件(大会名に埋め込まれた年が単一種類・大会名中の「N月N日」がdateの月日と一致)で
// dateの年を自動補正するため、正常に動作していれば以下はゼロ件のはず。このゲートは
// その不変条件をビルド時に多重防御として再検証する(将来この補正ロジックが外れる・
// 新しい種類の年ズレパターンが出た場合に検知する)。
//
// data/kick/generated/ (scripts/build-kick-data.tsが直前に生成) を読む。生データ
// (data/kick/*.json)は一切変更しない。
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");

interface Violation {
  slug: string;
  date: string;
  event: string;
}

const violations: Violation[] = [];
const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));

for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    const date: string | null = b.date;
    const event: string | null = b.event;
    if (!date || !event) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) continue;
    const [, dateYear, dateMonth, dateDay] = m;
    const eventYears = [...event.matchAll(/(?:19|20)\d{2}/g)].map((x) => x[0]);
    if (eventYears.length === 0 || eventYears.includes(dateYear)) continue;
    const uniqueYears = new Set(eventYears);
    if (uniqueYears.size !== 1) continue;
    const md = /(\d{1,2})月(\d{1,2})日/.exec(event);
    if (!md || Number(md[1]) !== Number(dateMonth) || Number(md[2]) !== Number(dateDay)) continue;
    violations.push({ slug: f.slug, date, event });
  }
}

if (violations.length > 0) {
  console.error(
    `[kick-event-date-year-mismatch] ★大会名に埋め込まれた年とdateの年が食い違う行が` +
      `${violations.length}件見つかりました。デプロイをブロックします:\n` +
      violations
        .slice(0, 20)
        .map((v) => `  - ${v.slug}: date="${v.date}" event="${v.event}"`)
        .join("\n"),
  );
  process.exit(1);
}

console.log("[kick-event-date-year-mismatch] OK(大会名埋め込みの年とdateの年の食い違い0件)");
