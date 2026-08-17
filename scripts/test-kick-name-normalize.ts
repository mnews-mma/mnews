// PR-G(2026-08-17): src/lib/kick/nameNormalize.ts の normalizeKickName() が、
// 統一のきっかけになった表記ゆれを実際に吸収できることを固定する回帰テスト。
// フルテストフレームワークは使わず、簡易アサーションで既知の壊れ方を再現する
// (scripts/test-event-countdown.ts等の既存test:*スクリプトと同じ形式)。
//
// 実行方法: npx tsx scripts/test-kick-name-normalize.ts
import { normalizeKickName } from "../src/lib/kick/nameNormalize";

let failures = 0;
function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    failures++;
    console.error(`✗ ${label}: expected="${expected}" actual="${actual}"`);
  } else {
    console.log(`✓ ${label}`);
  }
}
function assertSame(a: string, b: string, label: string) {
  assertEqual(normalizeKickName(a), normalizeKickName(b), label);
}
function assertDifferent(a: string, b: string, label: string) {
  if (normalizeKickName(a) === normalizeKickName(b)) {
    failures++;
    console.error(`✗ ${label}: "${a}" と "${b}" が同一に正規化されてしまう("${normalizeKickName(a)}")`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// PR-G調査(2026-08-17)で実際に発見した「岩崎 悠斗」(半角スペース+旧字体「﨑」なし表記)と
// fighters.jsonの表記名「岩﨑悠斗」(旧字体「﨑」使用)が、統一前のnormNameでは不一致だった
// 実例。異体字統一が無いと相手名寄せが失敗する。
assertSame("岩﨑悠斗", "岩崎 悠斗", "旧字体(﨑→崎)+半角スペースの統一で相手名寄せが一致する");

// 全角スペース・全角英数字の統一(NFKC)。
assertSame("SAHO　太郎", "SAHO 太郎", "全角/半角スペースの統一");
assertSame("Ａｋｉｒａ", "Akira", "全角/半角英数字の統一(NFKC)");

// 中黒(全角・半角)の統一。
assertSame("ロッキー・マルティネス", "ロッキー･マルティネス", "中黒(全角・/半角･)の統一");

// 引用符類(ニックネーム囲み)の除去。stripQuotedNickname(内容ごと除去)とは別に、
// normalizeKickName自体は記号だけを剥がす(内容は残す)。
assertSame(`"AKIRA"`, "AKIRA", "引用符(ダブルクォート)の除去");
assertSame("“AKIRA”", "AKIRA", "引用符(全角スマートクォート)の除去");

// 異体字は別人の同名衝突を作らないことも確認する(統一しすぎない)。
assertDifferent("田中太郎", "田中次郎", "似ていない名前まで誤って同一視しない");

if (failures > 0) {
  console.error(`\n[test:kick-name-normalize] ${failures}件失敗しました。`);
  process.exit(1);
}
console.log("\n[test:kick-name-normalize] OK(全件成功)");
