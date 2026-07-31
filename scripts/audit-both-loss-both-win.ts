// 4団体(RIZIN/修斗/パンクラス/DEEP)の構造化データを横断し、同一boutで
// 両者が敗(または両者が勝)と表示されうるケースを機械的に列挙する。
// 列挙のみ・修正はしない(読み取り専用の調査スクリプト)。
//
// 実行: npx tsx scripts/audit-both-loss-both-win.ts
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

interface Finding {
  org: string;
  event: string;
  date: string | null;
  cardPosition: number;
  fighterAName: string;
  fighterBName: string;
  fighterASlug: string | null;
  fighterBSlug: string | null;
  winnerName: string | null;
  winnerSlug?: string | null;
  pattern: string;
}

function auditRizin(): Finding[] {
  const events = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "rizinRecords.json"), "utf8"));
  const findings: Finding[] = [];
  for (const ev of events) {
    for (const b of ev.bouts) {
      if (b.resultType !== "decisive") continue;
      const winnerIsA = b.winnerName === b.fighterAName;
      const winnerIsB = b.winnerName === b.fighterBName;
      const winnerCornerSlug = winnerIsA ? b.fighterASlug : winnerIsB ? b.fighterBSlug : undefined;

      if (!winnerIsA && !winnerIsB) {
        findings.push({
          org: "rizin",
          event: ev.eventName,
          date: ev.date,
          cardPosition: b.cardPosition,
          fighterAName: b.fighterAName,
          fighterBName: b.fighterBName,
          fighterASlug: b.fighterASlug,
          fighterBSlug: b.fighterBSlug,
          winnerName: b.winnerName,
          winnerSlug: b.winnerSlug,
          pattern: "winnerNameが両コーナーの名前と不一致",
        });
        continue;
      }

      // isWin = winnerSlug === slug で判定されるため、勝者コーナーのslugが
      // 解決済み(non-null)なのにwinnerSlugがそれと一致していない場合、
      // 集計時にその勝者すら「勝ち」判定されず、両者敗になる。
      if (winnerCornerSlug && b.winnerSlug !== winnerCornerSlug) {
        findings.push({
          org: "rizin",
          event: ev.eventName,
          date: ev.date,
          cardPosition: b.cardPosition,
          fighterAName: b.fighterAName,
          fighterBName: b.fighterBName,
          fighterASlug: b.fighterASlug,
          fighterBSlug: b.fighterBSlug,
          winnerName: b.winnerName,
          winnerSlug: b.winnerSlug,
          pattern: `winnerSlug不整合(期待値=${winnerCornerSlug}, 実際=${b.winnerSlug ?? "null"})`,
        });
      }

      // 敗者側のslugがwinnerSlugと一致してしまっている(両者勝になりうる)
      const loserCornerSlug = winnerIsA ? b.fighterBSlug : b.fighterASlug;
      if (loserCornerSlug && b.winnerSlug === loserCornerSlug) {
        findings.push({
          org: "rizin",
          event: ev.eventName,
          date: ev.date,
          cardPosition: b.cardPosition,
          fighterAName: b.fighterAName,
          fighterBName: b.fighterBName,
          fighterASlug: b.fighterASlug,
          fighterBSlug: b.fighterBSlug,
          winnerName: b.winnerName,
          winnerSlug: b.winnerSlug,
          pattern: "winnerSlugが敗者コーナーのslugと一致(両者勝の疑い)",
        });
      }
    }
  }
  return findings;
}

function auditNameBased(org: string, fileName: string): Finding[] {
  const events = JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));
  const findings: Finding[] = [];
  for (const ev of events) {
    for (const b of ev.bouts) {
      if (b.resultType !== "decisive") continue;
      const winnerIsA = b.winnerName === b.fighterAName;
      const winnerIsB = b.winnerName === b.fighterBName;
      if (!winnerIsA && !winnerIsB) {
        findings.push({
          org,
          event: ev.eventName,
          date: ev.date ?? null,
          cardPosition: b.cardPosition,
          fighterAName: b.fighterAName,
          fighterBName: b.fighterBName,
          fighterASlug: b.fighterASlug ?? null,
          fighterBSlug: b.fighterBSlug ?? null,
          winnerName: b.winnerName,
          pattern: "winnerNameが両コーナーの名前と不一致(このorgはwinnerName直接比較で集計するため、両者敗になる)",
        });
      }
    }
  }
  return findings;
}

function main() {
  const all: Finding[] = [
    ...auditRizin(),
    ...auditNameBased("shooto", "shootoRecords.json"),
    ...auditNameBased("pancrase", "pancraseRecords.json"),
    ...auditNameBased("deep", "deepRecords.json"),
  ];

  console.log(`=== 横断監査: 両者敗/両者勝の疑いがあるbout ===`);
  console.log(`総件数: ${all.length}`);
  const byOrg = new Map<string, number>();
  const byPattern = new Map<string, number>();
  for (const f of all) {
    byOrg.set(f.org, (byOrg.get(f.org) ?? 0) + 1);
    byPattern.set(f.pattern.split("(")[0], (byPattern.get(f.pattern.split("(")[0]) ?? 0) + 1);
  }
  console.log("--- 団体別 ---");
  for (const [org, count] of byOrg) console.log(`${org}: ${count}`);
  console.log("--- パターン別 ---");
  for (const [p, count] of byPattern) console.log(`${p}: ${count}`);

  const outDir = path.join(process.cwd(), "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const lines: string[] = [];
  lines.push("# 4団体横断: 両者敗/両者勝 疑いbout一覧");
  lines.push("");
  lines.push(`総件数: ${all.length}`);
  lines.push("");
  lines.push("| org | event | date | cardPosition | fighterA | fighterB | Aslug | Bslug | winnerName | winnerSlug | pattern |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const f of all) {
    lines.push(
      `| ${f.org} | ${f.event} | ${f.date ?? "-"} | ${f.cardPosition} | ${f.fighterAName} | ${f.fighterBName} | ${f.fighterASlug ?? "-"} | ${f.fighterBSlug ?? "-"} | ${f.winnerName ?? "-"} | ${f.winnerSlug ?? "-"} | ${f.pattern} |`
    );
  }
  fs.writeFileSync(path.join(outDir, "both-loss-both-win-audit.md"), lines.join("\n") + "\n");
  console.log(`\nレポート: out/both-loss-both-win-audit.md`);
}

main();
