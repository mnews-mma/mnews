// DEEP公式サイト(deep2001.com)の「試合結果」アーカイブ全期間(2002年〜)の大会
// 結果を機械取得し、data/deepRecords.json へ書き出すバッチ(生成のみ・ランキング等の
// 本番パイプラインへは一切接続しない)。shooto/パンクラス(PR #255/#256)と同じ手順。
//
// スコープ: DEEP公式 /result/ の全大会。2024年以降69件(F1/Group4/Group2/Group1
// の4フォーマット)に加え、2023年以前221件の全件分類(2026-07-29、ユーザー提供の
// 一次資料。out/deep-format-variants-full-221.md参照)に基づき、F2(method中間型・
// 最大勢力142件)・F8(完全分離型・ジム名なし13件)・F10(VS+mark併記型4件)を追加
// 実装し、F9(Group2の見出し前提緩和・11件)にも対応した。
//
// 除外(個別対戦結果が公式に存在しない・仕様上の限界): F7(トーナメント優勝者
// サマリー型・21件)・F11(結果本文が完全に空・4件)。これらはbout抽出が
// 構造的に不可能なため、抽出0件の大会として検出しレポートに列挙する
// (ハードコードされた大会名リストは持たない。実行時に実際のページ内容から
// 判定する)。
//
// 除外(アマチュア大会、2026-07-29追加、ユーザー指示): 「DEEP JEWELSアマチュア」
// 等、大会名自体がアマチュア大会と名乗るものは選手戦績集計の対象外として
// 大会単位で除外する。判定は大会名(タイトル)に「アマチュア」を含むかの単純な
// 文字列一致のみで行う(あいまいな判定はしない)。除外大会名は全件レポートに
// 列挙する。
//
// 除外(bout単位の非プロ/非MMA混入、2026-07-30追加): 大会名自体はプロ大会でも、
// カード内の一部bout(主にオープニングファイト)に成人アマチュア戦・キッズ/
// ジュニア戦・トライアウト戦・寝試合(提出限定ルール)等が混入することがある
// (out/amateur-contamination-audit.md参照。修斗/パンクラスで確認済みの混入
// パターンと同型で、DEEP側でも実例を確認済み: 例 DEEP TOKYO IMPACT 2019の
// 「アマチュアグラップリングBルール」「アマチュアSPルール」等のundercard)。
// この判定はPR #265(修斗/パンクラスのアマチュア混入監査)が抽出した共有
// 判定器 scripts/lib/nonProBoutFilter.ts をそのまま流用する(新規キーワード
// 一覧は作らない)。判定対象はheadingText/namedDivisionのみ(DEEPの生データ
// スキーマにはstrapTitle/noteRaw相当のフィールドが無いため)。
//
// 実行: npx tsx scripts/build-deep-records.ts
import fs from "fs";
import path from "path";
import { toJstDateStr } from "../src/lib/eventCountdown";
import { isExcludedNonProBout } from "./lib/nonProBoutFilter";
import {
  extractArchiveLinks,
  detectPagination,
  isKickEvent,
  isAmateurEvent,
  extractEventDate,
  stripTags,
  extractDeepBouts,
  resolveOutcome,
  DeepRecordsBout,
  DeepRecordsEvent,
} from "../src/lib/mnewsRating/deepScraper";
import { findFighterSlugByName } from "../src/lib/fighters";

const OUT = path.join(process.cwd(), "data", "deepRecords.json");
const REPORT_OUT = path.join(process.cwd(), "out", "deep-records-data-ingest-report.md");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const ARCHIVE_URL = "https://www.deep2001.com/result/";

// F7(優勝者サマリーのみ)の簡易判定: 個別bout結果が1件も抽出できず、かつ
// 本文に「優勝者」の語がある場合。あくまで報告用の推定理由であり、これに
// よってbout抽出ロジックの挙動が変わることはない(除外は「抽出0件」という
// 事実のみで決まる)。
function guessExclusionReason(bodyClean: string): string {
  if (bodyClean.includes("優勝者")) {
    return "F7相当(階級別優勝者名のみで個別対戦結果が本文に存在しない)";
  }
  return "F11相当(本文に個別結果が見つからない。想定済みフォーマット7種のいずれにも一致しなかった)";
}

// 停止条件(ユーザー指示、2026-07-29): 抽出0件の大会が、既知の除外見込み25件
// (F7:21件+F11:4件)を除いて30件を超えた場合、想定外の抽出失敗が多すぎると
// 判断してdata/deepRecords.jsonへの書き込みを行わずに停止する。
const KNOWN_EXCLUSION_COUNT = 25;
const STOP_EXTRA_ZERO_BOUT_THRESHOLD = 30;

