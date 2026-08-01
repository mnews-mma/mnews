// ビルドゲート(2026-08-01、指示書D〜Fの連続修正完了時に追加): DEEP構造化
// データ(data/deepRecords.json)のbout(fighterAName/fighterBName/methodRaw)に、
// 正規表現の境界誤検出に由来する既知の混入パターンが残っていないかを検査
// する。
//
// null-slugゲート(check-null-slug-baseline.ts)と異なりベースライン/比率では
// なくゼロ件を要求する(この種の混入は「一部が既存データより解決しにくい」
// 自然な現象ではなく、抽出ロジックのバグそのものであり、1件でも新規発生
// した時点で異常とみなすべきため)。指示書D〜Fでこのファイルの混入を
// 12件→0件まで解消し、0件を維持できる状態になったため恒久チェックとして
// 追加した(それ以前は「0件にできない残件があるならゲートは作らない」との
// 判断で保留されていた)。
//
// 検出パターン(この session で実際に発見・修正した4種の症状に基づく):
// 1. mark文字(●○〇△◯×⚪⚫)単体が選手名フィールドの値になっている
//    (指示書D: BOUT_RE_F8_NO_HEADING、指示書F: BOUT_RE_F2の同種バグ)
// 2. 「第N試合」のような見出しテキストが決着欄・選手名欄に混入している
//    (指示書C: group1_vsの境界誤検出、指示書Gで発見したF1亜種の構造崩れ)
// 3. DEEP公式サイト側のPHP実行時警告(「Warning」)が決着欄・選手名欄に
//    混入している(指示書F: ページ末尾の境界誤検出)
// 4. methodRawが異常に長い(200文字超、他boutの内容を巻き込んだ連鎖破損の
//    兆候)
//
// 実行: npx tsx scripts/check-deep-contamination-baseline.ts
import fs from "fs";
import path from "path";
import type { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";

const DATA_DIR = path.join(process.cwd(), "data");
function loadJson<T>(file: string): T {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [] as unknown as T;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

const MARK_CHARS = new Set(["●", "○", "〇", "△", "◯", "×", "⚪", "⚫"]);
const METHOD_RAW_MAX_LEN = 200;

interface Issue {
  eventName: string;
  date: string;
  cardPosition: number;
  reason: string;
}

function scan(events: DeepRecordsEvent[]): Issue[] {
  const issues: Issue[] = [];
  for (const ev of events) {
    for (const b of ev.bouts) {
      const push = (reason: string) => issues.push({ eventName: ev.eventName, date: ev.date, cardPosition: b.cardPosition, reason });

      if (MARK_CHARS.has(b.fighterAName.trim())) push(`fighterAName がmark文字単体: "${b.fighterAName}"`);
      if (MARK_CHARS.has(b.fighterBName.trim())) push(`fighterBName がmark文字単体: "${b.fighterBName}"`);

      if (b.fighterAName.includes("試合") || b.fighterAName.includes("Warning")) {
        push(`fighterAName に見出し/Warning混入: "${b.fighterAName}"`);
      }
      if (b.fighterBName.includes("試合") || b.fighterBName.includes("Warning")) {
        push(`fighterBName に見出し/Warning混入: "${b.fighterBName}"`);
      }
      if (b.methodRaw.includes("第") && b.methodRaw.includes("試合")) {
        push(`methodRaw に見出し混入: "${b.methodRaw}"`);
      }
      if (b.methodRaw.includes("Warning")) {
        push(`methodRaw にWarning混入: "${b.methodRaw}"`);
      }
      if (b.methodRaw.length > METHOD_RAW_MAX_LEN) {
        push(`methodRaw が異常に長い(${b.methodRaw.length}文字、他boutを巻き込んだ連鎖破損の疑い)`);
      }
    }
  }
  return issues;
}

function main() {
  const deepEvents = loadJson<DeepRecordsEvent[]>("deepRecords.json");
  const issues = scan(deepEvents);

  if (issues.length > 0) {
    console.error(`[DEEP混入検査] ★${issues.length}件の混入パターンを検出しました。デプロイをブロックします:`);
    for (const i of issues) {
      console.error(`  ${i.eventName}(${i.date}) card#${i.cardPosition}: ${i.reason}`);
    }
    console.error(
      `  対処法: 該当大会の公式ページを直接確認し、原因となっている正規表現(src/lib/mnewsRating/deepScraper.ts)を` +
        `特定してください。個別大会を除外する対処ではなく、汎用的な境界修正を優先してください。`
    );
    process.exit(1);
  }

  console.log(`[DEEP混入検査] OK(混入0件)`);
}

main();
