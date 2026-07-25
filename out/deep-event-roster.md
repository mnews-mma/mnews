# deep-event-roster: イベント起点の名簿発見(DEEPで試作)

生成日時(JST): 2026-07-25 / 対象期間: 2025-07-25 〜 2026-07-25(直近12ヶ月)

本レポートは監査専用の出力。`fighters.ts`等への変更は行っていない(diffゼロ)。推奨・優先度づけは含まない。

> ## ⚠️ 停止条件に該当(指示書②§5)
>
> 以下の条件に該当したため、この実行は**指示書②§5の停止条件を満たしている**。判断は代行していない。
> 以下のデータはあくまで「何が起きたか」の記録であり、スコープを狭めてよいかどうかは人間が決めること。
>
> - §5停止条件: ユニーク選手数が400件を超過(481件)

## 1. 設計検証レポート(最重要)

イベント単位のパース状況: ok(結果抽出成功)=29 / partial(一部欠落)=1 / failed(結果抽出失敗)=10 / unfetchable(取得失敗)=0 / 対象期間外(スキップ)=50

### レイアウトの種類

結果ページは基本的に単一の構造(`第N試合 [階級・時間・R数] | 記号+選手名（ジム）| 記号+選手名（ジム）| 決着方法`のテーブル/リスト形式)に収束したが、以下の**表記ゆれ**が実際に観測され、単一の正規表現では初回吸収できなかった(修正して対応済み。詳細は下記「弱点」参照):

- 勝敗記号に `○`(U+25CB)と `〇`(U+3007、漢数字の0)の**2種類のUnicode文字**が混在(ページ・執筆者によって不統一)
- ジム名を囲む括弧が半角`()`と全角`（）`で**混在**(同一ページ内で片方だけ全角/半角が入れ替わっている行がある)
- 「第N試合」の直後に階級表記が**同一セル内(空白区切り)**の場合と**別セル(パイプ区切り)**の場合の2パターン
- 「第N試合」の採番は**イベントごとに1から始まらない**(例: 大規模カードの一部として21試合目から始まるケースを確認)

上記はいずれも**同一の基本構造のバリエーション**であり、「レイアウトが3種類以上に分岐」には該当しないと判断した(停止条件に該当せず続行)。

### 弱点(この設計が壊れる場所)

- **同一URLが開催前後で内容ごと入れ替わる**: DEEP公式は「対戦カード発表」と「試合結果」を別記事にせず、同じ投稿URL(例 `/deep-133-impact/`)を開催後に結果へ更新する運用。今回の取得タイミングで**まだ結果に更新されていない投稿**(=開催前、または開催直後で未更新)は、結果マーカーが一切検出できず`parse_status=failed`に分類される。これは`/result/`という名前のアーカイブに載っていても実際には結果が読めるとは限らないことを意味する。
- **`/result/`アーカイブの並び順は「投稿更新順」であり「開催日順」ではない**: 未来の大会(対戦カード公開時点)がアーカイブの上位に来ることがある(実際に2026年9月開催予定の大会が本監査時点でアーカイブ上位に出現した)。そのため「アーカイブの上から順に辿って12ヶ月分より古くなったら打ち切る」という単純な方法は使えず、本スクリプトは個別ページの本文から開催日を確認してから期間判定している(サムネイル画像のアップロード年は粗い足切りにのみ使用し、確定判定には使っていない)。
- **勝敗記号・括弧の表記ゆれは今回観測できた範囲でのみ対応済み**: 今後さらに別のUnicode類似文字(例: 全角丸囲み数字、異なる句読点)が使われた場合、`parse_status=failed`として検出はされる(黙って0人で成功扱いにはならない設計)が、自動では拾えない。
- **引用符なしの埋め込み異名は`findFighterSlugByName`の`stripDecorativeNickname`では剥がれない**(指示書②の既知の地雷どおり)。`name_confidence=decorated_suspect`で機械的に検出できたのは「漢字+カタカナ2文字以上+漢字」という限定パターンのみで、それ以外の埋め込み異名(例: 末尾に付くもの、1文字カタカナのもの)は`clean`のまま素通りしている可能性がある。
- **欠場・対戦相手変更の混入は排除できていない可能性**: 結果ページ本文を使っているため対戦カード発表由来の混入は原理的に避けられているはずだが、DEEP公式が結果ページに旧カードの記述を消し忘れているケースまでは検証していない。

### 他団体への横展開可否

**条件付きで可能。ただしDEEP固有の要素に依存している部分がある。** 具体的には:

- 依存しているDEEP固有の要素: (1) `/result/`という固定パスのアーカイブページの存在, (2) 「第N試合｜●/○/〇/△ 選手名（ジム）｜...｜決着方法」という**DEEP独自のテーブル表記規約**, (3) 開催日が本文中に`YYYY年M月D日`という和暦でない西暦表記で必ず出現する慣習。
- これらはいずれも団体ごとに個別実装が必要になる(GLADIATOR・ZSTがこの3点を同じ形式で提供している保証はない)。**「イベント一覧→個別ページ→本文正規表現抽出」という3段構成の設計自体(アーキテクチャ)は横展開できるが、正規表現とURL規則はDEEP固有であり、団体ごとに再実装が必要**というのが結論。共通化できる部分は「fighters.tsへの突合ロジック」(`findFighterSlugByName`)のみで、これは既に団体非依存。

## 2. ブランド別・全体の listed/hidden/missing 内訳

| brand | 必達セット(ユニーク選手) | listed | hidden | missing |
|---|---|---|---|---|
| DEEP FIGHT CHALLENGE | 27 | 1 | 0 | 26 |
| DEEP IMPACT | 112 | 54 | 4 | 54 |
| DEEP OSAKA IMPACT | 105 | 5 | 0 | 100 |
| DEEP NAGOYA IMPACT | 84 | 0 | 0 | 84 |
| DEEP HAMAMATSU IMPACT | 85 | 0 | 0 | 85 |
| DEEP JEWELS | 60 | 3 | 0 | 57 |
| DEEP TOKYO IMPACT | 116 | 18 | 0 | 98 |
| **全体** | **481** | **64** | **4** | **413** |

