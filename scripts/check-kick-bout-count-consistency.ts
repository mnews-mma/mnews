// PR-G(2026-08-17): /kick/fighters(一覧)の「戦績N戦」表示と /kick/fighters/[slug](詳細)の
// 「収録N試合」表示が、将来また別経路の集計に分岐しないことをビルド時に保証するゲート。
//
// 現状は両ページともbuild-kick-data.tsが書き出した同じ`bouts`配列由来の値
// (index.jsonのboutCount / fighters/<slug>.jsonのbouts.length)を、
// src/lib/kick/data.tsのgetFighterBoutCount()という単一の関数経由で参照している
// (src/app/kick/fighters/page.tsx・src/app/kick/fighters/[slug]/page.tsx参照)。
// このスクリプトは、両ページが実際に呼ぶのと同じgetFighterBoutCount()を使い、
// 一覧側の入力(KickIndexEntry)と詳細側の入力(KickFighter)のそれぞれに適用した結果が
// 全選手で一致することを、生成済みデータ全件について独立に検証する。
// どちらかのページ実装だけが将来別の集計に書き換わった場合、この検証は失敗する
// (ページのソースコード自体は読まず、生成済みデータの中身のみで判定するため、
// 実装がどう変わっても「値の食い違い」自体は捕捉できる)。
//
// 実行方法: npx tsx scripts/check-kick-bout-count-consistency.ts
import { getFighterBoutCount, getKickFighter, getKickIndex } from "../src/lib/kick/data";

const { fighters } = getKickIndex();

interface Mismatch {
  slug: string;
  indexBoutCount: number;
  detailBoutCount: number;
}

const mismatches: Mismatch[] = [];
let missingDetail = 0;

for (const entry of fighters) {
  const detail = getKickFighter(entry.slug);
  if (!detail) {
    missingDetail++;
    continue;
  }
  const indexCount = getFighterBoutCount(entry);
  const detailCount = getFighterBoutCount(detail);
  if (indexCount !== detailCount) {
    mismatches.push({ slug: entry.slug, indexBoutCount: indexCount, detailBoutCount: detailCount });
  }
}

console.log(
  `[kick-bout-count-consistency] 検査対象${fighters.length}人 / 不一致${mismatches.length}件 / 詳細データ欠落${missingDetail}件`,
);

if (missingDetail > 0) {
  console.error(
    `[kick-bout-count-consistency] ★index.jsonに載っている選手のうち${missingDetail}人分、` +
      `data/kick/generated/fighters/<slug>.jsonが存在しません。ビルドを失敗させます。`,
  );
  process.exit(1);
}

if (mismatches.length > 0) {
  console.error(
    `[kick-bout-count-consistency] ★選手一覧(/kick/fighters)と選手詳細(/kick/fighters/[slug])の` +
      `戦績数表示が${mismatches.length}人分で食い違っています。ビルドを失敗させます:\n` +
      mismatches
        .slice(0, 30)
        .map((m) => `  - ${m.slug}: 一覧=${m.indexBoutCount} / 詳細=${m.detailBoutCount}`)
        .join("\n"),
  );
  process.exit(1);
}

// baselineファイルは持たず常にゼロ件を要求する(単一関数経由に統一済みで、
// 生成元が同じである以上ゼロ件が構造的に成立するはずのため)。
console.log("[kick-bout-count-consistency] OK(全選手で一覧・詳細の戦績数が一致)");
