# 火の鳥 RIZIN戦績 +1敗 過剰算入 調査(S1〜S3・停止)

> **status: active（2026-07-29）** — S1〜S3を実測完了、S3の停止条件に該当したため実装(S4)は未着手。人間判断待ち。

## 経緯

`/rankings/flyweight` で火の鳥(hinotori)の表示戦績が2-1(実際は2-0)になっている件の調査指示書に対する回答。

## S1: 真因確定

`data/rizinRecords.json`(RIZIN公式ソース)上の火の鳥の対戦は2戦のみ(RIZIN LANDMARK 13 vs 本田良介 勝、RIZIN LANDMARK 15 vs イ・ジェフン 勝)で、これ自体は正しい。2025-11-02 DEEP 128 IMPACT(vs 木村琉音、敗)は `isRizinMmaEvent()` の判定(イベント名に"RIZIN"を含むことが必須)により正しく除外されており、混入していない。指示書のS1候補1(DEEP戦の混入)は棄却。

実際の混入元は**tomizawa-daichi(冨澤大智)側の`data/fighterRecords.json`履歴**にある1件のデータ誤り。

- tomizawa-daichi の history に `2024-12-31 / opponent: "火の鳥" / event: "RIZIN DECADE" / result: win / method: "1R 1:53 KO（左膝蹴り）"` というエントリが存在する。
- 同日同大会のRIZIN公式ソース(`rizinRecords.json`)を見ると、冨澤大智の実際の対戦相手は**三浦孝太**であり(第4試合、1R 1分53秒 KO・スタンドでの膝打撃)、火の鳥ではない。ラウンド・タイム・決着方法(KO)が完全一致しており、同一の実試合を指しているのは確実。
- 冨澤大智側のデータ(おそらくWikipedia由来)が対戦相手名を誤記載しており、その誤った名前 `"火の鳥"` が偶然にも `fighters.ts` 上のhinotoriの登録名(`nameJa: "火の鳥"`)と完全一致するため、名前解決(`buildOpponentResolver`)でDB内選手として解決され、hinotoriの対戦本人の明細には一切現れないファントムの敗戦(tomizawa-daichi視点の勝ち)としてElo集計に混入していた。

指示書のS1候補2(明細に存在しないファントム敗)に該当。ただし「wallノード由来」ではなく、**別選手の履歴の相手名誤記が偶然DB内選手名と一致した誤解決**という、より踏み込んだ原因。

## S2: 掲載資格ルート

ファントム敗を除いた火の鳥の真のRIZIN対戦は2戦(2026-04-12, 2026-07-18)、いずれも2025年以降。`ELIGIBILITY_RECENT_MIN_FIGHTS`(直近ルート必要試合数)を満たすため、通算3戦ルートに依存せず**直近2戦ルートで掲載資格を維持する**。指示書のS2の2番目の分岐(直近2戦ルートで成立→掲載維持・表示戦績のみ修正で足りるはず)に該当 — が、S3の結果によりこの「表示戦績のみ」という前提そのものが崩れた(下記)。

## S3: rawRatingへの影響(★停止条件に該当)

指示書の前提「rawRatingは全MMA戦から算出する単一グローバル値であり、DEEP戦の敗はrawRatingには正当に入っている」は本件には当てはまらない。今回のファントム敗は実在しない架空の対戦であり、RIZINイベント名を持つため`buildBouts`のフィルタを素通りしてElo計算に混入している。

`buildBouts`→`computeRawRatings`を実データで再実行し、このファントム対戦(tomizawa-daichi履歴の当該1件)を取り除いた場合のrawRating差分を実測した。

- hinotori・tomizawa-daichi 本人のrawRatingが変動する(想定内)だけでなく、**tomizawa-daichiと後続で対戦したshinotsuka-tatsuki(2025-12-31にtomizawa-daichiと対戦)のrawRatingにも二桁規模の変動**が生じた。これはEloの逐次計算特性による連鎖(既存の実装コメントが言う「Elo連鎖リップル」、高木凌修正時の秋元強真ケースと同型)。
- さらにarai-jo・hiramoto-jo・yamamoto-arsen・honda-ryosuke・"name:イジェフン"(圏外ノード)にも小〜中規模の変動、加えて無関係に見える他の選手数名にも微小(ノイズ級)の変動が波及した。
- 現行`rankings.json`ではhinotori(#10)・shinotsuka-tatsuki(#12)・tomizawa-daichi(#13)がいずれも同一の丸めレート(1470)で並んでおり、hinotoriが上がりshinotsuka-tatsuki/tomizawa-daichiが下がる方向の変動は、この3者の**表示順位が入れ替わる可能性が高い**。

→ 「rate不変・順位不変」という指示書の受入条件(S4-2)は満たせない。指示書S3の「前提が成立するかを実測で確認し、rate差分が出るなら止めて報告(想定外)」という停止条件に該当するため、ここで停止する。

## 未実装(S4は着手していない)

以下の分岐について人間判断が必要:

1. **表示戦績のみ`recordDisplayExclusions`で2-0に補正し、rawRatingのファントム汚染は残したまま(不整合を許容)** — 表示と裏側のレートが食い違う状態を意図的に残すことになり、望ましくない可能性が高い。
2. **tomizawa-daichi側のデータそのものを訂正する(相手名を三浦孝太に訂正)** — `src/lib/mnewsRating/recordOverrides.ts`の`RECORD_OVERRIDES`(remove+add)で対応可能だが、これは`update-fighter-records.ts`実行時にのみ反映される機構であり、rawRating/順位が複数選手(hinotori/tomizawa-daichi/shinotsuka-tatsuki他)にわたって動く。指示書の「マージ」節が定める「順位が動く結論になった場合は深夜帯ルールを適用するか人間判断を仰ぐ」に該当する規模。

いずれもS4着手前に人間の判断が必要なため、本調査はここで一旦提出する。S5(同型ケースの総点検)も本件の方針確定後に着手する。
