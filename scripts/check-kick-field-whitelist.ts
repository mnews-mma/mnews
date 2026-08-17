// PR-G(2026-08-17): /kick の各フィールドについて「既知のパターン外の値が黙って
// 画面に出ている」ことを毎ビルド検知するゲート。
//
// 背景: PR-1〜PR-22 + #560/#561/#562 では、パーサ取りこぼし・列ずれ・ネストテンプレート・
// wikitext残骸(引用符・テンプレート断片)の混入といった欠陥が、いずれも「値としては
// 存在するが中身が壊れている」形で発生し、本番に出てから発見されていた。値の形式自体を
// 検査していれば気づけたはずのものを、ビルドゲート化する。
//
// data/kick/generated/ (scripts/build-kick-data.tsが直前に生成) を読む。生データ
// (data/kick/*.json)は一切変更しない。
//
// ベースラインはこのスクリプトが自動でratchet(前回ビルド時点の値を基準にし、増加したら
// 失敗・減少/同値なら基準を更新)する。data/kick/unmatchedBoutsBaseline.jsonと同じ方式。
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");
const BASELINE_PATH = path.join(ROOT, "data/kick/kickFieldWhitelistBaseline.json");

interface Violation {
  category: string;
  slug: string;
  detail: string;
}

const violations: Violation[] = [];

// ---------- 決着(method)のホワイトリスト ----------
// scripts/standup-pipeline/SCHEMA.md記載の enum に加え、実データ調査(PR-G, 2026-08-17)で
// 見つかった "disqualification"(反則負け)を追加する。SCHEMA.md記載時点では未記録だったが、
// 実データに72件存在し、値自体は不正でも取りこぼしでもない正当な決着区分のため許可リストに含める。
const KNOWN_METHODS = new Set<string | null>([
  "ko",
  "tko",
  "decision",
  "submission",
  "doctor_stop",
  "injury_decision",
  "walkover",
  "time_limit",
  "draw",
  "no_contest",
  "disqualification",
  "other",
  null,
]);

// ---------- 対戦相手名・決着原文(methodRaw)のwikitext残骸検知 ----------
// build-kick-data.ts が最終出力するopponentName/methodRawに、Wikipedia側パーサの
// テンプレート・引用タグの処理漏れが残っていないかを見る。
// `=` はテンプレートの名前付き引数(|url=...)、`<`はタグ、`{{`はテンプレート開始、
// `|`はテンプレートの引数区切りの残骸を示す。
const WIKITEXT_RESIDUE_RE = /\{\{|<ref\b|<\/ref>|<!--|-->/;
const OPPONENT_MARKUP_RE = /[=<]|\{\{|\|/;

// ---------- 読み(kana)のホワイトリスト ----------
// ひらがな・カタカナ(半角含む)・長音符・中黒・空白のみを許可する。
// リングネームの引用符囲み("コング" コウセイ等)・ラテン文字(COMACHI等)・数字(man48等)・
// タイ人選手のローマ字転写に使われる全角ピリオド(ソー.カムイン等)・フランス語の"="(ジャン=クロード)は
// 「読み」フィールドの目的(かなでの検索・五十音順分類)に対して既知パターン外の値として検知する。
const KANA_ONLY_RE = /^[ぁ-んァ-ヶーｧ-ﾝﾞﾟ・\s]+$/;

function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [, ys, ms, ds] = m;
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === mo && dt.getUTCDate() === d;
}

const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));
for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    // 日付: null(明示未取得)か、妥当なYYYY-MM-DDのいずれかのみ許可。
    if (b.date !== null && !isValidDate(b.date)) {
      violations.push({
        category: "date",
        slug: f.slug,
        detail: `date="${b.date}"(不正な形式またはカレンダー上存在しない日付) event=${b.event ?? "null"} sourceType=${b.sourceType ?? "official"}`,
      });
    }
    // 決着(method): ホワイトリスト外の値。
    if (!KNOWN_METHODS.has(b.method)) {
      violations.push({
        category: "method",
        slug: f.slug,
        detail: `method="${b.method}" methodRaw="${b.methodRaw}"`,
      });
    }
    // 決着原文(methodRaw): wikitextテンプレート・タグの残骸。
    if (b.methodRaw && WIKITEXT_RESIDUE_RE.test(b.methodRaw)) {
      violations.push({
        category: "methodRaw_wikitext_residue",
        slug: f.slug,
        detail: `methodRaw="${b.methodRaw}" sourceUrl=${b.sourceUrl}`,
      });
    }
    // 対戦相手名: wikitextマークアップ記号の残骸。
    if (b.opponentName && OPPONENT_MARKUP_RE.test(b.opponentName)) {
      violations.push({
        category: "opponentName_markup_residue",
        slug: f.slug,
        detail: `opponentName="${b.opponentName}" sourceUrl=${b.sourceUrl}`,
      });
    }
  }
}

// 読み(kana)はindex.json(選手単位、1回のみ)を見る。
const index = JSON.parse(fs.readFileSync(path.join(GEN, "index.json"), "utf8"));
for (const f of index.fighters as any[]) {
  if (f.kana && !KANA_ONLY_RE.test(f.kana)) {
    violations.push({ category: "kana_non_kana_chars", slug: f.slug, detail: `kana="${f.kana}"` });
  }
}

// ---------- 集計・ratchet判定 ----------
const counts: Record<string, number> = {};
for (const v of violations) counts[v.category] = (counts[v.category] ?? 0) + 1;

const CATEGORIES = [
  "date",
  "method",
  "methodRaw_wikitext_residue",
  "opponentName_markup_residue",
  "kana_non_kana_chars",
];
for (const c of CATEGORIES) if (!(c in counts)) counts[c] = 0;

console.log("[kick-field-whitelist] 現在の違反件数:", JSON.stringify(counts, null, 1));

const prevBaseline: Record<string, number> = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"))
  : Object.fromEntries(CATEGORIES.map((c) => [c, counts[c]]));

const regressed: string[] = [];
for (const c of CATEGORIES) {
  const prev = prevBaseline[c] ?? 0;
  if (counts[c] > prev) {
    regressed.push(`${c}: ${counts[c]}件 > 前回基準${prev}件`);
  }
}

if (regressed.length) {
  console.error(
    `[kick-field-whitelist] ★フィールド値の想定外の混入が前回ビルド時点の基準から増加しています。デプロイをブロックします:\n` +
      `  ${regressed.join("\n  ")}\n` +
      "  代表例:\n" +
      violations
        .slice(0, 30)
        .map((v) => `    - [${v.category}] ${v.slug}: ${v.detail}`)
        .join("\n"),
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 1) + "\n");
console.log("[kick-field-whitelist] OK(いずれのフィールドも基準以下)");
