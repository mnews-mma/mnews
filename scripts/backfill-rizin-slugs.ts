// data/rizinRecords.json の fighterASlug/fighterBSlug を埋め直すバックフィル。
//
// 背景: rizinRecords.jsonは生成時点(update-rizin-records.ts実行時)のfighters.ts
// でslug解決している。その後fighters.tsに選手が追加されても、既存のRIZIN戦の
// bout側slugは再解決されずnullのまま残る。修斗・パンクラス・DEEPには
// backfill-shooto-pancrase-slugs.tsによる再解決が既に走っているが、RIZINには
// 同種の再解決が一度も実行されていなかった(2026-07-31、fighterRecords不整合調査で発見。
// 実例: rizinRecords.jsonのfetchedDateが2026-07-18の時点でfighters.tsに無かった
// 選手のRIZIN戦が未解決のまま残っていた。hamamotoのRIZIN.9/RIZIN.42が該当)。
//
// 正規化・近似照合ロジックはscripts/lib/fighterNameBackfill.tsを共用する
// (backfill-shooto-pancrase-slugsと同一ルール。新しい正規化はここでは作らない)。
//
// 挙動:
// - fighterASlug/fighterBSlugがnullのものだけを解決する。既に非nullの値は
//   一切上書きしない(このスクリプトは書き込み前に必ずnullチェックする)。
// - 生の選手名表記(fighterAName/fighterBName)・その他フィールドは変更しない。
// - 曖昧一致(複数選手が同一正規化名)は解決しない(推測で埋めない)。
// - winnerSlugがnullで、winnerNameが指すコーナーのslugが(このスクリプトの
//   実行前後を問わず)解決済みの場合、その値をwinnerSlugに埋める(2026-07-31追加。
//   #292調査で発見: rizinRecordsAggregate.tsの勝敗判定はwinnerSlug===slugで
//   行うため、fighterASlug/fighterBSlugだけ埋めてwinnerSlugを再計算しないと、
//   本来の勝者が「勝ちの解決slugがwinnerSlugと一致しない」ため敗扱いになり、
//   同一boutの両者が「敗」と表示される。winnerSlugが既に非nullの値は上書きしない)。
//
// 実行: npx tsx scripts/backfill-rizin-slugs.ts
import fs from "fs";
import path from "path";
import { buildNameIndex, resolveSlug, buildCandidateList, findNearMisses } from "./lib/fighterNameBackfill";
import { computeMultiOrgRecord } from "../src/lib/mnewsRating/multiOrgRecord";
import type { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_DIR = path.join(process.cwd(), "out");
const TARGET_FILE = "rizinRecords.json";

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
}

interface AffectedBout {
  event: string;
  date: string | null;
  cardPosition: number;
  corner: "A" | "B";
  rawName: string;
  resolvedSlug: string;
}

