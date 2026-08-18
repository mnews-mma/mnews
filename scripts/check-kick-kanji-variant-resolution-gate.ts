// T-4(2026-08、名前解決失敗の分離と表記ゆれ修正): 旧字体/異体字の変換表(ingest_*.py群・
// bouts.pyのnk()に実装、10ファイルで同期)を適用すれば一意に解決できるはずの対戦相手名が、
// 未解決(opponent_resolved:false)のまま残っていないかをビルド時にゼロ件で検知するゲート。
//
// 背景: opponent_resolved:false 約5,957件を機械的に分類したところ、512件が「編集距離1の
// 候補が名簿に存在する」候補だったが、その大半(佐藤亮→佐藤匠、久保孝太→久保優太等)は
// 単に漢字1文字が似ているだけの**別人**であり、機械的に統合すると誤結合になることを
// 個別確認で突き止めた。安全に統合できたのは、読み・字義が完全に同一と確認できる
// 旧字体/異体字ペア(崎/﨑・高/髙・国/國・実/實・弍/弐・凛/凜・斎/齋・竜/龍、
// および長音記号の異体ー/―)に限られ、63件を修正した。詳細は
// out/kick-name-resolution-split-report.md参照。
//
// data/kick/bouts_*.json(パーサの生出力、resolve()が実際に見る値)を直接読む。
// data/kick/generated/を経由しない(build-kick-data.tsの表示用クリーンアップ後の値は、
// 相手欄が壊れた生表記〈例:「志 朗（BeWELLキックボクシングジム」のような未閉括弧〉を
// 表示上だけ整形してしまい、実際の名寄せ入力とズレて誤検知するため。この食い違い自体は
// 別の既知バグ〈相手欄の括弧閉じ忘れパース漏れ〉であり、本ゲートのスコープ外)。
//
// このゲートは「変換表自体が壊れていないか」をビルドごとに再検証する多重防御であり、
// ゼロ件不変条件(ratchetではない)。変換表を拡張する場合は、このゲートで新たに
// ヒットする行が「本当に同一人物か」を個別確認してから追加すること(機械的な
// 編集距離だけで安全側に倒してはいけない、という教訓を反映した設計)。
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data/kick");

// ingest_*.py群のnk()と同一の変換表(意図的に同期させている)。
const KANJI_VARIANT_PAIRS: [string, string][] = [
  ["﨑", "崎"],
  ["髙", "高"],
  ["國", "国"],
  ["實", "実"],
  ["弍", "弐"],
  ["凜", "凛"],
  ["齋", "斎"],
  ["龍", "竜"],
  ["―", "ー"],
];
const CANON = new Map<string, string>();
for (const [a, b] of KANJI_VARIANT_PAIRS) {
  CANON.set(a, b);
}

function nk(s: string): string {
  const nfkc = s.normalize("NFKC");
  const stripped = nfkc.replace(/[“”"'’‘`「」『』]/g, "");
  const noSpace = stripped.replace(/\s+/g, "").replace(/・/g, "").replace(/=/g, "").toLowerCase();
  return Array.from(noSpace)
    .map((c) => CANON.get(c) ?? c)
    .join("");
}

interface Fighter {
  name: string;
  aliases: string[];
}
interface Bout {
  fighter_slug: string;
  date: string | null;
  opponent_name: string;
  opponent_resolved: boolean;
  opponent_ambiguous: boolean;
}

const fighters: Fighter[] = JSON.parse(fs.readFileSync(path.join(SRC, "fighters.json"), "utf8"));
const byNormName = new Map<string, Set<string>>();
for (const f of fighters) {
  for (const n of [f.name, ...f.aliases]) {
    const key = nk(n);
    if (!key) continue;
    if (!byNormName.has(key)) byNormName.set(key, new Set());
    byNormName.get(key)!.add(f.name);
  }
}

const SOURCES: { tag: string; file: string }[] = [
  { tag: "K-1/Krush/Krush-EX", file: "bouts_k1.json" },
  { tag: "RISE", file: "bouts_rise.json" },
  { tag: "SHOOT BOXING", file: "bouts_sb.json" },
  { tag: "KNOCK OUT", file: "bouts_knockout.json" },
  { tag: "NJKF", file: "bouts_njkf.json" },
  { tag: "DEEP☆KICK", file: "bouts_deepkick.json" },
  { tag: "HoostCup", file: "bouts_hoostcup.json" },
  { tag: "KROSS×OVER", file: "bouts_krossover.json" },
  { tag: "NKB", file: "bouts_nkb.json" },
  { tag: "Stand up", file: "bouts_standup.json" },
  { tag: "JKA", file: "bouts_jka.json" },
  { tag: "SNKA", file: "bouts_snka.json" },
  { tag: "Bigbang", file: "bouts_bigbang.json" },
];

interface Violation {
  tag: string;
  fighterSlug: string;
  date: string | null;
  opponentName: string;
  matchedFighter: string;
}

const violations: Violation[] = [];
for (const { tag, file } of SOURCES) {
  const bouts: Bout[] = JSON.parse(fs.readFileSync(path.join(SRC, file), "utf8"));
  for (const b of bouts) {
    if (b.opponent_resolved || b.opponent_ambiguous) continue;
    const key = nk(b.opponent_name ?? "");
    if (!key) continue;
    const matches = byNormName.get(key);
    if (matches && matches.size === 1) {
      violations.push({
        tag,
        fighterSlug: b.fighter_slug,
        date: b.date,
        opponentName: b.opponent_name,
        matchedFighter: Array.from(matches)[0],
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `[kick-kanji-variant-resolution] ★旧字体/異体字変換表を適用すれば一意に解決できる` +
      `対戦相手名が${violations.length}件、未解決のまま残っていました。デプロイをブロックします:\n` +
      violations
        .slice(0, 20)
        .map(
          (v) =>
            `  - ${v.fighterSlug} [${v.tag}] (${v.date ?? "date null"}): opponent_name="${v.opponentName}" -> "${v.matchedFighter}"`,
        )
        .join("\n"),
  );
  process.exit(1);
}

console.log("[kick-kanji-variant-resolution] OK(旧字体/異体字変換表の適用漏れ0件)");
