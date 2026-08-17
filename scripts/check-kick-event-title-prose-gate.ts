// PR-G追補(2026-08、表示層混入監査、項目4-1): 大会名(event)フィールドに、大会名ではなく
// レポート記事内の地の文(散文)が紛れ込んでいないかを検知するゼロ件ゲート。
//
// 実例(この監査で発見・修正): data/kick/bouts_deepkick.json の10行で、大会名が
// 「いつでもやってやる。でも今日の試合内容では、次も俺の1ラウンドKO勝ち」という、
// 63kg王者山口裕人が試合後のマイクで発した"引用符付きの発言"になっていた
// (出典: deep-kick.com/posts/4233860、正しい大会名は「DEEP☆KICK 27」)。
// scripts/standup-pipeline/ingest_deepkick.py の extract_event_name() が、記事本文
// 冒頭8行以内に現れる最初の『...』(二重かぎ括弧)をそのまま大会名として採用する実装で、
// 今回はその括弧が偶然「選手の発言」を囲んでいたため誤って抽出された。
//
// 検出ロジック: event フィールド中に句点「。」が**末尾以外の位置**に出現する行を候補とする
// (大会名・トーナメント名は名詞句であり、「。」で文が続く構造は通常取らない)。
// 全DB走査の結果、この条件に該当したのは2件のみで、うち1件(NJKF「NJKF王者たちよ。俺か？
// おまえ達か？"真の主役"は誰だ？！」)はNJKF公式サイト自身がこの扇情的なフレーズを
// 大会ページの<title>としてそのまま使っている**正当な大会名**であることを確認済み
// (njkf.info本文で確認)。誤検知を避けるため、確認済みの正当な大会名は下記
// ALLOWLIST に個別登録し、それ以外の新規該当行はすべて違反として扱う。
//
// 実行方法: npx tsx scripts/check-kick-event-title-prose-gate.ts
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const GEN = path.join(ROOT, "data/kick/generated");

// 確認済みの正当な大会名(扇情的なタイトルだが一次資料で大会名そのものと確認済み)。
// 新たに該当行が見つかった場合は、まず一次資料(出典サイト)で大会名かレポート散文かを
// 確認し、大会名であればここに追記、散文であればbouts_*.jsonのevent値を修正すること。
const ALLOWLIST = new Set<string>(['NJKF王者たちよ。俺か？おまえ達か？”真の主役”は誰だ？！']);

interface Violation {
  slug: string;
  date: string | null;
  event: string;
}

const violations: Violation[] = [];
const fighterFiles = fs.readdirSync(path.join(GEN, "fighters"));

for (const file of fighterFiles) {
  const f = JSON.parse(fs.readFileSync(path.join(GEN, "fighters", file), "utf8"));
  for (const b of f.bouts as any[]) {
    const event: string = b.event ?? "";
    const idx = event.indexOf("。");
    if (idx === -1 || idx === event.length - 1) continue; // 句点なし、または文末の句点は対象外
    if (ALLOWLIST.has(event)) continue;
    violations.push({ slug: f.slug, date: b.date, event });
  }
}

if (violations.length > 0) {
  console.error(
    `[kick-event-title-prose] ★大会名フィールドに散文(レポート記事の地の文・発言引用等)が` +
      `混入している疑いのある行が${violations.length}件見つかりました。デプロイをブロックします:\n` +
      violations.map((v) => `  - ${v.slug}: ${v.date ?? "date不明"} / event="${v.event}"`).join("\n") +
      `\n  対処法: 出典サイトで正しい大会名を確認し、data/kick/bouts_*.jsonのevent値を修正するか、` +
      `一次資料で確認済みの正当な大会名であればこのファイルのALLOWLISTに追記してください。`,
  );
  process.exit(1);
}

console.log("[kick-event-title-prose] OK(大会名への散文混入0件)");
