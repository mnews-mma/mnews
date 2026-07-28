// /tmp/ri94_generated.json(generate.tsの出力)から、fighters.ts へ挿入する
// TypeScriptスニペットと、人間レビュー用のMarkdownレポート(out/roster-injection-94.md)
// を生成する。fighters.ts自体への書き込みはしない(挿入は別途手動で行い、差分を
// 目視確認できるようにする)。
import { readFileSync, writeFileSync } from "fs";

const data = JSON.parse(readFileSync("/tmp/ri94_generated.json", "utf8"));

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function emitFighterTs(r: any): string {
  const lines: string[] = [];
  lines.push(`  {`);
  lines.push(`    slug: "${esc(r.slug)}",`);
  lines.push(`    nameJa: "${esc(r.nameJa)}",`);
  lines.push(`    nameEn: "${esc(r.nameEn)}",`);
  lines.push(`    org: "${r.primaryOrg}",`);
  if (r.orgs.length > 1) lines.push(`    orgs: [${r.orgs.map((o: string) => `"${o}"`).join(", ")}],`);
  lines.push(`    weightClass: "${r.weightClass ?? "不明"}",`);
  lines.push(`    wins: ${r.wins},`);
  lines.push(`    losses: ${r.losses},`);
  lines.push(`    draws: ${r.draws},`);
  lines.push(`    ko: ${r.ko},`);
  lines.push(`    sub: ${r.sub},`);
  lines.push(`    decision: ${r.decision},`);
  if (r.history.length === 0) {
    lines.push(`    history: [],`);
  } else {
    lines.push(`    history: [`);
    // 既存DB慣例(平良達郎等)に合わせ、直近(新しい)試合を先頭にする(日付降順)。
    const hist = [...r.history].reverse();
    for (const h of hist) {
      lines.push(
        `      { date: "${h.date}", opponent: "${esc(h.opponent)}", result: "${h.result}", method: "${esc(h.method)}", event: "${esc(h.event)}", round: "${esc(h.round)}" },`
      );
    }
    lines.push(`    ],`);
  }
  lines.push(`    hidden: true,`);
  lines.push(`    needsReview: true,`);
  lines.push(`  },`);
  return lines.join("\n");
}

const header = `  // ===========================================================================
  // パンクラス・修斗94名(#248/#247)hidden投入(out/roster-injection-94.md参照)。
  // 全員 hidden:true / needsReview:true。slug/weightClassの確度は各エントリの
  // out/roster-injection-94.md該当セクションを参照(人間レビュー前提・公開はしない)。
  // ===========================================================================
`;

const body = data.results.map(emitFighterTs).join("\n");
writeFileSync("/tmp/ri94_fighters_snippet.ts", header + body + "\n");

console.log(`TSスニペット生成: ${data.results.length}件 → /tmp/ri94_fighters_snippet.ts`);
