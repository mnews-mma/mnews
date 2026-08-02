// data/shootoRecords.json・data/pancraseRecords.json・data/deepRecords.json の
// fighterASlug/fighterBSlugを埋め直すバックフィル専用スクリプト(ファイル名は
// 修斗/パンクラス投入時のままだが、2026-07-29にdeepRecords.jsonも対象に追加した)。
//
// 背景: 各ファイルは生成時点のfighters.tsでslug解決しているため、その後の
// fighters.ts更新(新規選手投入等)を反映できていないbout側slugがnullのまま
// 残る。対象ファイルを再度slug解決し、fighterASlug/fighterBSlugフィールドだけを
// 更新して書き戻す(本文・その他フィールドは一切変更しない。サイトへの
// 再フェッチは不要)。
//
// 解決ロジック(このスクリプト専用の新規実装。既存findFighterSlugByName
// (src/lib/fighters.ts)は一切変更せず、ロジックも再利用しない):
// - hidden:trueの選手も解決対象に含める(findFighterSlugByNameはhidden除外
//   だが、それは表示用リンク解決の共有関数のため今回は使わない)。
// - 正規化はNFKC + 空白除去 + 異体字統一(髙→高・﨑→崎・齋/齊/斎→斉・
//   濵→浜等) + 漢字/カタカナ同形文字統一(ニ→二・ロ→口・カ→力・エ→工・
//   ト→卜) + 引用符/中黒等の記号除去。ひらがな/カタカナ間の変換はしない。
//   findFighterSlugByNameより厳格な完全一致(#260継続、2026-07-29追加正規化)。
// - 対象候補は全選手のnameJa + aliases。正規化後、bout側の生表記と
//   完全一致した場合のみ解決する(部分一致・あいまい一致は禁止)。
// - 複数選手が同じ正規化名にマッチする場合(曖昧)も未解決のまま残す
//   (推測で埋めない)。
//
// 実行: npx tsx scripts/backfill-shooto-pancrase-slugs.ts
//
// 正規化・近似照合ロジック本体はscripts/lib/fighterNameBackfill.tsに集約
// (2026-07-31、RIZINバックフィル追加時に切り出し。ロジック自体は変更していない)。
import fs from "fs";
import path from "path";
import { buildNameIndex, resolveSlug, buildCandidateList, findNearMisses } from "./lib/fighterNameBackfill";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_DIR = path.join(process.cwd(), "out");
const TARGET_FILES = ["shootoRecords.json", "pancraseRecords.json", "deepRecords.json"];

// 指示書R-4(2026-08-01): 名前は本人で一致するが、試合そのものがプロ戦績
// 集計の対象外(アマチュア/年少者向け特別ルール等)のため、名前解決の
// 対象から個別に除外するbout。denylist(名前単位で常時ブロック)とは違い、
// この選手の他のboutの自動解決は妨げない(karenの"華蓮DATE"aliasは
// PANCRASE 319/311/322の3戦を正しく解決する一方、このDEEP JEWELS 12の
// 1戦だけは除外する)。
//
// - DEEP JEWELS 12(2016-06-05)「華蓮DATE」vs 三阪あゆみ: headingText/
//   namedDivisionに「※パウンド無し」の注記があり、DEEP JEWELS本戦の
//   通常ルール(グラウンドパンチ有り)とは異なる特別ルール。本人がこの
//   興行に出場したこと自体はefight.jpの記事(Team DATE解散報道、
//   「DEEP JEWELSに12歳で初出場」の記載)と符合するが、パウンド無しの
//   特別ルール戦をプロ通算成績に算入すると1行目(Wikipedia由来、10-3-0)
//   を2行目が上回ってしまう(11-3-0)。1行目もこの試合を含めていないため、
//   本アグリゲータでも除外し1行目と2行目を10-3-0で一致させる。
const KNOWN_NON_PROFESSIONAL_BOUTS: ReadonlySet<string> = new Set([
  "deepRecords.json::DEEP JEWELS 12::2016-06-05::1",
]);

function boutKey(file: string, eventName: string, date: string | null, cardPosition: number): string {
  return `${file}::${eventName}::${date}::${cardPosition}`;
}

// ------------------------------------------------------------------
// ファイル単位のバックフィル処理
// ------------------------------------------------------------------
interface FileResult {
  file: string;
  totalBoutSlots: number; // bout数×2(左右コーナー)
  alreadyResolved: number;
  newlyResolved: number;
  unresolved: Map<string, number>; // 生表記 -> 出現件数(未解決のみ)
}

