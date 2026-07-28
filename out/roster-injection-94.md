# パンクラス・修斗94名の投入(hidden) 実施報告

生成日時: 2026-07-28(JST)
入力: PR #248(パンクラス公式アーカイブ35名+listed16名)/ PR #247(修斗公式アーカイブ必達60名+listed19名)の `out/` 成果物。**再取得・再抽出はしていない**(取得済みCSV/MDのみを読んだ)。
対象ブランチ: `feat/roster-injection-94`(マージしない・公開しない。draft PR済み)

## サマリー

- 投入対象: **92名**(修斗必達60名+パンクラス必達35名=94名 − 除外1名 − 重複統合1組2名→1名)
- 除外: 1名(エルナニ ペルペトゥオ。理由は後述)
- 修斗×パンクラス重複統合: 2組(KAREN、SARAMI。両団体のbout履歴を1レコードに統合し `orgs: ["shooto","pancrase"]` を付与)
- 既存 `FIGHTERS`(hidden含む258名)との重複: **0件**
- slug衝突(投入対象内+既存FIGHTERS全体): **0件**
- 階級(weightClass)null: **1名**(HENRY)
- 全員 `hidden: true, needsReview: true` で投入。公開はしていない。

停止条件(いずれも非該当): slug衝突20件超→**0件**／既存listedとの重複→**0件**／階級null30名超→**1名**／AI RIZINランキング変化→**0件**(後述)。

## 1. 突合・重複解消

修斗必達60名とパンクラス必達35名を正規化名(空白除去)で突合した結果、**KAREN**と**SARAMI**の2名が両団体に出場歴があった。

- **KAREN**: 修斗1戦(2023-12-02、COLORS Produce by SHOOTO Vol.2) + パンクラス12戦(2019-2025)。1レコードに統合、`org: "pancrase"`(直近試合の団体)、`orgs: ["shooto","pancrase"]`。
- **SARAMI**: 修斗4戦(2020-2023) + パンクラス3戦(2023-2024)。同様に統合、`org: "pancrase"`、`orgs: ["shooto","pancrase"]`。

他の92名はいずれか一方の団体のみでの出場。

`Fighter`インターフェースに `orgs?: SourceKey[]` を追加した([src/lib/fighters.ts](../src/lib/fighters.ts)のコメント参照)。既存の `org`(単一値)の意味・挙動は変えていない(既存のランキング/フィルタ絞り込みは全て `org` 単一値ベースのままで、これは変更していない)。

## 2. 除外1名

| 選手名 | 団体 | 理由 |
|---|---|---|
| エルナニ ペルペトゥオ | 修斗 | 修斗アーカイブ上でbout 0件。選手紹介ページの最終戦績日付(2013-08-25)が `/result/` 一覧の網羅期間(228件)より古く、該当試合が現行一覧に存在しない。#247報告書「既知の制限事項6」に記載済みの、上流サイト側のアーカイブ疎密によるギャップであり、抽出漏れではない。 |

## 3. slug/nameEn の決定方法と確度

「名鑑のローマ字を候補にする。衝突は全件列挙して人間判断に回す(自動で連番を振らない)」の方針で、以下の優先順で機械的に決定した。**いずれの階層でも一意に読みを確定できない場合は推測で埋めていない。**

