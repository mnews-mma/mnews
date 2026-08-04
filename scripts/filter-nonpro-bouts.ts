// out/amateur-contamination-audit.md(2026-07-30監査)で確定した除外基準を
// data/shootoRecords.json・data/pancraseRecords.json に適用する。
//
// 除外対象(src/lib/mnewsRating/nonProBoutFilter.ts参照):
//   - non_mma_karate / non_mma_kids_shooto / non_mma_submission_only (MMAではない)
//   - not_pro_amateur / not_pro_tryout (プロ試合ではない)
//   - not_pro_cage_gate (PANCRASE CAGE GATE。Bayside FIGHT限定・37bout・PR #269で追加)
//   - not_pro_pancrase_gate (パンクラスゲート系、表記ゆれ4種・262bout・指示書④で追加。
//     2026-07-30時点は「除外しない」判断だったが2026-08-03に上書き)
// 除外しない(ユーザー確定事項): 新人王決定トーナメント(修斗)・NEO BLOOD!(パンクラス)
//   は団体公式のプロ登竜門トーナメントのため対象外(キーワード自体を定義していない)。
// 保留(今回は変更しない): Bayside FIGHT・地方主催大会は追加調査待ちのため、
//   このスクリプトでは一切除外しない。
//
// 大会(event)自体は削除しない。bouts配列だけを絞り込む(既存データにも
// bouts:0件のイベントが実在しており、その形式を踏襲する)。
//
// 実行方法: npx tsx scripts/filter-nonpro-bouts.ts [--dry-run]
import fs from "fs";
import path from "path";
import { classifyNonProBout, NonProBoutCategory } from "../src/lib/mnewsRating/nonProBoutFilter";
import { ShootoRecordsEvent, ShootoRecordsBout } from "../src/lib/mnewsRating/shootoScraper";
import { PancraseRecordsEvent, PancraseRecordsBout } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { computeFighterPancraseRecord } from "../src/lib/mnewsRating/pancraseRecordsAggregate";

const DRY_RUN = process.argv.includes("--dry-run");

const SHOOTO_PATH = path.join(__dirname, "..", "data", "shootoRecords.json");
const PANCRASE_PATH = path.join(__dirname, "..", "data", "pancraseRecords.json");

const INJECTED_92_SLUGS = [
  "aono-hikaru", "aratadaiki", "asadulloev", "asahina-ken", "aya-murakami",
  "azumi-kento", "baikin-dokuichiro", "body-maxthe", "dinesh-nain", "endoraiki",
  "erika", "fujii-nobuki", "fujino-emi", "gojima-daiki", "hailaiwusamo",
  "hamamoto", "henry", "hirata-ayane", "hoshuyama-momoka", "huang-jenny",
  "iino-yuto", "ishidarikuya", "itokawayoshito", "iwasaki-taiga", "kanayumu",
  "karen", "katayama-tomoe", "kawakita-haruki", "kobayashiryohei", "kurobe-mina",
  "lightyear-daiki", "maedakohei", "masudataiga", "mio-shiyama", "motokawaharuaki",
  "motonomiki", "nada", "nakaike-takehiro", "nakajima-riku", "nakamura-miku",
  "noa-tokumoto", "nojiri-yasuyuki", "okada-arashi", "okadatakuma", "park-bohyun",
  "park-jongjun", "rafaelribeiro", "raika", "ryoa", "saito-tsubasa", "salt",
  "sarami", "satoru", "satoshogo", "satoyujibonsai", "sekisena", "shikijima-kazuma",
  "shiraijoji", "sugimoto-megumi", "sugimoto-seiya", "sugiyama", "susung",
  "suzuki-takeru", "suzukiyuto", "taguchi-keita", "taira", "takada-atsuhi",
  "takamoto-chiyo", "tamura-hibiki", "tanaka-yu", "teraokatakuei", "tomori-kota",
  "tomori-rui", "tou-hoiin", "tyson-nobumitsu", "uehara-taira", "uematsuyoshiki",
  "umeki-yutoku", "unconfirmed-shooto-1849", "unconfirmed-shooto-1875",
  "valenzuela-victor", "wadaayane", "waki-grappler", "watanabe-ayaka",
  "yamakimahiro", "yamasakisora", "yamauchi-wataru", "young-kim", "young-parkseo",
  "yuji-arai", "yuki-daiki", "zhangyuta",
];