// アーカイブ総リンク数の安全弁(PR #231調査時点で287〜308件)。超過は警告のみ
// (実データを黙って切り捨てる意図の上限ではない)。
const CANDIDATE_SAFETY_WARN = 500;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return await res.text();
    } catch {
      /* fall through to retry */
    }
    if (attempt < retries) await sleep(1500);
  }
  return null;
}

interface EventDiag {
  eventName: string;
  date: string;
  boutCount: number;
  formatsUsed: string[];
  parseFailures: number;
  unresolvedNames: number;
  unknownResults: number;
  nonProBoutCount: number;
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  const fetchedDate = toJstDateStr();

  console.log(`DEEP公式 /result/ アーカイブを取得中...`);
  const archiveHtml = await fetchHtml(ARCHIVE_URL);
  if (!archiveHtml) {
    console.error(`[FATAL] /result/ アーカイブの取得に失敗しました。`);
    process.exitCode = 1;
    return;
  }

  const paginationLinks = detectPagination(archiveHtml);
  if (paginationLinks.length > 0) {
    console.error(`[STOP] /result/ にページネーションリンクを検出した(${paginationLinks.length}件)。新しいアーカイブ辿り方の実装が必要と判断し、処理を打ち切ります。`);
    process.exitCode = 1;
    return;
  }

  const allLinks = extractArchiveLinks(archiveHtml);
  console.log(`アーカイブから${allLinks.length}件のリンクを検出。`);
  if (allLinks.length > CANDIDATE_SAFETY_WARN) {
    console.warn(`[WARN] リンク数が安全弁(${CANDIDATE_SAFETY_WARN})を超過。想定外の増加(処理は継続する)。`);
  }

  const events: DeepRecordsEvent[] = [];
  const diags: EventDiag[] = [];
  const excludedZeroBout: { eventName: string; date: string; url: string; reason: string }[] = [];
  const excludedKick: string[] = [];
  const excludedAmateur: string[] = [];
  const excludedFutureUnheld: string[] = [];
  const excludedDateUnknown: { eventName: string; url: string }[] = [];
  let candidateCount = 0;