1. **修斗名鑑ローマ字(必達60名分)**: 62名(統合後57名+KAREN/SARAMIの一部)。shootoの選手紹介ページに掲載されているローマ字表記(例 "Ken Asahina")をそのまま使う。2語表記は"Given Family"順とみなし、slugは`family-given`に反転(既存DB規約 `taira-tatsuro` 等に合わせた)。
2. **修斗名鑑全1898名からの逆引き**: パンクラス専属者(必達35名側)でも、修斗名鑑の全件(必達対象外含む)に同名が見つかった場合はそちらのローマ字を採用。3名(透暉鷹→Hoiin Tou、合島大樹→Daiki Gojima、ライカ→Raika)がこれで解決した。
3. **パンクラス名鑑URLトークン(語境界未確定)**: **30名**。パンクラス名鑑にはローマ字の別カラムが無く、プロフィールURL自体がローマ字表記(例 `satoshogo.html`)。姓名の境界が不明なため、**ハイフンを入れずURLトークンをそのまま**slug/nameEnの元にした(例 `satoshogo` / nameEn "Satoshogo")。**人間が姓名の切れ目を確認してから公開すべき対象。**
4. **読み不確定・placeholder**: **3名**。修斗名鑑にローマ字が一切無く、漢字の読みが一意に確定できない選手。
   - `unconfirmed-shooto-1875`(砂辺 光久): 「スナベ」「イソベ」等、読みが一意に確定できない。
   - `unconfirmed-shooto-1849`(沙門): 「シャモン」「サモン」等、読みが一意に確定できない。
   - `nakajima-riku`(中島 陸): 一般的な読み(Nakajima Riku)からの最善推定。ローマ字表記での確認はできていない(placeholderではなく推定値だが未確認)。
5. **カタカナ音写からの最善推定**: 1名。`valenzuela-victor`(ヴィクター バレンズエラ): カタカナ音写(Victor Valenzuela)からの推定。未確認。
6. **ラテン表記そのまま**: 1名。`henry`(HENRY): nameJa自体が既にラテン文字。

slug衝突チェック(投入対象内92名同士 + 既存FIGHTERS全258名との突合)は **0件**。

## 4. 階級(weightClass)

直近(全org横断で日付最新)のbout weightLabelを正規化して採用した。キャッチウェイト・トライアウト・アマチュア修斗等の非公式階級ラベルは階級シグナルとして使っていない(判定不能→null)。女子選手は生ラベルが男子と同綴りの場合(「フライ級」等)でも「女子フライ級」を優先するよう実装時に修正した(初回実装でバグがあり、KAREN/SARAMI/杉山しずか等が誤って男子階級に分類されていたのを発見・修正済み)。

**階級null: 1名**

| slug | 選手名 | 理由 |
|---|---|---|
| `henry` | HENRY | 唯一のbout(2026-03-29、岩﨑大河戦)がパンクラス/修斗いずれの元データでもweight_label欄が空。捏造しないため型上の要請で `weightClass: "不明"` という文字列を入れているが、これは階級null相当の意味(`WEIGHT_KG`に存在しないラベルなので階級別ランキング等には出ない・`weightSortKey`のフォールバック(9999)で末尾に安全に扱われる)。 |

## 5. 戦績・対戦テーブル

#247/#248の集計(no_marker/nc除く)をそのまま採用。history配列には勝敗分(win/loss/draw/nc)のみを収録し、未解決(判定不能)・マーカーなし試合は除外して報告書側に記録した(捏造しない。除外件数は各報告書の「マーカーなし/対象外」列と一致することを検証済み)。

- 総勝: 429 / 総敗: 260(92名合計、除外分の名田英平1試合(2012-11-25、event名が原資料側で空欄)を含む)
- 決着方法テキストは、修斗側は `result_type_text`(短縮コード or 判定スコア)と `result_method`(決まり技)を `コード/技名` で連結(パンクラス側の表記 `TKO/グラウンドのパンチ` と統一)。技名が無い場合はコードのみ(捏造しない)。
- roundフィールドは既存DB規約(`"R{n} {m:ss}"`)に合わせて結合。ラウンド情報が原資料に無い判定等は空文字。

## 6. 決定性・整合性チェック

- `parse_reports.py`→`generate.ts`→`emit.ts` を2回実行し、中間JSON・TSスニペットとも**バイト単位で完全一致**を確認(非決定性なし)。
- `npx tsc --noEmit`: エラーなし。
- `npm run build`(全checkスクリプト+next build): **exit 0、fatal 0件**。
  - `check:fighter-records`: fatal 0 / warning 14件(すべて投入前から存在する既存RIZIN選手の集計不一致。投入した92名はゼロ件、`data/fighterRecords.json`にまだ収録されていないため対象外)。
  - `check:rankings-slugs`: OK
  - `check:rizin-weightclass`: fatal 0(既存の警告のみ)
