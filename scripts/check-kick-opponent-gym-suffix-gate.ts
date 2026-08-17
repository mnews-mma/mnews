// PR-G追補(2026-08、表示層混入監査、項目4-2): PR-9(#544, 0bb7873)の検査C3
// (相手名への所属連結)で「区切り文字が無く直接連結しているため機械分離できない」として
// 対象外のまま残されていた行を追跡するratchetゲート。
//
// このPRでの対応: scripts/build-kick-data.tsのsplitOpponentGymSuffix()に、
// (1) 区切り文字の異体字3種(半角中点･・中黒·・ビュレット•)を追加、
// (2) 区切り文字が無くても末尾が既知の固定ジム名(センチャイジム/センチャジム/
//     ヨックタイジム/K.T.ジム/KTジム)と完全一致する場合は辞書的に境界を認める、
// の2点を追加し、56件中42件を解消した(2026-08時点)。
//
// 残る14件(ユニーク8名義)は、(a) 未知のジム名で辞書に無いもの(3件)、(b) 「ジム」が
// 外国人選手のファーストネームの一部で実際には所属の連結ではないもの(3件、誤って
// 別人の所属を捏造しないよう意図的に分割しない)、(c) PR-18で「文字化け・対応不要」と
// 既に確定しているもの(1件)、を含む。これらは無理に分割せず、原文のまま表示する
// (推測で境界を作らない、というSCHEMA.mdの既存方針を踏襲)。
//
// このゲートは「ゼロ件」を要求しない。新しいジム名の連結パターンが増えたら気づける
// ようにするための検知網(ratchet、増加でビルド失敗)。
//
// 実行方法: npx tsx scripts/check-kick-opponent-gym-suffix-gate.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");
const BASELINE_PATH = path.join(ROOT, "data/kick/kickOpponentGymSuffixBaseline.json");

const GYM_SUFFIX_KEYWORD_RE = /ジム|道場|塾|GYM|Gym|gym|Team|TEAM|team|Club|CLUB|club|協会|会館/g;

interface Hit {
  slug: string;
  date: string | null;
  opponentName: string;
}

const hits: Hit[] = [];
const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));

for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    const n: string = b.opponentName ?? "";
    if (GYM_SUFFIX_KEYWORD_RE.test(n)) {
      GYM_SUFFIX_KEYWORD_RE.lastIndex = 0;
      hits.push({ slug: f.slug, date: b.date, opponentName: n });
    }
  }
}

console.log(
  `[kick-opponent-gym-suffix] 対戦相手欄に所属語を含みながら未分離の行 = ${hits.length}件` +
    `(ユニーク表記${new Set(hits.map((h) => h.opponentName)).size}件)`,
);

const prevBaseline: number = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).count
  : hits.length;

if (hits.length > prevBaseline) {
  console.error(
    `[kick-opponent-gym-suffix] ★未分離の行が前回ビルド時点の基準(${prevBaseline}件)から` +
      `${hits.length}件に増加しました。デプロイをブロックします:\n` +
      hits
        .slice(0, 30)
        .map((h) => `  - ${h.slug}: ${h.date ?? "date不明"} / opponentName="${h.opponentName}"`)
        .join("\n") +
      `\n  対処法: scripts/build-kick-data.tsのsplitOpponentGymSuffix()に、確認済みの` +
      `固定ジム名であればKNOWN_GYM_SUFFIX_TOKENSへ追加してください。`,
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ count: hits.length }, null, 1) + "\n");
console.log(`[kick-opponent-gym-suffix] OK(${hits.length}件、基準${prevBaseline}件以下)`);
