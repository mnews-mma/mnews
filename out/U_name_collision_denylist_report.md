# 指示書U: 同名別人によるバックフィル誤爆の防止 + taito slug衝突解消

## 1. denylistの構築

`out/pancrase_name_reconciliation_table.json`(パンクラス公式1,683件)・
`out/shooto_all_fighters.json`(修斗公式1,897件)を**それぞれのファイル内で**
突合(ファイルをまたいだ完全一致は、複数団体を掛け持つ同一選手=クロスオーバーの
誤検出が大半になるため対象外とした。例: 後藤丈治は両方の公式ロースターに載るが
同一人物)。

判定基準:
- (a) 同一ファイル内で表示名が完全一致するのに異なるurlStem/id
- (b) 同一ファイル内で、あるエントリの表示名が別エントリ(異なるurlStem/id)の
  表示名の部分文字列になっている(例: パンクラス公式で「力也」(rikiya.html)と
  「辻川力也」(tsujikawar.html)が別プロフィール)

結果: **75件**(パンクラス内25件・修斗内51件、重複1件)。生成スクリプト:
`out/build_denylist.ts`。結果は `scripts/lib/nameCollisionDenylist.ts` に
静的配列として焼き込んだ(out/は非コミットのため)。

「泰斗」「力也」は想定どおり含まれる。「泰斗」はパンクラス公式内で
taito.html/taitosc.htmlの2プロフィールが同一表示名を持つため確定的な衝突。
さらに調査中に**3件目のパンクラスプロフィール「渡邉泰斗」
(../prfl2/watanabetaito.html)**も発見した(taito/taitoscいずれかの
本名表記の可能性があるが未確認、指示書Uのスコープ外として記録のみ)。

## 2. `resolveSlug()`への適用

`scripts/lib/fighterNameBackfill.ts`の`resolveSlug()`の入口で、正規化後の
名前(直接一致・引用符挿入部除去一致の両方)がdenylistに含まれる場合は
無条件で`null`を返すようにした。これにより`backfill-shooto-pancrase-slugs.ts`・
`backfill-rizin-slugs.ts`の両方(同一ロジックを共有)で自動的に効く。

## 3. 既存の誤爆確認(修正はしていない)

denylist該当75名が現在data/・fighters.tsでどう解決されているかを全件照合した
(`out/check_existing_misresolution.ts`)。該当した解決済みboutは以下の5名分のみ:

| denylist名 | 解決先slug | 件数 | 判定 |
|---|---|---|---:|---|
| 金太郎 | kintaro | 25件(RIZIN/パンクラス/DEEP、2012〜2026年) | 対象選手自身の正当な戦績と判断(継続的な実戦歴と整合) |
| 力也 | rikiya | 26件(RIZIN/パンクラス/DEEP、2019〜2026年) | 同上 |
| 泰斗 | taito(→taito-rangers) | 8件(修斗、2020〜2025年) | #308で確定済みの本人の戦績 |
| 岡田嵐士 | okada-arashi | 9件(修斗、2024〜2026年) | 選手の登録名(姓+名)そのものと完全一致、正当 |
| ヒカル | hikaru | 4件(修斗、2024〜2026年) | 直近の修斗フェザー級戦歴と整合、正当 |

**明確な誤爆(別人への誤った紐付け)は確認できなかった**。ただし
`data/pancraseRecords.json`・`data/deepRecords.json`側に、denylist対象
「泰斗」の**裸表記(姓なし)が7件、これまでずっと未解決のまま残っていた**
(パンクラス4件・DEEP3件、下記参照)。fighters.tsの`taito`(旧slug)エントリの
nameJaが完全に同じ「泰斗」だったため、次回バックフィル実行時に**この7件が
誤って修斗選手のslugに紐づくリスクが実在した**(本PRの調査で未然に発見)。

| データ | 大会 | 日付 |
|---|---|---|
| パンクラス | PANCRASE 260 | 2014-08-10 |
| パンクラス | Bayside FIGHT.3 | 2014-04-20 |
| パンクラス | PANCRASE 2012 PROGRESS TOUR | 2012-10-06 |
| パンクラス | PANCRASE 2011 IMPRESSIVE TOUR | 2011-02-06 |
| DEEP | DEEP 97 IMPACT | 2020-09-20 |
| DEEP | DEEP TOKYO IMPACT 2021 | 2021-03-13 |
| DEEP | DEEP 102 IMPACT | 2021-07-04 |

denylist適用後、この7件は**引き続き未解決のまま**であることを実測確認した
(バックフィル再実行で新規解決0件)。

## 4. taito slugの衝突解消

`src/lib/fighters.ts`のslugを `taito` → **`taito-rangers`** に変更(表示名
nameJa「泰斗」は変えない)。所属ジム(MMA RANGERS GYM)に由来する命名とし、
将来パンクラス側のtaito.html(1989年生・山梨・KIBA)・taitosc.html(1990年生・
東京・真月流COMBAD)を登録する際にslugが衝突しない形にした。fighters.tsの
エントリ直上に3(+未確認1)人存在する旨のコメントを追加。

`data/shootoRecords.json`側の参照8件(fighterASlug/fighterBSlug)も
`taito-rangers`に一括更新した。

## 5. unresolved件数の変化

| 団体 | denylist適用前 | 適用後 | 差分 |
|---|---:|---:|---:|
| RIZIN | 1100 | 1100 | 0 |
| 修斗 | 2913 | 2913 | 0 |
| パンクラス | 8497 | 8497 | 0 |
| DEEP | 3850 | 3850 | 0 |

**件数は変化していない**(denylist対象の7件は元々未解決だったため)。
これは「見えている数字を改善した」のではなく「見えていない将来の事故
(次回バックフィル実行時に7件が誤爆する)を未然に防いだ」措置である。

## 6. 検証

- `npx tsc --noEmit`: パス
- `npm run build`: パス
- `npm run test:mnews-rating`: 220件成功/0件失敗
- ローカル主要ページ200確認
