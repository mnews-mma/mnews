# shouldPreferMultiOrgRecord live チェック追加 — 実装・検証・STOP報告

ブランチ: `investigate/ushiku-juntaro-record-display` / PR #443(同PRに実装追加、マージはまだしていない)

## 1. 実装(完了)

`src/lib/mnewsRating/multiOrgRecord.ts` の `shouldPreferMultiOrgRecord()` — `recordFromResults` 分岐に、`needsReview` 分岐と同じ `live===true` チェックを追加。新しい判定は追加していない(1条件のみ)。

```diff
-  if (!fighter.recordFromResults) return false;
-  return record.wins + record.losses + record.draws > rowOneWins + rowOneLosses + rowOneDraws;
+  if (fighter.recordFromResults && !fighter.live) return record.wins + record.losses + record.draws > rowOneWins + rowOneLosses + rowOneDraws;
+  return false;
```

`tsc --noEmit` 通過済み。`data/`・`rankings.json` は無変更(ロジックのみ、焼き込み未実施)。

## 2. 全FIGHTERS走査(完了、受入条件どおり)

FIGHTERS全365名(`data/fighterRecords.json`焼き込み済み分=365/365、未焼き込みなし)で修正前後の`shouldPreferMultiOrgRecord`戻り値を比較。**判定が変わったのは3名だけ**(全員 true→false、つまり1行目表示に切り替わる):

- `ushiku-juntaro`(牛久絢太郎)
- `kurobe-kazusa`(黒部和沙)
- `ryoga`(亮我)

受入条件「変更は`multiOrgRecord.ts`の1条件のみ、全FIGHTERS走査で判定が変わるのは3名だけ」は満たしている。

## 3. 3名それぞれの増減bout内訳(確定、外部裏取り込み)

裏取りは生wikitext(`action=query&prop=revisions&rvprop=content`)を直接取得し、`{{Fight-cont}}`行を手動集計して`fetchJaWikiFighterRecord()`の出力と突合する方式で実施(レンダリング版は見ていない)。

### 牛久絢太郎(ushiku-juntaro): 22-12-1(35戦) → 22-12-0(34戦)

| 区分 | 日付 | 相手 | 結果 | 大会 |
|---|---|---|---|---|
| 消える(4団体のみ) | 2013-09-07 | 柳井康作 | 勝ち | PANCRASE 251 |
| 消える(4団体のみ) | 2013-05-19 | 柳井康作 | 分け | PANCRASE247 |
| 増える(wikiのみ) | 2019-01-12 | マルシオ・セザール | 勝ち | RFC WAY OF THE DRAGON CHAMPIONSHIPS 3(海外団体、4団体対象外は正しい挙動) |

検算: common(両ソース一致)33戦 + 消える2戦 = 35(4団体) / common33戦 + 増える1戦 = 34(wiki)。整合。

**重要な追加確認**: 生wikitextを見ると、牛久絢太郎の記事は「プロ総合格闘技」節(34戦、これが`fetchJaWikiFighterRecord`の採用元)と「アマチュア総合格闘技」節(9戦、対象外)が別立てで、**消える2戦(2013-09-07・2013-05-19 vs 柳井康作)は両方とも「アマチュア総合格闘技」節に記載されている**。

さらに`data/pancraseRecords.json`の該当bout実データを確認したところ、この2戦は`headingText: "第2試合 フェザー級..."`(カード2番目、通常のPANCRASE本戦番号付きイベントのundercard)で、`nonProBoutFilter.ts`の`not_pro_pancrase_gate`カテゴリのコメントが既に指摘している既知パターン(「パンクラスゲート系...通常PANCRASE本戦等のundercard。ja.wikipediaがアマチュア節に分類する実例あり」)と一致する。ただし該当bout の`headingText`に「パンクラスゲート」等のキーワードが一切含まれないため、既存のキーワード方式フィルタでは検出できていない(フィルタの穴)。

→ この2戦は「本物のプロ戦績が消える」のではなく、**mnews側のPancraseデータに紛れ込んだアマチュア(Gate)戦がwiki側の分類によって除かれる**、という可能性が高い。ただし`nonProBoutFilter.ts`・`data/pancraseRecords.json`の修正はこのPRのスコープ外(別ファイル・指示書外)のため、このPRでは変更していない。

### 黒部和沙(kurobe-kazusa): 7-2-1(10戦) → 6-1-1(7戦)

| 区分 | 日付 | 相手 | 結果 | 大会 |
|---|---|---|---|---|
| 消える | 2026-05-31 | 田上こゆる | 負け | PROFESSIONAL SHOOTO 2026 Vol.4 in OSAKA |
| 消える | 2026-01-18 | 旭那拳 | 勝ち | PROFESSIONAL SHOOTO 2026 Vol.1 |
| 消える | 2024-04-07 | 澤田龍人 | 勝ち | SHOOTO GIG TOKYO Vol.36 |

