# 「大成」→sekino-taiseiエイリアス化 衝突確認(指示書B S1)

## 結論: 実装(S2)を保留。3rd-partyの衝突リスクを検出したため停止・報告。

## 1. 「大成」の全出現箇所

| ファイル | 文脈 | 判定 |
|---|---|---|
| `src/lib/eventResults.ts` DEEP 126 IMPACT(2025-08-17)「DEEPメガトン級」酒井リョウ戦 | 関野大成本人 | 問題なし |
| `src/lib/eventResults.ts` shooto-2025-vol10-osaka(2025-11-22)「55kg契約」正木翔夢戦 | **DEEPヘビー級の関野大成(102kg級)とは体重が全く違う別人の可能性が高い(未確認)** | **要確認** |
| `data/deepRecords.json` DEEP121/126 IMPACTの酒井リョウ・水野竜也戦(fighterBSlug既にsekino-taisei) | 関野大成本人(既解決済み) | 問題なし |
| `data/archive.json` ニュース見出し3件 | 関野大成の文脈(DEEP133 IMPACT前哨記事) | 問題なし(表示はリンクされないプレーンテキスト) |

西谷大成(nishitani-taisei、フェザー級)との衝突は無し(PR #277/#278/#279で既に人物特定・分離済み。西谷大成は`eventResults.ts:2327`にフルネームでのみ出現し、裸表記「大成」との重複なし)。

## 2. 見つかった別種の衝突リスク

`findFighterSlugByName()`(`src/lib/fighters.ts` L3732-3775)は`org`を一切見ない全団体横断のグローバル名前解決。`aliases`に「大成」を追加すると、DEEP文脈だけでなく**shooto-2025-vol10-osaka(55kg契約、正木翔夢戦)の「大成」もsekino-taiseiへ誤ってリンクされる**。

- 抑制機構(`src/lib/fighterLinkOverrides.ts`の`resolveOpponentSlug`)は`src/app/fighters/[slug]/page.tsx`でのみ使われており、`src/app/events/[slug]/page.tsx`・`src/app/results/[slug]/page.tsx`(イベント予定・結果一覧ページ)には配線されていない。
- 正木翔夢はfighters.ts未収録のためこの誤リンクは`/results/shooto-2025-vol10-osaka`ページ上でのみ発生する見込み(本人の選手ページは無いので二次被害はそこに限定)。
- 該当55kg契約選手が本当に関野大成と同一人物かどうかは未確認(体重差から別人の可能性が高いという推定に留まる)。

## 3. 選択肢

1. **エイリアス追加を保留**し、代わりにDEEP133 IMPACT等の対象イベントのみ、eventResults.ts側で表記を「大成」→「関野大成」に個別修正する(グローバル解決に頼らない・最小変更)。
2. エイリアスを追加した上で、`events/[slug]/page.tsx`・`results/[slug]/page.tsx`にも`fighterLinkOverrides.ts`の抑制機構を配線し、shooto-2025-vol10-osakaの当該試合をNO_LINK_OVERRIDESに追加する(既存機構の拡張が必要・影響範囲がやや広い)。
3. shooto55kg契約選手の正体を先に特定し、実は関野大成本人だった場合はそもそも衝突ではないと確定させる。

判断待ち。