  for (const link of allLinks) {
    if (isKickEvent(link.title)) {
      excludedKick.push(link.title);
      continue;
    }
    if (isAmateurEvent(link.title)) {
      excludedAmateur.push(link.title);
      continue;
    }

    await sleep(1200);
    const html = await fetchHtml(link.url);
    if (!html) {
      console.warn(`[WARN] fetch失敗: ${link.title} (${link.url})`);
      continue;
    }

    const clean = stripTags(html);
    const date = extractEventDate(clean);
    if (!date) {
      excludedDateUnknown.push({ eventName: link.title, url: link.url });
      continue;
    }
    // 未開催(告知のみ・結果データが存在しない)大会は除外する。fetchedDateより
    // 先の日付は「開催予定」であって「結果」ではないため、0boutのまま投入しない。
    if (date > fetchedDate) {
      excludedFutureUnheld.push(link.title);
      continue;
    }

    candidateCount++;

    const { bouts: rawBouts, formatsUsed } = extractDeepBouts(clean);

    if (rawBouts.length === 0) {
      excludedZeroBout.push({ eventName: link.title, date, url: link.url, reason: guessExclusionReason(clean) });
      continue;
    }

    // F1(第N試合見出し)採用ページに限り、見出し数(=本来あるはずのbout数)と
    // 実際に抽出できたbout数の差分をparseFailuresとして検出する(修斗/パンクラス
    // と同じ「黙って欠落させない」方針)。Group1/Group2/Group4/F2/F8/F10は
    // 見出しに通し番号を持たない/連番が前提でないためこの検出は行わない
    // (該当形式では実施しない=検出できないという限界を持つ。unknownResultsとは
    // 別軸の指標)。非プロ/非MMA bout除外(下記)より前に計算する: 除外は
    // 「正しく抽出できた上での内容フィルタ」であり、抽出失敗とは別軸のため。
    let parseFailures = 0;
    if (formatsUsed[0] === "F1") {
      const headingNumbers = new Set([...clean.matchAll(/第\s*(\d+)試合/g)].map((m) => Number(m[1])));
      parseFailures = Math.max(0, headingNumbers.size - rawBouts.length);
    }

    // bout単位の非プロ/非MMA混入除外(PR #265の共有判定器、ファイル冒頭コメント参照)。
    // DEEPフューチャーキングトーナメントはキーワードが大会名にしか現れないため
    // eventName(link.title)も判定器に渡す(nonProBoutFilter.ts冒頭コメント参照)。
    const excludedNonProCount = rawBouts.length;
    const proRawBouts = rawBouts.filter(
      (raw) =>
        !isExcludedNonProBout({
          headingText: raw.weightClassRaw,
          namedDivision: raw.weightClassRaw,
          eventName: link.title,
        })
    );
    const nonProBoutCount = excludedNonProCount - proRawBouts.length;

    if (proRawBouts.length === 0) {
      excludedZeroBout.push({
        eventName: link.title,
        date,
        url: link.url,
        reason: `全bout(${rawBouts.length}件)が非プロ/非MMA混入判定(アマチュア・キッズ・トライアウト・寝試合等)により除外`,
      });
      continue;
    }

    let unresolvedNames = 0;
    let unknownResults = 0;
    const bouts: DeepRecordsBout[] = proRawBouts.map((raw, idx) => {
      const outcome = resolveOutcome(raw);
      if (outcome.resultType === "unknown") unknownResults++;
      const fighterASlug = findFighterSlugByName(raw.fighterAName);
      const fighterBSlug = findFighterSlugByName(raw.fighterBName);
      if (!fighterASlug) unresolvedNames++;
      if (!fighterBSlug) unresolvedNames++;
      const winnerName = outcome.winner === "A" ? raw.fighterAName : outcome.winner === "B" ? raw.fighterBName : null;
      const winnerSlug = outcome.winner === "A" ? fighterASlug : outcome.winner === "B" ? fighterBSlug : null;

      return {
        cardPosition: proRawBouts.length - idx,
        isOpeningFight: idx === proRawBouts.length - 1,
        headingText: raw.weightClassRaw ?? "",
        fighterAName: raw.fighterAName,
        fighterBName: raw.fighterBName,
        fighterASlug,
        fighterBSlug,
        ruleType: "unknown", // DEEPページに明示のルール種別表記が無いため捏造しない
        weightKg: null,
        namedDivision: raw.weightClassRaw,
        resultType: outcome.resultType,
        winnerName,
        winnerSlug,
        round: null, // methodRawに含まれるためround/time単独では切り出さない(捏造しない)
        time: null,
        methodRaw: raw.methodRaw,
        isWeighInMiss: false,
        format: raw.format,
        boutNumber: raw.boutNumber,
      };
    });

    events.push({
      eventName: link.title,
      date,
      sourceUrl: link.url,
      fetchedDate,
      bouts,
      parseFailures,
      venue: null,
    });

    diags.push({
      eventName: link.title,
      date,
      boutCount: bouts.length,
      formatsUsed,
      parseFailures,
      unresolvedNames,
      unknownResults,
      nonProBoutCount,
    });
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const totalBouts = events.reduce((sum, e) => sum + e.bouts.length, 0);
  const totalUnknown = diags.reduce((sum, d) => sum + d.unknownResults, 0);
  const totalUnresolved = diags.reduce((sum, d) => sum + d.unresolvedNames, 0);
  const totalParseFailures = diags.reduce((sum, d) => sum + d.parseFailures, 0);
  const totalNonProBouts = diags.reduce((sum, d) => sum + d.nonProBoutCount, 0);

  console.log(`\n=== 集計結果 ===`);
  console.log(`候補大会数(開催済・KICK/アマチュア除く): ${candidateCount}`);
  console.log(`除外(KICK): ${excludedKick.length}`);
  console.log(`除外(アマチュア大会): ${excludedAmateur.length}`);
  console.log(`除外(未開催・結果データ無し): ${excludedFutureUnheld.length}`);
  console.log(`除外(開催日不明): ${excludedDateUnknown.length}`);
  console.log(`除外(抽出0件・F7/F11相当): ${excludedZeroBout.length}`);
  console.log(`投入大会数: ${events.length}`);
  console.log(`bout数: ${totalBouts}`);
  console.log(`除外(bout単位の非プロ/非MMA混入): ${totalNonProBouts}件`);
  console.log(`parseFailures(F1見出し数との差分): ${totalParseFailures}`);
  console.log(`resultType=unknown: ${totalUnknown}`);
  console.log(`選手名未解決: ${totalUnresolved}`);

  const extraZeroBout = excludedZeroBout.length - KNOWN_EXCLUSION_COUNT;
  if (extraZeroBout > STOP_EXTRA_ZERO_BOUT_THRESHOLD) {
    console.error(
      `\n[STOP] 停止条件に該当しました: 抽出0件の大会=${excludedZeroBout.length}件` +
        `(既知の除外見込み${KNOWN_EXCLUSION_COUNT}件を差し引くと${extraZeroBout}件、` +
        `許容上限${STOP_EXTRA_ZERO_BOUT_THRESHOLD}件を超過)。` +
        `data/deepRecords.jsonへの書き込みを行わずに終了します。`
    );
    fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
    const stopLines = [
      `# deep-records-data-ingest: 停止`,
      ``,
      `抽出0件の大会が${excludedZeroBout.length}件(既知の除外見込み${KNOWN_EXCLUSION_COUNT}件を差し引くと${extraZeroBout}件)で、` +
        `許容上限${STOP_EXTRA_ZERO_BOUT_THRESHOLD}件を超過したため停止しました。`,
      ``,
      `## 抽出0件の大会一覧`,
      ...excludedZeroBout.map((e) => `- ${e.eventName}(${e.date}): ${e.url} — ${e.reason}`),
    ];
    fs.writeFileSync(path.join(path.dirname(REPORT_OUT), "deep-records-data-build-stop.md"), stopLines.join("\n") + "\n");
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(OUT, JSON.stringify(events, null, 2) + "\n");
  console.log(`\n[OK] ${OUT} に書き出しました。`);

  const reportLines: string[] = [];
  reportLines.push(`# deep-records-data-ingest-report`);
  reportLines.push(``);
  reportLines.push(`生成日時(JST): ${fetchedDate}`);
  reportLines.push(``);
  reportLines.push(`- アーカイブ総リンク数: ${allLinks.length}`);
  reportLines.push(`- 候補大会数(開催済・KICK/アマチュア除く): ${candidateCount}`);
  reportLines.push(`- 投入大会数: ${events.length}`);
  reportLines.push(`- bout数: ${totalBouts}`);
  reportLines.push(`- parseFailures(F1見出し数との差分。第N試合見出しはあるが抽出できなかった件数): ${totalParseFailures}件`);
  reportLines.push(`- resultType=unknown: ${totalUnknown}件`);
  reportLines.push(`- 選手名未解決(fighterASlug/fighterBSlug null): ${totalUnresolved}件`);
  reportLines.push(`- 除外(bout単位の非プロ/非MMA混入。PR #265の共有判定器を流用): ${totalNonProBouts}件`);
  reportLines.push(`- 除外(アマチュア大会): ${excludedAmateur.length}件`);
  reportLines.push(`- 除外(抽出0件・F7/F11相当): ${excludedZeroBout.length}件`);
  reportLines.push(`- 除外(開催日不明): ${excludedDateUnknown.length}件`);
  reportLines.push(``);
  reportLines.push(`## 除外(アマチュア大会。大会名に「アマチュア」を含むもの)`);
  for (const title of excludedAmateur) {
    reportLines.push(`- ${title}`);
  }
  reportLines.push(``);
  reportLines.push(`## 除外(抽出0件・個別結果データ無し)`);
  reportLines.push(`| 大会名 | 日付 | URL | 推定理由 |`);
  reportLines.push(`|---|---|---|---|`);
  for (const e of excludedZeroBout) {
    reportLines.push(`| ${e.eventName} | ${e.date} | ${e.url} | ${e.reason} |`);
  }
  reportLines.push(``);
  if (excludedDateUnknown.length > 0) {
    reportLines.push(`## 除外(開催日不明)`);
    for (const e of excludedDateUnknown) {
      reportLines.push(`- ${e.eventName}: ${e.url}`);
    }
    reportLines.push(``);
  }
  reportLines.push(`## 大会別内訳`);
  reportLines.push(`| 大会名 | 日付 | bout数 | フォーマット | parseFailures | unknown | 未解決名 | 非プロ除外bout |`);
  reportLines.push(`|---|---|---|---|---|---|---|---|`);
  for (const d of diags) {
    reportLines.push(`| ${d.eventName} | ${d.date} | ${d.boutCount} | ${d.formatsUsed.join(",")} | ${d.parseFailures} | ${d.unknownResults} | ${d.unresolvedNames} | ${d.nonProBoutCount} |`);
  }
  fs.writeFileSync(REPORT_OUT, reportLines.join("\n") + "\n");
  console.log(`[OK] ${REPORT_OUT} に書き出しました。`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