function backfillFile(fileName: string, index: Map<string, string | null>): FileResult {
  const filePath = path.join(DATA_DIR, fileName);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  let totalBoutSlots = 0;
  let alreadyResolved = 0;
  let newlyResolved = 0;
  const unresolved = new Map<string, number>();

  for (const ev of data) {
    for (const b of ev.bouts) {
      for (const [nameField, slugField] of [
        ["fighterAName", "fighterASlug"],
        ["fighterBName", "fighterBSlug"],
      ] as const) {
        totalBoutSlots++;
        const name: string = b[nameField];
        if (b[slugField]) {
          alreadyResolved++;
          continue;
        }
        if (KNOWN_NON_PROFESSIONAL_BOUTS.has(boutKey(fileName, ev.eventName, ev.date, b.cardPosition))) {
          unresolved.set(name, (unresolved.get(name) ?? 0) + 1);
          continue;
        }
        const resolved = resolveSlug(name, index);
        if (resolved) {
          b[slugField] = resolved;
          newlyResolved++;
        } else {
          unresolved.set(name, (unresolved.get(name) ?? 0) + 1);
        }
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  return { file: fileName, totalBoutSlots, alreadyResolved, newlyResolved, unresolved };
}

// ------------------------------------------------------------------
// メイン
// ------------------------------------------------------------------
function main() {
  const index = buildNameIndex();
  const candidates = buildCandidateList();

  const results: FileResult[] = TARGET_FILES.map((f) => backfillFile(f, index));

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const lines: string[] = [];
  lines.push("# 修斗・パンクラス slugバックフィル結果");
  lines.push("");
  lines.push(`生成日時: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("正規化方式: NFKC + 空白除去 + 異体字統一(髙→高・﨑→崎・齋/齊/斎→斉・濵→浜等) + 漢字/カタカナ同形文字統一");
  lines.push("(ニ→二・ロ→口・カ→力・エ→工・ト→卜) + 引用符/中黒等の記号除去(#260継続、2026-07-29追加)。ひらがな/カタカナ間の");
  lines.push("変換はしない。fighters.tsの全選手(hidden含む)の");
  lines.push("nameJa/aliasesと完全一致した場合のみ解決。複数選手が同一正規化名を持つ場合は曖昧として未解決のまま残す。");
  lines.push("");

  for (const r of results) {
    lines.push(`## ${r.file}`);
    lines.push("");
    lines.push(`- bout×コーナー総数: ${r.totalBoutSlots}`);
    lines.push(`- 既に解決済みだった件数: ${r.alreadyResolved}`);
    lines.push(`- 今回新規解決: ${r.newlyResolved}`);
    lines.push(`- 依然未解決(延べ): ${[...r.unresolved.values()].reduce((a, b) => a + b, 0)}`);
    lines.push(`- 依然未解決(ユニーク生表記数): ${r.unresolved.size}`);
    lines.push("");
    lines.push("### 未解決だった生表記の一覧(出現bout件数の多い順)");
    lines.push("");
    const sorted = [...r.unresolved.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
      lines.push(`- ${name} (${count}件)`);
    }
    lines.push("");
  }

  // 編集距離1〜2の「惜しい不一致」(ファイル横断・重複除去)
  lines.push("## 編集距離1〜2の惜しい不一致(参考、機械列挙のみ・同一人物判定はしていない)");
  lines.push("");
  lines.push("正規化後の生表記と、fighters.ts側の候補名(nameJa/aliases)の編集距離が1または2だったペアを");
  lines.push("機械的に列挙したもの。同一人物かどうかの判断はしていない(人間側で個別確認する前提)。");
  lines.push("");
  const allUnresolved = new Map<string, number>();
  for (const r of results) {
    for (const [name, count] of r.unresolved) {
      allUnresolved.set(name, (allUnresolved.get(name) ?? 0) + count);
    }
  }
  const nearMisses = findNearMisses(allUnresolved, candidates);
  nearMisses.sort((a, b) => a.distance - b.distance || b.rawNameBoutCount - a.rawNameBoutCount);
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

  fs.writeFileSync(path.join(OUT_DIR, "shooto-pancrase-slug-backfill.md"), lines.join("\n") + "\n");

  console.log("=== バックフィル完了 ===");
  for (const r of results) {
    console.log(
      `${r.file}: 新規解決 ${r.newlyResolved} / 既解決 ${r.alreadyResolved} / 未解決(延べ) ${[...r.unresolved.values()].reduce((a, b) => a + b, 0)}`
    );
  }
  console.log(`惜しい不一致(編集距離1〜2): ${nearMisses.length}件`);
  console.log(`レポート: out/shooto-pancrase-slug-backfill.md`);
}

main();
