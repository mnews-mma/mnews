// 指示書R-7/R-7b: 修斗選手プロフィールページ(/fighters/?id=NNN)経由の全件dry-run。
// data/shootoRecords.json・fighters.tsへの書き込みは一切行わない(読み取り専用)。
//
// R-7bでの変更点:
// - 勝敗食い違いは即停止せず、全件リストに積んで最後まで走らせる
//   (既存bout側のnoteRaw=ジャッジスコアを添え、多数決ドロー取りこぼしパターンかを分類する)
// - 新しい停止条件: 食い違いが20件を超えたとき/同一「日付+相手名」の複数マッチ(ambiguous)が
//   出たとき
//
// 実行: npx tsx scripts/investigate-shooto-profile-dryrun.ts
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";
import { assertAllowedByRobots } from "./lib/robotsGate";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";
const DELAY_MS = 1200;
const FETCH_TIMEOUT_MS = 30_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = 3): Promise<string> {
  await assertAllowedByRobots(url, UA);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    process.stderr.write(`[fetch] ${url} (試行${attempt + 1}/${retries + 1})\n`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTPステータス${res.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`[fetch] 取得に失敗しました(${retries + 1}回試行): ${url} (${String(lastError)})`);
}

function normName(s: string | null | undefined): string {
  return (s || "").replace(/[\s　]/g, "");
}

interface ProfileBout {
  section: "SHOOTO" | "VTJ";
  date: string;
  symbol: string; // ○/×/△
  result: "win" | "loss" | "draw" | "unknown";
  opponentNameRaw: string;
  opponentShootoId: string | null;
  methodRaw: string;
  linkedResultId: string | null; // /result/?id= があればその大会id、無ければnull
}

function resultFromSymbol(sym: string): ProfileBout["result"] {
  if (sym === "○") return "win";
  if (sym === "×") return "loss";
  if (sym === "△") return "draw";
  return "unknown";
}

// <h5>SHOOTO戦績</h5><table ...>...</table> のようなセクションを切り出し、
// 各<tr>を1boutとしてパースする。日付セルは大会archiveへのリンクがある
// 場合(post-cutoff)と無い場合(pre-cutoff or 未リンク)の両方に対応する。
const ROW_RE =
  /<tr><td[^>]*>(?:<a href="\/result\/\?id=(\d+)">)?(\d{4}-\d{2}-\d{2})(?:<\/a>)?<\/td><td[^>]*>([○×△])<\/td><td><a href="\/fighters\/\?id=(\d+)">([^<]*)<\/a><p>([^<]*)<\/p><\/tr>/g;

function parseProfilePage(html: string): { totalHeader: { total: number; win: number; lose: number; draw: number } | null; bouts: ProfileBout[] } {
  const bouts: ProfileBout[] = [];

  const headerMatch = html.match(
    /<span class="total_num"><b>(\d+)<\/b>戦<\/span><span class="win_num"><b>(\d+)<\/b>勝<\/span><span class="lose_num"><b>(\d+)<\/b>敗<\/span>/
  );
  const drawMatch = html.match(/<span class="draw_num"><b>(\d+)<\/b>分<\/span>/);
  const totalHeader = headerMatch
    ? {
        total: Number(headerMatch[1]),
        win: Number(headerMatch[2]),
        lose: Number(headerMatch[3]),
        draw: drawMatch ? Number(drawMatch[1]) : 0,
      }
    : null;

  const sectionRe = /<h5>(SHOOTO戦績|VTJ戦績)<\/h5><table[^>]*>([\s\S]*?)<\/table>/g;
  let secM: RegExpExecArray | null;
  while ((secM = sectionRe.exec(html))) {
    const section: "SHOOTO" | "VTJ" = secM[1] === "SHOOTO戦績" ? "SHOOTO" : "VTJ";
    const tableHtml = secM[2];
    let rowM: RegExpExecArray | null;
    ROW_RE.lastIndex = 0;
    while ((rowM = ROW_RE.exec(tableHtml))) {
      const [, resultId, date, symbol, oppId, oppNameRaw, methodRaw] = rowM;
      bouts.push({
        section,
        date,
        symbol,
        result: resultFromSymbol(symbol),
        opponentNameRaw: oppNameRaw.trim(),
        opponentShootoId: oppId,
        methodRaw: methodRaw.trim(),
        linkedResultId: resultId ?? null,
      });
    }
  }
  return { totalHeader, bouts };
}

interface ExistingBout {
  source: "shootoRecords" | "fightersHistory";
  date: string;
  opponentNorm: string;
  opponentRaw: string;
  result: "win" | "loss" | "draw" | "unknown";
  eventName: string | null;
  shootoEventId: number | null;
  noteRaw: string | null;
}

// noteRaw内のジャッジスコア行(例 "太田純一 19-19（1R 10-9／2R 9-10）")を抽出し、
// 「多数決ドロー」(3人中2人以上が同点)のパターンに該当するかを判定する。
// 亮我(2022-08-21 vs 山口峻)で確認済みの実在バグと同種かどうかの分類に使う。
function classifyJudgeScores(noteRaw: string | null): { judgeCount: number; tieCount: number; isMajorityDrawPattern: boolean } {
  if (!noteRaw) return { judgeCount: 0, tieCount: 0, isMajorityDrawPattern: false };
  // ジャッジ名とスコアの間の空白有無("太田純一 19-19（"/"片岡 誠人28-28 （")の両方に
  // 対応する(名前側に空白があってもスコア直前の空白は無いことがある。逆にスコアと
  // 開き括弧の間に空白が入ることもある)。ラウンド別内訳(1R 9-10等)は開き括弧の
  // 「中」にあり直後が"／"か"）"なので、開き括弧直前のNN-NNだけを拾えば混入しない。
  const re = /(\d+)-(\d+)\s*(?:[（(]|$)/g;
  let m: RegExpExecArray | null;
  let judgeCount = 0;
  let tieCount = 0;
  while ((m = re.exec(noteRaw))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    judgeCount++;
    if (a === b) tieCount++;
  }
  // 多数決ドロー: ジャッジの過半数が同点スコアを付けている(3人中2人以上等)。
  const isMajorityDrawPattern = judgeCount >= 2 && tieCount * 2 > judgeCount;
  return { judgeCount, tieCount, isMajorityDrawPattern };
}

const CUTOFF = "2012-12-24";

async function main() {
  const idMatchesPath = path.join(process.cwd(), "out", "r7-id-matches.json");
  const targets: { slug: string; nameJa: string; id: string }[] = JSON.parse(fs.readFileSync(idMatchesPath, "utf8"));

  const recordsPath = path.join(process.cwd(), "data", "shootoRecords.json");
  const shootoRecords: any[] = JSON.parse(fs.readFileSync(recordsPath, "utf8"));

  const fighterBySlug = new Map(FIGHTERS.map((f) => [f.slug, f]));

  // slug -> 既存bout一覧(shootoRecords.json + fighters.ts history)
  function buildExistingIndex(slug: string): ExistingBout[] {
    const out: ExistingBout[] = [];
    for (const ev of shootoRecords) {
      for (const b of ev.bouts) {
        let opponentRaw: string | null = null;
        let mySlug: string | null = null;
        if (b.fighterASlug === slug) {
          mySlug = b.fighterASlug;
          opponentRaw = b.fighterBName;
        } else if (b.fighterBSlug === slug) {
          mySlug = b.fighterBSlug;
          opponentRaw = b.fighterAName;
        }
        if (!mySlug) continue;
        let result: ExistingBout["result"] = "unknown";
        if (b.resultType === "draw") result = "draw";
        else if (b.resultType === "decisive") {
          if (b.winnerSlug === slug) result = "win";
          else if (b.winnerSlug) result = "loss";
          else result = "unknown"; // 勝者未解決
        }
        out.push({
          source: "shootoRecords",
          date: ev.date,
          opponentNorm: normName(opponentRaw),
          opponentRaw: opponentRaw || "",
          result,
          eventName: ev.eventName,
          shootoEventId: ev.shootoEventId,
          noteRaw: b.noteRaw ?? null,
        });
      }
    }
    const fighter = fighterBySlug.get(slug);
    if (fighter && Array.isArray(fighter.history)) {
      for (const h of fighter.history as any[]) {
        out.push({
          source: "fightersHistory",
          date: h.date,
          opponentNorm: normName(h.opponent),
          opponentRaw: h.opponent,
          result: h.result === "nc" ? "unknown" : h.result,
          eventName: h.event ?? null,
          shootoEventId: null,
          noteRaw: null,
        });
      }
    }

    // shootoRecords.json由来とfighters.ts history由来は、同一bout(投入済み選手は
    // 両方に同じ試合が載る)を指すことがある(実例: asahina-ken 2026-01-18)。
    // これは実データの重複ではなくスクリプト側の2ソース単純結合が原因なので、
    // 「日付+相手名」が一致するものは1件に統合してからambiguous判定に回す
    // (noteRaw等の情報量が多いshootoRecords側を正として残す)。
    const dedupMap = new Map<string, ExistingBout>();
    for (const e of out) {
      const key = `${e.date}|${e.opponentNorm}`;
      const existingEntry = dedupMap.get(key);
      if (!existingEntry || (existingEntry.source === "fightersHistory" && e.source === "shootoRecords")) {
        dedupMap.set(key, e);
      }
    }
    return [...dedupMap.values()];
  }

  // shootoEventId -> event(存在確認用)
  const eventIdSet = new Set<number>(shootoRecords.map((e) => e.shootoEventId));

  type Category = "matched" | "new1_precutoff" | "new2a_bout_missing_in_existing_event" | "new2b_event_missing" | "mismatch" | "ambiguous";

interface RowResult {
    slug: string;
    nameJa: string;
    shootoId: string;
    date: string;
    section: string;
    symbol: string;
    result: string;
    opponentRaw: string;
    opponentShootoId: string | null;
    methodRaw: string;
    linkedResultId: string | null;
    category: Category;
    note: string;
    existingNoteRaw: string | null;
    mismatchPattern: "majority_draw_miscount" | "decisive_reversed" | "other" | null;
  }

  const allRows: RowResult[] = [];
  const mismatches: RowResult[] = [];
  const ambiguousRows: RowResult[] = [];
  const unreachable: { slug: string; nameJa: string; id: string; error: string }[] = [];

  let fetchedCount = 0;
  let stopReason: string | null = null;

  outer: for (const t of targets) {
    const url = `https://www.shooto-mma.com/fighters/?id=${t.id}`;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      unreachable.push({ slug: t.slug, nameJa: t.nameJa, id: t.id, error: String(err) });
      await sleep(DELAY_MS);
      continue;
    }
    fetchedCount++;
    await sleep(DELAY_MS);

    const { bouts } = parseProfilePage(html);
    const existing = buildExistingIndex(t.slug);
    // 指示書R-7bの突合キーどおり「日付+相手名(正規化)」の複合キーで引く。
    // 同一日付だが別対戦相手の複数試合(例: efeviga-yushi 2025-01-19の不戦勝+
    // 通常bout2件)を誤ってambiguous扱いしないための複合キー化(date単独キーだと
    // この種の同日複数出場を全て偽陽性のambiguousにしてしまうため)。
    const existingByKey = new Map<string, ExistingBout[]>();
    const existingByDateOnly = new Map<string, ExistingBout[]>();
    for (const e of existing) {
      const key = `${e.date}|${e.opponentNorm}`;
      const arr = existingByKey.get(key) ?? [];
      arr.push(e);
      existingByKey.set(key, arr);
      const dateArr = existingByDateOnly.get(e.date) ?? [];
      dateArr.push(e);
      existingByDateOnly.set(e.date, dateArr);
    }

    for (const b of bouts) {
      const oppNorm = normName(b.opponentNameRaw);
      const candidates = existingByKey.get(`${b.date}|${oppNorm}`) ?? [];
      let category: Category;
      let note = "";
      let existingNoteRaw: string | null = null;
      let mismatchPattern: RowResult["mismatchPattern"] = null;

      if (candidates.length === 0) {
        if (b.date < CUTOFF) {
          category = "new1_precutoff";
        } else if (b.linkedResultId && eventIdSet.has(Number(b.linkedResultId))) {
          category = "new2a_bout_missing_in_existing_event";
          note = `event shootoEventId=${b.linkedResultId} は既存だがbout自体が無い`;
        } else if (b.linkedResultId) {
          category = "new2b_event_missing";
          note = `event shootoEventId=${b.linkedResultId} 自体がshootoRecords.jsonに無い`;
        } else {
          category = "new2b_event_missing";
          note = "post-cutoffだがprofileページに大会リンクなし";
        }
        // 同一日付は既存に別の相手名で存在する(要目視確認の近傍ヒント。ブロックはしない)。
        const sameDateOthers = (existingByDateOnly.get(b.date) ?? []).filter((e) => e.opponentNorm !== oppNorm);
        if (sameDateOthers.length > 0) {
          note += `${note ? " / " : ""}同一日付に別相手名の既存bout有り(要目視確認): ${sameDateOthers.map((e) => e.opponentRaw).join(", ")}`;
        }
      } else if (candidates.length > 1) {
        category = "ambiguous";
        note = `同一「日付+相手名」に既存候補${candidates.length}件`;
      } else {
        const cand = candidates[0];
        category = "matched";
        if (cand.result !== "unknown" && b.result !== "unknown" && cand.result !== b.result) {
          category = "mismatch";
          existingNoteRaw = cand.noteRaw;
          const judge = classifyJudgeScores(cand.noteRaw);
          if (b.result === "draw" && cand.result !== "draw" && judge.isMajorityDrawPattern) {
            mismatchPattern = "majority_draw_miscount";
          } else if (
            (b.result === "win" && cand.result === "loss") ||
            (b.result === "loss" && cand.result === "win")
          ) {
            mismatchPattern = "decisive_reversed";
          } else {
            mismatchPattern = "other";
          }
          note =
            `既存result=${cand.result} vs profile symbol=${b.symbol}(${b.result}) [${cand.source}, event=${cand.eventName ?? "-"}]` +
            ` judge(count=${judge.judgeCount},tie=${judge.tieCount},majorityDraw=${judge.isMajorityDrawPattern})`;
        }
      }

      const row: RowResult = {
        slug: t.slug,
        nameJa: t.nameJa,
        shootoId: t.id,
        date: b.date,
        section: b.section,
        symbol: b.symbol,
        result: b.result,
        opponentRaw: b.opponentNameRaw,
        opponentShootoId: b.opponentShootoId,
        methodRaw: b.methodRaw,
        linkedResultId: b.linkedResultId,
        category,
        note,
        existingNoteRaw,
        mismatchPattern,
      };
      allRows.push(row);
      if (category === "mismatch") mismatches.push(row);
      if (category === "ambiguous") ambiguousRows.push(row);

      if (ambiguousRows.length > 0) {
        stopReason = `同一「日付+相手名」の複数マッチ(ambiguous)を検出: ${t.slug} ${b.date}`;
        console.error(`\n[STOP] ${stopReason}`);
        break outer;
      }
      if (mismatches.length > 20) {
        stopReason = `勝敗食い違いが20件を超過(${mismatches.length}件)`;
        console.error(`\n[STOP] ${stopReason}`);
        break outer;
      }
    }
  }

  // 出力
  const outDir = path.join(process.cwd(), "out");
  const csvPath = path.join(outDir, "r7-shooto-profile-dryrun.csv");
  const csvHeader =
    "slug,nameJa,shootoId,date,section,symbol,result,opponentRaw,opponentShootoId,methodRaw,linkedResultId,category,note,mismatchPattern,existingNoteRaw";
  const csvLines = allRows.map((r) =>
    [
      r.slug,
      r.nameJa,
      r.shootoId,
      r.date,
      r.section,
      r.symbol,
      r.result,
      JSON.stringify(r.opponentRaw),
      r.opponentShootoId ?? "",
      JSON.stringify(r.methodRaw),
      r.linkedResultId ?? "",
      r.category,
      JSON.stringify(r.note),
      r.mismatchPattern ?? "",
      JSON.stringify(r.existingNoteRaw ?? ""),
    ].join(",")
  );
  fs.writeFileSync(csvPath, [csvHeader, ...csvLines].join("\n") + "\n");

  const counts: Record<string, number> = {};
  for (const r of allRows) counts[r.category] = (counts[r.category] ?? 0) + 1;

  const mismatchPatternCounts: Record<string, number> = {};
  for (const m of mismatches) {
    const key = m.mismatchPattern ?? "unknown";
    mismatchPatternCounts[key] = (mismatchPatternCounts[key] ?? 0) + 1;
  }

  const summary = {
    targetsTotal: targets.length,
    fetchedCount,
    unreachableCount: unreachable.length,
    unreachable,
    totalBoutsParsed: allRows.length,
    counts,
    mismatchCount: mismatches.length,
    mismatchPatternCounts,
    mismatchesDetail: mismatches,
    ambiguousCount: ambiguousRows.length,
    ambiguousDetail: ambiguousRows,
    stopReason,
    stoppedEarly: stopReason !== null,
  };
  fs.writeFileSync(path.join(outDir, "r7-shooto-profile-dryrun-summary.json"), JSON.stringify(summary, null, 2) + "\n");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
