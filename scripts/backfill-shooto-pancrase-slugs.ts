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
import fs from "fs";
import path from "path";
import { FIGHTERS } from "../src/lib/fighters";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_DIR = path.join(process.cwd(), "out");
const TARGET_FILES = ["shootoRecords.json", "pancraseRecords.json", "deepRecords.json"];

// ------------------------------------------------------------------
// 正規化・候補インデックス構築
// (NFKC + 空白除去 + 異体字統一 + 漢字/カタカナ同形統一 + 引用符・記号除去。
//  カタカナ/ひらがな変換は引き続きしない)
// ------------------------------------------------------------------

// 旧字体・異体字 -> 統一先。読みが同じ別字(斎/斉等)も実データ上サイトウ姓の
// 表記ゆれとして混在しているため統一対象に含める。
const VARIANT_CHAR_MAP: Record<string, string> = {
  "髙": "高",
  "﨑": "崎",
  "齋": "斉",
  "齊": "斉",
  "斎": "斉",
  "濵": "浜",
};
const VARIANT_CHAR_RE = new RegExp(`[${Object.keys(VARIANT_CHAR_MAP).join("")}]`, "g");

// 漢字とカタカナで字形が同じ/酷似する文字の統一(片方をもう片方に寄せる)。
const HOMOGRAPH_CHAR_MAP: Record<string, string> = {
  "ニ": "二",
  "ロ": "口",
  "カ": "力",
  "エ": "工",
  "ト": "卜",
};
const HOMOGRAPH_CHAR_RE = new RegExp(`[${Object.keys(HOMOGRAPH_CHAR_MAP).join("")}]`, "g");

// 引用符・区切り記号の除去対象(装飾ニックネームの囲みや中黒等)。
const QUOTE_SYMBOL_RE = /["'‘’“”〝〞〟・·‧]/g;

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(QUOTE_SYMBOL_RE, "")
    .replace(VARIANT_CHAR_RE, (c) => VARIANT_CHAR_MAP[c])
    .replace(HOMOGRAPH_CHAR_RE, (c) => HOMOGRAPH_CHAR_MAP[c]);
}

// 正規化名 -> slug。複数選手が同名の場合はnull(曖昧・解決しない)を入れる。
function buildNameIndex(): Map<string, string | null> {
  const index = new Map<string, string | null>();
  const claim = (raw: string, slug: string) => {
    const n = normalize(raw);
    if (!n) return;
    if (index.has(n)) {
      const existing = index.get(n);
      if (existing !== slug) index.set(n, null);
    } else {
      index.set(n, slug);
    }
  };
  for (const f of FIGHTERS) {
    claim(f.nameJa, f.slug);
    (f.aliases ?? []).forEach((a) => claim(a, f.slug));
  }
  return index;
}

function resolveSlug(name: string, index: Map<string, string | null>): string | null {
  const n = normalize(name);
  if (!n) return null;
  return index.get(n) ?? null;
}

// ------------------------------------------------------------------
// 報告専用: 編集距離1〜2の「惜しい不一致」検出(解決ロジックには一切使わない)
// ------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j], dp[j - 1]);
      prevDiag = temp;
    }
  }
  return dp[n];
}

interface CandidateName {
  normName: string;
  displayName: string;
  slug: string;
}

function buildCandidateList(): CandidateName[] {
  const seen = new Set<string>();
  const out: CandidateName[] = [];
  for (const f of FIGHTERS) {
    const names = [f.nameJa, ...(f.aliases ?? [])];
    for (const raw of names) {
      const norm = normalize(raw);
      if (!norm) continue;
      const key = `${norm}::${f.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ normName: norm, displayName: raw, slug: f.slug });
    }
  }
  return out;
}

interface NearMiss {
  rawName: string;
  rawNameBoutCount: number;
  candidateName: string;
  candidateSlug: string;
  distance: number;
}

// 未解決の生表記(name -> 出現bout件数)ごとに、全候補名との編集距離を計算し、
// 距離1〜2のものだけを列挙する(距離0=完全一致は既に解決済みのはずなので
// ここには出現しない)。同一人物かどうかの判断はしない(機械的な列挙のみ)。
//
// 距離1については、正規化後の生表記が3文字以下の場合は候補を出さない
// (修我/亮我・圭太郎/金太郎・雅也/力也のような短いリングネーム同士は
// 距離1でもほぼ別人で、一覧のノイズになるため。2026-07-29追加)。
function findNearMisses(unresolved: Map<string, number>, candidates: CandidateName[]): NearMiss[] {
  const out: NearMiss[] = [];
  for (const [rawName, count] of unresolved) {
    const norm = normalize(rawName);
    if (!norm) continue;
    for (const cand of candidates) {
      // 明らかに文字数差が大きい候補は距離2を超えるため計算を省略する(高速化)。
      if (Math.abs(cand.normName.length - norm.length) > 2) continue;
      const dist = levenshtein(norm, cand.normName);
      if (dist === 1 && norm.length <= 3) continue;
      if (dist === 1 || dist === 2) {
        out.push({ rawName, rawNameBoutCount: count, candidateName: cand.displayName, candidateSlug: cand.slug, distance: dist });
      }
    }
  }
  return out;
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
