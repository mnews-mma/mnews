// PR-G(2026-08-17): scripts/build-kick-data.ts の splitOpponentGymSuffix() が、
// PR-9(検査C3・相手名への所属連結、306件)で実際に修正された壊れ方を再発させないことを
// 固定する回帰テスト。相手名(opponent_name)の末尾に所属らしき語が区切り文字を挟んで
// 連結している行(例:「サンチャイ・TEPPEN GYM」)を人名/所属へ正しく分割できるかを検証する。
//
// 実行方法: npx tsx scripts/test-kick-gym-suffix-split.ts
//
// 注意: build-kick-data.ts はimportされた時点でトップレベルのビルド処理(data/kick/*.json
// の読み込み・data/kick/generated/への書き出し)を実行する。package.json の build チェーンでは
// このテストの前に必ず `npm run kick:data` が走るため、副作用としての再実行は無害
// (冪等)だが、ここで実行時間が数秒かかるのは想定内。
import { splitOpponentGymSuffix } from "./build-kick-data";

let failures = 0;
function check(input: string, expected: { person: string; gym: string } | null, label: string) {
  const actual = splitOpponentGymSuffix(input);
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`✗ ${label}: input="${input}" expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// PR-9本文に記載の実例パターン(区切り文字あり: 分割対象)。
// 注意: 「サンチャイ・TEPPEN GYM」(実データ: data/kick/bouts_knockout.json)は、
// 直近の区切り文字が「GYM」直前の半角スペースになるため、person="サンチャイ・TEPPEN" /
// gym="GYM"に割れる(本来の選手名は「サンチャイ・TEPPENGYM」1語)。これは複数語のジム名に
// 対する既知の限界で、このテストは現状の実際の挙動を固定するもの(新規修正はこのPRの
// スコープ外、data/kick/*.jsonの変更もしない)。
check(
  "サンチャイ・TEPPEN GYM",
  { person: "サンチャイ・TEPPEN", gym: "GYM" },
  "中黒+スペース混在時の既知の分割挙動(複数語ジム名の限界)を固定",
);
check("龍太郎（本気道場）", { person: "龍太郎", gym: "本気道場" }, "全角括弧区切りの道場連結を分割");
check("次郎(闘魂塾)", { person: "次郎", gym: "闘魂塾" }, "半角括弧区切りの塾連結を分割");
check("三郎 拳会館", { person: "三郎", gym: "拳会館" }, "半角スペース区切りの会館連結を分割");

// モノニム/MMA混入監査(2026-08)の追補: PR-9時点は区切り文字が無い直接連結を一律
// 対象外(null)としていたが、末尾が既知の固定ジム名(センチャイジム等)と完全一致する
// 場合は辞書的に境界を認めるよう拡張した(56件中21件を新たに分割)。
check("壱センチャイジム", { person: "壱", gym: "センチャイジム" }, "既知の固定ジム名(センチャイジム)は区切り文字が無くても分割する");
check("洋センチャイジム", { person: "洋", gym: "センチャイジム" }, "既知の固定ジム名(センチャイジム)は区切り文字が無くても分割する");
check("目黒ヨックタイジム", { person: "目黒", gym: "ヨックタイジム" }, "既知の固定ジム名(ヨックタイジム)は区切り文字が無くても分割する");
// 未知の語(辞書に無い)は区切り文字が無ければ引き続き対象外(nullのまま)。
check("マット％自演乙％魁塾", null, "辞書に無い未知の語は区切り文字が無ければ分割しない(PR-18で対応不要と確定済みの文字化けケース)");
// 区切り文字自体はあるが従来の異体字セットに含まれていなかった半角中点(･)・中黒(·)・
// ビュレット(•)も分割できることを確認する(モノニム/MMA混入監査での追加)。
check("コンバンノー･エスジム", { person: "コンバンノー", gym: "エスジム" }, "半角中点(･)区切りを分割する");
check("シャーク·チャラムスックジム", { person: "シャーク", gym: "チャラムスックジム" }, "中黒(·)区切りを分割する");
check("シャーク•チャラムスックジム", { person: "シャーク", gym: "チャラムスックジム" }, "ビュレット(•)区切りを分割する");
// 「ジム」を含むが実際には人名の一部(外国人選手のファーストネーム)であり、
// 所属の連結ではないケースは引き続き分割しない(誤って別人の所属を捏造しない)。
check("ジム・ミューレン", null, "「ジム」が人名の一部(外国人ファーストネーム)の場合は分割しない");

// 所属語を含まない通常の相手名は無変換(null)のまま。
check("和島大海", null, "所属語を含まない通常の相手名は分割しない");

if (failures > 0) {
  console.error(`\n[test:kick-gym-suffix-split] ${failures}件失敗しました。`);
  process.exit(1);
}
console.log("\n[test:kick-gym-suffix-split] OK(全件成功)");
