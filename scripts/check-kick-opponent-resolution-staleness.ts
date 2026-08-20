// V-3締め(2026-08-20): scripts/standup-pipeline/bouts.py・ingest_*.py の resolve() は
// fighters.json をそのつどファイルから読んで対戦相手を解決するが、その結果
// (opponent_ref/opponent_ref_gym/opponent_resolved/opponent_ambiguous/opponent_candidates)
// は data/kick/bouts_*.json に静的な値として書き出される。fighters.json 側が後日
// 更新される(改名・所属ジム修正・同名異人の統合等)と、bouts_*.json 側は再生成しない限り
// 古い解決結果を持ち続け、無言でズレていく。K-1側でこの問題が94件溜まっていたのが
// 発端(V-3、実際に反映したのは46件+他12ソース54件+RIZIN 3件=103件、詳細はコミット
// メッセージ参照)。今後同じ手作業が繰り返されないよう、このゲートで常時ゼロ件を保証する。
//
// 対象は Python側の resolve() が実際に使う3通りの解決方式それぞれを、この場で
// TypeScriptに再現して突き合わせる(Pythonを起動しない。npm run build はPython非依存が
// 前提のため):
// 1. sourceUrl方式(SB/RISE/KNOCK OUT/K-1): opponent_site_slug優先、無ければ名前+所属。
// 2. identity方式の大半(DEEP☆KICK/NJKF/HoostCup/NKB/Bigbang/Stand up/KROSS×OVER/SNKA/JKA):
//    名前+所属のみ(サイト内リンクを持たない)。
// 3. RIZIN: opponent_affiliationを持たないため、名前一致のみで解決(所属による絞り込みなし)。
// ONE Championshipは常にopponent_resolved:falseで書き出される(ingest_one.py参照)ため
// 構造的にズレようがなく対象外。
//
// data/kick/manualOverrides.json の correctedBoutResults に登録済みの行は、公式サイト自体の
// 誤りを理由に手動で正しい値へ上書きしている(=このゲートの「あるべき値」が意図的に
// 古い/推測できない値のまま)。この検査の対象から明示的に除外する(除外しないと、
// check-kick-manual-edit-drift.ts の検査3が守っている手動修正を、このゲートが
// 「巻き戻せ」と誤って要求してしまう)。
//
// ---- ゲートが落ちたときの直し方 ----
// 1. 何が変わったかをまず理解する: 直近でfighters.jsonに手を入れたPR(改名・統合・
//    ジム修正)を確認する。「対応法」ではなく「fighters.json側の変更が正しいか」を先に
//    疑うこと(誤った統合を反映してこのゲートを黙らせるのは本末転倒)。
// 2. このゲートが出す差分一覧(bout_id・旧値・新値)を、ソースごとに個別確認する。
//    「正しい」パターンの例(V-3で実例確認済み): 同名異人が生年月日/出身地/ローマ字の
//    完全一致で統合された結果、ambiguous→resolvedになる/gymが更新される/表記名が
//    変わる。「誤り」の可能性がある場合(生年月日が数年ずれる等)は反映せず、
//    fighters.json側の統合を疑って個別に調査すること。
// 3. data/kick/manualOverrides.json の correctedBoutResults に該当bout_idが登録されて
//    いないか必ず確認する(登録されていれば、その行は意図的な例外なので反映しない)。
// 4. 正しいと確認できた行だけ、対象フィールド5つ(opponent_ref/opponent_ref_gym/
//    opponent_resolved/opponent_ambiguous/opponent_candidates)を data/kick/ と
//    scripts/standup-pipeline/ の両ミラーに反映する。他のフィールド(date/event/
//    method等)やbout行の追加・削除は一切発生しないはず — もし発生したら別の変更が
//    混入しているので切り分けること。
// 5. npm run build を再実行し、このゲート・check:kick-identity-merge-risk・
//    check:kick-manual-edit-drift がいずれもクリアすることを確認する。
//
// 実行方法: npx tsx scripts/check-kick-opponent-resolution-staleness.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");
const BASELINE_PATH = path.join(SRC, "kickOpponentResolutionStalenessBaseline.json");