interface FilterStats {
  totalBoutsBefore: number;
  totalBoutsAfter: number;
  removedByCategory: Record<NonProBoutCategory, number>;
  eventsBecameEmpty: { date: string | null; eventName: string }[];
}

function filterEvents<E extends { eventName: string; date: string | null; bouts: B[] }, B>(
  events: E[]
): { filtered: E[]; stats: FilterStats } {
  const removedByCategory: Record<NonProBoutCategory, number> = {
    non_mma_karate: 0,
    non_mma_kids_shooto: 0,
    non_mma_submission_only: 0,
    not_pro_amateur: 0,
    not_pro_tryout: 0,
    not_pro_cage_gate: 0,
    not_pro_pancrase_gate: 0,
    // not_pro_futureking(DEEP)はこのスクリプトの対象外(修斗/パンクラスのみ)のため常に0。
    // eventNameキーワード自体を持たないため該当なし(src/lib/mnewsRating/nonProBoutFilter.ts参照)。
    not_pro_futureking: 0,
    not_pro_promotion_tournament: 0,
  };
  let totalBoutsBefore = 0;
  let totalBoutsAfter = 0;
  const eventsBecameEmpty: { date: string | null; eventName: string }[] = [];

  const filtered = events.map((ev) => {
    totalBoutsBefore += ev.bouts.length;
    const hadBouts = ev.bouts.length > 0;
    const keptBouts = ev.bouts.filter((b) => {
      // eventNameはbout側でなくevent側にしか無いフィールドのため明示的に渡す
      // (指示書「ushiku-juntaro 1行目非表示調査」2026-08-05で発覚: 大会名自体が
      // 「パンクラスゲート」等の登録済みキーワードを含む場合でも、この呼び出しに
      // eventNameが渡っていなかったため素通りしていた=パンクラスゲート2009、45bout)。
      const category = classifyNonProBout({ ...(b as any), eventName: ev.eventName });
      if (category) {
        removedByCategory[category]++;
        return false;
      }
      return true;
    });
    totalBoutsAfter += keptBouts.length;
    if (hadBouts && keptBouts.length === 0) {
      eventsBecameEmpty.push({ date: ev.date, eventName: ev.eventName });
    }
    return { ...ev, bouts: keptBouts };
  });

  return {
    filtered,
    stats: { totalBoutsBefore, totalBoutsAfter, removedByCategory, eventsBecameEmpty },
  };
}

