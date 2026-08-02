# 修斗/パンクラス/RIZINスクレイパーの同型盲点監査(指示書②d、read-only)

DEEPで見つかった「抽出器(bout検出)と検査器(健全性チェック)が同じ手がかりに
依存しているため、見出し表記の想定外パターンで両方が同時に失敗しても気づけない」
という構造的バグが、修斗・パンクラス・RIZINの各スクレイパーにも無いかを確認した。
read-only調査。コード変更は無し。

## 結論(要約)

3団体とも、DEEPのように「自由記述の見出しテキスト(第N試合)」を抽出アンカーに
使ってはおらず、抽出の入り口はいずれもDOM構造(class名・data-id・HTMLコメント)
であるため、DEEPほど脆くはない。ただし**「検査器(parseFailures)が、抽出器と
同じ入り口で見つかった候補の中でしか失敗を数えない」という設計自体は3団体とも
共通**しており、「入り口自体が候補を見つけられなかった場合に気づけない」という
DEEPと同根の盲点を原理的には共有している。DEEPの`countStructuralBoutBlocks()`に
相当する、見出し・class名に依存しない独立カウンタは3団体のいずれにも存在しない。

## 修斗(shootoScraper.ts / scripts/build-shooto-records.ts)

- 検査器: `buildEventBouts()`。`splitIntoBoutBoxes()`が見つけたbox数のうち
  `parseBoutBox()`が失敗した件数を`parseFailures`とする。
- 抽出アンカー: `<div class="matchmake-box h_js" data-id="(\d+)">...<!--matchmake-box-->`
  というDOM class+data-id+HTMLコメント終端。カード位置ラベル(メインイベント/
  セミファイナル等)や「第N試合」はbout検出には使われず、strapTitle/cardNumberという
  参考情報としてのみ抽出される。
- リスク評価: **低〜中**。DEEP型の「見出し文言の変化で丸ごと消える」リスクは
  構造的に低い。ただし`matchmake-box h_js`という固定class名自体が将来別テンプレート
  に変わった場合、それを検出する独立カウンタは無い。

## パンクラス(pancraseRecordsTypes.ts / scripts/build-pancrase-records.ts)

- 検査器: `buildEventBouts()`。`extractBoutTables()`が`<table class="crdl">`を
  抽出し、両コーナーとも選手名を取れなかった場合のみ失敗としてカウント。
- 抽出アンカー: `table class="crdl"`というDOM構造。「メインイベント」等のラベルは
  headingText列として保存されるのみで検出には使われない。
- リスク評価: **低〜中**。理由は修斗と同じ(DOM構造アンカー)。独立検証カウンタは
  無い。

## RIZIN(rizinScraper.ts / scripts/update-rizin-records.ts)

- 検査器: `buildEventBouts()`。`splitIntoBoutChunks()`(`<h2 class="article-heading">`
  単位分割+`expandNestedH3Bouts()`によるh3展開)で得たチャンクのうち、既知フォーマット
  A〜Dいずれにも一致しなかったものを`parseFailures`としてカウント。
- 抽出アンカー: `<h2 class="article-heading">`というDOM構造。`extractCardNumber()`が
  「第N試合」を抽出するが、コード内コメントに明記のとおり「カード順はページ内出現順で
  決まるため、番号の有無はbout検出に影響しない」参考情報。
- **既に実証済みの類似事故**: 超RIZIN/RIZIN.38で複数試合が1つの`<h2>`の下に
  `<h3 class="article-subheading">`でまとめられる「アンダーカードまとめ枠」が
  実在し、`expandNestedH3Bouts()`で個別展開する対応が既に入っている。つまりRIZIN
  公式サイトは実際に「1見出し=1bout」という前提を崩すレイアウトを使うことがある
  と実証済み。
- **さらに、大会単位の丸ごと欠落の実例**: `rizinRecordOverrides.ts`に、
  「SARABAの宴」(2015年RIZIN旗揚げ興行)が`RIZIN_EVENT_INDEX`にも当時のoverridesにも
  含まれておらず`data/rizinRecords.json`から大会単位で丸ごと欠落していたことが
  2026-08-02に判明・追加された記録が残っている。bout単位ではなく大会単位の抜けだが、
  「検査器が抽出器と同じ入口(RIZIN_EVENT_INDEXという単一リスト)に依存しているため、
  リストに載っていない大会自体の欠落には誰も気づけない」という同根の構造的リスクを
  示す実例。
- リスク評価: **中**(3団体中最も優先度が高い)。DOM構造アンカーである点で
  DEEPより頑健だが、実際に「1見出し≠1bout」の変則レイアウト実例(超RIZIN)と
  大会単位の丸ごと欠落実例(SARABAの宴)を両方持つ。

## 対応

本タスクのスコープ(DEEPの見出しなしメインイベント欠落バグの修正)には含めない。
将来、修斗・パンクラス・RIZINそれぞれにDOM構造ベースの独立カウンタ
(`countStructuralBoutBlocks()`相当)を追加する場合は、本レポートを起点に
別タスクとして切り出すことを推奨する。特にRIZINは実証済みの事故が2件あるため
優先度が高い。
