// PR-G(2026-08-17): #562(和島大海の欠落5試合、Wikipedia結合キー不一致+ニックネーム重複バグ)
// で実際に起きた壊れ方 — 「木村"フィリップ"ミノル」(K-1公式、ニックネーム引用符入り)と
// 「木村ミノル」(Wikipedia側、ニックネーム抜き)が同一試合として統合されず二重計上されていた
// — を再現し、scripts/build-kick-data.ts の stripQuotedNickname() +
// src/lib/kick/nameNormalize.ts の normalizeKickName() の組み合わせで正しく同一試合と
// 判定できることを固定する回帰テスト。
//
// 実行方法: npx tsx scripts/test-kick-nickname-dedupe.ts
import { stripQuotedNickname } from "./build-kick-data";
import { normalizeKickName } from "../src/lib/kick/nameNormalize";

let failures = 0;
function assertSame(a: string, b: string, label: string) {
  const na = normalizeKickName(stripQuotedNickname(a));
  const nb = normalizeKickName(stripQuotedNickname(b));
  if (na !== nb) {
    failures++;
    console.error(`✗ ${label}: "${a}"→"${na}" と "${b}"→"${nb}" が一致しない`);
  } else {
    console.log(`✓ ${label}`);
  }
}
function assertDifferent(a: string, b: string, label: string) {
  const na = normalizeKickName(stripQuotedNickname(a));
  const nb = normalizeKickName(stripQuotedNickname(b));
  if (na === nb) {
    failures++;
    console.error(`✗ ${label}: "${a}" と "${b}" が誤って同一試合と判定されてしまう`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// #562の実例そのもの: K-1公式(ニックネーム引用符入り)とWikipedia側(ニックネーム抜き)。
assertSame(
  '木村"フィリップ"ミノル',
  "木村ミノル",
  "#562実例: ダブルクォート型ニックネームの有無だけの表記ゆれを同一試合と判定する",
);
// 全角スマートクォート版(build-kick-data.tsのQUOTE_PAIRSに含まれる別の引用符ペア)。
assertSame(
  "アンドリュー“KEN”ブリュースター",
  "アンドリューブリュースター",
  "全角スマートクォート型ニックネームの有無だけの表記ゆれを同一試合と判定する",
);

// 別人までニックネーム除去だけで同一視しない(安全側の確認)。
assertDifferent('田中"エース"太郎', "佐藤太郎", "ニックネームを剥がしても別人の名前は別人のまま");

if (failures > 0) {
  console.error(`\n[test:kick-nickname-dedupe] ${failures}件失敗しました。`);
  process.exit(1);
}
console.log("\n[test:kick-nickname-dedupe] OK(全件成功)");
