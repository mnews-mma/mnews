// 定期実行（GitHub Actions）でその時点の記事一覧を取得し、リポジトリ内の
// data/archive.json に追記保存するスクリプト。過去記事の閲覧用アーカイブを
// 「今日から」少しずつ蓄積するためのもの（バックフィルは行わない）。
//
// 実行: npx tsx scripts/archive-articles.ts
import fs from "fs";
import path from "path";
import { fetchRawArticles } from "../src/lib/feeds/aggregate";
import type { Article } from "../src/lib/articles";

const ARCHIVE_PATH = path.join(process.cwd(), "data", "archive.json");
const MAX_ARCHIVE_SIZE = 5000; // 無限に増え続けないようにする上限

async function main() {
  const { articles } = await fetchRawArticles();

  const existing: Article[] = fs.existsSync(ARCHIVE_PATH)
    ? JSON.parse(fs.readFileSync(ARCHIVE_PATH, "utf8"))
    : [];

  const seen = new Set(existing.map((a) => a.url));
  // 初回検知時刻を「今このスクリプトが新規として拾った時刻」で刻む。
  // BREAKINGの失効判定（検知から4時間）はこの firstSeenAt を起点にする。
  const now = new Date().toISOString();
  const newOnes = articles
    .filter((a) => !seen.has(a.url))
    .map((a) => ({ ...a, firstSeenAt: a.firstSeenAt ?? now }));

  if (newOnes.length === 0) {
    console.log("新着記事なし。");
    return;
  }

  const merged = [...existing, ...newOnes]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_ARCHIVE_SIZE);

  fs.mkdirSync(path.dirname(ARCHIVE_PATH), { recursive: true });
  fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(merged, null, 2) + "\n");

  console.log(`新着 ${newOnes.length} 件を追加。アーカイブ合計 ${merged.length} 件。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