- `npm run test:mnews-rating`: **220件成功 / 0件失敗**(既存のレーティングエンジン回帰は無し)。

## 7. AI RIZINランキングへの影響: 0件(確認済み)

投入した92名は全員 `hidden: true` のため、`findFighterSlugByName`(RIZIN戦績バッチ `scripts/update-rizin-records.ts` が使う唯一の名前解決関数)の候補から機械的に除外される(`eligible()`が`f.hidden`を弾く実装)。

`data/rizinRecords.json` を全文検索したところ、投入した92名のうち5名(SARAMI、ソルト、山木麻弥、遠藤来生、杉山しずか)が**既存RIZIN選手の対戦相手として名前だけ**記録されていたが、いずれも `fighterBSlug: null`(未解決)のまま。hiddenである限り、今後 `update-rizin-records.ts` が再実行されても同じ理由でnullのまま変わらないことをコードで確認した(将来的な影響も無い)。`data/rankings.json` には92名いずれの一致も無い。

## 8. hiddenのまま選手ページを実機で開いた結果(重要)

ローカルdevサーバー(`next dev`、worktree内)で複数選手ページを開いて確認した。

### 8-1. 全員「データなし」と表示される(想定どおりの挙動・要注意点あり)

投入した92名のfighters.ts側 `wins/losses/history` に実データを入れているにも関わらず、**ローカルdevで開くと全員「データなし」("戦績データがありません")と表示される。**

原因: `/fighters/[slug]` は `resolveFighter()`(ライブWikipedia解決)ではなく `resolveFighterCached()` → `fetchFighterRecords()` を経由する。これは **GitHub raw経由でmainブランチの `data/fighterRecords.json` を取得するだけ**の設計(`src/lib/fighterRecordsCache.ts`)で、ローカルの `fighters.ts` 変更やローカルの `data/fighterRecords.json` 書き換えを一切参照しない。既存の全hidden投入(DEEP等)が `recordFromResults: true` + `wins:0` のプレースホルダーで統一されている理由もこれで腑に落ちた(表示に使われるのはバッチが焼き込んだキャッシュのみで、seed値自体は最初から「表示されない」設計)。

**本番で正しく戦績を表示させるには以下の3段階が必要**(このPR単体では発生しない):
1. 本PRがmainにマージされる
2. `update-fighter-records.ts` バッチ(次回の定期実行 or 手動実行)が新規92slugを処理し `data/fighterRecords.json` に書き込む
3. その結果がコミット・デプロイされる

### 8-2. バッチ解決ロジックを手元で個別シミュレーションした結果(`--slug=`モード)

`scripts/update-fighter-records.ts --slug=<slug>` は1名だけ実際にWikipedia解決を試して結果を返すモードがあったため、92名全員に対して実行し、**本番相当の最終解決結果を検証した**(このローカル実行結果自体は `data/fighterRecords.json` に書き込まれたが、検証目的のみのため**作業後に `git checkout` で元に戻し、このPRの差分には含めていない**)。

**81名は想定どおり**: Wikipedia記事が見つからず、投入したseed値(archive集計)がそのまま採用された(`live: false`)。数値は投入値と完全一致することを確認(例: `asahina-ken` 10-7-0、`karen` 10-3-0、`satoshogo` 5-1-0)。

**11名でWikipedia記事が自動解決された**(`live: true`)。デフォルトタイトル推測(`nameJa`のスペース除去)によるもので、`recordFromResults`を使う既存hidden投入と違い**同名別人ガードが掛かっていない**(このガードは`fighter.recordFromResults`時のみ有効)。9名で投入した集計値と大きく異なる戦績が採用された:

