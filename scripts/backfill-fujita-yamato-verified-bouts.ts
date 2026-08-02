// 指示書R-4(2026-08-01): 「藤田大和」はscripts/lib/nameCollisionDenylist.ts
// (指示書U、修斗公式ロースター内の同姓同名2プロフィール検出)によりnameJa/alias
// 側の自動name解決(resolveSlug、backfill-shooto-pancrase-slugs.ts等)から
// 恒常的に除外されている。denylist自体は将来の修斗再取得時に別人を誤って
// 束ねる事故を防ぐ安全策のため変更しない(scripts/lib/nameCollisionDenylist.ts
// は不変更)。
//
// 一方、RIZIN/DEEP生データに登場する14件の「藤田大和」(2022-05-08の
// DEEP 107 IMPACTを除く。下記注記参照)は、ja.Wikipedia「藤田大和」記事
// (生年月日1992-08-13・岡山県倉敷市出身・リバーサルジム新宿Me,We所属・
// DEEPフライ級元暫定王者)の経歴と個別に突合し、日付・対戦相手・大会名が
// 一致することを確認済み(下記VERIFIED_BOUTSのコメント参照)。同名の別人
// (denylistの根拠)が実際に紛れているという証跡は無い(shootoRecords.json
// には現時点で「藤田大和」の出現が0件で、denylistの根拠である修斗ロースター
// 内重複は今回の14件と接点が無い)。
//
// このため、denylistを緩めるのではなく、個別に確認済みの14件だけを
// このスクリプトで直接slugを書き込む(力也/rikiyaが同様の経緯で denylist
// 登録後も既存の解決済み分はそのまま残っている前例と同じ考え方)。
//
// 前提条件: fighters.tsに`slug: "fujita-yamato"`(nameJa:"藤田大和")が
// 存在すること(指示書S・PR #338で追加予定、本スクリプト作成時点では未
// マージ)。存在しない場合はDRY_RUNログを出すのみで書き込みを行わない
// (--writeを付けても書き込まれない、安全側に倒す)。
//
// 実行: npx tsx scripts/backfill-fujita-yamato-verified-bouts.ts [--write]
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";

const DATA_DIR = path.join(process.cwd(), "data");
const TARGET_SLUG = "fujita-yamato";
const WRITE = process.argv.includes("--write");

// [file, eventName, date, side("A"|"B"), cardPosition]。日付・大会名・
// 対戦相手・勝敗をja.Wikipedia「藤田大和」記事の経歴(プロデビュー2017-10
// 那須川天心戦・DEEPフライ級暫定王座2021-02-21戴冠 渋谷カズキ戦・2021-09-23
// 防衛 伊藤裕樹戦・2022-05-08統一戦敗退※本スクリプト対象外、下記注記参照)と
// 個別突合済み。RIZIN.9は同日開催の同一トーナメント内に2試合(1回戦・Final)
// あるためcardPositionで一意に指定する。
const VERIFIED_BOUTS: Array<[string, string, string, "A" | "B", number]> = [
  ["rizinRecords.json", "RIZIN.7 RIZIN FIGHTING WORLD GRAND-PRIX 2017 バンタム級トーナメント＆女子スーパーアトム級トーナメント1st ROUND -秋の陣-", "2017-10-15", "B", 2], // vs 那須川天心(プロデビュー戦、記事に一致)
  ["rizinRecords.json", "RIZIN.9 RIZIN FIGHTING WORLD GRAND-PRIX 2017 バンタム級トーナメント＆女子スーパーアトム級トーナメントFinal ROUND", "2017-12-31", "B", 4], // vs 砂辺光久(1回戦、win)。藤田大和自身の同定はこの試合単体で明確(対戦相手側の人物特定は別件・対象外)
  ["rizinRecords.json", "RIZIN.9 RIZIN FIGHTING WORLD GRAND-PRIX 2017 バンタム級トーナメント＆女子スーパーアトム級トーナメントFinal ROUND", "2017-12-31", "B", 10], // vs 那須川天心(Final、キックボクシング。記事のプロデビュー戦系譜と一致)
  ["rizinRecords.json", "湘南美容クリニック presents RIZIN.36", "2022-07-02", "A", 6], // vs 曹竜也(MMA)
  ["deepRecords.json", "DEEP 87 IMPACT", "2018-12-22", "B", 3], // vs 曽我英将
  ["deepRecords.json", "DEEP 88 IMPACT", "2019-03-09", "A", 4], // vs 鮎田直人
  ["deepRecords.json", "DEEP 89 IMPACT", "2019-05-12", "A", 8], // vs 森脇公三
  ["deepRecords.json", "DEEP 91 IMPACT", "2019-09-08", "B", 11], // vs 伊藤裕樹
  ["deepRecords.json", "DEEP 93 IMPACT", "2019-12-15", "A", 10], // vs 松丸息吹
  ["deepRecords.json", "DEEP 94 IMPACT", "2020-03-01", "A", 5], // vs 島袋チカラ
  ["deepRecords.json", "DEEP 97 IMPACT", "2020-09-20", "A", 3], // vs ランボー宏輔
  ["deepRecords.json", "DEEP 100 IMPACT ～20th Anniversary～", "2021-02-21", "A", 13], // DEEPフライ級暫定王者決定戦 vs 渋谷カズキ(記事の戴冠日と一致)
  ["deepRecords.json", "DEEP 102 IMPACT", "2021-07-04", "A", 4], // vs 山本聖悟
  ["deepRecords.json", "DEEP 103 IMPACT ～20th Anniversary～", "2021-09-23", "A", 9], // DEEPフライ級暫定タイトルマッチ vs 伊藤裕樹(記事の防衛日と一致)
];
// 注記: 2022-05-08 DEEP 107 IMPACT(vs 神龍誠、王座統一戦敗退)は記事に記載が
// あるが、data/deepRecords.jsonの当該bout(神龍誠側)はfighterBNameが空文字列
// (スクレイパー側の対戦相手名抽出漏れ)になっており、名前解決ではなく
// パーサー側の別バグ(このPRのスコープ外、名前解決層ではない)。本スクリプト
// の対象に含めない。