interface Fighter {
  name: string;
  aliases: string[];
  gym: string | null;
  orgs: string[];
  sources: string[];
}

interface Bout {
  bout_id: string;
  opponent_name: string;
  opponent_affiliation: string | null;
  opponent_site_slug: string | null;
  opponent_ref: string | null;
  opponent_ref_gym: string | null;
  opponent_resolved: boolean;
  opponent_ambiguous: boolean;
  opponent_candidates: { name: string; gym: string | null; orgs: string[] }[] | null;
}

const fighters: Fighter[] = JSON.parse(fs.readFileSync(path.join(SRC, "fighters.json"), "utf8"));

// scripts/standup-pipeline/bouts.py・ingest_*.py の nk()/gk() と意図的に同一の実装。
const KANJI_VARIANT_TABLE: Record<string, string> = {
  "﨑": "崎", "髙": "高", "國": "国", "實": "実", "弍": "弐", "凜": "凛", "齋": "斎", "龍": "竜", "―": "ー",
};
function nk(s: string | null | undefined): string {
  let t = (s ?? "").normalize("NFKC");
  for (const c of "“”\"'’‘`「」『』") t = t.split(c).join("");
  t = t.replace(/\s+/g, "").split("・").join("").split("=").join("").toLowerCase();
  return [...t].map((c) => KANJI_VARIANT_TABLE[c] ?? c).join("");
}
const GENERIC = new Set(["フリー", "無所属", "free", ""]);
function gk(s: string | null | undefined): string | null {
  if (!s) return null;
  let t = s.normalize("NFKC").toLowerCase();
  for (const c of "“”\"'’‘`") t = t.split(c).join("");
  t = t.replace(/(ジム|gym|キックボクシング|kickboxing|道場|会館|塾|team|チーム|ボクシング)/g, "");
  t = t.replace(/[\s　／/・\-,、。.]/g, "");
  return t || null;
}

const byName = new Map<string, Fighter[]>();
for (const f of fighters) {
  for (const n of [f.name, ...f.aliases]) {
    const k = nk(n);
    if (!k) continue;
    const list = byName.get(k) ?? [];
    if (!list.includes(f)) list.push(f);
    byName.set(k, list);
  }
}
function bySlugFor(host: string): Map<string, Fighter> {
  const m = new Map<string, Fighter>();
  const re = new RegExp(`^https://${host.replace(/\./g, "\\.")}/fighters?/([^/?]+)/?$`);
  for (const f of fighters) {
    for (const u of f.sources) {
      const mm = u.match(re);
      if (mm) m.set(mm[1], f);
    }
  }
  return m;
}

type Resolved = [string | null, string | null, boolean, boolean, { name: string; gym: string | null; orgs: string[] }[] | null];

// 名前+所属での解決(所属による絞り込み込み)。identity方式の大半とsourceUrl方式の
// フォールバックで共用。
function resolveByNameAff(name: string, aff: string | null): Resolved {
  const cands = byName.get(nk(name)) ?? [];
  if (cands.length === 0) return [null, null, false, false, null];
  if (cands.length === 1) {
    const r = cands[0];
    return [r.name, r.gym, true, false, null];
  }
  const a = gk(aff);
  let hit: Fighter[] = [];
  if (a && aff && !GENERIC.has(aff)) {
    hit = cands.filter((r) => {
      const rg = gk(r.gym);
      return rg && !GENERIC.has(r.gym ?? "") && (rg === a || a.includes(rg) || rg.includes(a));
    });
  }
  if (hit.length === 1) {
    const r = hit[0];
    return [r.name, r.gym, true, false, null];
  }
  return [null, null, false, true, cands.map((r) => ({ name: r.name, gym: r.gym, orgs: r.orgs }))];
}