| slug | 選手名 | 投入(archive集計) | Wikipedia採用後 | 所見 |
|---|---|---|---|---|
| `unconfirmed-shooto-1875` | 砂辺 光久 | 2-0-0 | 30-13-4(47戦) | **★要確認・別人の疑いが強い**。TENKAICHI/CAGE FORCE(2008年台の旧団体)を含む古いキャリアと、修斗の新規登録ID(1875=直近登録)が整合しない。 |
| `nakajima-riku` | 中島 陸 | 8-1-0 | 6-0-1(7戦) | 修斗のみの経歴で件数は近い。同一人物の可能性あり要確認。 |
| `iwasaki-taiga` | 岩﨑 大河 | 7-1-0 | 11-2-0(13戦) | 修斗+パンクラスの経歴で範囲が近い。同一人物の可能性あり要確認。 |
| `aono-hikaru` | 青野 ひかる | 2-1-0 | 14-8-0(22戦) | DEEP+修斗の経歴が加わる。要確認。 |
| `aya-murakami` | 村上 彩 | 2-3-0 | 10-4-0(14戦) | DEEP+修斗の経歴が加わる。要確認。 |
| `kurobe-mina` | 黒部 三奈 | 6-4-0 | 18-7-0(25戦) | RIZIN/DEEP/ROAD FC/JEWELS等を含む長いキャリア。ベテラン女子選手の可能性(同名別人の懸念は比較的低いが未確認)。 |
| `sarami` | SARAMI | 6-1-0 | 20-14-0(34戦) | RIZIN/ONE/JEWELS/ROAD FC/PXC等。特徴的な芸名のため同一人物の可能性が高いと見るが未確認。 |
| `fujino-emi` | 藤野 恵実 | 6-0-0 | 31-16-1(49戦) | SMACKGIRL(2006〜)からJEWELS/RIZIN/DEEPまで及ぶ長期キャリア。ベテラン復帰選手の可能性が高いと見るが未確認。 |
| `sugiyama` | 杉山しずか | 3-1-0 | 23-8-1(33戦) | JEWELS全期間+RIZIN/ONE/DEEP。ベテラン女子選手の可能性が高いと見るが未確認。 |

(残り2名: `watanabe-ayaka` 3-1-0→4-3-0、`yamakimahiro` 3-2-0→3-3-0 は差異小さく実害は低いと見る。)

**このPRでは同名別人ガードの実装変更(スコープ外の設計変更)はしていない。** 上記9名は、hidden解除前の人間レビューで実在確認(同一人物かどうか)を行い、別人と判断される場合は該当選手に `wikiTitleJa: ""` を明示設定してデフォルトタイトル推測を無効化する対応を推奨する(コード上、`wikiTitleJa`が空文字の場合は`??`演算子がfalsy扱いせずそのまま使われるため、Wikipedia解決が空タイトルで失敗しseed値にフォールバックする ことをコードリーディングで確認済み。ただし実機での動作確認はしていない)。

### 8-3. その他の表示確認

- `/fighters`(選手データベース一覧)に投入した92名は表示されない(hidden除外が機能している)ことを確認。
- 階級表示(`weightClass: "不明"`)は不正な階級文字列として安全にフォールバックされ、ページを壊さないことを確認(HENRYのページで実機確認)。
- devサーバーのログにエラー・500は一切発生していない。

## 9. 差分ファイル

- `src/lib/fighters.ts`: `Fighter`インターフェースに`orgs?: SourceKey[]`追加 + FIGHTERS配列末尾に92名分のエントリを追加。
- `scripts/roster-injection-94/`: 生成に使った読み取り専用スクリプト一式(`parse_reports.py` / `generate.ts` / `emit.ts`)。今後の同種投入の参考に残置。
- `out/pancrase-{bouts,fighters}.csv` / `out/pancrase-records.md` / `out/shooto-{bouts,fighters}.csv` / `out/shooto-records.md`: PR #247/#248成果物のコピー(このリポジトリの `out/` は.gitignore対象だが、他worktreeから取り込んだ元ファイル。差分としては追跡されない)。
- `out/roster-injection-94.md`: 本ファイル。