function main() {
  const index = buildNameIndex();
  const candidates = buildCandidateList();

  // 影響評価用に、書き換え前のRIZINイベント配列をディープコピーで保持する
  // (書き換え後のオブジェクトと同一参照だと「変更前」が失われるため)。
  const rizinEventsBefore = loadJson<RizinRecordsEvent[]>(TARGET_FILE);
  const rizinEventsAfter: RizinRecordsEvent[] = JSON.parse(JSON.stringify(rizinEventsBefore));

  const shootoEvents = loadJson<ShootoRecordsEvent[]>("shootoRecords.json");
  const pancraseEvents = loadJson<PancraseRecordsEvent[]>("pancraseRecords.json");
  const deepEvents = loadJson<DeepRecordsEvent[]>("deepRecords.json");

  let totalBoutSlots = 0;
  let alreadyResolved = 0;
  let newlyResolved = 0;
  const unresolved = new Map<string, number>();
  const affectedBouts: AffectedBout[] = [];
  const affectedSlugs = new Set<string>();
  // 既存の解決済みslugが変わっていないことの自己検証用(念のための二重チェック)。
  const preExistingSlugChanged: string[] = [];
  const winnerSlugFixed: AffectedBout[] = [];

  for (const ev of rizinEventsAfter) {
    for (const b of ev.bouts as any[]) {
      for (const [nameField, slugField, corner] of [
        ["fighterAName", "fighterASlug", "A"],
        ["fighterBName", "fighterBSlug", "B"],
      ] as const) {
        totalBoutSlots++;
        const name: string = b[nameField];
        const before = b[slugField];
        if (before) {
          alreadyResolved++;
          continue;
        }
        const resolved = resolveSlug(name, index);
        if (resolved) {
          b[slugField] = resolved;
          if (b[slugField] !== resolved) {
            preExistingSlugChanged.push(`${ev.eventName} ${nameField}`);
          }
          newlyResolved++;
          affectedSlugs.add(resolved);
          affectedBouts.push({
            event: ev.eventName,
            date: ev.date ?? null,
            cardPosition: b.cardPosition,
            corner,
            rawName: name,
            resolvedSlug: resolved,
          });
        } else {
          unresolved.set(name, (unresolved.get(name) ?? 0) + 1);
        }
      }

      // winnerSlugがnullで、winnerNameが指すコーナーのslugが解決済みなら埋める。
      // 既に非nullのwinnerSlugは上書きしない(上と同じ安全方針)。
      if (!b.winnerSlug && b.winnerName) {
        const winnerCorner: "A" | "B" | null =
          b.winnerName === b.fighterAName ? "A" : b.winnerName === b.fighterBName ? "B" : null;
        const winnerSlugCandidate = winnerCorner === "A" ? b.fighterASlug : winnerCorner === "B" ? b.fighterBSlug : null;
        if (winnerSlugCandidate) {
          b.winnerSlug = winnerSlugCandidate;
          affectedSlugs.add(winnerSlugCandidate);
          winnerSlugFixed.push({
            event: ev.eventName,
            date: ev.date ?? null,
            cardPosition: b.cardPosition,
            corner: winnerCorner as "A" | "B",
            rawName: b.winnerName,
            resolvedSlug: winnerSlugCandidate,
          });
        }
      }
    }
  }

  // 既存の解決済みslugが1件も変わっていないことを自己検証する(停止条件チェック用)。
  for (let i = 0; i < rizinEventsBefore.length; i++) {
    const evBefore = rizinEventsBefore[i];
    const evAfter = rizinEventsAfter[i];
    for (let j = 0; j < (evBefore.bouts as any[]).length; j++) {
      const bBefore = (evBefore.bouts as any[])[j];
      const bAfter = (evAfter.bouts as any[])[j];
      for (const slugField of ["fighterASlug", "fighterBSlug", "winnerSlug"] as const) {
        if (bBefore[slugField] && bBefore[slugField] !== bAfter[slugField]) {
          preExistingSlugChanged.push(`${evBefore.eventName} ${slugField} (${bBefore[slugField]} -> ${bAfter[slugField]})`);
        }
      }
    }
  }

  if (preExistingSlugChanged.length > 0) {
    console.error("!!! 既存の解決済みslugが変化しました。書き込みを中止します !!!");
    console.error(preExistingSlugChanged.join("\n"));
    process.exit(1);
  }

  fs.writeFileSync(path.join(DATA_DIR, TARGET_FILE), JSON.stringify(rizinEventsAfter, null, 2) + "\n");

  // ------------------------------------------------------------------
  // 影響を受けた選手ごとの4団体通算の変化(RIZIN以外は不変なので差分は
  // 純粋にRIZIN新規解決分の寄与)。
  // ------------------------------------------------------------------
  interface FighterImpact {
    slug: string;
    newlyResolvedBoutCount: number;
    before: { wins: number; losses: number; draws: number };
    after: { wins: number; losses: number; draws: number };
  }
  const impacts: FighterImpact[] = [];
  for (const slug of [...affectedSlugs].sort()) {
    const before = computeMultiOrgRecord(slug, {
      rizinEvents: rizinEventsBefore,
      shootoEvents,
      pancraseEvents,
      deepEvents,
    });
    const after = computeMultiOrgRecord(slug, {
      rizinEvents: rizinEventsAfter,
      shootoEvents,
      pancraseEvents,
      deepEvents,
    });
    const count = affectedBouts.filter((b) => b.resolvedSlug === slug).length;
    impacts.push({
      slug,
      newlyResolvedBoutCount: count,
      before: { wins: before.wins, losses: before.losses, draws: before.draws },
      after: { wins: after.wins, losses: after.losses, draws: after.draws },
    });
  }
  impacts.sort((a, b) => b.newlyResolvedBoutCount - a.newlyResolvedBoutCount);

  // ------------------------------------------------------------------
  // 編集距離1の惜しい不一致(ユーザー指定: 距離1のみ。判断はせずそのまま出す)
  // ------------------------------------------------------------------
  const nearMisses = findNearMisses(unresolved, candidates).filter((nm) => nm.distance === 1);
  nearMisses.sort((a, b) => b.rawNameBoutCount - a.rawNameBoutCount);

  // ------------------------------------------------------------------
  // レポート出力
  // ------------------------------------------------------------------
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const lines: string[] = [];
  lines.push("# RIZIN選手slug再解決バックフィル結果");
  lines.push("");
  lines.push(`生成日時: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("正規化ロジックはscripts/lib/fighterNameBackfill.ts(backfill-shooto-pancrase-slugs.tsと共通)を使用。");
  lines.push("fighters.tsの全選手(hidden含む)のnameJa/aliasesと完全一致した場合のみ解決。既存の解決済みslugは上書きしない。");
  lines.push("");
  lines.push(`- bout×コーナー総数: ${totalBoutSlots}`);
  lines.push(`- 既に解決済みだった件数: ${alreadyResolved}`);
  lines.push(`- 今回新規解決(コーナー単位): ${newlyResolved}`);
  lines.push(`- 今回新規解決(ユニークbout件数): ${new Set(affectedBouts.map((b) => `${b.event}#${b.cardPosition}`)).size}`);
  lines.push(`- 依然未解決(延べ): ${[...unresolved.values()].reduce((a, b) => a + b, 0)}`);
  lines.push(`- 依然未解決(ユニーク生表記数): ${unresolved.size}`);
  lines.push(`- winnerSlug再計算で埋めた件数: ${winnerSlugFixed.length}`);
  lines.push("");

  lines.push("## 影響を受けた選手一覧(選手名・解決bout数・4団体通算の変化)");
  lines.push("");
  if (impacts.length === 0) {
    lines.push("(該当なし)");
  } else {
    lines.push("| slug | 新規解決bout数 | 4団体通算(変更前) | 4団体通算(変更後) |");
    lines.push("|---|---|---|---|");
    for (const imp of impacts) {
      const fmt = (r: { wins: number; losses: number; draws: number }) => `${r.wins}-${r.losses}-${r.draws}`;
      lines.push(`| ${imp.slug} | ${imp.newlyResolvedBoutCount} | ${fmt(imp.before)} | ${fmt(imp.after)} |`);
    }
  }
  lines.push("");

  lines.push("## 新規解決bout明細");
  lines.push("");
  lines.push("| 大会 | 日付 | コーナー | 生表記 | 解決slug |");
  lines.push("|---|---|---|---|---|");
  for (const b of affectedBouts) {
    lines.push(`| ${b.event} | ${b.date ?? "-"} | ${b.corner} | ${b.rawName} | ${b.resolvedSlug} |`);
  }
  lines.push("");

  lines.push("## winnerSlug再計算明細(fighterA/BSlugは解決済みだがwinnerSlugがnullのまま残っていたbout)");
  lines.push("");
  if (winnerSlugFixed.length === 0) {
    lines.push("(該当なし)");
  } else {
    lines.push("| 大会 | 日付 | コーナー | 勝者名 | 解決slug |");
    lines.push("|---|---|---|---|---|");
    for (const b of winnerSlugFixed) {
      lines.push(`| ${b.event} | ${b.date ?? "-"} | ${b.corner} | ${b.rawName} | ${b.resolvedSlug} |`);
    }
  }
  lines.push("");

  lines.push("## 編集距離1の不一致候補(参考、機械列挙のみ・同一人物判定はしていない)");
  lines.push("");
  if (nearMisses.length === 0) {
    lines.push("(該当なし)");
  } else {
    lines.push("| bout側の生表記 | 出現bout件数 | 候補選手名(nameJa/alias) | 候補選手slug | 編集距離 |");
    lines.push("|---|---|---|---|---|");
    for (const nm of nearMisses) {
      lines.push(`| ${nm.rawName} | ${nm.rawNameBoutCount} | ${nm.candidateName} | ${nm.candidateSlug} | ${nm.distance} |`);
    }
  }
  lines.push("");

  lines.push("## 依然未解決の生表記一覧(出現bout件数の多い順)");
  lines.push("");
  const sortedUnresolved = [...unresolved.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedUnresolved) {
    lines.push(`- ${name} (${count}件)`);
  }
  lines.push("");

  fs.writeFileSync(path.join(OUT_DIR, "rizin-slug-backfill.md"), lines.join("\n") + "\n");

  console.log("=== RIZINバックフィル完了 ===");
  console.log(`新規解決(コーナー単位): ${newlyResolved}`);
  console.log(`新規解決(ユニークbout件数): ${new Set(affectedBouts.map((b) => `${b.event}#${b.cardPosition}`)).size}`);
  console.log(`既解決: ${alreadyResolved}`);
  console.log(`依然未解決(延べ): ${[...unresolved.values()].reduce((a, b) => a + b, 0)}`);
  console.log(`winnerSlug再計算で埋めた件数: ${winnerSlugFixed.length}`);
  console.log(`影響選手数: ${impacts.length}`);
  console.log(`編集距離1の不一致: ${nearMisses.length}件`);
  console.log(`レポート: out/rizin-slug-backfill.md`);
}

main();