(①-b で確定したとおり hidden は「マスターに存在する」側として扱っている。新規候補として二重計上していない。)

## 3. missing 全件リスト

| brand | name_raw | 出場回数 | 直近event_id |
|---|---|---|---|
| DEEP FIGHT CHALLENGE | 坂野周平 | 1 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 井上セナ | 3 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | マイティ・saw | 3 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 中尾響 | 3 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 朝比奈龍希 | 3 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 川口海翔 | 2 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 今野蓮弥 | 2 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 今井風快 | 1 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 琥 | 1 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 渡部恵多 | 1 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 大越充悟 | 3 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 佐々木琢磨 | 1 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 森谷風真 | 1 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 齋藤未来 | 1 | deep-fight-challenge-2026-2nd-round |
| DEEP IMPACT | 山田聖真 | 3 | deep-132-impact |
| DEEP IMPACT | 太田将吾 | 2 | deep-132-impact |
| DEEP IMPACT | 河村泰博 | 2 | deep-132-impact |
| DEEP IMPACT | 高橋正親 | 3 | deep-132-impact |
| DEEP IMPACT | マサト・ナカムラ | 3 | deep-132-impact |
| DEEP IMPACT | 斎藤璃貴 | 1 | deep-132-impact |
| DEEP IMPACT | 松井優磨 | 4 | deep-132-impact |
| DEEP IMPACT | 石原射 | 4 | deep-132-impact |
| DEEP IMPACT | 矢野武蔵 | 3 | deep-132-impact |
| DEEP IMPACT | 武利侑都 | 2 | deep-132-impact |
| DEEP IMPACT | 横内三旺 | 4 | deep-132-impact |
| DEEP IMPACT | 秋元優志 | 3 | deep-132-impact |
| DEEP IMPACT | 荒井夕翔 | 3 | deep-132-impact |
| DEEP OSAKA IMPACT | 栗山葵 | 3 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | サラ・マフムード | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | Street♡★Bob洸助 | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 河坂修斗 | 3 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 小川道的 | 3 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 澤田龍美 | 4 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | フェルナンド | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | カーレッジユウキ | 2 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 橋本葵 | 2 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 渡辺真央 | 3 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 加藤憂也 | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 大島伊玖都 | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 切嶋龍輝 | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 大空斗 | 3 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 谷岡祐樹 | 3 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | MG眞介 | 2 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | みやび | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 虎鉄 | 2 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 窪田大羅 | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 鈴木 “QP” まい | 2 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | ルリー・サンシャイン | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 古根川充 | 2 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 権藤大剛 | 1 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | ステファン“スマッシュ” | 2 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 酒井天佑 | 3 | deep-osaka-impact-2026-3rd-round |
| DEEP NAGOYA IMPACT | TATSUMI | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 加藤綾真 | 4 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 浅野功暉 | 4 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | カーン・ソガズ | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 時任流架 | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 鈴木幹也 | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 中川内 羽矢斗 | 4 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 熊澤バイオレンス | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 宜野座ケビン | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 大澤空 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | ユリカ・グラップリングシュートボクサーズジム | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | パク・ソヨン | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | SHOYA | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 吉田翼 | 3 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 朱里グラップリングシュートボクサーズジム | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | チェ・ウンジ | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 青井佑磨 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 三島康貴 | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 黒川晃司 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 早田大牙 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 三ツ塚勇介 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 永井宏人 | 3 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 古市陸 | 4 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 橋上壮馬 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 椿馨 | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 青代享 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 山田悠太 | 3 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 川畑凜斗 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 内田 菱牙 | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 吉口聖也 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 真下健嗣 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 土屋太郎 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 細川晄希 | 2 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 倉冨立聖 | 1 | deep-nagoya-impact-2026-2nd-round |
| DEEP HAMAMATSU IMPACT | 内山拓真 | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 奥野充貴 | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 木之下喧壱 | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 青田剛 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 大野勇斗 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | AKIYOSHI | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 西原大貴 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 伊藤一輝 | 3 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | ルーク中村 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 小林ゆたか | 3 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 真野アミル | 3 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 平井総一郎 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | マサムネ | 3 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 一輝 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 佐藤修斗 | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 加藤翔奏 | 3 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | ショーン・ホマレー | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 高田真音 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 石津隼人 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 菊池創太 | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | フェリペ・ハセヤマ | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 上瀬あかり | 3 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 渡邊花美 | 3 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 和久田月聖 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 黒太翔人 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | トーマ | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | RYUA | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | ランボルギーニ | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 高橋典斗 | 2 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 金子徹哉 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 平田大地 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 久留拓磨 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 仁 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 熊谷輝彦 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 金城壮志 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 津島忠彦 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 中村大和 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 比企那菜実 | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | AKINA | 1 | deep-hamamatsu-impact-2026-1st-round |
| DEEP JEWELS | 中井りん | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 奥富夕夏 | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 竹林 エル | 3 | deep-jewels-52-2 |
| DEEP JEWELS | ののか | 2 | deep-jewels-52-2 |
| DEEP JEWELS | キム・ソユル | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 桐生祐子 | 3 | deep-jewels-52-2 |
| DEEP JEWELS | 月井隼南 | 3 | deep-jewels-52-2 |
| DEEP JEWELS | 彩綺 | 2 | deep-jewels-52-2 |
| DEEP JEWELS | abbie | 3 | deep-jewels-52-2 |
| DEEP JEWELS | 樹季 | 4 | deep-jewels-52-2 |
| DEEP JEWELS | Te-a | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 古林礼名 | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 大井すず | 3 | deep-jewels-52-2 |
| DEEP JEWELS | SAAYA | 4 | deep-jewels-52-2 |
| DEEP JEWELS | 鈴木”BOSS”遥 | 2 | deep-jewels-52-2 |
| DEEP JEWELS | 田川真帆 | 2 | deep-jewels-52-2 |
| DEEP JEWELS | JUICY | 2 | deep-jewels-52-2 |
| DEEP JEWELS | うらら | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 山吹マリン | 3 | deep-jewels-52-2 |
| DEEP JEWELS | 谷山心優 | 4 | deep-jewels-52-2 |
| DEEP JEWELS | あきぴ | 4 | deep-jewels-52-2 |
| DEEP JEWELS | 村松美直 | 3 | deep-jewels-52-2 |
| DEEP JEWELS | 愛温 | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 山内梨緒 | 1 | deep-jewels-52-2 |
| DEEP JEWELS | 横江 明日香 | 3 | deep-jewels-52-2 |
| DEEP JEWELS | デスティニー | 1 | deep-jewels-52-2 |
| DEEP TOKYO IMPACT | 高橋遼伍 | 3 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 長谷川賢 | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | ブラックタイガー | 3 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | カンジ | 2 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | KINNO | 2 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 黒岡裕真 | 3 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 笹崎健司 | 2 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 坂本岳 | 3 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | ハム・ギワン | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 仁井田右楽 | 2 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 廣瀬裕斗 | 5 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 渡邉龍太郎 | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | キンジ | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | ガブリエル | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 尚太郎 | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | TAKUMA | 2 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 猿丸凛太朗 | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 菊間瑛太 | 3 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 小嵐翔真 | 1 | deep-tokyo-impact-2026-3rd-round |
| DEEP IMPACT | 知名昴海 | 3 | deep-131-impact |
| DEEP IMPACT | 今野連弥 | 1 | deep-131-impact |
| DEEP IMPACT | 武井大将 | 1 | deep-131-impact |
| DEEP IMPACT | ショウエイ | 1 | deep-131-impact |
| DEEP IMPACT | 矢代光 | 1 | deep-131-impact |
| DEEP TOKYO IMPACT | 森俊樹 | 1 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 中村雄一 | 1 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 堂園悠 | 2 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 唐沢タツヤ | 2 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 橋本優大 | 2 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | コビー・レオン | 1 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 安永吏成 | 2 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 高橋健斗 | 1 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | トミー渡部 | 2 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 井上竜旗 | 2 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 寉岡樹記 | 3 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 藤井連 | 2 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 山田葵生 | 1 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 佐藤聖優 | 3 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | サンシャイン | 1 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | ごとう瑠海 | 1 | deep-tokyo-impact-2026-2nd-round |
| DEEP IMPACT | 谷口仁歩 | 2 | deep-130-impact |
| DEEP IMPACT | 高尾凌生 | 3 | deep-130-impact |
| DEEP IMPACT | 河島ノブヒデ | 1 | deep-130-impact |
| DEEP OSAKA IMPACT | 濱口奏琉 | 2 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 松場貴志 | 1 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 松原聖也 | 2 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 岩本達彦 | 1 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 藤田宇宙 | 3 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 木下竜馬 | 2 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 福田泰暉 | 2 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | あー子 | 1 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 瀧口脩生 | 2 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 田中壱季 | 2 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 井康勢 | 1 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 大西未来 | 2 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | HIME | 1 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 武蔵 | 3 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 太一 | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 今村豊 | 3 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | MANA | 1 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 中尾あづき | 1 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | ベンジャミン | 3 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 武蔵坊慶輔 | 1 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 米原剛希 | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 西川将輝 | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | アモリン | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | ぽちゃんZ | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | Bobo飛鳥 | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 近藤世里菜 | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 佐藤勇真 | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 朝井啓太 | 2 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 杉映都 | 1 | deep-osaka-impact-2026-1st-round |
| DEEP JEWELS | 百湖 | 1 | deep-jewels-52 |
| DEEP JEWELS | 万智 | 1 | deep-jewels-52 |
| DEEP JEWELS | キム・ダンビ | 1 | deep-jewels-52 |
| DEEP JEWELS | 海咲イルカ | 1 | deep-jewels-52 |
| DEEP JEWELS | 堀井かりん | 3 | deep-jewels-52 |
| DEEP JEWELS | 横瀬友愛 | 3 | deep-jewels-52 |
| DEEP JEWELS | 岡美紀 | 2 | deep-jewels-52 |
| DEEP JEWELS | 坂本瑠華 | 1 | deep-jewels-52 |
| DEEP JEWELS | ダイナマイト♡ユラ | 1 | deep-jewels-52 |
| DEEP JEWELS | 島村優花 | 1 | deep-jewels-52 |
| DEEP JEWELS | 中澤諒香 | 1 | deep-jewels-52 |
| DEEP JEWELS | 村井成美 | 1 | deep-jewels-52 |
| DEEP JEWELS | ちゃんりな | 2 | deep-jewels-52 |
| DEEP JEWELS | せりな | 3 | deep-jewels-52 |
| DEEP JEWELS | 山岸佳音 | 1 | deep-jewels-52 |
| DEEP JEWELS | たから | 1 | deep-jewels-52 |
| DEEP TOKYO IMPACT | 関鉄矢 | 2 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 黒井海成 | 2 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 中務修良 | 2 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 御代川敏志 | 1 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 吉田悠太郎 | 1 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | ウラケン | 1 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 平井聡一朗 | 1 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 石井涼馬 | 2 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 西山亮翔 | 2 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 小林よしずみ | 1 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 小笠原孝成 | 2 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 須山豪 | 2 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | Michael北見 | 1 | deep-tokyo-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 吉田陸 | 3 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 脇田仁 | 3 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 藤岡陸 | 2 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 田中慎一郎 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 平澤克明 | 2 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 小澤亮太 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 加藤颯 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 勇太 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 大岩翔哉 | 3 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 川崎ごうる | 2 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 前田遊 | 2 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 出口誉 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 伊藤叶 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 権藤悠太郎 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 杉村祥真 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 切嶋黎 | 2 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 石田ガリット勝也 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 村田和生 | 2 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 福山佳祐 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 濱本佳樹 | 2 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 武山詩音 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 森大夢 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 内野誠哉 | 1 | deep-nagoya-impact-2026-1st-round |
| DEEP FIGHT CHALLENGE | 佐々木耀 | 2 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | トミー渡辺 | 1 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | アニンタ・アリ | 2 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | ホワイトベア | 1 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 佐藤カナウ | 1 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 佐藤照栄 | 2 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 福嶋司 | 1 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 金子蒼空 | 2 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 横山桔平 | 1 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | ランペイジ竜太 | 1 | deep-fight-challenge-2026-1st-round |
| DEEP TOKYO IMPACT | 越智晴雄 | 1 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 安谷屋智弘 | 1 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 松岡疾人 | 3 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 野尻大輔 | 1 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 左京 | 1 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 堀内美沙紀 | 2 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 国分獅斗 | 1 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 菊池佳歩 | 1 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 佐藤凛 | 1 | deep-tokyo-impact-2025-6th-round |
| DEEP IMPACT | 奥山貴大 | 1 | deep-129-impact |
| DEEP IMPACT | 水野竜也 | 1 | deep-129-impact |
| DEEP IMPACT | 稲田将 | 1 | deep-129-impact |
| DEEP IMPACT | 橋本ユウタ | 1 | deep-129-impact |
| DEEP IMPACT | 荒井銀二 | 1 | deep-129-impact |
| DEEP IMPACT | 平石光一 | 2 | deep-129-impact |
| DEEP IMPACT | ハチミツ大魔王 | 1 | deep-129-impact |
| DEEP OSAKA IMPACT | 延命そら | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 牧野滉風 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 三村亘 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 鈴木琢仁 | 2 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 大家皆 | 2 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 山﨑鼓大 | 2 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 田口貴規 | 2 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 大澤将司 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 上田拳翔 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 上村亮馬 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 原田闘鬼 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 丸山晃毅 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 石田拓己 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 吉村凌仁郎 | 1 | deep-osaka-impact-2025-5th-round |
| DEEP JEWELS | 浜崎朱加 | 1 | deep-jewels-51 |
| DEEP JEWELS | サラ | 2 | deep-jewels-51 |
| DEEP JEWELS | 小雪 | 1 | deep-jewels-51 |
| DEEP JEWELS | 五十嵐莉子 | 1 | deep-jewels-51 |
| DEEP JEWELS | 和智美音 | 2 | deep-jewels-51 |
| DEEP TOKYO IMPACT | Guts | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 神酒龍一 | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 湯浅帝蓮 | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 多湖力翔 | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | キム・ミンソク | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 山口コウタ | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 丈太 | 2 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 田中悠翔 | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 池森ヨシキ | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 松元大樹 | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 上田遥斗 | 1 | deep-tokyo-impact-2025-5th-round |
| DEEP IMPACT | 大木良太 | 1 | deep-128-impact |
| DEEP IMPACT | 高野優樹 | 1 | deep-128-impact |
| DEEP IMPACT | 木村琉音 | 1 | deep-128-impact |
| DEEP IMPACT | バッファロー | 1 | deep-128-impact |
| DEEP IMPACT | 大将 | 1 | deep-128-impact |
| DEEP HAMAMATSU IMPACT | 桜井聡紀 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 武田祈和 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | イトカズ・コウセイ | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 小林桜太 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 南谷純也 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | ドリーム★キミ | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 喪黒★福蔵 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 胸毛ニキ | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 切嶋龍希 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | Akiyoshi | 2 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 金光優真 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 中野ハヤト | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 高林和真 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 和泉直人 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | WATARU | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 中川北斗 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 小林直貴 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 伊藤陸都 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 高山敦 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 稲村健心 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 鈴木克彰 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 加藤宥希 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 大川怜輝 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 伊藤佑都 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 鈴木柚来 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 望月琉偉 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 袴田玲 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 浅野劉生 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 河合奏太朗 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 有村至恩 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 山本凌己 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 児玉英志朗 | 1 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP OSAKA IMPACT | 前園渓 | 1 | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | GINJI | 1 | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | 澄斗 | 1 | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | 大原宇竜 | 1 | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | チェ・ソンヒョク | 1 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | サダエ☆マヌーフ | 1 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 大野“虎眼”賢良 | 1 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 砂田華社 | 1 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 横瀬美久 | 1 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 成本優良 | 1 | deep-osaka-impact-2025-3rd-round |
| DEEP IMPACT | 佐藤洋一郎 | 1 | deep-127-impact-2 |
| DEEP IMPACT | 郷野聡寛 | 1 | deep-127-impact-2 |
| DEEP IMPACT | 近藤有己 | 1 | deep-127-impact-2 |
| DEEP IMPACT | 春日井“寒天”たけし | 1 | deep-127-impact-2 |
| DEEP IMPACT | 石塚雄馬 | 1 | deep-127-impact-2 |
| DEEP IMPACT | 菊川イサム | 1 | deep-127-impact-2 |
| DEEP IMPACT | RYOTA | 1 | deep-127-impact-2 |
| DEEP JEWELS | 富松恵美 | 1 | deep-jewels-50 |
| DEEP JEWELS | きたりこ | 1 | deep-jewels-50 |
| DEEP JEWELS | MANAKA | 1 | deep-jewels-50 |
| DEEP JEWELS | 谷山瞳 | 1 | deep-jewels-50 |
| DEEP JEWELS | ジャカ季美香 | 1 | deep-jewels-50 |
| DEEP JEWELS | 須山ゆな | 1 | deep-jewels-50 |
| DEEP TOKYO IMPACT | アサン・ゲェイデ | 1 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 颯斗 | 1 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 生田大雅 | 1 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 大和田龍斗 | 1 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 菅涼星 | 1 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | ダイア | 1 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 岸翔大 | 1 | deep-tokyo-impact-2025-4th-round |
| DEEP IMPACT | 原虎徹 | 1 | deep-126-impact |
| DEEP NAGOYA IMPACT | 八尋大輝 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 草野ガブリエル | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 中西哲夫 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 野木崇政 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 河村嘉展 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 髙村友晴 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | もも太郎 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 福井達郎 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 平山稔和 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 河野太喜 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 熊澤愛希也 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 西川玲司 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 大森仁 | 1 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 西村凛惺 | 1 | deep-nagoya-impact-2025-1st-round |