interface RawEvent {
  eventName: string;
  date: string | null;
  bouts: Array<{
    cardPosition: number;
    fighterAName: string;
    fighterBName: string;
    fighterASlug: string | null;
    fighterBSlug: string | null;
  }>;
}

function main() {
  const fighterExists = FIGHTERS.some((f) => f.slug === TARGET_SLUG);
  console.log(`対象slug "${TARGET_SLUG}" がfighters.tsに存在するか: ${fighterExists}`);
  if (!fighterExists) {
    console.log("存在しないため、書き込みは行わずDRY_RUNのみ実施します(--writeを付けても書き込まれません)。");
  }

  const fileCache = new Map<string, RawEvent[]>();
  const loadFile = (file: string): RawEvent[] => {
    if (!fileCache.has(file)) {
      fileCache.set(file, JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")));
    }
    return fileCache.get(file)!;
  };

  let matched = 0;
  let alreadyResolved = 0;
  let notFound = 0;

  for (const [file, eventName, date, side, cardPosition] of VERIFIED_BOUTS) {
    const events = loadFile(file);
    const ev = events.find((e) => e.eventName === eventName && e.date === date);
    if (!ev) {
      console.log(`[NOT FOUND] ${file} ${eventName} ${date}`);
      notFound++;
      continue;
    }
    const bout = ev.bouts.find((b) => {
      const name = side === "A" ? b.fighterAName : b.fighterBName;
      return name === "藤田大和" && b.cardPosition === cardPosition;
    });
    if (!bout) {
      console.log(`[NOT FOUND] ${file} ${eventName} ${date} side=${side} cardPosition=${cardPosition}: bout not found`);
      notFound++;
      continue;
    }
    const slugField = side === "A" ? "fighterASlug" : "fighterBSlug";
    const current = (bout as unknown as Record<string, string | null>)[slugField];
    if (current) {
      console.log(`[既に解決済み] ${file} ${eventName} ${date} side=${side}: slug=${current}`);
      alreadyResolved++;
      continue;
    }
    matched++;
    if (fighterExists && WRITE) {
      (bout as unknown as Record<string, string | null>)[slugField] = TARGET_SLUG;
      console.log(`[書き込み] ${file} ${eventName} ${date} side=${side} -> ${TARGET_SLUG}`);
    } else {
      console.log(`[対象(未書き込み)] ${file} ${eventName} ${date} side=${side}`);
    }
  }

  console.log(`\n対象${VERIFIED_BOUTS.length}件中: 未解決で対象一致${matched}件 / 既に解決済み${alreadyResolved}件 / 見つからず${notFound}件`);

  if (fighterExists && WRITE && matched > 0) {
    for (const file of fileCache.keys()) {
      fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(fileCache.get(file), null, 2) + "\n");
    }
    console.log("書き込み完了。");
  }
}

main();
