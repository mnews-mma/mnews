// 調査専用スクリプト(read-only、data/配下は一切書き換えない)。
//
// 背景: RIZIN LANDMARK非該当の2015年IZAの舞(PR #367)で、parseRuleInfo()が
// 「K-1ルール」「SBルール」(シュートボクシングの略記)を非MMAと判定できない
// ギャップが発覚した(手動書き起こしで回避)。本スクリプトは、この種の
// 「ルール表記があるのにMMA戦績として混入する」問題が、RIZIN以外(DEEP・
// パンクラス・修斗)や既存データに他に無いかを横断的に検証する。
//
// data/{rizin,deep,pancrase,shooto}Records.jsonのboutは、ruleLineRaw(ルール原文)
// 自体を保持しておらず、パース済みのruleType(enum)・headingText・namedDivisionの
// みが残る。RIZINはheadingTextに試合順文言("第10試合")しか入らずルール原文が
// 完全に失われるため、既存78大会(RIZIN.1/RIZIN.2の手動書き起こし分を除く)の
// K-1/SBルール混入有無は本スクリプトでは判定できない(別スクリプト
// audit-non-mma-rule-gap-rizin-refetch.tsが公式サイト再取得で確認する)。
// DEEP/パンクラス/修斗はheadingText/namedDivisionに元のルール文言がそのまま
// 残っているため、ここではその2フィールドをキーワード検索する
// (methodRaw/noteRawは決着描写や別選手の所属ジム名に同じ語が偶然含まれる
// 誤検知が実際に発生したため対象外にした)。
import fs from "fs";
import { computeFighterDeepRecord } from "../src/lib/mnewsRating/deepRecordsAggregate";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { computeFighterPancraseRecord } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { computeMultiOrgRecord } from "../src/lib/mnewsRating/multiOrgRecord";

// RIZIN(NON_MMA_RULE_PATTERNS)・パンクラス(NON_MMA_PATTERNS)双方の既存キーワードを
// 合わせ、K-1・SBルール(略記)を追加した合成パターン。
const KEYWORDS =
  /K-?1(?!グ)|SB\s*ルール|キックボクシ|キック(ルール|戦)|Kickboxing|ISKA|シュートボクシング|グラップリング|ベアナックル|スタンディングバウト|エキシビ|エキジビ|MIXルール|チャレンジ\s*ルール|プロレスルール/i;

interface Hit {
  file: string;
  event: string;
  date: string | null;
  cardPosition: number;
  fighterAName: string;
  fighterASlug: string | null;
  fighterBName: string;
  fighterBSlug: string | null;
  ruleType: string;
  matchedField: string;
  matchedText: string;
}

function scanFile(file: string): Hit[] {
  const events = JSON.parse(fs.readFileSync(`data/${file}`, "utf8"));
  const hits: Hit[] = [];
  for (const ev of events) {
    for (const b of ev.bouts) {
      const fields: [string, string][] = [
        ["headingText", b.headingText ?? ""],
        ["namedDivision", b.namedDivision ?? ""],
      ];
      for (const [field, val] of fields) {
        if (KEYWORDS.test(val)) {
          hits.push({
            file,
            event: ev.eventName,
            date: ev.date ?? null,
            cardPosition: b.cardPosition,
            fighterAName: b.fighterAName,
            fighterASlug: b.fighterASlug,
            fighterBName: b.fighterBName,
            fighterBSlug: b.fighterBSlug,
            ruleType: b.ruleType,
            matchedField: field,
            matchedText: val,
          });
          break;
        }
      }
    }
  }
  return hits;
}

