// data/archive.json に既に保存済みのURLからutm_*/fbclid/gclidを除去する
// 一回限りの移行スクリプト(集約側の正規化はsrc/lib/feeds/aggregate.tsの
// stripTrackingParamsで対応済み。既存データはそちらを通らないため別途実行)。
// 正規化後にURLが衝突するケースがある(同一記事がパラメータ違いで複数保存
// されていた場合)ため、publishedAtが新しい方を残して再重複排除する。
//
// 実行: npx tsx scripts/strip-tracking-params-migration.ts
import fs from "fs";
import path from "path";
import type { Article } from "../src/lib/articles";

const ARCHIVE_PATH = path.join(process.cwd(), "data", "archive.json");

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_NAMES = new Set(["fbclid", "gclid"]);

function stripTrackingParams(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const toDelete: string[] = [];
  u.searchParams.forEach((_, key) => {
    if (TRACKING_PARAM_NAMES.has(key) || TRACKING_PARAM_PREFIXES.some((p) => key.startsWith(p))) {
      toDelete.push(key);
    }
  });
  toDelete.forEach((key) => u.searchParams.delete(key));
  return u.toString();
}

function main() {
  const existing: Article[] = JSON.parse(fs.readFileSync(ARCHIVE_PATH, "utf8"));

  let changedCount = 0;
  const normalized = existing.map((a) => {
    const cleaned = stripTrackingParams(a.url);
    if (cleaned !== a.url) changedCount++;
    return { ...a, url: cleaned };
  });

  // 正規化で衝突したURLはpublishedAtが新しい方を残す
  const byUrl = new Map<string, Article>();
  for (const a of normalized) {
    const prev = byUrl.get(a.url);
    if (!prev || new Date(a.publishedAt).getTime() > new Date(prev.publishedAt).getTime()) {
      byUrl.set(a.url, a);
    }
  }
  const deduped = Array.from(byUrl.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  console.log(`正規化対象: ${changedCount}件 / 全${existing.length}件`);
  console.log(`正規化後の重複除去: ${existing.length - deduped.length}件削減 (${existing.length} → ${deduped.length})`);

  fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(deduped, null, 2) + "\n");
  console.log("data/archive.json を更新しました。");
}

main();
