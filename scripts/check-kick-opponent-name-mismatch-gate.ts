// PR-G追補(2026-08、サンチャイ・TEPPENGYM対戦相手誤分割監査): 対戦相手欄の表示名が、
// 実際に解決されたリンク先選手の名簿登録名と食い違っていないかを検知するゼロ件ゲート。
//
// 実例(この監査で発見・修正): 「サンチャイ・TEPPENGYM」(TEAM TEPPEN)のように、
// 選手本人のリングネーム自体にGYM/ジム等の語を含む選手が対戦相手として表示される際、
// scripts/build-kick-data.tsのsplitOpponentGymSuffix()がそのリングネームを
// 「人名+所属の連結」と誤認して分割していた(例:「サンチャイ・TEPPEN」+所属「GYM」)。
// opponentSlugは正しく解決されているため見た目のリンク自体は機能していたが、
// **表示されるテキスト自体が実在の選手名と一致しない**という状態だった
// (全DB調査で同型216行を確認、修正詳細はout/kick-sanchai-teppengym-*.md参照)。
//
// このゲートは、既存のscripts/check-kick-opponent-gym-suffix-gate.ts
// (PR #567新設。「分割語がまだ残っている」=**分割不足**を検知するratchet)とは
// **逆方向**の検知を行う: opponentSlugが解決済みの行について、表示名
// (opponentName、GYMの連結を除いて突合)が解決先選手の名簿登録名と一致しない場合を
// 検知する(=**分割しすぎ/誤分割**によって実在の選手名を壊していないか)。
// 両ゲートは重複しない設計(片方は「残存」、もう片方は「食い違い」を見る)。
//
// 実行方法: npx tsx scripts/check-kick-opponent-name-mismatch-gate.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");
const BASELINE_PATH = path.join(ROOT, "data/kick/kickOpponentNameMismatchBaseline.json");

const norm = (s: string) => s.replace(/[\s　]/g, "");

const index = JSON.parse(fs.readFileSync(path.join(GEN, "index.json"), "utf8"));
const nameBySlug = new Map<string, string>(
  (index.fighters as { slug: string; name: string }[]).map((f) => [f.slug, f.name]),
);

interface Mismatch {
  slug: string;
  date: string | null;
  opponentSlug: string;
  displayedName: string;
  registeredName: string;
}

const mismatches: Mismatch[] = [];
const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));

// このゲートが対象にするのは「表示名が登録名の**先頭一致の切り詰め**であり、
// 切り詰められた残りの部分にGYM/ジム等の所属語が含まれる」という、
// splitOpponentGymSuffix()の誤爆に特有の形だけに絞る。表記ゆれ・引用符・異体字・
// 改名/alias解決による別表記等(このゲートの対象外の既知の別事象)は誤検知しないよう
// 除外する(先頭一致かつ残りが所属語を含む、という条件を満たさないものは無視する)。
const GYM_SUFFIX_KEYWORD_RE = /ジム|道場|塾|GYM|Gym|gym|Team|TEAM|team|Club|CLUB|club|協会|会館/;

for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    if (!b.opponentSlug) continue;
    const registeredName = nameBySlug.get(b.opponentSlug);
    if (!registeredName) continue; // 名簿に無いslugは別の異常(構造的に起こらないはずだが念のためスキップ)
    const displayed = b.opponentName ?? "";
    const nReg = norm(registeredName);
    const nDisp = norm(displayed);
    if (nReg === nDisp) continue;
    if (!nDisp || !nReg.startsWith(nDisp)) continue; // 先頭一致の切り詰めでなければ対象外(改名・表記ゆれ等)
    const rest = nReg.slice(nDisp.length);
    if (!GYM_SUFFIX_KEYWORD_RE.test(rest)) continue; // 切り詰められた部分に所属語が無ければ対象外
    mismatches.push({
      slug: f.slug,
      date: b.date,
      opponentSlug: b.opponentSlug,
      displayedName: displayed,
      registeredName,
    });
  }
}

console.log(`[kick-opponent-name-mismatch] 検出${mismatches.length}件`);

const prevBaseline: number = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).count
  : mismatches.length;

if (mismatches.length > prevBaseline) {
  console.error(
    `[kick-opponent-name-mismatch] ★対戦相手の表示名が解決先選手の登録名と食い違っている行が` +
      `前回ビルド時点の基準(${prevBaseline}件)から${mismatches.length}件に増加しました。` +
      `デプロイをブロックします:\n` +
      mismatches
        .slice(0, 30)
        .map(
          (m) =>
            `  - ${m.slug}: ${m.date ?? "date不明"} / 表示="${m.displayedName}" ≠ 登録名="${m.registeredName}"` +
            `(→${m.opponentSlug})`,
        )
        .join("\n") +
      `\n  対処法: scripts/build-kick-data.tsのsplitOpponentGymSuffix()の適用条件` +
      `(opponent_affiliation有無・KNOWN_FIGHTER_NAMES)を確認してください。`,
  );
  process.exit(1);
}

fs.writeFileSync(BASELINE_PATH, JSON.stringify({ count: mismatches.length }, null, 1) + "\n");
console.log(`[kick-opponent-name-mismatch] OK(${mismatches.length}件、基準${prevBaseline}件以下)`);