function main() {
  const files = ["rizinRecords.json", "pancraseRecords.json", "shootoRecords.json", "deepRecords.json"];
  const allHits: Record<string, Hit[]> = {};
  for (const f of files) allHits[f] = scanFile(f);

  console.log("=== ステップ1: headingText/namedDivisionのキーワード抽出(全件) ===\n");
  for (const f of files) {
    const hits = allHits[f];
    const resolved = hits.filter((h) => h.fighterASlug || h.fighterBSlug);
    console.log(`${f}: 総ヒット${hits.length}件 / うちslug解決済み(選手記録への影響あり得る)${resolved.length}件`);
    for (const h of resolved) {
      console.log(
        `  [${h.event} / ${h.date} / #${h.cardPosition}] ${h.fighterAName}(${h.fighterASlug ?? "-"}) vs ${h.fighterBName}(${h.fighterBSlug ?? "-"}) ruleType=${h.ruleType}`
      );
      console.log(`    ${h.matchedField}: ${h.matchedText}`);
    }
    console.log();
  }

  console.log("=== ステップ2: 実際に選手戦績集計(computeFighter*Record)に算入されているかの実測 ===\n");

  const deepEvents = JSON.parse(fs.readFileSync("data/deepRecords.json", "utf8"));
  const shootoEvents = JSON.parse(fs.readFileSync("data/shootoRecords.json", "utf8"));
  const pancraseEvents = JSON.parse(fs.readFileSync("data/pancraseRecords.json", "utf8"));
  const rizinEvents = JSON.parse(fs.readFileSync("data/rizinRecords.json", "utf8"));

  const deepSlugs = [...new Set(allHits["deepRecords.json"].flatMap((h) => [h.fighterASlug, h.fighterBSlug]).filter((s): s is string => !!s))];
  const shootoSlugs = [...new Set(allHits["shootoRecords.json"].flatMap((h) => [h.fighterASlug, h.fighterBSlug]).filter((s): s is string => !!s))];
  const pancraseSlugs = [...new Set(allHits["pancraseRecords.json"].flatMap((h) => [h.fighterASlug, h.fighterBSlug]).filter((s): s is string => !!s))];

  console.log(`--- DEEP: 対象${deepSlugs.length}名(computeFighterDeepRecordはruleTypeでの絞り込みを一切行わない設計のため、原則そのまま算入される) ---`);
  for (const slug of deepSlugs) {
    const r = computeFighterDeepRecord(deepEvents, slug);
    const multi = computeMultiOrgRecord(slug, { rizinEvents, shootoEvents, pancraseEvents, deepEvents });
    console.log(`  ${slug}: DEEP単体 wins=${r.wins} losses=${r.losses} draws=${r.draws} excluded=${r.excluded.length} / 4団体通算 wins=${multi.wins} losses=${multi.losses} draws=${multi.draws}`);
  }

  console.log(`\n--- 修斗: 対象${shootoSlugs.length}名(computeFighterShootoRecordはruleTypeでの絞り込みを一切行わない設計のため、原則そのまま算入される) ---`);
  for (const slug of shootoSlugs) {
    const r = computeFighterShootoRecord(shootoEvents, slug);
    const multi = computeMultiOrgRecord(slug, { rizinEvents, shootoEvents, pancraseEvents, deepEvents });
    console.log(`  ${slug}: 修斗単体 wins=${r.wins} losses=${r.losses} draws=${r.draws} excluded=${r.excluded.length} / 4団体通算 wins=${multi.wins} losses=${multi.losses} draws=${multi.draws}`);
  }

  console.log(`\n--- パンクラス: 対象${pancraseSlugs.length}名(computeFighterPancraseRecordはMMA_RULE_TYPES=new Set(["MMA"])で絞り込む設計のため、正しくexcluded側に入るはず) ---`);
  for (const slug of pancraseSlugs) {
    const r = computeFighterPancraseRecord(pancraseEvents, slug);
    console.log(`  ${slug}: パンクラス単体 wins=${r.wins} losses=${r.losses} draws=${r.draws} excluded=${r.excluded.length}`);
    for (const e of r.excluded) console.log(`    excluded: ${e.event} vs ${e.opponentName} (${e.reason})`);
  }
}

main();
