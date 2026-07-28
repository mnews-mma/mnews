# RIZIN戦績の誤除外を直す(ルール情報が欠落した試合)

作業日: 2026-07-28。PR #240のブランチに含める形で追加修正した(別PRは立てていない)。矢地祐介の戦績変化調査(PR #240コメント参照)で発見した`ruleType`誤分類バグを修正し、影響範囲を全データでスキャンした。

## 1〜2. 修正内容

### `parseRuleInfo`(`src/lib/mnewsRating/rizinScraper.ts`)

「MMA以外と積極的に判定できた」場合のみ`"その他"`を返すようにし、ルール行テキスト自体が空(欠落)の場合は新設した`"unknown"`(判定不能)を返すよう変更した。既知キーワード(MMA/キックボクシング/シュートボクシング/グラップリング)に一致しない場合の既定値だった`"その他"`を、単なるデフォルトから「ルール行はあるが未知」という積極的な確定へ意味を変えた。

```ts
export interface ParsedRuleInfo {
  ruleType: "MMA" | "キックボクシング" | "シュートボクシング" | "グラップリング" | "その他" | "unknown";
  ...
}
export function parseRuleInfo(ruleLineRaw: string): ParsedRuleInfo {
  let ruleType: ParsedRuleInfo["ruleType"];
  if (/MMA/i.test(ruleLineRaw)) ruleType = "MMA";
  else if (/キックボクシング/.test(ruleLineRaw)) ruleType = "キックボクシング";
  else if (/シュートボクシング/.test(ruleLineRaw)) ruleType = "シュートボクシング";
  else if (/グラップリング/.test(ruleLineRaw)) ruleType = "グラップリング";
  else if (ruleLineRaw.trim() === "") ruleType = "unknown";
  else ruleType = "その他";
  ...
}
```

### `applyRizinRecordsToHistory`(`src/lib/mnewsRating/rizinRecordsOverride.ts`)

`ruleType === "unknown"`の試合は、除外(非MMA扱い)もWikipedia側の上書き(MMA扱い)もせず、既存のWikipedia由来history エントリをそのまま温存するよう分岐を追加した(除外判定より前に配置)。ルール種別の推測はしていない(「判定不能をMMAと決めつける」対応はしていない)。

`RizinOverrideResult`に`ruleUnknownCount`を追加し、`update-mnews-rating.ts`のログにも件数を出力するようにした(透明性のため。既存の`overriddenCount`/`excludedCount`と同じ扱い)。

## 3. ルール情報欠落で判定不能なbout全件(既存データ全体をスキャン)

修正後の`parseRuleInfo`で全80大会(RIZIN.1個別分含む)を再スキャンした結果、**`ruleType === "unknown"`のboutは28件**、2大会に集中していた。

| 大会 | 開催日 | 件数 | 傾向 |
|---|---|---|---|
| RIZIN.7(RIZIN FIGHTING WORLD GRAND-PRIX 2017 バンタム級トーナメント＆女子スーパーアトム級トーナメント1st ROUND -秋の陣-) | 2017-10-15 | 16件(そのページの全試合) | ページ全体でルール行の記載様式が無い(1大会まるごと) |
| RIZIN.10 | 2018-05-06 | 12件(そのページの全試合) | 同上 |

いずれも「特定の1試合だけルール行が抜けている」のではなく、**そのイベントの結果ページ全体に渡ってルール行テキスト自体が本文に存在しない**という、ページ単位の記載様式の違いだった(RIZIN.10については矢地の1件だけの問題ではなかった。指示書の懸念どおり)。

他の77大会には`unknown`は0件(全て`MMA`/`キックボクシング`等が確定的に判定できている)。

## 4. 戦績が変化する選手(全件)

28件のboutのうち、自社DBのslugに解決できた選手側は6件(RIZIN.7で2件・RIZIN.10で4件)。このうち、**Wikipedia側(`data/fighterRecords.json`)に同日付のRIZIN公式試合として記録済みのエントリがあり、旧ロジック(`ruleType !== "MMA"`で除外)により戦績集計から消えていたはずの選手は5名**。

