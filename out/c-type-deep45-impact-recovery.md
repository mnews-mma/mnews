# DEEP 45 IMPACT(2010-01-24)回収の検証記録

生成日時(JST): 2026-08-02

[[c-type-deep-numbered-mainline-wayback-check]]で回収可能と判定したDEEP 45
IMPACTを実際に`data/deepRecords.json`へ取り込んだ。指示どおり「1件だけ」に
スコープを絞り、他237大会には一切手を加えていない。

## 実装内容

1. `src/lib/mnewsRating/deepScraper.ts`の`decodeHtmlEntities()`に
   `&times;`(×)のデコードを追加。このページは○を素のUnicode文字、×を
   HTML実体参照`&times;`で書いており、未デコードだと敗者名フィールドの
   先頭に文字列として混入していた。
2. `scripts/build-deep-records.ts`に`DEEP_PINNED_MANUAL_SOURCES`(現行
   `/result/`一覧には無いがWayback Machineに個別記事が現存する大会を扱う
   仕組み)を新設。通常のライブクロールと同じbout変換処理
   (`processRawBouts()`として共通化)を再利用し、Wayback側の"id_"生ページ
   (アーカイブ閲覧バナー無し)を取得する。日付は自動抽出を使わず
   `2010-01-24`を直接指定(理由は[[c-type-deep-numbered-mainline-wayback-check]]
   §2-7参照: ページ本文に紛らわしい日付が2種類含まれ自動抽出が誤爆するため)。

## 取り込み方法についての判断

`build-deep-records.ts`をフル実行(287大会の再クロール)すると、本セッションの
変更とは無関係に**選手ロースター(`fighters.ts`)側の更新差分により25件の
winnerSlug解決改善+1件の退行(パク・ソヨン/young-parkseo、2件のbout)**が
副作用として混入することが判明した(`data/deepRecords.json`が前回生成された
時点より後に選手が追加・命名変更されたための自然な drift で、本セッションの
&times;修正・pinned機構とは無関係)。指示は「DEEP45の1件だけ回収する」で
あるため、この無関係なdriftを混入させないよう、フル再クロールではなく
DEEP 45 IMPACT 1件のみをフェッチして既存配列へ挿入する方式を採用した
(一時スクリプト`scripts/tmp-insert-deep45.ts`、未コミット。ロジックは
`build-deep-records.ts`の`processRawBouts()`と同一)。

将来`build-deep-records.ts`をフル実行すればDEEP45は`DEEP_PINNED_MANUAL_SOURCES`
経由で自動的に含まれ続けるため、今回の一時的な取り込み方法は次回以降の
通常運用に影響しない。

## 検証結果

- `npx tsc --noEmit -p .`: エラー0件
- `npm run build`: 成功(139/139ページ生成)
- `npm run test:mnews-rating`: 220件成功/0件失敗
- **既存237大会は完全に無変更**(全フィールドでbefore/after一致を確認済み)。
  新規追加は「DEEP 45 IMPACT」(2010-01-24)の1大会のみ。
- **重複チェック(日付+対戦相手名〈順不同〉の複合キー)**: `data/deepRecords.json`
  全体(2,354bout)を対象に実施。2010-01-24の複合キーに重複は0件。
  (参考: 2016-08-27に無関係の既存重複7件があるが、これは本セッション以前から
  存在するもので今回の変更とは無関係)。
- **rankings.jsonへの実害**: なし。DEEP45で解決した2選手(誠悟/seigo・
  中村優作/nakamura-yusaku)はいずれも現行ランキング5階級(計73名掲載)に
  含まれておらず、`update-mnews-rating.ts`を実行してもrawRating・順位とも
  変化しないことを確認した(DEEP45追加ありなしの2パターンを同一セッションで
  実行し比較。フェザー級のtakeda-koji/takagi-ryo順位入れ替わりは
  PR #364由来の別件の未反映分であり、DEEP45とは無関係と切り分け済み)。
  `data/rankings.json`・`data/rankings.prev.json`・
  `data/rankings.legitimateBaseline.json`はいずれも本PRにコミットしない
  (#353・#364の前例に倣う。マージ後の夜間バッチで自動反映される想定)。

## 影響選手(2行目=4団体通算)の増分

DEEP45 IMPACTの17boutのうち、選手DBに解決できたのは2名のみ(残り15名は
未登録の地方選手)。

| 選手 | 対戦相手 | 結果 | 決着 | 4団体通算(変更前→変更後) |
|---|---|---|---|---|
| 誠悟(seigo) | 亮太 | win | 1R 2'08" 袈裟固め | 10勝12敗0分 → **11勝12敗0分** |
| 中村優作(nakamura-yusaku) | 広斗 | win | 1R 4'21" TKO | 14勝8敗1分 → **15勝8敗1分**(本人のWikipedia由来「通算戦績」には元々この一戦が含まれていたため「通算戦績」自体は変化なし。今回変わるのは4団体通算〈2行目〉のみ) |

## DEEP 45 IMPACT 全17bout(参考記録)

出典: Wayback Machine(https://web.archive.org/web/20110824232529id_/http://www.deep2001.com/article.php/20100125001956962、原記事「1.24 大阪大会　結果」)

| 勝者(ジム) | 敗者(ジム) | 決着 |
|---|---|---|
| 白井祐矢(TeamMAD) | 池本誠知(総合格闘技スタジオSTYLE) | 判定0-5 |
| 誠悟(フリー) | 亮太(圭太郎道場) | 1R 2'08" 袈裟固め |
| 中尾受太郎(フリー) | 伊藤有起(ALLIANCE) | 判定3-0 |
| TAISHO(バルボーザジャパン) | 釜谷真(CMA京都成溪館) | 判定3-0 |
| 藤井隆平(和術慧舟會RJW) | RYO(ランズエンド・ZERO-ONE MAX) | 判定0-3 |
| 長倉立尚(吉田道場) | 鍵山雄介(総合格闘技道場コブラ会) | 1R 3'28" KO |
| 岸本泰昭(総合格闘技道場コブラ会) | 毛利昭彦(毛利道場) | 判定0-3 |
| 中村晃司(パンクラス稲垣組)△田中慎一郎(GSB) | (引き分け) | 判定1-0 |
| 中村優作(総合格闘技スタジオSTYLE) | 広斗(SFK) | 1R 4'21" TKO |
| 森翔之(M-BLOW) | 階健志(NJKF健心塾) | 判定3-0 |
| デービス(M-FACTORY) | ジェームス(SFK) | 判定3-0 |
| 山口裕人(MA多田ジム山口道場) | 井上義悟(ライタイボクシング) | 判定3-0 |
| 中川幸樹(魁塾) | 松浦廣平(理心塾) | 判定2-0 |
| 桜井享(京賀塾) | 岸本顕吾(アツキムエタイジム) | 判定3-0 |
| 小池翔(誠空会) | 原田隆史(修狼塾) | 判定3-0 |
| 野中翔(パンクラス稲垣組) | 吉川圭太(NEX) | 1R 2'45" ヒールホールド |
| 富田浩司(パンクラス稲垣組) | 佐藤裕二(毛利道場) | 2R 4'21" TKO |

## 出力

- `src/lib/mnewsRating/deepScraper.ts`(&times;デコード追加)
- `scripts/build-deep-records.ts`(processRawBouts共通化・
  DEEP_PINNED_MANUAL_SOURCES新設)
- `data/deepRecords.json`(DEEP 45 IMPACT・17bout追加、既存237大会は無変更)
- 本ファイル(out/c-type-deep45-impact-recovery.md)
