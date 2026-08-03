// 船田電池(funada-denchi)のパンクラス戦績3件が未反映だった原因の修正。
//
// data/pancraseRecords.json には該当3boutが本名表記「船田侃志」
// (プロフィールURL stem: funadakanji.html)で既に正しく記録されているが、
// fighters.tsのnameJa「船田電池」(リングネーム)と文字列が一致しないため
// fighterASlug/fighterBSlug/winnerSlugがnullのまま残っていた。
//
// fighters.tsにalias「船田侃志」を追加済み(次回のdata/pancraseRecords.json
// 再生成時はこれで自動解決される)。本スクリプトは、既存JSON側の3件を
// 直接パッチする(全418大会の再スクレイピングは行わない)。
//
// 対象3件(いずれも「船田侃志」の勝利、leftUrl/rightUrlがfunadakanji.htmlで
// 一致することを確認済み):
//   2024-02-25 PANCRASE BLOOD.2   船田侃志 vs 日向優希
//   2024-05-25 PANCRASE 343       織部修也 vs 船田侃志(第30回ネオブラッドトーナメント決勝)
//   2024-09-29 PANCRASE 347       野田遼介 vs 船田侃志
//
// 対戦相手側(野田遼介/織部修也/日向優希)のslugは今回のスコープ外のため変更しない。
//
// 実行: npx tsx scripts/backfill-funada-denchi-pancrase-slugs.ts
import fs from "fs";
import path from "path";
import { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";

const FILE = path.join(process.cwd(), "data", "pancraseRecords.json");
const TARGET_SLUG = "funada-denchi";
const TARGET_NAME = "船田侃志";
const TARGET_PROFILE_URL_FRAGMENT = "funadakanji.html";

function main() {
  const events: PancraseRecordsEvent[] = JSON.parse(fs.readFileSync(FILE, "utf8"));

  let patched = 0;
  for (const ev of events) {
    for (const b of ev.bouts) {
      const isA = b.fighterAName === TARGET_NAME && b.leftUrl?.includes(TARGET_PROFILE_URL_FRAGMENT);
      const isB = b.fighterBName === TARGET_NAME && b.rightUrl?.includes(TARGET_PROFILE_URL_FRAGMENT);
      if (!isA && !isB) continue;

      if (isA) {
        if (b.fighterASlug !== null) throw new Error(`想定外: 既にslug解決済み(${ev.date} ${b.fighterAName})`);
        b.fighterASlug = TARGET_SLUG;
      } else {
        if (b.fighterBSlug !== null) throw new Error(`想定外: 既にslug解決済み(${ev.date} ${b.fighterBName})`);
        b.fighterBSlug = TARGET_SLUG;
      }
      if (b.winnerName === TARGET_NAME) {
        if (b.winnerSlug !== null) throw new Error(`想定外: winnerSlug既に設定済み(${ev.date})`);
        b.winnerSlug = TARGET_SLUG;
      }
      patched++;
      console.log(`[patch] ${ev.date} ${ev.eventName}: ${b.fighterAName} vs ${b.fighterBName}`);
    }
  }

  if (patched !== 3) {
    console.error(`[ERROR] 期待件数3件に対し${patched}件パッチ。想定外の件数のため書き込みを中止。`);
    process.exit(1);
  }

  fs.writeFileSync(FILE, JSON.stringify(events, null, 2) + "\n");
  console.log(`[OK] ${patched}件パッチ完了`);
}

main();
