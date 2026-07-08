// 戦績(大会結果・開催予定)に登場する対戦相手名のうち、どの選手にも一致しない
// 名前を棚卸しする。別名(aliases)不足・未登録選手・表記ゆれの発見用QAツール。
// 本番ビルド/デプロイには組み込まない(任意実行のスタンドアロンスクリプト)。
//
// 実行: npx tsx scripts/audit-unmatched-opponents.ts
import { EVENT_RESULTS } from "../src/lib/eventResults";
import { EVENTS } from "../src/lib/events";
import { findFighterSlugByName } from "../src/lib/fighters";

function collectOpponentNames(): Map<string, Set<string>> {
  // 名前 -> 出現元(イベント名)のセット
  const names = new Map<string, Set<string>>();
  const add = (name: string, source: string) => {
    if (!name) return;
    if (!names.has(name)) names.set(name, new Set());
    names.get(name)!.add(source);
  };
  for (const e of EVENT_RESULTS) {
    for (const f of e.fights) {
      add(f.fighterA, e.eventName);
      add(f.fighterB, e.eventName);
    }
  }
  for (const e of EVENTS) {
    for (const b of e.bouts) {
      if (b.fighterA) add(b.fighterA, e.eventName);
      if (b.fighterB) add(b.fighterB, e.eventName);
    }
    for (const n of e.expectedFighters ?? []) add(n, e.eventName);
  }
  return names;
}

function main() {
  const names = collectOpponentNames();
  const unmatched: { name: string; sources: string[] }[] = [];
  for (const [name, sources] of names) {
    if (!findFighterSlugByName(name)) {
      unmatched.push({ name, sources: [...sources] });
    }
  }
  unmatched.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  console.log(`総対戦相手名: ${names.size} 件 / 未一致: ${unmatched.length} 件\n`);
  for (const u of unmatched) {
    console.log(`- ${u.name}  (${u.sources.slice(0, 3).join(" / ")}${u.sources.length > 3 ? " ほか" : ""})`);
  }
}

main();