function main() {
  const shootoRaw: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(SHOOTO_PATH, "utf-8"));
  const pancraseRaw: PancraseRecordsEvent[] = JSON.parse(fs.readFileSync(PANCRASE_PATH, "utf-8"));

  const { filtered: shootoFiltered, stats: shootoStats } = filterEvents(shootoRaw);
  const { filtered: pancraseFiltered, stats: pancraseStats } = filterEvents(pancraseRaw);

  const lines: string[] = [];
  lines.push("# 非プロ/非MMA bout除外 実行結果");
  lines.push("");
  lines.push("## 除外件数");
  lines.push("");
  lines.push("### 修斗");
  lines.push(`- 全bout数: ${shootoStats.totalBoutsBefore} → ${shootoStats.totalBoutsAfter}(${shootoStats.totalBoutsBefore - shootoStats.totalBoutsAfter}件除外)`);
  for (const [cat, count] of Object.entries(shootoStats.removedByCategory)) {
    if (count > 0) lines.push(`  - ${cat}: ${count}件`);
  }
  lines.push("");
  lines.push("### パンクラス");
  lines.push(`- 全bout数: ${pancraseStats.totalBoutsBefore} → ${pancraseStats.totalBoutsAfter}(${pancraseStats.totalBoutsBefore - pancraseStats.totalBoutsAfter}件除外)`);
  for (const [cat, count] of Object.entries(pancraseStats.removedByCategory)) {
    if (count > 0) lines.push(`  - ${cat}: ${count}件`);
  }
  lines.push("");

  lines.push("## 除外により空(0bout)になった大会");
  const allEmpty = [...shootoStats.eventsBecameEmpty, ...pancraseStats.eventsBecameEmpty];
  if (allEmpty.length === 0) {
    lines.push("なし");
  } else {
    for (const e of allEmpty) lines.push(`- [${e.date}] ${e.eventName}`);
  }
  lines.push("");

  lines.push("## #252投入92名 戦績変化(除外前 → 除外後)");
  lines.push("");
  lines.push("除外前・除外後とも現行 data/shootoRecords.json・data/pancraseRecords.json をslug完全一致で集計した値(fighters.ts記載の投入済み数値とは別。既知の差分はPR #258で別途追跡中)。");
  lines.push("");
  lines.push("| slug | 修斗(前→後) | パンクラス(前→後) | 変化 |");
  lines.push("|---|---|---|---|");

  const zeroedOut: string[] = [];
  for (const slug of INJECTED_92_SLUGS) {
    const shootoBefore = computeFighterShootoRecord(shootoRaw, slug);
    const shootoAfter = computeFighterShootoRecord(shootoFiltered, slug);
    const pancraseBefore = computeFighterPancraseRecord(pancraseRaw, slug);
    const pancraseAfter = computeFighterPancraseRecord(pancraseFiltered, slug);

    const fmt = (r: { wins: number; losses: number; draws: number; ncs: number }) =>
      `${r.wins}-${r.losses}-${r.draws}${r.ncs ? `-${r.ncs}nc` : ""}`;

    const hasShootoBouts = shootoBefore.bouts.length > 0;
    const hasPancraseBouts = pancraseBefore.bouts.length > 0;
    const shootoChanged = shootoBefore.bouts.length !== shootoAfter.bouts.length;
    const pancraseChanged = pancraseBefore.bouts.length !== pancraseAfter.bouts.length;

    if (!shootoChanged && !pancraseChanged) continue; // 変化なしの選手は表に出さない(後で全員分を別途出す)

    const shootoCell = hasShootoBouts ? `${fmt(shootoBefore)} → ${fmt(shootoAfter)}` : "-";
    const pancraseCell = hasPancraseBouts ? `${fmt(pancraseBefore)} → ${fmt(pancraseAfter)}` : "-";

    const totalAfter =
      shootoAfter.wins + shootoAfter.losses + shootoAfter.draws + shootoAfter.ncs +
      pancraseAfter.wins + pancraseAfter.losses + pancraseAfter.draws + pancraseAfter.ncs;
    const totalBefore =
      shootoBefore.wins + shootoBefore.losses + shootoBefore.draws + shootoBefore.ncs +
      pancraseBefore.wins + pancraseBefore.losses + pancraseBefore.draws + pancraseBefore.ncs;

    let mark = "";
    if (totalBefore > 0 && totalAfter === 0) {
      mark = " ⚠0-0-0化";
      zeroedOut.push(slug);
    }
    lines.push(`| \`${slug}\` | ${shootoCell} | ${pancraseCell} | ${shootoChanged || pancraseChanged ? "変化あり" : ""}${mark} |`);
  }
  lines.push("");
  lines.push("(上表は除外の影響で試合数が変わった選手のみ。変化なしの選手は省略)");
  lines.push("");

  lines.push("## 個別ハイライト");
  for (const slug of ["takada-atsuhi", "noa-tokumoto", "nakaike-takehiro"]) {
    const before = computeFighterShootoRecord(shootoRaw, slug);
    const after = computeFighterShootoRecord(shootoFiltered, slug);
    lines.push(`### \`${slug}\``);
    lines.push(`- 除外前: ${before.wins}-${before.losses}-${before.draws}(${before.bouts.length}戦)`);
    lines.push(`- 除外後: ${after.wins}-${after.losses}-${after.draws}(${after.bouts.length}戦)`);
    lines.push(`- 除外された対戦: ${before.bouts.length - after.bouts.length}件`);
    lines.push("");
  }

  lines.push("## 0-0-0化した選手");
  if (zeroedOut.length === 0) {
    lines.push("なし");
  } else {
    lines.push("以下の選手は除外適用後に戦績が0-0-0(該当bout無し)になった。**除外は適用済みだが、この選手達をどう扱うかは人間の判断待ち(投入取り消し等の対応はしていない)。**");
    for (const slug of zeroedOut) lines.push(`- \`${slug}\``);
  }
  lines.push("");

  const report = lines.join("\n");
  console.log(report);

  const reportPath = path.join(__dirname, "..", "out", "nonpro-bout-filter-report.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report + "\n");

  if (!DRY_RUN) {
    fs.writeFileSync(SHOOTO_PATH, JSON.stringify(shootoFiltered, null, 2) + "\n");
    fs.writeFileSync(PANCRASE_PATH, JSON.stringify(pancraseFiltered, null, 2) + "\n");
    console.log(`\n書き込み完了: ${SHOOTO_PATH}`);
    console.log(`書き込み完了: ${PANCRASE_PATH}`);
  } else {
    console.log("\n--dry-run のためファイルへの書き込みはしていません。");
  }
}

main();
