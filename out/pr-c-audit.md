# C-1: VSページのindex面監査 — 26d②(本格実施)

読み取り専用。実装・PR作成は行っていない。C-2には入っていない。26cで参照先が見つからず停止した回だが、本書(26d)に指示書本文が内包されたためそれに従って実施した。

## 事前確認(重複作業チェック)

26d④で取得済みの全75worktree・オープンPR9件(#215, #208, #203, #201, #198, #197, #177, #172, #93)を再確認したが、VSページのindex/次戦句に関するタイトル・内容のものは無い。着手前提を満たす。

---

## 1. VSページのindex条件(参照箇所付き)

対象: [src/app/vs/[slugA]/[slugB]/page.tsx](../src/app/vs/[slugA]/[slugB]/page.tsx)

### noindexの付与条件

`generateMetadata()`内(97-98行目): `meta.robots = indexable ? undefined : { index: false, follow: true };`
`indexable = recordsResult.ok && isVsPairIndexable(fighterA, fighterB, entryA, entryB)`(66行目)。

判定関数本体は [src/lib/vsPairing.ts](../src/lib/vsPairing.ts) の`isVsPairIndexable()`(13-22行目)。index許可条件は以下3つのOR:
1. `fighterA.org === fighterB.org && fighterA.weightClass === fighterB.weightClass`(同一団体・同一階級)
2. `computeHeadToHead(entryA, fighterB.nameJa).length > 0`(過去の直接対戦あり)
3. `computeCommonOpponents(entryA, entryB).length > 0`(共通対戦相手あり)

さらに`fetchFighterRecordsStrict()`(戦績取得の厳格版)が失敗した場合は`recordsResult.ok`がfalseになり、上記条件を満たしていても無条件でnoindexになる(66行目の`&&`短絡)。

### 実カード判定(findMatchupEvent)がindex条件に効いているか

**効いていない。** `isVsPairIndexable()`内で`findMatchupEvent`は一切呼ばれていない([src/lib/vsPairing.ts](../src/lib/vsPairing.ts)に`findMatchupEvent`のimportはあるが、それは別関数`buildVsShareText()`(シェア文言生成用)でのみ使用され、indexability判定には使われていない)。`findMatchupEvent`はページ側の`generateMetadata()`60-61行目で**title文言の出し分け**(実カード名を入れるかどうか)にのみ使われている。

→ **「カードが発表されたからindexされる」わけではない。** 実際にindexされるかどうかは、発表の有無と無関係に「同一団体・同一階級」「過去の対戦」「共通対戦相手」のいずれかで機械的に決まる。多くの実カード(同団体・同階級同士の対戦)はこの1つ目の条件で自動的にindex許可されているに過ぎない。

### canonical

[src/lib/seo.ts](../src/lib/seo.ts) `pageMetadata()`(10-39行目): `alternates: { canonical: url }` で `url = SITE_URL + path`。VSページ側は`path: /vs/${norm.a}/${norm.b}`(page.tsx 87行目)を渡しており、**常に正規化後(辞書順)のクエリ無しURLへの自己参照**。`?red=`等のクエリはcanonicalに含めない設計(page.tsx 85-86行目のコメントで明示)。

`{a}/{b}`と`{b}/{a}`の扱い: `normalizeVsSlugs()`([src/lib/vsPairing.ts:8-11](../src/lib/vsPairing.ts))がスラッグ辞書順で`{a,b}`を正規化し、非正規順でアクセスされた場合はpage.tsx 117-122行目で`permanentRedirect()`(308)により正規順URLへ転送。canonicalタグとリダイレクトの二重で1ペア1URLを担保している。

### sitemap掲載条件

[src/app/sitemap.ts](../src/app/sitemap.ts) 90-104行目。`getVisibleFighters()`で取得した可視選手全ペアの総当たりに対し`isVsPairIndexable(fA, fB, fA, fB)`(96行目)で足切り。**ページ側のrobots判定と同一関数を共有**しており、ロジックの二重実装は無い(コード内コメント通り)。

**入力データの検証**: `getVisibleFighters()`は`FIGHTERS`(静的シード)に`fetchFighterRecords()`(バッチ生成の`data/fighterRecords.json`)をマージした`ResolvedFighter`を返す([src/lib/fighterRecordsCache.ts](../src/lib/fighterRecordsCache.ts) `mergeFighterRecord()`87-104行目、`{ ...fighter, ...rec }`でバッチ側の`.history`がシードを上書きする)。したがって`isVsPairIndexable(fA, fB, fA, fB)`の第3・第4引数(本来`FighterRecordEntry`型)に`Fighter`由来のオブジェクトを渡していても、実体は既にバッチの最新`.history`を持つマージ済みオブジェクトであり、ページ側の判定(`fetchFighterRecordsStrict()`由来の`entryA`/`entryB`)と**実質的に同じ戦績データを参照している**ことを確認した(誤って古いシードデータで判定している、という懸念は検証の結果否定された)。

ただし取得失敗時の挙動に差がある: ページ側は`fetchFighterRecordsStrict()`で失敗を明示的に受け取りnoindexにするのに対し、sitemap側は`fetchFighterRecords()`(非strict版)で失敗時に`{}`を返し、`getVisibleFighters()`が全選手を`noRecordData:true`扱いにして`.filter((f) => !f.noRecordData)`で全員弾く→**取得失敗時はvsRoutes自体が0件になる**(ページ側は個別に200+noindexで残るのに対し、sitemap側はセクションごと消える)。実装は異なるが「取得失敗時に検索面へ露出させない」という効果自体は両者で一致している。

### lastmod

[src/app/sitemap.ts](../src/app/sitemap.ts) 103行目: `lastModified: TODAY`。`TODAY`はファイル冒頭で`toJstDateStr()`(15行目、`eventCountdown.ts`経由・引数無し=関数実行時点のJST日付)。**個々のVSペアの実際の更新内容とは無関係に、sitemap実行時点の「今日の日付」が機械的に入る。** 大会日・カード発表日・選手データの実更新日のいずれとも紐づいていない(比較として`rankingDivisionRoutes`は実際の`updatedAt`を、`resultRoutes`/`eventRoutes`は`e.date`を使っており、VSルートだけがこの「常にTODAY」パターン)。

---

## 2. 「発表当日にlastmodが動くか」

**Yes**(ただし機械的な意味でのYesであり、質的な意味は弱い)。理由:

1. **カード発表(EVENTS側データの更新)の入り方**: `EVENTS`は[src/lib/events.ts:106](../src/lib/events.ts)の**静的TypeScript配列(ソースコードに直接記述)**。全`.github/workflows/*.yml`を検索したが`events.ts`/`EVENTS`を書き換えるジョブは0件。**カード発表の反映は完全に手動(人間/エージェントがコードを編集してPRをマージする)であり、バッチ・自動取り込みは一切存在しない。**
2. **VSページへの反映タイミング**: `EVENTS`はビルド時にJSバンドルへ焼き込まれる定数のため、ISRのrevalidate秒数という概念がそもそも無い。**新しいデプロイが発生するまで一切変わらない**(該当page.tsxに`export const revalidate`は無い)。
3. **sitemapのlastmod更新**: [sitemap.ts:19](../src/app/sitemap.ts) `export const revalidate = 3600`(1時間)。加えてR-3([out/r3-isr-verification.md](r3-isr-verification.md))で確認済みの通り、bot自動コミット(archive-articles等)を含む**あらゆるmainへのpushがVercel本番デプロイをトリガーする**ため、新規デプロイのたびにISRキャッシュ全体が破棄されsitemapも再生成される。
4. **sitemap自体の再生成頻度**: 上記よりデプロイのたびに(R-3実測で1日に複数回)、加えて単一デプロイ内でも1時間ごとに再生成される。

**結論として、当日中にEVENTS変更のコミット+マージ(=デプロイ)さえ起きれば、その後のsitemapアクセスで`lastmod`は即日「今日の日付」になる。** ボトルネックは工程3・4(自動で高速)ではなく**工程1(カード情報の入力が100%手動)**にある。人間/エージェントが発表当日中にeventsを更新してマージしなければ、以降のすべての工程がどれだけ速くても無意味になる。

なお`lastmod`が個々のペアの実変化と無関係に常に「今日」になる設計(上記1章末尾)は、発表当日という文脈では偶然「動く」ように見えるが、**変化していない日も含め毎日動くため、クローラーへの鮮度シグナルとしては弱い**(恒常的に更新される日付は、検索エンジン側で信頼度の低い信号として扱われることが一般に知られている)。これは背景で挙げられていたCTRの低さと直接の因果を断定できる材料ではないが、関連しうる実装上の特徴として記録する。

---

## 3. 手動indexリクエスト用URL出力の要件(実装しない)

- **対象の定義**: 「直近N日以内に発表された未消化カードのVS URL」という定義自体は成立する。データ源は`EVENTS`の`bouts`のうち`event.status`が`upcoming`/`live`で、かつ`git log`上でその`bouts`エントリが直近N日以内に追加されたコミットを持つもの、という組み合わせで判定できる(「発表日」というフィールド自体はEVENTS側に無く、コード上の追加コミット日で近似する必要がある)。
- **出力先候補**:
  - ファイル出力(`out/`や`scripts/`配下にCSV/テキスト): 実装コストは最小(既存の`findMatchupEvent`/`isVsPairIndexable`をスクリプトから呼ぶだけ)。手作業でSearch ConsoleのURL検査へ1件ずつ貼る手間は残る。
  - admin画面(例: 既存の`/admin/drafts`に近い一覧UI): 認証境界(`/admin/*`)に既に乗るため追加の認証実装は不要。URLのコピーボタン等UIの実装コストが乗る。
  - CLI(`npx tsx scripts/xxx.ts`でコンソール出力): ファイル出力と同程度に軽い。
- **既存admin機能への相乗り**: CLAUDE.mdの「数字で見る対戦カード」記事公開手順([CLAUDE.md](../CLAUDE.md)参照)が`/admin/drafts`タブ③で大会・対象試合を選ぶUIを既に持っており、対象母集団の抽出ロジック(未消化カードの一覧)は近い可能性がある。ただし今回はコードを読んでおらず未検証(C-2の範囲であり本書では実装調査に踏み込まない)。

---

## 4. 次戦句の母数

`FIGHTERS.filter(f => !f.hidden)`(母数207名)のうち、`findNextFight(fighter.nameJa)`が非nullを返す(=発表済みかつ未消化のカードを持つ)選手を実測:

- **対象選手数: 60名**(207名中)
- **対象イベント数: 6件**(`rizin-54`, `超RIZIN.5 浪速の超復活祭り`, `deep-133-impact`, `deep-osaka-impact-2026-4th`, `deep-tokyo-impact-2026-4th`, `pancrase-364`)
- **団体別内訳(選手数ベース)**: rizin 36名, deep 23名, pancrase 1名
- **`/fighters/{slug}`の存在確認**: `/fighters/[slug]/page.tsx`の404条件は`if (!seed) notFound();`([src/app/fighters/[slug]/page.tsx:275](../src/app/fighters/[slug]/page.tsx))のみで、`hidden`/`noRecordData`は404条件に含まれない(hiddenはnoindexになるだけ)。今回の60名はいずれも`!f.hidden`で既に絞っているため**全60名が`/fighters/{slug}`ページを持つ**。

(§6の停止条件「対象選手が0名」には該当しない。)

---

## 5. EVENTS側の団体フィールド・短縮マップの要否

`MEvent`型([src/lib/events.ts:27-47](../src/lib/events.ts))には`org: SourceKey`フィールドが**既にある**。[src/lib/sources.ts](../src/lib/sources.ts)の`SOURCES[org].label`が団体の短縮表示名(例: `rizin`→"RIZIN", `deep`→"DEEP", `pancrase`→"パンクラス")を既に単一ソースとして提供しており、これは選手ページの`orgLabel`表示等、既存箇所で既に使われている値そのもの。

**団体レベルの短縮名は新規マップ不要。** `SOURCES[org].label`をそのまま使える。

一方、大会シリーズ単位の短縮名(例: 「超RIZIN.5」「DEEP OSAKA IMPACT」のように号数・地域名まで区別する短縮)に該当するフィールドは`MEvent`に存在しない(`eventName`という正式名称のみ)。ただし本書C-1-4で提示された候補N1〜N4はいずれも団体名レベルの短縮(例:「次戦8/2 RIZIN」)を想定しており、大会シリーズ単位の短縮までは要求していない。**したがって候補N1〜N4の実現には新規マップは不要であり、`SOURCES[org].label`のみで足りる**(§6の停止条件「短縮マップが必要で20件超の規模」には該当しない=マップ自体が不要と判定)。

---

## 6. 候補4種の文字数分布と上限超過件数

団体短縮名として`SOURCES[org].label`を使用し、対象60件で実測(コードポイント単位=全角1字・半角1字を同じ1として数える方式、および半角基準=ASCII/半角カナ1・それ以外2、の両方で計測):

| ID | テンプレート | コードポイント単位(min/max/avg) | 12字超(コードポイント基準) | 半角基準min/max/avg(N1のみ計測) |
|---|---|---|---|---|
| N1 | 次戦{M}/{D} {短縮名} | 10 / 12 / 11.5 | 0件 | 12 / 19 / 13.6 |
| N2 | {M}/{D} {短縮名}出場 | 10 / 12 / 11.5 | 0件 | (N1と同じ傾向) |
| N3 | 次戦{M}/{D} | 5 / 6 / 5.9 | 0件 | (常に最短) |
| N4 | 次戦{M}/{D} vs{相手姓} | 11 / 24 / 14.2 | **44件/60件** | (未計測) |

- **N1・N2・N3は目標10字前後・上限12字の設計目標を60件全件で満たす**(コードポイント基準)。半角基準で数えるとN1はmax19字まで伸びる(「超RIZIN.5 浪速の超復活祭り」のような長い正式イベント名を使わず団体短縮名のみに絞っているため、半角基準でも上限内に収まりやすい)。
- **N4は44/60件(73%)が12字超**。原因は相手姓の切り出し(スペース区切りの先頭トークンのみを取る単純な実装で試算)が、スペースを含まない外国人選手のカタカナ表記(例:「カルシャガ・ダウトベック」)ではフルネームのまま残ってしまうこと。日本人選手同士(スペース区切りの「姓 名」表記)では正しく姓だけが切り出され12字に収まる。**「相手名が長い」という原因の実体は、汎用的な姓切り出しロジックが存在しないこと**であり、和名と外国人名で成功率に大きな差が出る。

---

## 7. 75字上限との干渉

既存の[src/lib/seoTemplates.ts](../src/lib/seoTemplates.ts) `buildFighterDescription()`は`FIGHTER_DESCRIPTION_MAX = 75`(8行目)に対し、超過時に**英字別表記→所属句→ランク句の順に句を落とす**段階的フォールバックを持つ(82-96行目)。この60件全員について、**既存ロジックが最も削った最終形(全フォールバック後)にN1(次戦句)を1つ追記した場合**の文字数を実測した。

- **既存description(フォールバック後の最終形)の平均文字数: 60.5字**(75字上限に対し既にかなり近い)
- **N1追記後に75字を超える件数: 34件/60件(57%)**
- このうち2件(`souza-roberto-satoshi`: 81字, `sheydullaev-rajabali`: 84字)は**次戦句を足す前の時点で、既存description自体が既に75字を超えている**(外国人選手のフルネーム表記が長いため、既存の段階的フォールバックを尽くしてもなお上限を超える既存の別問題)。

**落ちることになる句**: 今回の試算(`rank`引数を常にnullで計測)では、既存のフォールバックが英字別表記→所属句→ランク句まで**既に全て落としきった状態**でもなお34件が超過しており、これは「次戦句を追加するために既存のどれか1句をさらに落とせば足りる」という単純な話ではなく、**既存description本体(選手名・戦績数字・「戦績・全試合結果の説明」文言=削除対象外と規定されている部分)だけで既に65〜84字に達している選手が過半数存在する**ことを意味する。次戦句を無理なく足すには、既存の「削除しない」と定めている本文側の圧縮(定型文言の短縮等)が必要になる可能性が高い、という数字が出た。

**次戦句を切り詰め順のどこに置くべきかの案(確定しない、論点のみ)**:
- 案a: 次戦句を最優先句にし、既存の英字別表記→所属句→ランク句のいずれよりも先に(=これらより残りやすい位置に)置く。カード発表直後の検索意図に直接応える情報のため。
- 案b: 既存の落とし順の最後(ランク句のさらに後)に追加する。既存句の表示優先度を変えない保守的な変更。
- 案c: 次戦句がある場合は「戦績・全試合結果の説明」という定型文言自体を短縮し、両方を残す余地を作る(本文側への変更が要るため影響範囲が広い)。

---

## 8. 遷移仕様の論点整理(決めない)

- **「消化済み」の判定基準の候補**:
  - (a) イベント日(`event.date`)がJST基準で過ぎたか否か
  - (b) 結果データ(`EVENT_RESULTS`または`data/fighterRecords.json`)にその試合結果が実際に反映されたか否か
  - この2つはラグが生じる。イベント当日〜結果反映(`update-fighter-records`バッチ、cron表記載の実測遅延は中央値+3.27時間、最大+5.25時間)までの間、(a)基準では既に「消化済み」だが(b)基準ではまだ「未消化」という状態が生じる。
- **JSTのどの瞬間で切り替わるか**: 候補は「大会当日0:00 JST」「大会の`startTime`を過ぎた瞬間」「イベントの`status`が`completed`に変わった瞬間(手動更新)」の3通りが考えられ、いずれを採るかで大会当日中の表示(次戦句のままか、既に結果待ちの空白表示になるか)が変わる。判定に日付を使う場合は`eventCountdown.ts`の認可ヘルパー(`daysUntilEventJst`等)経由であることが指示書の前提。
- **どちらでもない時間帯の可能性**: `findNextFight()`は`event.status`が`upcoming`/`live`のイベントのみを見る([src/lib/events.ts:836-840](../src/lib/events.ts) `getUpcomingEvents()`)。`status`の`completed`への切り替えは(EVENTS自体が手動更新のため)人間/エージェントの作業タイミング次第であり、自動では起きない。したがって「大会は終わったがstatusがまだupcomingのまま」の期間は次戦句が出続け、逆に「statusはcompletedに切り替えたが結果バッチ(2:30 JST目安、実測遅延あり)がまだ反映されていない」期間は次戦句(status完了で消える)と結果ベース句(バッチ未反映で出せない)の**どちらも出ない空白が生じうる**。
- **次戦句とPR-Aの結果ベース句(`latestResultClause`)の排他/併記**: 指示書が明示する制約(「PR-Aは結果ベースのまま変更しない」)を踏まえると排他が素直な選択に見えるが、これは論点として提示するのみで確定しない。

---

## まとめ(推奨・優先度づけなし)

1. index条件: noindex解除は「同一団体・同一階級」「過去対戦」「共通対戦相手」の3条件のみで、`findMatchupEvent`(実カード判定)はindex条件に一切関与しない。
2. 「発表当日にlastmodが動くか」: Yes。ただし本質的なボトルネックはEVENTS更新が100%手動である点(工程1)。sitemapのlastmodは常に「今日」を機械的に入れる設計であり、質的な鮮度シグナルとしては弱い。
3. 手動indexリクエストURL出力: ファイル/CLI/admin画面の3候補を提示。実装しない。
4. 次戦句の母数: 60名(207名中)、6イベント、rizin/deep/pancrase。0名ではないため停止条件非該当。
5. EVENTSに`org`フィールドは既存。団体短縮名は`SOURCES[org].label`で足り、新規マップは不要(N1〜N4の要求水準では)。
6. N1/N2/N3は12字上限を全件で達成。N4は73%(44/60件)が超過(相手姓切り出しロジックの粗さが原因)。
7. 75字上限との干渉: 既存descriptionの全フォールバック後にN1を足しても57%(34/60件)が超過。うち2件は次戦句を足す前から既に超過している別問題。
8. 遷移仕様: 判定基準・切替タイミング・空白期間・排他/併記のいずれも論点提示のみで確定していない。
