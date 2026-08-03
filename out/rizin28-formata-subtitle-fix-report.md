# RIZIN.28 メインイベント欠落バグ修正(指示書①フォローアップ)

親調査: [#388](https://github.com/mnews-mma/mnews/pull/388) `out/rizin-checker-blindspot-audit.md`
HTMLキャッシュは#388の`out/rizin-html-cache/`を再利用(本PRでは再取得・再コミットしない)。

## 修正内容

`src/lib/mnewsRating/rizinScraper.ts` の `parseBoutChunkFormatA()`。

**症状**: 「喧嘩道スペシャルマッチ」のような企画名だけのサブタイトル段落が、本来の
ルール情報+選手情報の段落より先に独立した`<p style="text-align:center;">`として
入っているチャンクで、非貪欲マッチがそのサブタイトル段落を誤って掴み、実際の選手・
勝敗情報を含む段落を見ないままパース失敗していた。RIZIN.28で2bout(メインイベント
「朝倉未来 vs. クレベル・コイケ」を含む)が`data/rizinRecords.json`から丸ごと欠落。

**修正**: `<p style="text-align:center;">`候補を全て走査し、実際に選手2名分の`<a>`を
含む`font-weight:bold`のspanを持つ段落を選ぶよう変更(候補が1個だけの通常ケースは
従来と同じ挙動)。

## 検証

### 1. 再取得なしでの検証手順
キャッシュ済み77大会分のHTML(#388の`out/rizin-html-cache/`)を読む一時スクリプトで
`data/rizinRecords.json`相当の出力を再現し、修正前コード/修正後コードそれぞれで
新規実行して比較した(コミット済みファイルとの単純diffは不成立なため。
`feedback_scraper_verification_traps.md`参照)。

### 2. bout数が減った大会: 0件
修正前後で全82大会(manualOverride 4件 + auto-fetch 77件 + LANDMARK15手動投入1件)の
bout数を突合。**RIZIN.28のみ7→9(+2)、他81大会は完全に不変**。

### 3. 2回連続実行でSHA256一致
修正後コードでの新規実行を2回行い、出力JSONのSHA256が完全一致することを確認
(`fetchedDate`を固定した上で):
```
6e5b3a2dc8fc99527177048647b94a98afd2d3a60d6e7a77e13cbc6e3f60f4de  after-run1.json
6e5b3a2dc8fc99527177048647b94a98afd2d3a60d6e7a77e13cbc6e3f60f4de  after-run2.json
```

### 4. axis (a) 食い違い件数: 9件 → 7件
#388で検出した9件のうち、**RIZIN.28は独立根拠との差が+3→+1に縮小**(那須川天心 vs
3人の特別マッチは今回のスコープ外のため未解消、想定通り)。

「LANDMARK 12 in KOBE」「RIZIN師走の超強者祭り」の2件は、今回の突合方式を
「独立根拠 vs 修正後の新規フルfetch」に変えたことで見かけ上リストから消えたが、
**これは本修正と無関係**: この2大会は現在コミット済みの`data/rizinRecords.json`が
新規フルfetch結果と元々1boutずつ食い違っており(committed=19/16 vs 新規fetch=18/15、
本修正の影響を受けない既存のドリフト)、#388時点の「オープナーに詳細リンクなし」
という説明で食い違い自体は既に解消済みと判定していた。今回は比較対象を
「新規fetch」に統一したためこの食い違いが可視化されなくなっただけで、
**本修正のスコープ外・未調査のまま**(特殊マッチ3件・チェック手法限界6件と同様、
今回は触っていない)。

修正後に残る7件:
| 大会 | 独立根拠 | 抽出bouts | 分類 |
|---|---|---|---|
| RIZIN.3 | 0 | 13 | チェック手法の限界(era外・#388で既報) |
| RIZIN.4 | 0 | 11 | チェック手法の限界(era外・#388で既報) |
| RIZIN.13 | 13 | 12 | 特殊マッチ(3on3団体戦・非MMA、#388で既報・未修正) |
| RIZIN.14 | 13 | 14 | チェック手法の限界(オープナー、#388で既報) |
| RIZIN.28 | 10 | 9 | 特殊マッチ(那須川天心vs3人、#388で既報・未修正・本修正のスコープ外) |
| RIZIN.29 | 12 | 13 | チェック手法の限界(オープナー、#388で既報) |
| RIZIN LANDMARK vol.3 | 5 | 4 | 特殊マッチ(2v2団体戦グラップリング、#388で既報・未修正) |

### 5. RIZIN LANDMARK 15 in HIROSHIMA(手動投入分)の温存確認
`RIZIN_EVENT_INDEX`の外から手動投入された特殊事例(`feedback_scraper_verification_traps.md`
の既知の地雷)。**実データは14bout**(指示書に記載の「12bout」とは異なる、
2026-08-03時点のコミット済みファイルで実測)。修正適用後も**14boutのまま変化なし**
であることを確認した(全81件の自動生成分+LANDMARK15を手動で再結合する方式を採り、
LANDMARK15ブロック自体には一切触れていない)。

### 6. 適用方法(コミット済みファイルへの反映)
「修正前 vs 修正後」の新規fetch結果同士の比較では検証の独立性のためフルフェッチを
使ったが、`data/rizinRecords.json`への実際の反映は**フルフェッチによる全件上書きでは
なく、RIZIN.28イベントのbouts配列とparseFailuresのみを対象にした外科的パッチ**を
適用した。理由:
- 「シビサイ頌真 vs スダリオ剛」(RIZIN.28第2試合)には`backfill-rizin-slugs.ts`による
  手動slug補強(`fighterBSlug: "sudario-tsuyoshi"`)が既に入っており、素のフルフェッチ
  では再現できない(全件上書きすると退行する)。
- 上記5.の通りLANDMARK 12・RIZIN師走にも本修正と無関係な既存ドリフトがあり、
  全件上書きするとスコープ外の2大会まで意図せず変更してしまう。

適用後、`data/rizinRecords.json`の差分は**RIZIN.28のbouts配列(2件挿入・
cardPosition再採番)とparseFailures(6→4)のみ**。他81大会はバイト単位で不変
(`git diff --stat`で確認済み)。

## 検証結果サマリ

| 項目 | 結果 |
|---|---|
| RIZIN.28にメインイベント含む2bout復元 | ✅(朝倉未来 vs. クレベル・コイケ / 朝倉海 vs. 渡部修斗) |
| 他79大会(LANDMARK15・SARABA/IZA/RIZIN.1/RIZIN.2除く自動生成分)不変 | ✅ |
| 2回連続実行でSHA256一致 | ✅ |
| RIZIN LANDMARK 15(14bout)温存 | ✅ |
| tsc --noEmit | ✅ エラー0件 |
| npm run build(next build含む全ゲート) | ✅ exit 0 |
| npm run test:mnews-rating | ✅ 220件成功/0件失敗 |

## 影響範囲

`data/`はrizinRecordsAggregate.tsを通じて選手ページの戦績表示(2行目)にのみ使われ、
mnewsレーティングエンジンは`fighterRecords.json`のみを入力にしているため
ランキングには影響しない(想定通り)。

## 未着手(今回のスコープ外)

- RIZIN.13/RIZIN LANDMARK vol.3/RIZIN.28(那須川天心vs3人)の多人数・団体戦マッチ対応
  (`RizinRawBout`型の2名固定という設計自体の変更が必要)
- RIZIN.3/RIZIN.4のera制約、オープナーの詳細リンク省略という独立検査手法自体の限界
- axis (b)(「大会情報」タグ一覧との悉皆突合)の仕組み化

---

## 追記(指示書1フォローアップ・日次差分ゼロ化)

### task 2: パターン2の中止試合2件をbout単位でマージ可能にする

**原因確定**: LANDMARK 12 in KOBE(ヴガール・ケラモフ vs. 松嶋こよみ)・RIZIN師走の超強者祭り
(斎藤裕 vs. YA-MAN)の中止試合は、公式サイト上で見出しが`【試合中止】`プレフィックス付きに
変わり、中身も選手名リンク・勝敗マーカーを一切持たない「お知らせ記事」構造
(`<div class="block-lbox">...`)に丸ごと置き換わる。`<div class="raw-html">`自体が
存在しないため、`rizinScraper.ts`のどのフォーマットパーサー(A/B/C/D)でも原理的に
パース不可能(お知らせ記事の本文をパースしにいく案は、大会ごとに書式が揺れるため不採用)。
コミット済みファイルにはcardPosition小数値(16.5・9.5)で個別に手動投入されていたが、
`update-rizin-records.ts`を素直に再実行すると再現されずLANDMARK15と同型の地雷になっていた
(**方向は「日々の再生成で消える」側**であり、日次自動化の減少ガードに直撃する)。

**対応**: `rizinRecordOverrides.ts`に`RizinSupplementalBout`型と
`RIZIN_SUPPLEMENTAL_BOUTS_BY_EVENT`(イベント名キー)を新設し、該当2件を確定値として登録。
`update-rizin-records.ts`に`mergeSupplementalBouts()`を追加し、自動抽出結果へ
cardPosition降順で再結合するようにした(自動採番されたbout側のcardPositionには一切触れない)。

**検証**: キャッシュ済みHTML(#388流用)から2回連続で新規生成しSHA256一致を確認。
LANDMARK15を除く全81大会をコミット済みファイルと突合し、**全フィールド完全一致**
(RIZIN.28は#391の修正どおり+2、LANDMARK 12・RIZIN師走は補完bout込みで完全一致、
他78大会は無変更)。`data/rizinRecords.json`自体への追加変更は不要(既存のcommitted値と
今回の生成ロジックが一致することを確認しただけで、値そのものは元々正しかった)。

### task 1: RIZIN LANDMARK 15の自動取得移行は保留(内容不一致のため)

**resultsPageId特定**: `17853329`(WebSearch→WebFetchでtitleが
「abc presents RIZIN LANDMARK 15 in HIROSHIMA 試合結果一覧」と完全一致することを確認)。

**内容一致確認の結果: 不一致だったため手動投入ブロックは外していない。**

現行スクレイパー(#391の修正込み)でこのページを自動パースすると、17チャンク中16件が
成功(非bout見出し「大会情報／チケット」1件のみ正しくFAIL)。うち:
- 本戦第1〜12試合(12件)+ OPENING FIGHT第2〜4試合(3件) = 15件がコミット済み14boutの
  上位互換(既存14boutは全て自動取得結果に含まれる)
- OPENING FIGHT第1試合(田中仁 vs. 健太朗、`RIZIN MMAアマチュアルール`)は既知
  (PR #348で意図的に除外済み、`ruleType="MMA"`だがアマチュアのため対象外)
- **本戦第1試合(芝宏二郎 vs. 遥心、`RIZIN キックボクシングルール`)がコミット済み14boutに
  含まれていない。新規発見。** `ruleType="キックボクシング"`(非MMA)で、
  `data/rizinRecords.json`は他の大会でも非MMA試合を通常どおり格納する仕様
  (`data/rizinRecords.json`全体で155件の既存キックボクシングboutを確認済み)。
  32c0924での手動投入時にこの1試合(OPENING FIGHTではなく本戦の第1試合)が
  抜けていた可能性が高い。

つまり「アマチュア1件を除いた自動取得結果」は**15bout**であり、コミット済みの14boutとは
一致しない(指示書の「自動取得で14bout」という想定とも異なる)。「減るなら外さず報告」の
条件そのものではない(増える方向)が、「内容一致することを確認してから外す」の条件を
満たさないため、**`RIZIN_EVENT_INDEX`への登録・手動投入ブロックの解除は行っていない**。

判断が必要な点:
1. 「芝宏二郎 vs. 遥心」(キックボクシング)を`data/rizinRecords.json`に追加するか
   (他大会の非MMA試合と同じ扱いに揃えるなら追加が一貫的)。
2. 追加する場合、LANDMARK15を`RIZIN_EVENT_INDEX`へ正式登録し手動投入ブロックを解除する
   (自動取得で15bout、アマチュア1件を除く運用ルールをどこかに明文化する必要がある)か、
   現状の手動投入(14bout)のまま「芝宏二郎 vs. 遥心」だけをtask 2と同じ
   bout単位マージ機構で追加するか。

### task 3: RIZINのbout数減少0件を再確認

上記task2適用後の再生成(#391修正込み・LANDMARK15除く81大会)で、コミット済みファイルとの
差分は**0件**(全81大会・全フィールド一致)。LANDMARK15は今回未着手のため対象外
(現状どおり手動投入14boutのまま、`RIZIN_EVENT_INDEX`外)。

### 検証結果サマリ(追記分)

| 項目 | 結果 |
|---|---|
| LANDMARK 12・RIZIN師走の中止試合2件がbout単位マージで再現 | ✅(全フィールド一致) |
| LANDMARK15除く81大会、再生成でコミット済みと差分0件 | ✅ |
| 2回連続実行でSHA256一致 | ✅ |
| LANDMARK15の自動取得移行 | ⏸ 保留(内容不一致・要判断) |
| `tsc --noEmit` | ✅ エラー0件 |
| `npm run build` | ✅ exit 0 |
| `npm run test:mnews-rating` | ✅ 220件成功/0件失敗 |