missing 総数: 413 件

## 4. match_confidence = none の要確認リスト

| brand | name_raw | 直近event_id |
|---|---|---|
| DEEP FIGHT CHALLENGE | 坂野周平 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 井上セナ | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | マイティ・saw | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 中尾響 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 朝比奈龍希 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 川口海翔 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 今野蓮弥 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 今井風快 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 琥 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 渡部恵多 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 大越充悟 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 佐々木琢磨 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 森谷風真 | deep-fight-challenge-2026-2nd-round |
| DEEP FIGHT CHALLENGE | 齋藤未来 | deep-fight-challenge-2026-2nd-round |
| DEEP IMPACT | 山田聖真 | deep-132-impact |
| DEEP IMPACT | 太田将吾 | deep-132-impact |
| DEEP IMPACT | 河村泰博 | deep-132-impact |
| DEEP IMPACT | 高橋正親 | deep-132-impact |
| DEEP IMPACT | マサト・ナカムラ | deep-132-impact |
| DEEP IMPACT | 斎藤璃貴 | deep-132-impact |
| DEEP IMPACT | 松井優磨 | deep-132-impact |
| DEEP IMPACT | 石原射 | deep-132-impact |
| DEEP IMPACT | 矢野武蔵 | deep-132-impact |
| DEEP IMPACT | 武利侑都 | deep-132-impact |
| DEEP IMPACT | 横内三旺 | deep-132-impact |
| DEEP IMPACT | 秋元優志 | deep-132-impact |
| DEEP IMPACT | 荒井夕翔 | deep-132-impact |
| DEEP OSAKA IMPACT | 栗山葵 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | サラ・マフムード | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | Street♡★Bob洸助 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 河坂修斗 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 小川道的 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 澤田龍美 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | フェルナンド | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | カーレッジユウキ | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 橋本葵 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 渡辺真央 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 加藤憂也 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 大島伊玖都 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 切嶋龍輝 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 大空斗 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 谷岡祐樹 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | MG眞介 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | みやび | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 虎鉄 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 窪田大羅 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 鈴木 “QP” まい | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | ルリー・サンシャイン | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 古根川充 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 権藤大剛 | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | ステファン“スマッシュ” | deep-osaka-impact-2026-3rd-round |
| DEEP OSAKA IMPACT | 酒井天佑 | deep-osaka-impact-2026-3rd-round |
| DEEP NAGOYA IMPACT | TATSUMI | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 加藤綾真 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 浅野功暉 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | カーン・ソガズ | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 時任流架 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 鈴木幹也 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 中川内 羽矢斗 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 熊澤バイオレンス | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 宜野座ケビン | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 大澤空 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | ユリカ・グラップリングシュートボクサーズジム | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | パク・ソヨン | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | SHOYA | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 吉田翼 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 朱里グラップリングシュートボクサーズジム | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | チェ・ウンジ | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 青井佑磨 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 三島康貴 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 黒川晃司 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 早田大牙 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 三ツ塚勇介 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 永井宏人 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 古市陸 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 橋上壮馬 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 椿馨 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 青代享 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 山田悠太 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 川畑凜斗 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 内田 菱牙 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 吉口聖也 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 真下健嗣 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 土屋太郎 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 細川晄希 | deep-nagoya-impact-2026-2nd-round |
| DEEP NAGOYA IMPACT | 倉冨立聖 | deep-nagoya-impact-2026-2nd-round |
| DEEP HAMAMATSU IMPACT | 内山拓真 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 奥野充貴 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 木之下喧壱 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 青田剛 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 大野勇斗 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | AKIYOSHI | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 西原大貴 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 伊藤一輝 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | ルーク中村 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 小林ゆたか | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 真野アミル | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 平井総一郎 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | マサムネ | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 一輝 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 佐藤修斗 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 加藤翔奏 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | ショーン・ホマレー | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 高田真音 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 石津隼人 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 菊池創太 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | フェリペ・ハセヤマ | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 上瀬あかり | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 渡邊花美 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 和久田月聖 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 黒太翔人 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | トーマ | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | RYUA | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | ランボルギーニ | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 高橋典斗 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 金子徹哉 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 平田大地 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 久留拓磨 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 仁 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 熊谷輝彦 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 金城壮志 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 津島忠彦 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 中村大和 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | 比企那菜実 | deep-hamamatsu-impact-2026-1st-round |
| DEEP HAMAMATSU IMPACT | AKINA | deep-hamamatsu-impact-2026-1st-round |
| DEEP JEWELS | 中井りん | deep-jewels-52-2 |
| DEEP JEWELS | 奥富夕夏 | deep-jewels-52-2 |
| DEEP JEWELS | 竹林 エル | deep-jewels-52-2 |
| DEEP JEWELS | ののか | deep-jewels-52-2 |
| DEEP JEWELS | キム・ソユル | deep-jewels-52-2 |
| DEEP JEWELS | 桐生祐子 | deep-jewels-52-2 |
| DEEP JEWELS | 月井隼南 | deep-jewels-52-2 |
| DEEP JEWELS | 彩綺 | deep-jewels-52-2 |
| DEEP JEWELS | abbie | deep-jewels-52-2 |
| DEEP JEWELS | 樹季 | deep-jewels-52-2 |
| DEEP JEWELS | Te-a | deep-jewels-52-2 |
| DEEP JEWELS | 古林礼名 | deep-jewels-52-2 |
| DEEP JEWELS | 大井すず | deep-jewels-52-2 |
| DEEP JEWELS | SAAYA | deep-jewels-52-2 |
| DEEP JEWELS | 鈴木”BOSS”遥 | deep-jewels-52-2 |
| DEEP JEWELS | 田川真帆 | deep-jewels-52-2 |
| DEEP JEWELS | JUICY | deep-jewels-52-2 |
| DEEP JEWELS | うらら | deep-jewels-52-2 |
| DEEP JEWELS | 山吹マリン | deep-jewels-52-2 |
| DEEP JEWELS | 谷山心優 | deep-jewels-52-2 |
| DEEP JEWELS | あきぴ | deep-jewels-52-2 |
| DEEP JEWELS | 村松美直 | deep-jewels-52-2 |
| DEEP JEWELS | 愛温 | deep-jewels-52-2 |
| DEEP JEWELS | 山内梨緒 | deep-jewels-52-2 |
| DEEP JEWELS | 横江 明日香 | deep-jewels-52-2 |
| DEEP JEWELS | デスティニー | deep-jewels-52-2 |
| DEEP TOKYO IMPACT | 高橋遼伍 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 長谷川賢 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | ブラックタイガー | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | カンジ | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | KINNO | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 黒岡裕真 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 笹崎健司 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 坂本岳 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | ハム・ギワン | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 仁井田右楽 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 廣瀬裕斗 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 渡邉龍太郎 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | キンジ | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | ガブリエル | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 尚太郎 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | TAKUMA | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 猿丸凛太朗 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 菊間瑛太 | deep-tokyo-impact-2026-3rd-round |
| DEEP TOKYO IMPACT | 小嵐翔真 | deep-tokyo-impact-2026-3rd-round |
| DEEP IMPACT | 知名昴海 | deep-131-impact |
| DEEP IMPACT | 今野連弥 | deep-131-impact |
| DEEP IMPACT | 武井大将 | deep-131-impact |
| DEEP IMPACT | ショウエイ | deep-131-impact |
| DEEP IMPACT | 矢代光 | deep-131-impact |
| DEEP TOKYO IMPACT | 森俊樹 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 中村雄一 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 堂園悠 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 唐沢タツヤ | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 橋本優大 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | コビー・レオン | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 安永吏成 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 高橋健斗 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | トミー渡部 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 井上竜旗 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 寉岡樹記 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 藤井連 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 山田葵生 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | 佐藤聖優 | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | サンシャイン | deep-tokyo-impact-2026-2nd-round |
| DEEP TOKYO IMPACT | ごとう瑠海 | deep-tokyo-impact-2026-2nd-round |
| DEEP IMPACT | 谷口仁歩 | deep-130-impact |
| DEEP IMPACT | 高尾凌生 | deep-130-impact |
| DEEP IMPACT | 河島ノブヒデ | deep-130-impact |
| DEEP OSAKA IMPACT | 濱口奏琉 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 松場貴志 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 松原聖也 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 岩本達彦 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 藤田宇宙 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 木下竜馬 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 福田泰暉 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | あー子 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 瀧口脩生 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 田中壱季 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 井康勢 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | 大西未来 | deep-osaka-impact-2026-2nd-round |
| DEEP OSAKA IMPACT | HIME | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 武蔵 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 太一 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 今村豊 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | MANA | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 中尾あづき | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | ベンジャミン | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 武蔵坊慶輔 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 米原剛希 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 西川将輝 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | アモリン | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | ぽちゃんZ | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | Bobo飛鳥 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 近藤世里菜 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 佐藤勇真 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 朝井啓太 | deep-osaka-impact-2026-1st-round |
| DEEP OSAKA IMPACT | 杉映都 | deep-osaka-impact-2026-1st-round |
| DEEP JEWELS | 百湖 | deep-jewels-52 |
| DEEP JEWELS | 万智 | deep-jewels-52 |
| DEEP JEWELS | キム・ダンビ | deep-jewels-52 |
| DEEP JEWELS | 海咲イルカ | deep-jewels-52 |
| DEEP JEWELS | 堀井かりん | deep-jewels-52 |
| DEEP JEWELS | 横瀬友愛 | deep-jewels-52 |
| DEEP JEWELS | 岡美紀 | deep-jewels-52 |
| DEEP JEWELS | 坂本瑠華 | deep-jewels-52 |
| DEEP JEWELS | ダイナマイト♡ユラ | deep-jewels-52 |
| DEEP JEWELS | 島村優花 | deep-jewels-52 |
| DEEP JEWELS | 中澤諒香 | deep-jewels-52 |
| DEEP JEWELS | 村井成美 | deep-jewels-52 |
| DEEP JEWELS | ちゃんりな | deep-jewels-52 |
| DEEP JEWELS | せりな | deep-jewels-52 |
| DEEP JEWELS | 山岸佳音 | deep-jewels-52 |
| DEEP JEWELS | たから | deep-jewels-52 |
| DEEP TOKYO IMPACT | 関鉄矢 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 黒井海成 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 中務修良 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 御代川敏志 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 吉田悠太郎 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | ウラケン | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 平井聡一朗 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 石井涼馬 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 西山亮翔 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 小林よしずみ | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 小笠原孝成 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | 須山豪 | deep-tokyo-impact-2026-1st-round |
| DEEP TOKYO IMPACT | Michael北見 | deep-tokyo-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 吉田陸 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 脇田仁 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 藤岡陸 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 田中慎一郎 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 平澤克明 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 小澤亮太 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 加藤颯 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 勇太 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 大岩翔哉 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 川崎ごうる | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 前田遊 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 出口誉 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 伊藤叶 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 権藤悠太郎 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 杉村祥真 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 切嶋黎 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 石田ガリット勝也 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 村田和生 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 福山佳祐 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 濱本佳樹 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 武山詩音 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 森大夢 | deep-nagoya-impact-2026-1st-round |
| DEEP NAGOYA IMPACT | 内野誠哉 | deep-nagoya-impact-2026-1st-round |
| DEEP FIGHT CHALLENGE | 佐々木耀 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | トミー渡辺 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | アニンタ・アリ | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | ホワイトベア | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 佐藤カナウ | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 佐藤照栄 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 福嶋司 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 金子蒼空 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | 横山桔平 | deep-fight-challenge-2026-1st-round |
| DEEP FIGHT CHALLENGE | ランペイジ竜太 | deep-fight-challenge-2026-1st-round |
| DEEP TOKYO IMPACT | 越智晴雄 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 安谷屋智弘 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 松岡疾人 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 野尻大輔 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 左京 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 堀内美沙紀 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 国分獅斗 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 菊池佳歩 | deep-tokyo-impact-2025-6th-round |
| DEEP TOKYO IMPACT | 佐藤凛 | deep-tokyo-impact-2025-6th-round |
| DEEP IMPACT | 奥山貴大 | deep-129-impact |
| DEEP IMPACT | 水野竜也 | deep-129-impact |
| DEEP IMPACT | 稲田将 | deep-129-impact |
| DEEP IMPACT | 橋本ユウタ | deep-129-impact |
| DEEP IMPACT | 荒井銀二 | deep-129-impact |
| DEEP IMPACT | 平石光一 | deep-129-impact |
| DEEP IMPACT | ハチミツ大魔王 | deep-129-impact |
| DEEP OSAKA IMPACT | 延命そら | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 牧野滉風 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 三村亘 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 鈴木琢仁 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 大家皆 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 山﨑鼓大 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 田口貴規 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 大澤将司 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 上田拳翔 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 上村亮馬 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 原田闘鬼 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 丸山晃毅 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 石田拓己 | deep-osaka-impact-2025-5th-round |
| DEEP OSAKA IMPACT | 吉村凌仁郎 | deep-osaka-impact-2025-5th-round |
| DEEP JEWELS | 浜崎朱加 | deep-jewels-51 |
| DEEP JEWELS | サラ | deep-jewels-51 |
| DEEP JEWELS | 小雪 | deep-jewels-51 |
| DEEP JEWELS | 五十嵐莉子 | deep-jewels-51 |
| DEEP JEWELS | 和智美音 | deep-jewels-51 |
| DEEP TOKYO IMPACT | Guts | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 神酒龍一 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 湯浅帝蓮 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 多湖力翔 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | キム・ミンソク | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 山口コウタ | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 丈太 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 田中悠翔 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 池森ヨシキ | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 松元大樹 | deep-tokyo-impact-2025-5th-round |
| DEEP TOKYO IMPACT | 上田遥斗 | deep-tokyo-impact-2025-5th-round |
| DEEP IMPACT | 大木良太 | deep-128-impact |
| DEEP IMPACT | 高野優樹 | deep-128-impact |
| DEEP IMPACT | 木村琉音 | deep-128-impact |
| DEEP IMPACT | バッファロー | deep-128-impact |
| DEEP IMPACT | 大将 | deep-128-impact |
| DEEP HAMAMATSU IMPACT | 桜井聡紀 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 武田祈和 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | イトカズ・コウセイ | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 小林桜太 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 南谷純也 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | ドリーム★キミ | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 喪黒★福蔵 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 胸毛ニキ | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 切嶋龍希 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | Akiyoshi | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 金光優真 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 中野ハヤト | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 高林和真 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 和泉直人 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | WATARU | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 中川北斗 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 小林直貴 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 伊藤陸都 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 高山敦 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 稲村健心 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 鈴木克彰 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 加藤宥希 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 大川怜輝 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 伊藤佑都 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 鈴木柚来 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 望月琉偉 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 袴田玲 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 浅野劉生 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 河合奏太朗 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 有村至恩 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 山本凌己 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP HAMAMATSU IMPACT | 児玉英志朗 | deep-hamamatsu-impact-2025-2nd-round |
| DEEP OSAKA IMPACT | 前園渓 | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | GINJI | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | 澄斗 | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | 大原宇竜 | deep-osaka-impact-2025-4th-round |
| DEEP OSAKA IMPACT | チェ・ソンヒョク | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | サダエ☆マヌーフ | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 大野“虎眼”賢良 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 砂田華社 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 横瀬美久 | deep-osaka-impact-2025-3rd-round |
| DEEP OSAKA IMPACT | 成本優良 | deep-osaka-impact-2025-3rd-round |
| DEEP IMPACT | 佐藤洋一郎 | deep-127-impact-2 |
| DEEP IMPACT | 郷野聡寛 | deep-127-impact-2 |
| DEEP IMPACT | 近藤有己 | deep-127-impact-2 |
| DEEP IMPACT | 春日井“寒天”たけし | deep-127-impact-2 |
| DEEP IMPACT | 石塚雄馬 | deep-127-impact-2 |
| DEEP IMPACT | 菊川イサム | deep-127-impact-2 |
| DEEP IMPACT | RYOTA | deep-127-impact-2 |
| DEEP JEWELS | 富松恵美 | deep-jewels-50 |
| DEEP JEWELS | きたりこ | deep-jewels-50 |
| DEEP JEWELS | MANAKA | deep-jewels-50 |
| DEEP JEWELS | 谷山瞳 | deep-jewels-50 |
| DEEP JEWELS | ジャカ季美香 | deep-jewels-50 |
| DEEP JEWELS | 須山ゆな | deep-jewels-50 |
| DEEP TOKYO IMPACT | アサン・ゲェイデ | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 颯斗 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 生田大雅 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 大和田龍斗 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 菅涼星 | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | ダイア | deep-tokyo-impact-2025-4th-round |
| DEEP TOKYO IMPACT | 岸翔大 | deep-tokyo-impact-2025-4th-round |
| DEEP IMPACT | 原虎徹 | deep-126-impact |
| DEEP NAGOYA IMPACT | 八尋大輝 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 草野ガブリエル | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 中西哲夫 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 野木崇政 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 河村嘉展 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 髙村友晴 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | もも太郎 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 福井達郎 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 平山稔和 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 河野太喜 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 熊澤愛希也 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 西川玲司 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 大森仁 | deep-nagoya-impact-2025-1st-round |
| DEEP NAGOYA IMPACT | 西村凛惺 | deep-nagoya-impact-2025-1st-round |

