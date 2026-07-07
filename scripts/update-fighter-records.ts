// 定期実行(GitHub Actions)でWikipediaから選手戦績を取得し、data/fighterRecords.json に
// 焼き込む。getVisibleFighters()・各表示ページはこのJSONを読むだけにして、
// リクエスト時のライブfetchを無くす(可視選手数がリクエストごとに変動する問題の恒久対策)。
//
// 失敗時は前回値を保持(update-org-rankings.tsと同じ思想)。一度取れた戦績を、
// 次回fetch失敗で「データなし」に倒さない。selectors.tsの選手データ本体は一切書き換えない。
//
// 実行: npx tsx scripts/update-fighter-records.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { resolveFighter } from "../src/lib/feeds/resolveFighter";
import type { FighterRecordEntry, FighterRecordsFile } from "../src/lib/fighterRecordsCache";

const OUT = path.join(process.cwd(), "data", "fighterRecords.json");

function toCacheEntry(r: Awaited<ReturnType<typeof resolveFighter>>): FighterRecordEntry {
  return {
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    ko: r.ko,
    sub: r.sub,
    decision: r.decision,
    history: r.history,
    live: r.live,
    ...(r.nickname ? { nickname: r.nickname } : {}),
    ...(r.birthPlace ? { birthPlace: r.birthPlace } : {}),
    ...(r.age !== undefined ? { age: r.age } : {}),
    ...(r.noRecordData ? { noRecordData: true } : {}),
  };
}

// Wikipedia側のレート制限に当たると同時実行数が多いほど失敗しやすい(実測: 5並列で
// 168人中76人が失敗したが、個別に単発実行すると同じ選手が普通に成功する)。
// そのため取得は直列(1件ずつ)・失敗時は間隔を空けて数回リトライする。
async function resolveWithRetry(f: Fighter, retries = 3): Promise<ReturnType<typeof resolveFighter> extends Promise<infer T> ? T : never> {
  let r = await resolveFighter(f);
  for (let i = 0; i < retries && r.noRecordData; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await resolveFighter(f);
  }
  return r;
}

async function main() {
  const prev: FighterRecordsFile = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, "utf8"))
    : {};

  const targets = FIGHTERS.filter((f) => !f.hidden);
  const out: FighterRecordsFile = {};
  const failedNoFallback: string[] = [];
  const failedKeptPrev: string[] = [];

  for (const f of targets) {
    const r = await resolveWithRetry(f);
    const isBad = !!r.noRecordData;
    const prevEntry = prev[f.slug];
    const prevWasGood = !!prevEntry && !prevEntry.noRecordData;

    if (isBad && prevWasGood) {
      out[f.slug] = prevEntry;
      failedKeptPrev.push(f.slug);
    } else {
      out[f.slug] = toCacheEntry(r);
      if (isBad) failedNoFallback.push(f.slug);
    }
    // 選手間にも軽くウェイトを入れて連続fetchの負荷を下げる。
    await new Promise((res) => setTimeout(res, 200));
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  const visibleCount = Object.values(out).filter((r) => !r.noRecordData).length;
  console.log(`対象: ${targets.length}人 / 可視(noRecordData以外): ${visibleCount}人`);
  if (failedKeptPrev.length) {
    console.log(`今回取得失敗・前回値を保持(${failedKeptPrev.length}人): ${failedKeptPrev.join(", ")}`);
  }
  if (failedNoFallback.length) {
    console.log(`今回取得失敗・前回値なしのためデータなし(${failedNoFallback.length}人): ${failedNoFallback.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
