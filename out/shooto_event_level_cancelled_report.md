# 修斗イベント単位「中止」欠落バグの修正報告(指示書Z派生)

調査日: 2026-08-01。指示書Zのレビュー指摘(RIZIN.29の修正と一貫性が無いのでは、という指摘)
を受けて、`shootoScraper.ts`に同型の欠落が無いか確認した。

## 1. 原因

`resolveOutcome()`(`src/lib/mnewsRating/shootoScraper.ts`)は`CANCELLED_HEADING_KEYWORDS`
(`["中止", "欠場", "試合不成立"]`)を**bout単位のheadingText**(例:「第6試合 フライ級 5分3R」)
に対してのみ照合していた。大会自体が中止された場合、修斗公式サイトは中止の告知を
**イベント名(ページタイトル)側にのみ**「【中止】」と付け、個々のbout見出しには
中止の痕跡が一切残らない(試合が実施されていないため当然、カード自体の見出しは通常の
「第N試合 ○○級 ○分○R」のまま)。このため大会単位の中止が検出できず、該当7bout全件が
`unknown`に落ちていた。RIZIN.29(中村優作×北方大地、PR #327)と全く同型のバグクラス
(cancelled信号が、関数が見ているスコープの外側の別フィールドにある)。

## 2. 該当件数

`data/shootoRecords.json`の全大会でeventNameに「【中止】」を含むものを機械的に検索した
ところ**1大会のみ**該当(「【中止】PROFESSIONAL SHOOTO 2020 Supported by ONE Championship」
id=90、2020年3月29日にコロナ禍で中止)。同大会の全bout(7件)がこれに該当し、指示書Zの
36件のうち「①公式ページに決着の記載自体が無い」に分類していた7件と完全一致する。

公式ページ自体を確認したところ、ページ冒頭に「新型コロナウイルス感染拡大を予防する
観点から、中止とさせて頂きました」との告知があり、大会自体が実施されなかったこと自体は
事実として正しい。ただし「決着の記載が無い」=「unknownのまま」ではなく、公式に中止と
明示されている以上`resultType: "cancelled"`が正しい表現であり、指示書Zでの分類は誤り
だった(①ではなく、修正対象のバグ)。

## 3. 修正

- `src/lib/mnewsRating/shootoScraper.ts`: `resolveOutcome()`に`eventName`引数を追加し、
  `CANCELLED_HEADING_KEYWORDS`の判定を`headingText`と`eventName`の両方に対して行うように
  変更(他の判定(draw/nc等)は従来通りbout単位の情報のみを見る)。
- `scripts/build-shooto-records.ts`: 呼び出し側で`meta.eventName`を渡すように追随。
- 専用バックフィル(`scripts/backfill-shooto-event90-cancelled.ts`)で該当1大会
  (shootoEventId=90)のみ再フェッチし、他229大会はバイト単位で無変更。

## 4. 影響確認

- 該当7bout全件の`resultType`のみ`unknown`→`cancelled`に変化。他のフィールド・他の
  bout・他229大会は無変更(スクリプト内自己検証・2回連続実行のSHA256一致で確認済み)。
- `winnerName`は全件元々`null`(中止試合のため対象外、変更なし)。
- `shootoRecordsAggregate.ts`は`resultType`が`unknown`/`cancelled`のいずれも勝敗・NC
  集計に含めない実装のため、win/loss/draw/nc集計への影響はゼロ。
- RIZINの`rizinRecordsOverride.ts`(`applyRizinRecordsToHistory()`、Wikipedia由来history
  との日付突合)に相当する仕組みは修斗側には存在しない(grep確認済み、該当ファイルなし)。
  そのため`data/rankings.json`等の集計パイプラインへの影響経路自体が無い。

## 5. 検証結果

- [x] `npx tsc --noEmit`: エラー0件
- [x] `npm run build`(check群+テスト+`next build`、比率ゲート含む全通過、139/139ページ生成)
- [x] `npm run test:mnews-rating`: 220件成功/0件失敗
- [x] resultType/winner以外のフィールドが変わったbout: 0件
- [x] unknownから変わった件数: 7件(報告値と一致)
- [x] `git diff --stat -- data/rankings.json data/orgRankings.json data/fighterRecords.json
      data/rizinRecords.json data/pancraseRecords.json data/deepRecords.json`: 空
- [x] SHA256一致(2回連続実行でバイト一致)
- [x] 主要ページ200(ローカル`next build && next start`): `/` `/fighters` `/events`
      `/results` `/rankings` `/fighters/saito-yutaka`