件数: 413 件(missingと一致)

## 5. name_confidence = decorated_suspect の全件(異名剥がれ疑い)

| brand | name_raw | status |
|---|---|---|
| DEEP NAGOYA IMPACT | 石田ガリット勝也 | missing |

## 6. 取得・パースできなかったイベント

- **failed** DEEP OSAKA IMPACT 2026 5th ROUND(https://www.deep2001.com/deep-osaka-impact-2026-5th-round/): 開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト
- **failed** DEEP OSAKA IMPACT 2026 4th ROUND(https://www.deep2001.com/deep-osaka-impact-2026-4th-round/): 開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト
- **failed** DEEP 133 IMPACT(https://www.deep2001.com/deep-133-impact/): 開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト
- **failed** DEEP JEWELS 54(https://www.deep2001.com/deep-jewels-54/): 開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト
- **failed** DEEP TOKYO IMPACT 2026 4th ROUND(https://www.deep2001.com/deep-tokyo-impact-2026-4th-round/): 開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト
- **failed** Grasp the future cage2(https://www.deep2001.com/grasp-the-future-cage2/): 開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト
- **failed** DEEPフューチャーキングトーナメント2025(https://www.deep2001.com/%e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025/): 開催日は確認できたが結果マーカー(●/○/〇/△)が検出できず。未開催の対戦カード発表ページの可能性、または未知のレイアウト
- **failed** DEEP NAGOYA IMPACT 2023 公武堂ファイト 3rd ROUND/4th ROUND(https://www.deep2001.com/deep-nagoya-impact-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88/): 開催日・結果とも検出できず(構造不明)
- **failed** DEEP OSAKA IMPACT 2023 2nd ROUND(https://www.deep2001.com/deep-osaka-impact-2023-2nd-round/): 開催日・結果とも検出できず(構造不明)
- **failed** DEEP X NARIAGARI(https://www.deep2001.com/deep-x-nariagari/): 開催日・結果とも検出できず(構造不明)

### ブランド分類が既知パターンに一致しなかったイベント(`other`。黙って除外していない)

- Grasp the future cage2(https://www.deep2001.com/grasp-the-future-cage2/)
- DEEPフューチャーキングトーナメント2025(https://www.deep2001.com/%e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025/)
- DEEPフューチャーキングトーナメント2024(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882024/)
- DEEPサマーフェスティバル2024 inお台場(https://www.deep2001.com/deep%e3%82%b5%e3%83%9e%e3%83%bc%e3%83%95%e3%82%a7%e3%82%b9%e3%83%86%e3%82%a3%e3%83%90%e3%83%ab2024-in%e3%81%8a%e5%8f%b0%e5%a0%b4/)
- DEEP CAGE IMPACT 2024 in HAMAMATSU(https://www.deep2001.com/deep-cage-impact-2024-in-hamamatsu/)
- DEEPフューチャーキングトーナメント2023(https://www.deep2001.com/deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882023/)
- DEEP X NARIAGARI(https://www.deep2001.com/deep-x-nariagari/)

## 7. 監査③成果物との突合

**比較不能**: 監査③の成果物(`wiki_missing_deep_pancrase_shooto.csv`等)を以下のパスで探索したが見つからなかった(ローカルtmpで揮発した可能性がある、と指示書に記載の通り)。再生成は今回のスコープ外。

- /Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/deep-event-roster-discovery/out/wiki_missing_deep_pancrase_shooto.csv(存在せず)
- /var/folders/9p/1qp82wsd4qlggh4r95y5sj940000gn/T/wiki_missing_deep_pancrase_shooto.csv(存在せず)

## 8. S4集計

- ユニーク選手数(必達セット, name_normalizedベース): 481
- listed=64 / hidden=4 / missing=413(いずれもユニーク選手数ベース)
- match_confidence=none: ユニーク413件(延べ出場行ベースでは658件。1人が複数大会に出た分を含む延べ数)
- name_confidence分布: clean=429 / decorated_suspect=1 / kana_only=50 / foreign=1
- 出場回数分布: 1回のみ=282 / 2回=114 / 3回以上=85(優先度づけではなく単なる分布の報告)

## 9. 自己検証

- 対象期間内イベント数(40) ≤ 60: OK
- ユニーク選手数(481) ≤ 400: NG
- ユニーク選手数(481) = listed+hidden+missing(481): 一致
- match_confidence=none のユニーク件数(413) = §3/§4リストの行数(413): 一致
- match_confidence=none の延べ件数(658) = missingの延べ件数(658): 一致(参加者行レベルの内部整合性チェック)
- 参加者行数 = 各イベント試合数×2: 全イベントで一致(不一致があれば実行時にexit 1)

