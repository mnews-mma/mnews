# data/fighterRecords.json B型(NC関連)38件の原因調査(read-only)

依頼: 「B型38件」のうち34件(NC扱い差)の真因を`update-fighter-records.ts`側で特定し、
NCを勝敗数に含めるか・history行として出すか、どちらが正しい仕様かを決められる材料を出す。
残り4件の個別データ不整合も原因を分類する。修正はしていない(read-only)。

## 結論(要約)

**34件(NC由来)側は、コード側の実装としてはバグではない。**
`wins/losses/draws`(集計値)は**設計として一貫してNCを除外**しており、historyには
**設計としてNCを行として保持**している。この2つの独立した仕様が組み合わさった結果、
「`wins+losses+draws` を単純に `history.length` と比較する」という粗い(naive)チェックを
使うと、NC行を1件でも持つ選手は構造的に必ず不一致判定になる。これは検出ロジック側の
限界であり、data側の不整合ではない。

過去のNC監査トラック(PR #131系、後述)で確定済みの「NCは勝敗数に非算入」という判断とも
完全に一致しており、矛盾はない。

## 実データでの検証(2026-08-02、mainブランチHEAD `02b28d4`時点)

`data/fighterRecords.json`全体(351選手)を走査:

| 分類 | 件数 |
|---|---|
| historyにresult:"nc"行を持つ選手 | 34名(nc行合計37件) |
| ├─ NC行を除いて数えれば集計値と完全一致(内部矛盾なし) | 32名 |
| └─ NC行を考慮してもなお不一致が残る(要個別調査) | 2名(sato-shoko, strasser-kiichi) |
| NC行を持たないが `wins+losses+draws ≠ history.length` | 8名 |

再現に使った検証コマンド:
```
node -e '/* out/nc-audit-report.md 末尾の付録参照。data/fighterRecords.jsonを走査し
history中のresult:"nc"件数と、wins+losses+drawsとhistory.lengthの差分(gap)を算出 */'
```
生データ: `out/nc-audit-nc-group.json`(NC保有34名)、`out/nc-audit-non-nc-group.json`(NC非保有8名)。

**注記(件数の一致について)**: 本調査は独自に再構築した検証ロジックであり、依頼文にある
「B型38件」の元になった監査(別ブロックで実施されたと思われる)のスクリプトそのものは
参照できていない。上記34名/8名という内訳は、それと近い値だが完全に一致するとは限らない
(スコープの取り方——例えば既に個別追跡中の選手を除外するか等——の違いによる)。ただし
「NC保有選手はほぼ全員、NCを除けば集計値と一致する」という核心の結論は、下記のコード根拠
により再現性がある事実として確認できている。

## コード根拠: NCの扱いは4箇所で一貫している

1. **英語版Wikipedia解析** `tally()`(`src/lib/feeds/wikipedia.ts:245-268`)
   `history.filter(h => h.result === "win"/"loss"/"draw")` のみを数える。`result:"nc"`の
   行は明示的にカウント対象外。

2. **日本語版Wikipedia解析**(`src/lib/feeds/wikipedia.ts:549-570`、`parseJaRecordTotals()`)
   `wins/losses/draws`は`{{MMA statsbox3}}`/`{{MMA recordbox}}`テンプレートの**infobox申告数値を
   そのまま採用**する。history(Fight-contテンプレートの逐次解析、`parseJaFightHistory()`)とは
   **完全に独立した別経路**。コード内コメント(551-557行目)に理由が明記されている:
   「{{Fight-cont}}の試合履歴にはアマチュア戦・異種格闘技イベントも混在することがあり、
   それを数え上げると公式のプロMMA戦績と食い違うため、合計値は必ずinfoboxの数字を優先する」
   — これは意図的な設計判断であり、historyの行数(NC含む)と集計値が一致しない構造は
   最初から織り込み済み。

3. **オーバーライド適用**(`src/lib/mnewsRating/recordOverrides.ts`)
   - `deriveTotalsFromHistory()`(1041-1056行目): `result==="nc"`の行は加算しない。
   - `applyRecordOverridesToTotals()`(1058-1096行目): `add`型オーバーライドで`result:"nc"`の
     試合を追加する際、`win`/`loss`/`draw`のいずれにも該当しないため集計値には一切加算されない
     (if/elseチェーンを素通りする)。この設計はコード内コメントで明示されている
     (476-477行目、和田竜光の例):「resultはnc=勝敗数に非算入のためtotalsAlreadyReflectedの
     区別は不要」。

4. **整合性チェック** `checkFighterRecordIntegrity()`(`src/lib/fighterRecordIntegrity.ts:72-82`)
   history再集計側(`hw`/`hl`/`hd`)も`win`/`loss`/`draw`のみを数え、NCは除外。
   `scripts/update-fighter-records.ts`のバッチ実行時と`scripts/check-fighter-records-integrity.ts`
   (デプロイ前ゲート、`next build`の`prebuild`で自動実行)の両方がこの同じ関数を使う。

**実測**: 現在`npx tsx scripts/check-fighter-records-integrity.ts`を実行すると
`fatal: 0件 / warning: 13件`。NC行を持つ34名のうち32名はこのwarningに一切現れない
(=NCの扱いは正しく機能している)。warningに現れるのはsato-shoko・ohara-juri・
strasser-kiichiの3名のみで、これらもNC行数と無関係な原因(下記参照)。

## 過去のNC監査との整合性確認

過去に独立したNC専用監査トラックが存在する(ブランチ`chore/nc-full-audit-and-wada-aoki`、
PR #131系、コミット`7f26259`/`71c1818`/`44eeb22`)。同トラックの最終コミットメッセージには
以下の記載がある:

> 全件result="nc"のため勝敗数には非算入、通算戦績は全対象選手で不変。

これは今回のコード調査結果と完全に一致する。矛盾なし。なお`RECORD_OVERRIDES`配列に現存する
12件の`result:"nc"`オーバーライドのうち8件は、まさにこのPR #131系トラックで発見・投入された
ものであることをコード内コメントで確認した(`akazawa-yukinori`, `ayaka-miura`, `hamada-takumi`,
`otsuka-tomoki`, `kitakata-daichi`×2, `kim-soochul`, `yang-jiyong`, `shibisai-shoma`)。

## 「NCを勝敗数に含めるか、history行として出すか」の決定材料

**提案: 現行仕様(NCは勝敗数に非算入・historyには行として保持)を維持する。**

根拠:
1. 過去のNC監査トラックの確定判断と一致する。
2. 現状の実装は4箇所すべてで一貫しており、34名中32名は内部的に完全に整合している
   (=正しく機能している証拠)。
3. NCを勝敗数(wins/losses/draws)に含める方式に変えると、「試合は成立したが判定・裁定が
   無効化された」というNCの定義自体と矛盾し、対外的に発表されている公式戦績
   (RIZIN/DEEP/パンクラス/修斗の公式no contest扱い)より水増しされた通算戦績を表示することになる。
4. NCをhistory行から除外する方式に変えると、選手ページの対戦歴一覧からその一戦が消え、
   「その試合は存在しなかった」という誤った印象を与える。実際には試合は行われた事実
   (対戦相手・日時・無効化の理由)を保持する価値がある。

**もし「B型38件」を検出した監査スクリプトがnaiveな`wins+losses+draws === history.length`
比較を使っているなら、対処すべきはdata側ではなく、その監査スクリプト側**(NC行数を
`history.length`から差し引いてから比較するよう修正、または`checkFighterRecordIntegrity()`と
同じ判定ロジックを再利用する)。

## 個別調査が必要な残りのケース

### NC行はあるが、それだけでは説明のつかない不一致(2名)

| slug | 集計(w-l-d) | history総数 | nc行数 | 診断 |
|---|---|---|---|---|
| `sato-shoko`(佐藤将光) | 38-17-2 (=57) | 57 | 1 | 見かけ上は総数が一致(57=57)だが、内訳は`hw=37`(集計38との差-1)。NCを除いた勝ち数がinfobox申告より1少ない。集計(infobox)側がこのNC試合を「勝ち」として数えている可能性、または別に1件の勝ち試合がhistoryから欠落している可能性。一次ソース未確認。 |
| `strasser-kiichi`(ストラッサー起一) | 21-13-2 (=36) | 35 | 1 | NC行(1件)を考慮してもなお集計(36)がhistory総数(35)より1多い。`src/lib/feeds/wikipedia.ts:344-349`のコード内コメントで名指しされている既知のケース: 記事本文(地の文)に「試合中止」の記述があるが、この一戦はFight-cont行自体が存在せず表に載っていない(計量超過による不成立で、そもそもテーブル化されていない)。コメントには「Fight-cont行自体が存在せず表に載っておらず、パーサの対象外だったため誤爆はしていなかった」とあるが、それでもinfobox側の36という数字がこの不成立試合を含めて数えている可能性が残る。一次ソース未確認。 |

### NC行なしで `wins+losses+draws ≠ history.length` (8名)

NCと無関係な独立した原因(勝敗の入れ替わり・bout欠落等)。

| slug | 集計(w-l-d) | history総数 | 差分 | 備考 |
|---|---|---|---|---|
| `tokoro-hideo`(所英男) | 36-34-1 (71) | 63 | -8 | `fighterRecordIntegrity.ts`のコード内コメントで既に「保留中ケース」として名指しされている既知案件。乖離が8件と大きく、単発の入れ替わりではなく複数試合の欠落が疑われる。 |
| `patricky-pitbull`(パトリッキー・ピットブル) | 25-16-0 (41) | 42 | +1 | 既に別トラックでRIZIN.19/20欠落を個別調査済み(PR #306, `investigate/patricky-pitbull-rizin-gap`)。本件はその調査結果と合わせて判断すべき。 |
| `nakamura-daisuke`(中村大介) | 35-29-1 (65) | 64 | -1 | 1敗分が集計に対しhistory側で不足。個別bout欠落の疑い。 |
| `kurobe-kazusa`(黒部和沙) | 6-1-1 (8) | 7 | -1 | 同上。 |
| `kitaoka-satoru`(北岡悟) | 45-29-10 (84) | 83 | -1 | 同上。 |
| `lee-kaiwen`(リー・カイウェン) | 16-8-0 (24) | 23 | -1 | 同上。 |
| `uno-caol`(宇野薫) | 35-23-5 (63) | 64 | +1 | history側が集計より1多い。extra bout混入の疑い。 |
| `sugiyama`(杉山しずか) | 23-8-1 (32) | 33 | +1 | 同上。 |

参考: `checkFighterRecordIntegrity()`のwarning13件には上記に加え`ohara-juri`・`uoi-fullswing`・
`miyake-kisa`も含まれる(いずれも合計は一致するが内訳が入れ替わっている「相殺型」のため、
本レポートの`wins+losses+draws ≠ history.length`という単純な差分チェックでは検出されない別カテゴリ)。
詳細は`checkFighterRecordIntegrity()`のwarning出力を参照。

## まとめ・提案(修正は未実施)

1. **NC由来の34件(前後)は仕様通りであり、修正不要**。「B型」という分類自体が、NCを
   考慮しない粗いチェック手法による誤検知である可能性が高い。もし今後この種のチェックを
   継続的に回すなら、`checkFighterRecordIntegrity()`と同じロジック(NC除外)を再利用するべき。
2. `sato-shoko`・`strasser-kiichi`の2件は、NC行が存在しつつも別の原因(infobox側のNC算入
   疑い、または不成立試合の扱い)が疑われるため個別の一次ソース確認が必要。
3. NC非保有の8件はNCと無関係な個別データ不整合(勝敗入れ替わり・bout欠落)。
   うち`tokoro-hideo`・`patricky-pitbull`は既に別トラックで認識・調査済み。残りは
   新規の個別調査(一次ソース確認)が必要。