3戦とも**正真正銘のプロ修斗公式戦**(牛久のケースと異なりアマチュア節は無い、生wikitextでも単一の「戦績」節のみ)。

- 2026-05-31・2026-01-18の2戦は、wiki記事の直近更新が2025-11-16(田口恵大戦)止まりで、単純に**wikiが未更新**なため消える。
- 2024-04-07(澤田龍人戦)は実は生wikitextに存在する(`{{Fight-cont|〇|澤田龍人|...|SHOOTO GIG TOKYO Vol.36|2024年4月7月}}`)が、**日付表記に誤字がある**(「2024年4月7**月**」=「日」であるべき箇所が「月」になっている)。この誤字により`fetchJaWikiFighterRecord()`のパーサが日付を解釈できず、この1戦だけ`history`配列から欠落する(勝敗集計=wins6には数えられているのに`history.length`は7止まりで1戦足りない、という内部不整合が既に本番で発生している)。これはこのPRとは独立した既存のパーサ側の別バグで、このPRでは修正していない(フラグのみ)。

いずれにせよ**3戦とも実在する正規のプロ修斗戦績**であり、切り替えると本物の試合が選手ページから消える。

### 亮我(ryoga): 14-7-2(24戦) → 10-2-2(14戦)

| 区分 | 日付 | 相手 | 結果 | 大会 |
|---|---|---|---|---|
| 消える | 2025-05-25 | 咲季 | 勝ち | DEEP TOKYO IMPACT 2025 3rd ROUND |
| 消える | 2024-12-08 | 橋本優大 | 勝ち | DEEP TOKYO IMPACT 2024 6th ROUND |
| 消える | 2024-02-24 | 堺龍平 | 負け | RIZIN LANDMARK 8 in SAGA |
| 消える | 2024-01-28 | 永留惇平 | NC | PROFESSIONAL SHOOTO 2024 Vol.1 |
| 消える | 2023-12-10 | Max | 負け | DEEP 117 IMPACT |
| 消える | 2023-07-23 | 吉田仁 | 負け | DEEP X NARIAGARI |
| 消える | 2022-12-11 | 駒杵嵩大 | 負け | DEEP TOKYO IMPACT 2022 7th ROUND |
| 消える | 2022-11-23 | 濱口奏琉 | 勝ち | DEEP TOKYO IMPACT 2022 6th ROUND |
| 消える | 2022-10-30 | TARKER | 勝ち | DEEP OKINAWA IMPACT 2022 |
| 消える | 2022-03-12 | 日比野"エビ中"純也 | 負け | DEEP TOKYO IMPACT 2022 1st ROUND |
| 消える | 2021-10-17 | ヒロヤ | 負け | DEEP TOKYO IMPACT 2021 1st ROUND |
| 増える | 2026-05-28 | ジョセフ・ラルチネーゼ | 負け | Road to UFC Season 5(UFC系、4団体対象外は正しい挙動) |

**11戦が消える**。全て実在するDEEP/RIZIN/修斗の正規プロ戦(アマチュア分類なし、生wikitextにも「プロ総合格闘技」節のみで別節無し)。亮我のwiki記事自体が2021〜2025年の主要な試合を欠いた**大幅に不完全な状態**(24戦中14戦=約58%しかカバーしていない)。

## 4. 判断(★停止して報告)

指示の条件4「落ちるboutが4団体内の試合だった場合は、消していいかの判断が要るので報告して止まる」に該当。

- **牛久絢太郎**: 消える2戦はwiki側で「アマチュア」分類・かつnonProBoutFilter.tsが既知パターンとして把握しているGate系undercardと一致。実質的にはデータ品質の是正に近く、比較的リスクは低い。
- **黒部和沙**: 消える3戦は正真正銘のプロ修斗戦(2戦はwiki未更新、1戦はパーサの日付誤字バグ)。切り替えは実害のある後退。
- **亮我**: 消える11戦(24戦中)は全て正真正銘のプロDEEP/RIZIN/修斗戦。切り替えは戦績の半分近くを選手ページから失う重大な後退。

同一の1条件修正が3名全員に一律適用されるため、部分適用(牛久だけ有効化するなど)は「新しい判定は追加しない」という指示と矛盾する。**このままマージすると黒部和沙・亮我は実在の試合が選手ページから消える**。

コード変更(`multiOrgRecord.ts`)自体はブランチに反映済みだが、**マージは保留**してこの報告を待つ。

## 未実施(マージ判断待ちのため)

- 波及確認(meta title/description・`/api/og/fighter`・次戦カード・`/fighters`一覧カード・`/dream`・`/vs`)は、マージするかどうか自体が未確定のため実施していない。
- `data/`焼き込み(`update-fighter-records.ts --slug=...`)も同様に未実施。