// RIZIN専用: opponent_affiliationを持たないため、名前一致のみ(絞り込みなし)。
function resolveByNameOnly(name: string): Resolved {
  const cands = byName.get(nk(name)) ?? [];
  if (cands.length === 0) return [null, null, false, false, null];
  if (cands.length === 1) {
    const r = cands[0];
    return [r.name, r.gym, true, false, null];
  }
  return [null, null, false, true, cands.map((r) => ({ name: r.name, gym: r.gym, orgs: r.orgs }))];
}

interface ManualOverrideRegistry {
  correctedBoutResults?: { sourceFile: string; boutId: string }[];
}
const overridesPath = path.join(SRC, "manualOverrides.json");
const registry: ManualOverrideRegistry = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, "utf8"))
  : {};
const excluded = new Set((registry.correctedBoutResults ?? []).map((e) => `${e.sourceFile}|${e.boutId}`));

interface SourceUrlSource {
  file: string;
  host: string;
}
const SOURCEURL_SOURCES: SourceUrlSource[] = [
  { file: "bouts_sb.json", host: "shootboxing.org" },
  { file: "bouts_rise.json", host: "rise-rc.com" },
  { file: "bouts_knockout.json", host: "knockoutkb.com" },
  { file: "bouts_k1.json", host: "k-1.co.jp" },
];
const NAME_AFF_SOURCES = [
  "bouts_deepkick.json", "bouts_njkf.json", "bouts_hoostcup.json", "bouts_nkb.json",
  "bouts_bigbang.json", "bouts_standup.json", "bouts_krossover.json", "bouts_snka.json", "bouts_jka.json",
];
const NAME_ONLY_SOURCES = ["bouts_rizin.json"];

interface Stale {
  file: string;
  boutId: string;
  expected: Resolved;
  actual: Resolved;
}
const stale: Stale[] = [];

function check(file: string, resolver: (b: Bout) => Resolved) {
  const filePath = path.join(SRC, file);
  if (!fs.existsSync(filePath)) return;
  const rows: Bout[] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const b of rows) {
    if (excluded.has(`${file}|${b.bout_id}`)) continue;
    const expected = resolver(b);
    const actual: Resolved = [
      b.opponent_ref, b.opponent_ref_gym, b.opponent_resolved, b.opponent_ambiguous, b.opponent_candidates,
    ];
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      stale.push({ file, boutId: b.bout_id, expected, actual });
    }
  }
}

for (const { file, host } of SOURCEURL_SOURCES) {
  const byslug = bySlugFor(host);
  check(file, (b) => {
    if (b.opponent_site_slug) {
      const r = byslug.get(b.opponent_site_slug);
      if (r) return [r.name, r.gym, true, false, null];
    }
    return resolveByNameAff(b.opponent_name, b.opponent_affiliation);
  });
}
for (const file of NAME_AFF_SOURCES) {
  check(file, (b) => resolveByNameAff(b.opponent_name, b.opponent_affiliation));
}
for (const file of NAME_ONLY_SOURCES) {
  check(file, (b) => resolveByNameOnly(b.opponent_name));
}

const prevBaseline: number = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).count
  : 0;

if (stale.length > prevBaseline) {
  console.error(
    `[kick-opponent-resolution-staleness] ★fighters.jsonの更新にbouts_*.json側の対戦相手解決` +
      `結果が追随していない行が、前回ビルド時点の基準(${prevBaseline}件)から${stale.length}件に` +
      `増加しました。デプロイをブロックします(このファイル冒頭コメントの「直し方」参照):\n` +
      stale
        .slice(0, 30)
        .map(
          (s) =>
            `  - ${s.file} ${s.boutId}\n` +
            `      現在の値: ${JSON.stringify(s.actual)}\n` +
            `      あるべき値: ${JSON.stringify(s.expected)}`,
        )
        .join("\n") +
      (stale.length > 30 ? `\n  ...他${stale.length - 30}件` : ""),
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ count: stale.length }, null, 1) + "\n");
console.log(
  `[kick-opponent-resolution-staleness] OK(未追随${stale.length}件、基準${prevBaseline}件以下)`,
);
