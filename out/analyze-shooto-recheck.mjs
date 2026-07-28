// PR #252 (feat/roster-injection-94) の修斗関連投入値を、data/shootoRecords.json
// (修斗公式サイトからの悉皆再スクレイピング・正データ)から再集計した値と突き合わせる
// 読み取り専用の検証スクリプト。src/・data/は変更しない。出力はJSONのみ(レポートは別途生成)。
import fs from "node:fs";

const DIFF_PATH = "out/reference-fighters-pr252.diff";
const RECORDS_PATH = "data/shootoRecords.json";
const OUT_JSON = "out/analyze-shooto-recheck.result.json";

function normalize(s) {
  if (s == null) return "";
  return String(s).replace(/[\s　 ]/g, "");
}

function normalizeLoose(s) {
  // round/event 文字列比較用: 空白除去のみ。
  return normalize(s);
}

function normalizeMethodContent(s) {
  // method文字列の内容比較用。
  // 実データ確認の結果、data/shootoRecords.json の methodRaw は "TKO レフェリーストップ" のように
  // カテゴリコードと詳細を半角スペースで区切るが、PR#252側の history.method は
  // "TKO/レフェリーストップ" のようにスラッシュ区切りで格納されている(先頭の区切り文字のみ表記が
  // 異なり、以降の区切り(2つ目以降の"/")は両者とも"/"のまま)。これは表記規約の違いであり内容の相違
  // ではないため、内容比較では空白とスラッシュの両方を区切り文字ノイズとして除去して比較する。
  return normalize(s).replace(/\//g, "");
}

// --- 1. diffから追加92名ブロックを抽出してJSオブジェクト配列として復元 ---
function extractPr252Entries() {
  const diff = fs.readFileSync(DIFF_PATH, "utf8");
  const lines = diff.split("\n");
  let inHunk2 = false;
  const added = [];
  for (const line of lines) {
    if (line.startsWith("@@ -1425")) {
      inHunk2 = true;
      continue;
    }
    if (inHunk2 && line.startsWith("@@")) inHunk2 = false;
    if (!inHunk2) continue;
    if (line.startsWith("+")) added.push(line.slice(1));
  }
  const src = "[" + added.join("\n") + "]";
  const arr = new Function("return " + src)();
  return arr;
}

// --- 2. shootoRecords.json をフラットな bout リストに展開 ---
function flattenRecords() {
  const events = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const bouts = [];
  for (const ev of events) {
    for (const b of ev.bouts || []) {
      bouts.push({
        eventName: ev.eventName,
        date: ev.date,
        sourceUrl: ev.sourceUrl,
        fighterAName: b.fighterAName,
        fighterBName: b.fighterBName,
        fighterANorm: normalize(b.fighterAName),
        fighterBNorm: normalize(b.fighterBName),
        resultType: b.resultType,
        winnerName: b.winnerName,
        winnerNorm: normalize(b.winnerName),
        round: b.round,
        time: b.time,
        methodRaw: b.methodRaw,
      });
    }
  }
  return bouts;
}

function formatRound(b) {
  // shootoRecords: round="1R" style, time="04:55" 別フィールド
  // fighters.ts (PR252側) history.round: "R1 04:55" 形式に合わせて変換して比較する
  if (!b.round && !b.time) return "";
  let base = "";
  if (b.round) {
    const num = String(b.round).replace(/[^0-9]/g, "");
    base = num ? `R${num}` : String(b.round);
  }
  if (b.time) return base ? `${base} ${b.time}` : b.time;
  return base;
}

function outcomeFor(bout, selfNorm) {
  if (bout.resultType === "decisive") {
    if (!bout.winnerNorm) return "ambiguous(decisive-no-winner)";
    return bout.winnerNorm === selfNorm ? "win" : "loss";
  }
  if (bout.resultType === "draw") return "draw";
  if (bout.resultType === "nc") return "nc";
  return `ambiguous(${bout.resultType})`;
}

function main() {
  const pr252All = extractPr252Entries();
  const shootoRelated = pr252All.filter(
    (f) => f.org === "shooto" || (f.orgs && f.orgs.includes("shooto"))
  );
  const bouts = flattenRecords();

  const results = [];

  for (const f of shootoRelated) {
    const selfNorm = normalize(f.nameJa);
    const isMultiOrg = !!(f.orgs && f.orgs.length > 1); // KAREN/SARAMI
    const allBoutsForSelf = bouts.filter(
      (b) => b.fighterANorm === selfNorm || b.fighterBNorm === selfNorm
    );

    const historyDiffs = []; // history要素ごとの差分
    const notFoundInRecords = []; // 投入データにあるが再集計データに無い
    const matchedBoutKeys = new Set(); // 再集計側でhistoryと紐付いたboutを記録(逆方向チェック用)

    for (const h of f.history) {
      const oppNorm = normalize(h.opponent);
      const candidates = allBoutsForSelf.filter(
        (b) =>
          b.date === h.date &&
          (b.fighterANorm === oppNorm || b.fighterBNorm === oppNorm)
      );
      if (candidates.length === 0) {
        notFoundInRecords.push({
          date: h.date,
          opponent: h.opponent,
          result: h.result,
          method: h.method,
          event: h.event,
        });
        continue;
      }
      const bout = candidates[0]; // 複数マッチは基本想定しないが多重マッチはambiguousNoteで記録
      const boutKey = `${bout.date}|${bout.eventName}|${bout.fighterANorm}|${bout.fighterBNorm}`;
      matchedBoutKeys.add(boutKey);

      const actualResult = outcomeFor(bout, selfNorm);
      const actualMethod = bout.methodRaw || "";
      const actualRound = formatRound(bout);
      const actualEvent = bout.eventName || "";

      const diffs = [];
      const formatOnlyDiffs = [];
      if (actualResult !== h.result) {
        diffs.push({
          field: "result",
          from: h.result,
          to: actualResult,
        });
      }
      if (normalizeMethodContent(h.method) !== normalizeMethodContent(actualMethod)) {
        diffs.push({
          field: "method",
          from: h.method,
          to: actualMethod,
        });
      } else if (normalizeLoose(h.method) !== normalizeLoose(actualMethod)) {
        // 区切り文字(スラッシュ⇔半角スペース)のみが異なる表記ゆれ。内容差ではないため
        // diffs(実質的な差分)には含めず、formatOnlyDiffsとして別記録する。
        formatOnlyDiffs.push({
          field: "method",
          from: h.method,
          to: actualMethod,
        });
      }
      if (normalizeLoose(h.round) !== normalizeLoose(actualRound)) {
        diffs.push({
          field: "round",
          from: h.round,
          to: actualRound,
        });
      }
      if (normalizeLoose(h.event) !== normalizeLoose(actualEvent)) {
        diffs.push({
          field: "event",
          from: h.event,
          to: actualEvent,
        });
      }

      if (diffs.length > 0 || formatOnlyDiffs.length > 0) {
        historyDiffs.push({
          date: h.date,
          opponent: h.opponent,
          multiMatch: candidates.length > 1,
          diffs,
          formatOnlyDiffs,
          injected: {
            result: h.result,
            method: h.method,
            round: h.round,
            event: h.event,
          },
          recomputed: {
            result: actualResult,
            method: actualMethod,
            round: actualRound,
            event: actualEvent,
          },
        });
      }
    }

    // 逆方向チェック: shootoRecords側にあるが、historyに対応要素が無いbout
    // (KAREN/SARAMIは複数団体混在のため対象外)
    const missingFromInjected = [];
    if (!isMultiOrg) {
      for (const b of allBoutsForSelf) {
        const oppNorm = b.fighterANorm === selfNorm ? b.fighterBNorm : b.fighterANorm;
        const oppNameRaw = b.fighterANorm === selfNorm ? b.fighterBName : b.fighterAName;
        const foundInHistory = f.history.some(
          (h) => h.date === b.date && normalize(h.opponent) === oppNorm
        );
        if (!foundInHistory) {
          missingFromInjected.push({
            date: b.date,
            opponent: oppNameRaw,
            resultType: b.resultType,
            winnerName: b.winnerName,
            method: b.methodRaw,
            event: b.eventName,
            outcome: outcomeFor(b, selfNorm),
          });
        }
      }
    }

    // 集計値比較(KAREN/SARAMIはスキップ)
    let aggregate = null;
    if (!isMultiOrg) {
      let wins = 0,
        losses = 0,
        draws = 0,
        ncs = 0,
        ambiguous = 0;
      for (const b of allBoutsForSelf) {
        const o = outcomeFor(b, selfNorm);
        if (o === "win") wins++;
        else if (o === "loss") losses++;
        else if (o === "draw") draws++;
        else if (o === "nc") ncs++;
        else ambiguous++;
      }
      aggregate = {
        recomputed: { wins, losses, draws, ncs, ambiguous },
        injected: { wins: f.wins, losses: f.losses, draws: f.draws },
        matches:
          wins === f.wins && losses === f.losses && draws === f.draws,
      };
    }

    results.push({
      slug: f.slug,
      nameJa: f.nameJa,
      org: f.org,
      orgs: f.orgs || null,
      isMultiOrg,
      injectedTotals: { wins: f.wins, losses: f.losses, draws: f.draws },
      historyLength: f.history.length,
      totalBoutsFoundByName: allBoutsForSelf.length,
      historyDiffs,
      notFoundInRecords,
      missingFromInjected,
      aggregate,
    });
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  // サマリー標準出力
  // historyDiffsのうち diffs(実質差分)が空でformatOnlyDiffsのみのものは「差分あり」に数えない
  const meaningfulHistoryDiffs = (r) => r.historyDiffs.filter((d) => d.diffs.length > 0);
  const diffCountFor = (r) =>
    meaningfulHistoryDiffs(r).length + r.notFoundInRecords.length + r.missingFromInjected.length +
    (r.aggregate && !r.aggregate.matches ? 1 : 0);
  const withDiffs = results.filter((r) => diffCountFor(r) > 0);
  console.log("対象選手数(修斗関連):", results.length);
  console.log("差分ありの選手数(実質差分ベース):", withDiffs.length);
  console.log(
    "内訳合計 - historyDiffs(実質):",
    results.reduce((a, r) => a + meaningfulHistoryDiffs(r).length, 0),
    "formatOnlyのみのbout件数(区切り文字ノイズ):",
    results.reduce((a, r) => a + r.historyDiffs.filter((d) => d.diffs.length === 0).length, 0),
    "notFoundInRecords:",
    results.reduce((a, r) => a + r.notFoundInRecords.length, 0),
    "missingFromInjected:",
    results.reduce((a, r) => a + r.missingFromInjected.length, 0),
    "aggregateMismatch:",
    results.filter((r) => r.aggregate && !r.aggregate.matches).length
  );
}

main();
