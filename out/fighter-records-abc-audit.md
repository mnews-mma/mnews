# data/fighterRecords.json 悉皆調査(指示書R-5、read-only)

## スコープ

`data/fighterRecords.json`(Wikipedia由来「1行目」戦績。351選手・全history)を、
`data/{rizin,shooto,pancrase,deep}Records.json`(4団体公式データ)と突合し、
以下3分類で誤りを悉皆列挙した。read-only(`data/`・`src/`への変更なし)。

- **A型**: history配列の内訳(win/loss/draw件数)と集計フィールド(wins/losses/draws)の不一致
- **B型**: 1行目の勝敗が4団体データと逆(または4団体データ側はdraw)になっているbout
- **C型**: 1行目の大会名・日付が4団体データのどの大会とも一致しないbout

## 実行方法

```
node -e '...(out/fighter-records-abc-audit.py 冒頭コメント参照)...'
python3 out/fighter-records-abc-audit.py
```

## 手法

- bout単位の選手識別は `fighterASlug`/`fighterBSlug` 一致を優先(4ファイルとも
  20〜62%しか付与されておらず不完全)、無ければ選手名(`fighters.ts`の
  nameJa/aliases)を空白除去して一致比較。
- 大会名の突合は日付一致を軸に、【】/()/～等の装飾除去、`presents`系スポンサー
  接頭辞の除去、修斗⇔SHOOTO・パンクラス⇔PANCRASE・闘裸男⇔TORAO等の表記ゆれ
  吸収、最長共通部分文字列(閾値: 短い方の50%以上かつ6文字以上)のフォール
  バックを組み合わせた近似マッチ。
- 同一大会内に対象選手のboutが複数ある場合(トーナメント準決勝+決勝など)は、
  対戦相手名の一致で曖昧性を解消する。相手名が一致しない場合は「unverifiable」
  (4番目のバケツ、A/B/C集計には含めない)に落とす。
- `noRecordData: true` の選手は対象外。

## 結果(2026-08-02、mainブランチ最新時点)

| 分類 | 件数 | 対象選手数 |
|---|---|---|
| A型 | 15件 | 15名 |
| B型 | 8件 | 8名 |
| C型 | 327件 | 84名 |
| (参考)unverifiable | 260件 | — |

C型327件の内訳:
- **291件**: その日付、該当団体のデータに大会が1件も存在しない。2004〜2017年の
  SHOOTO/DEEPに集中しており、4団体データ側の古い年代の取得漏れ(カバレッジ
  不足)の可能性が高く、機械的には真の誤りと区別できない。
  `events_on_that_date` 列が `(none)`。
- **36件**: その日に該当団体の大会は実在するが、大会名が完全に別物
  (例: `goto-joji` のDEEP122→実際はDEEP123)。実例と同型の高確度な誤りとみられる。
  `events_on_that_date` 列にその日の実際の大会名が入る。

初回調査時(同日、mainを1回pullする前)は上記36件が34件だった。pull後に
`fix/karen-fujita-name-resolution`(#345)等のalias追加が反映され、名前一致で
新たに2件(`salt`, `karen`)が発見可能になったための増分(データ側の新規劣化
ではない)。

## 既知の限界・要手動判断

- A型のうち `sumimura-ryuichiro` は他と性質が異なる可能性が高い(history欠損
  だがtotalsは存在)。`src/lib/fighterRecordIntegrity.ts` はこのパターン
  (`history.length === 0`)を「集計値のみ持つ記事(例: 住村竜市朗)」として
  既知の正常状態と明記しており、そもそも自動修正の対象ではない可能性がある。
  個別に判断すること。
- B型のうち6件は「勝敗として記録されているが4団体データでは引き分け」という
  パターン(単純な勝敗逆転ではない)。
- C型「(none)」291件は真の誤りと4団体データのカバレッジ不足が混在しており、
  本調査だけでは分離できない。

## 出力ファイル

- `out/fighter-records-abc-audit.py` — 調査スクリプト本体(標準ライブラリのみ)
- `out/fighter-records-abc-audit-fighters.json` — `fighters.ts`のFIGHTERS配列を
  JSON化した中間ファイル(スクリプト実行に必要。Node一発コマンドで再生成可)
- `out/fighter-records-abc-audit-a-type.csv`
- `out/fighter-records-abc-audit-b-type.csv`
- `out/fighter-records-abc-audit-c-type.csv`(`events_on_that_date`列で
  上記2パターンを判別可能)
- `out/fighter-records-abc-audit-unverifiable.csv`(参考。A/B/C集計には非含有)

修正はしていない。