## 付録: 投入92名 一覧

`⚠パンクラスURL(語境界未確定)`= slug/nameEnとも姓名の切れ目が未確認(30名)。`⚠要人間確認(読み不確定)`= 読みそのものが確定できない/最善推定(4名)。`⚠null(不明)`= weightClass判定不能。詳細は本文3〜4節参照。

| slug | nameJa | nameEn | org(s) | 階級 | 戦績(W-L-D) | slug確度 |
|---|---|---|---|---|---|---|
| `aono-hikaru` | 青野 ひかる | Hikaru Aono | shooto | 女子アトム級 | 2-1-0 | 修斗名鑑ローマ字 |
| `aratadaiki` | 荒田大輝 | Aratadaiki | pancrase | バンタム級 | 6-1-0 | ⚠パンクラスURL(語境界未確定) |
| `asadulloev` | バラカトゥロ・アサドゥラエフ | Asadulloev | pancrase | バンタム級 | 1-0-0 | ⚠パンクラスURL(語境界未確定) |
| `asahina-ken` | 旭那 拳 | Ken Asahina | shooto | ストロー級 | 10-7-0 | 修斗名鑑ローマ字 |
| `aya-murakami` | 村上 彩 | Murakami Aya | shooto | 女子スーパーアトム級 | 2-3-0 | 修斗名鑑ローマ字 |
| `azumi-kento` | 安海 健人 | Kento Azumi | shooto | ライト級 | 3-1-1 | 修斗名鑑ローマ字 |
| `baikin-dokuichiro` | 梅筋 毒一郎 | Dokuichiro Baikin | shooto | フライ級 | 1-2-0 | 修斗名鑑ローマ字 |
| `body-maxthe` | マックス・ザ・ボディ | Max The Body | shooto | ライト級 | 4-5-0 | 修斗名鑑ローマ字 |
| `dinesh-nain` | ネイン デイネッシュ | Nain Dinesh | shooto | フェザー級 | 7-2-0 | 修斗名鑑ローマ字 |
| `endoraiki` | 遠藤来生 | Endoraiki | pancrase | フェザー級 | 3-8-0 | ⚠パンクラスURL(語境界未確定) |
| `erika` | erika | Erika | shooto | 女子スーパーアトム級 | 3-1-0 | 修斗名鑑ローマ字 |
| `fujii-nobuki` | 藤井 伸樹 | Nobuki Fujii | shooto | バンタム級 | 8-8-0 | 修斗名鑑ローマ字 |
| `fujino-emi` | 藤野 恵実 | Emi Fujino | shooto | 女子ストロー級 | 6-0-0 | 修斗名鑑ローマ字 |
| `gojima-daiki` | 合島大樹 | Daiki Gojima | pancrase | バンタム級 | 8-9-1 | 修斗名鑑ローマ字 |
| `hailaiwusamo` | ハイライ ウーシャアモー | Hailaiwusamo | shooto | 女子ストロー級 | 1-0-0 | 修斗名鑑ローマ字 |
| `hamamoto` | 浜本キャット雄大 | Hamamoto | pancrase | フライ級 | 1-3-0 | ⚠パンクラスURL(語境界未確定) |
| `henry` | HENRY | Henry | shooto | ⚠null(不明) | 0-1-0 | ラテン表記そのまま |
| `hirata-ayane` | 平田 彩音 | Ayane Hirata | shooto | 女子アトム級 | 4-2-0 | 修斗名鑑ローマ字 |
| `hoshuyama-momoka` | 宝珠山 桃花 | Momoka Hoshuyama | shooto | 女子ストロー級 | 8-7-0 | 修斗名鑑ローマ字 |
| `huang-jenny` | ジェニー ファン | Jenny Huang | shooto | 女子アトム級 | 1-1-0 | 修斗名鑑ローマ字 |
| `iino-yuto` | 飯野 雄斗 | Yuto Iino | shooto | フェザー級 | 5-0-0 | 修斗名鑑ローマ字 |
| `ishidarikuya` | 石田陸也 | Ishidarikuya | pancrase | フェザー級 | 3-5-0 | ⚠パンクラスURL(語境界未確定) |
| `itokawayoshito` | 糸川義人 | Itokawayoshito | pancrase | フェザー級 | 4-7-0 | ⚠パンクラスURL(語境界未確定) |
| `iwasaki-taiga` | 岩﨑 大河 | Taiga Iwasaki | shooto | ミドル級 | 7-1-0 | 修斗名鑑ローマ字 |
| `kanayumu` | 菅歩夢 | Kanayumu | pancrase | フライ級 | 6-2-0 | ⚠パンクラスURL(語境界未確定) |
| `karen` | KAREN | Karen | shooto+pancrase | 女子ストロー級 | 10-3-0 | 修斗名鑑ローマ字 |
| `katayama-tomoe` | 片山 智絵 | Tomoe Katayama | shooto | 女子スーパーアトム級 | 3-1-0 | 修斗名鑑ローマ字 |
| `kawakita-haruki` | 川北 晏生 | Haruki Kawakita | shooto | バンタム級 | 6-1-3 | 修斗名鑑ローマ字 |
| `kobayashiryohei` | 小林了平 | Kobayashiryohei | pancrase | フライ級 | 2-3-0 | ⚠パンクラスURL(語境界未確定) |
| `kurobe-mina` | 黒部 三奈 | Mina Kurobe | shooto | 女子ストロー級 | 6-4-0 | 修斗名鑑ローマ字 |
| `lightyear-daiki` | ダイキ ライトイヤー | Daiki Lightyear | shooto | バンタム級 | 9-9-2 | 修斗名鑑ローマ字 |
| `maedakohei` | 前田浩平 | Maedakohei | pancrase | バンタム級 | 10-8-0 | ⚠パンクラスURL(語境界未確定) |
| `masudataiga` | 増田大河 | Masudataiga | pancrase | フライ級 | 4-3-0 | ⚠パンクラスURL(語境界未確定) |
| `mio-shiyama` | 嶋屋 澪 | Shiyama Mio | shooto | 女子アトム級 | 2-5-1 | 修斗名鑑ローマ字 |
| `motokawaharuaki` | 本川ハルアキ | Motokawaharuaki | pancrase | フライ級 | 3-0-0 | ⚠パンクラスURL(語境界未確定) |
| `motonomiki` | 本野美樹 | Motonomiki | pancrase | 女子ストロー級 | 2-0-0 | ⚠パンクラスURL(語境界未確定) |
| `nada` | 名田英平 | Nada | pancrase | フェザー級 | 10-9-2 | ⚠パンクラスURL(語境界未確定) |
| `nakaike-takehiro` | 中池 武寛 | Takehiro Nakaike | shooto | フライ級 | 8-2-0 | 修斗名鑑ローマ字 |
| `nakajima-riku` | 中島 陸 | Riku Nakajima | shooto | バンタム級 | 8-1-0 | ⚠要人間確認(読み不確定) |
| `nakamura-miku` | 中村 未来 | Miku Nakamura | shooto | 女子アトム級 | 9-6-0 | 修斗名鑑ローマ字 |
| `noa-tokumoto` | 徳本 望愛 | Tokumoto Noa | shooto | 女子アトム級 | 5-1-0 | 修斗名鑑ローマ字 |
| `nojiri-yasuyuki` | 野尻 定由 | Yasuyuki Nojiri | shooto | バンタム級 | 7-6-2 | 修斗名鑑ローマ字 |
| `okada-arashi` | 岡田 嵐士 | Arashi Okada | shooto | フライ級 | 7-2-0 | 修斗名鑑ローマ字 |
| `okadatakuma` | 岡田拓真 | Okadatakuma | pancrase | フェザー級 | 5-2-0 | ⚠パンクラスURL(語境界未確定) |
| `park-bohyun` | パク ボヒョン | Bo Hyun Park | shooto | 女子ストロー級 | 3-0-0 | 修斗名鑑ローマ字 |
| `park-jongjun` | パク ジョンジュン | Jong Jun Park | shooto | フェザー級 | 1-0-0 | 修斗名鑑ローマ字 |
| `rafaelribeiro` | ラファエル・リベイロ | Rafaelribeiro | pancrase | フライ級 | 2-1-0 | ⚠パンクラスURL(語境界未確定) |
| `raika` | ライカ | Raika | pancrase | 女子フライ級 | 7-8-0 | 修斗名鑑ローマ字 |
| `ryoa` | Ryo | Ryoa | pancrase | フェザー級 | 5-7-0 | ⚠パンクラスURL(語境界未確定) |
| `saito-tsubasa` | 齋藤 翼 | Tsubasa Saito | shooto | フェザー級 | 13-10-0 | 修斗名鑑ローマ字 |
| `salt` | ソルト | Salt | shooto | 女子ストロー級 | 2-4-0 | 修斗名鑑ローマ字 |
| `sarami` | SARAMI | Sarami | shooto+pancrase | 女子アトム級 | 6-1-0 | 修斗名鑑ローマ字 |
| `satoru` | 猿飛流 | Satoru | pancrase | フライ級 | 10-4-0 | ⚠パンクラスURL(語境界未確定) |
| `satoshogo` | 佐藤生虎 | Satoshogo | pancrase | ウェルター級 | 5-1-0 | ⚠パンクラスURL(語境界未確定) |
| `satoyujibonsai` | 佐藤ゆうじ | Satoyujibonsai | pancrase | バンタム級 | 4-3-0 | ⚠パンクラスURL(語境界未確定) |
| `sekisena` | 関翔渚 | Sekisena | pancrase | フェザー級 | 4-0-0 | ⚠パンクラスURL(語境界未確定) |
| `shikijima-kazuma` | 磯城嶋 一真 | Kazuma Shikijima | shooto | フェザー級 | 6-1-2 | 修斗名鑑ローマ字 |
| `shiraijoji` | 白井誠司 | Shiraijoji | pancrase | バンタム級 | 4-1-0 | ⚠パンクラスURL(語境界未確定) |
| `sugimoto-megumi` | 杉本 恵 | Megumi Sugimoto | shooto | 女子アトム級 | 11-7-1 | 修斗名鑑ローマ字 |
| `sugimoto-seiya` | 杉本 静弥 | Seiya Sugimoto | shooto | フライ級 | 5-1-1 | 修斗名鑑ローマ字 |
| `sugiyama` | 杉山しずか | Sugiyama | pancrase | 女子フライ級 | 3-1-0 | ⚠パンクラスURL(語境界未確定) |
| `susung` | チョウ スソン | Susung | shooto | バンタム級 | 4-2-0 | 修斗名鑑ローマ字 |
| `suzuki-takeru` | 鈴木 尊 | Takeru Suzuki | shooto | フライ級 | 5-0-0 | 修斗名鑑ローマ字 |
| `suzukiyuto` | 鈴木悠斗 | Suzukiyuto | pancrase | ライト級 | 6-1-0 | ⚠パンクラスURL(語境界未確定) |
| `taguchi-keita` | 田口 恵大 | Keita Taguchi | shooto | ストロー級 | 2-4-0 | 修斗名鑑ローマ字 |
| `taira` | 平信一 | Taira | pancrase | ライト級 | 7-7-0 | ⚠パンクラスURL(語境界未確定) |
| `takada-atsuhi` | 高田 暖妃 | Atsuhi Takada | shooto | 女子ストロー級 | 3-1-0 | 修斗名鑑ローマ字 |
| `takamoto-chiyo` | 高本 千代 | Chiyo Takamoto | shooto | 女子スーパーアトム級 | 3-4-1 | 修斗名鑑ローマ字 |
| `tamura-hibiki` | 田村 ヒビキ | Hibiki Tamura | shooto | ウェルター級 | 1-0-0 | 修斗名鑑ローマ字 |
| `tanaka-yu` | 田中 有 | Yu Tanaka | shooto | ライト級 | 5-3-0 | 修斗名鑑ローマ字 |
| `teraokatakuei` | 寺岡拓永 | Teraokatakuei | pancrase | ストロー級 | 4-4-1 | ⚠パンクラスURL(語境界未確定) |
| `tomori-kota` | 友利 幸汰 | Kota Tomori | shooto | ストロー級 | 4-1-0 | 修斗名鑑ローマ字 |
| `tomori-rui` | 友利 琉偉 | Rui Tomori | shooto | ストロー級 | 4-3-0 | 修斗名鑑ローマ字 |
| `tou-hoiin` | 透暉鷹 | Hoiin Tou | pancrase | バンタム級 | 9-1-0 | 修斗名鑑ローマ字 |
| `tyson-nobumitsu` | 大尊 伸光 | Nobumitsu Tyson | shooto | ライト級 | 5-3-0 | 修斗名鑑ローマ字 |
| `uehara-taira` | 上原 平 | Taira Uehara | shooto | フェザー級 | 7-3-3 | 修斗名鑑ローマ字 |
| `uematsuyoshiki` | 植松洋貴 | Uematsuyoshiki | pancrase | フライ級 | 6-4-0 | ⚠パンクラスURL(語境界未確定) |
| `umeki-yutoku` | 梅木 勇徳 | Yutoku Umeki | shooto | ストロー級 | 4-6-1 | 修斗名鑑ローマ字 |
| `unconfirmed-shooto-1849` | 沙門 | Unconfirmed | shooto | ミドル級 | 1-1-0 | ⚠要人間確認(読み不確定) |
| `unconfirmed-shooto-1875` | 砂辺 光久 | Unconfirmed | shooto | フライ級 | 2-0-0 | ⚠要人間確認(読み不確定) |
| `valenzuela-victor` | ヴィクター バレンズエラ | Victor Valenzuela | shooto | ウェルター級 | 1-0-0 | ⚠要人間確認(読み不確定) |
| `wadaayane` | 和田綾音 | Wadaayane | pancrase | 女子フライ級 | 2-1-0 | ⚠パンクラスURL(語境界未確定) |
| `waki-grappler` | グラップラー脇 | Grappler Waki | shooto | ウェルター級 | 2-1-0 | 修斗名鑑ローマ字 |
| `watanabe-ayaka` | 渡辺 彩華 | Ayaka Watanabe | shooto | 女子スーパーアトム級 | 3-1-0 | 修斗名鑑ローマ字 |
| `yamakimahiro` | 山木麻弥 | Yamakimahiro | pancrase | バンタム級 | 3-2-0 | ⚠パンクラスURL(語境界未確定) |
| `yamasakisora` | 山崎蒼空 | Yamasakisora | pancrase | フライ級 | 5-1-0 | ⚠パンクラスURL(語境界未確定) |
| `yamauchi-wataru` | 山内 渉 | Wataru Yamauchi | shooto | フライ級 | 7-1-0 | 修斗名鑑ローマ字 |
| `young-kim` | キム ジェヨン | Kim Young | shooto | ミドル級 | 0-2-0 | 修斗名鑑ローマ字 |
| `young-parkseo` | パク ソヨン | Park Seo Young | shooto | 女子アトム級 | 3-3-0 | 修斗名鑑ローマ字 |
| `yuji-arai` | 荒井 勇ニ | Arai Yuji | shooto | ミドル級 | 1-1-0 | 修斗名鑑ローマ字 |
| `yuki-daiki` | 結城 大樹 | Daiki Yuki | shooto | ライト級 | 7-5-1 | 修斗名鑑ローマ字 |
| `zhangyuta` | 張豊 | Zhangyuta | pancrase | ライト級 | 2-1-0 | ⚠パンクラスURL(語境界未確定) |