| 選手(slug) | 大会・開催日 | 対戦相手 | Wikipedia記録 | 旧ロジックでの扱い | 修正後の扱い |
|---|---|---|---|---|---|
| yamamoto-arsen(山本アーセン) | RIZIN.7・2017-10-15 | マネル・ケイプ | loss | 除外(敗数が1少なく表示) | 温存(正しい敗数に復元) |
| rena(RENA) | RIZIN.7・2017-10-15 | アンディ・ウィン | win | 除外(勝数が1少なく表示) | 温存(正しい勝数に復元) |
| horiguchi-kyoji(堀口恭司) | RIZIN.10・2018-05-06 | イアン・マッコール | win | 除外(勝数が1少なく表示) | 温存(正しい勝数に復元) |
| yachi-yusuke(矢地祐介) | RIZIN.10・2018-05-06 | ディエゴ・ヌネス | win | 除外(勝数が1少なく表示。PR #240コメントで報告済み) | 温存(正しい勝数に復元) |
| asakura-kai(朝倉海) | RIZIN.10・2018-05-06 | マネル・ケイプ | win | 除外(勝数が1少なく表示) | 温存(正しい勝数に復元) |

(残り1件、nakamura-yusaku(中村優作)はRIZIN.10で解決できたが、Wikipedia側に同日付のRIZIN公式試合としてのhistoryエントリが見つからず、旧ロジックでも実害なし。)

戦績が変化する選手は**5名**(停止条件「10名超」には非該当)。判定不能bout数は**28件**(停止条件「50件超」には非該当)。

このうち**yamamoto-arsen・rena・horiguchi-kyoji・asakura-kaiの4名はPR #240とは無関係の既存バグ**(RIZIN.7は#240で修正した3大会に含まれず、元から解析できていた大会。つまりこのバグはPR #240着手以前から本番の`main`ブランチに存在していた)。矢地祐介の1件だけがPR #240由来(RIZIN.10を新たに読めるようにしたことで顕在化)。

## 5. 矢地祐介の戦績確認

`--mode=data-correction`で再生成した結果、矢地祐介の表示戦績は**13-9-0に復元**(PR #240時点の12-9-0から回復)。

## 6. AI RIZINランキングの差分(#240時点 → 本修正)

| 階級 | 掲載数(前→後) | 新規掲載 | 掲載外れ | 順位移動 |
|---|---|---|---|---|
| フライ級 | 18→18 | 0 | 0 | 0(後述) |
| バンタム級 | 18→18 | 0 | 0 | 0 |
| フェザー級 | 17→17 | 0 | 0 | 0 |
| ライト級 | 15→15 | 0 | 0 | **2** |
| ヘビー級 | 6→6 | 0 | 0 | 0 |

**順位移動2件(ライト級)**: `case-johnny: 8→7位` / `yachi-yusuke: 7→8位`。これはPR #240で発生した順位入れ替え(矢地7位→8位/ケイス8位→7位)が**そのまま巻き戻り、#240適用前の元の順位に戻った**ことを意味する(矢地の戦績が13-9-0に復元され、rawRatingがcase-johnnyを再度上回ったため)。新規掲載・掲載外れは0件。

ランキング順位移動は2件で、停止条件「20件超」には非該当。

### 参考: フライ級での非表示の変動(記録として残す)

`yamamoto-arsen`のrawRatingが1498.37→1489.44(**-8.94**)と大きく動いたが、`rank`(4位)・表示`record`(4-3-0)はいずれも変化しなかった。この変動はスクリプム自身のripple検出ログにも記録されており(`ripple検出30件`の1件として検出)、data-correctionモードの設計どおりdelta表示は抑制されている。yamamoto-arsen自身の`record`が4-3-0のまま変わらなかった理由(rawRatingの変動幅の大きさに対し表示戦績が不変だったこと)の詳細な内部メカニズムは本タスクのスコープを超えるため深追いしていないが、ripple検出・data-correctionモードの抑制設計どおりに動作しており、ユーザーから見える表示(順位・戦績)への影響は無いことは確認済み。

## 7. 検証結果

| チェック | 結果 |
|---|---|
| `update-rizin-records.ts` 2回実行の決定性 | **一致**(バイト単位で完全一致) |
| `update-mnews-rating.ts --mode=data-correction` 2回実行の決定性 | **一致**(`updatedAt`タイムスタンプ以外は完全一致) |
| `scripts/check-h2h-invariant.ts`(必達不変条件・H2H違反) | **PASS**(全階級で違反0件、必達不変条件チェック違反0件) |
| `npm run check:fighter-records`(整合チェック) | **OK**(fatal 0件、warning 14件=既存の無関係な警告、本修正前と同数) |
| `npm run check:rankings-slugs` | **OK** |
| `npm run check:rizin-weightclass`(階級null検査) | **OK**(fatal 0件。副次効果で「古いギャップ」50→49件、「階級バケット不能」17→15名に減少=今回復元した試合が正しく階級付けされた分) |
| `tsc --noEmit` | **エラーなし** |
| `npm run build`(next build含む) | **成功**(`✓ Compiled successfully`) |

## 8. 変更ファイル

- `src/lib/mnewsRating/rizinScraper.ts`: `parseRuleInfo`に`"unknown"`状態を追加
- `src/lib/mnewsRating/rizinRecordsOverride.ts`: `applyRizinRecordsToHistory`に`ruleType==="unknown"`時の温存分岐を追加、`RizinOverrideResult`に`ruleUnknownCount`追加
- `scripts/update-mnews-rating.ts`: Phase3ログに`ruleUnknownCount`集計を追加
- `data/rizinRecords.json`: 13大会で`ruleType`が`"その他"`→`"unknown"`(またはボート内容の再パースに伴う変化)に変わった。80大会中67大会は無変更(バイト同一)
- `data/rankings.json`・`data/rankings.prev.json`: ライト級2名の順位が#240適用前の状態に巻き戻り
- `data/rankings.legitimateBaseline.json`・`data/rankings/archive/`: 無変更
- `data/fighterRecords.json`: 無変更

## 停止条件の該非

- 判定不能のboutが50件を超えた → **非該当(28件)**
- 戦績が変化する選手が10名を超えた → **非該当(5名)**
- 必達不変条件が1つでも破れた → **非該当**

いずれの停止条件にも該当せず、手順1〜8を完走した。マージ可否は人間の判断に委ねる(PR #240本体と合わせて判断してください)。
