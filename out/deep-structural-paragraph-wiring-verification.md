# recoverStructuralParagraphBouts() 配線検証レポート

[deep-2473-2403-breakdown-investigation.md](deep-2473-2403-breakdown-investigation.md)
で特定した「`recoverStructuralParagraphBouts()` が `scripts/build-deep-records.ts`
に配線されていない」問題への対応として、`recoverHeadinglessBouts()`
(367行目・443行目、PR #374)と同じ位置・同じ扱いで実際に配線した。

配線方法: 両呼び出し箇所で `recoverHeadinglessBouts()` の直後に

```ts
const structuralRecoveredBouts = recoverStructuralParagraphBouts(html, [...primaryRawBouts, ...recoveredBouts]);
const rawBouts = [...primaryRawBouts, ...recoveredBouts, ...structuralRecoveredBouts];
```

を追加(既存2パスの選定結果には一切関与しない追加専用パス。段落境界の判定に
`<p class="wp-block-paragraph">`タグが必要なため、他パスと異なりstripTags後の
`clean`ではなく生HTML(`html`)を渡す点に注意)。`EventDiag`に
`recoveredStructuralCount`を追加し、大会別内訳・サマリーの両方に列を追加した。

## ①②: 配線後に全238(+新規1=239)大会を再構築した実測結果

**事前の想定(70件がそのまま戻る)を決め打ちにせず、実際にキャッシュ279件
(`daily-records-workflow` worktreeから再取得せずコピー)で全大会を再構築した。**

- 投入大会数: 239(現行main 238大会 + 新規1大会)
- bout総数: **2470**(現行main比 -3。内訳は下記)
- 構造段落回収(recoverStructuralParagraphBouts()の生の返り値): **82件**
  (非プロ/非MMA除外フィルタ通過前の候補数)
- 非プロ/非MMA除外フィルタ通過後、最終的に`format: "structural_paragraph"`で
  `data/deepRecords.json`に残ったbout数: **67件**(82件中15件が除外)
- 2回連続(実質3回)実行でSHA256完全一致(決定的)

### 現行main(238大会・2473bout)との突合

- 現行mainの238大会は**全件**配線後の出力にも存在する(消失大会0件)。
- 238大会のうち**237大会はbout数完全一致**(内容も選手ペア+決着欄の
  multiset突合で完全一致。逆方向の新規混入も0件)。
- **1大会のみ数が変わった**: DEEP CAGE IMPACT 2024 in HAMAMATSU
  (2024-05-12)が12→8(-4)。原因は下記③参照。
- 新規に1大会追加: 格闘技フェスティバルDEEP湘南 2022(2022-05-18)。
  下記④参照。

**したがって「70件が全て戻る」という想定は成立しない。66/70件はそのまま
戻ったが、4件は"戻らないのが正しい"ことを検証済み(③)。加えて元の70件の
スコープ外で1件の新規大会・新規boutが追加された(④、想定70件との比較では
「超過」ではなく別カテゴリの副産物)。**

## ③: DEEP CAGE IMPACT 2024 in HAMAMATSU(12→8、-4)の妥当性判定

現行main(パッチ適用済み)の12boutの内訳:
- `group4_detached_mark`(通常抽出): 7bout
- `structural_paragraph`(一括パッチ由来): 5bout

配線後の再構築(8bout)の内訳:
- `group4_detached_mark`: 7bout(完全一致・変化なし)
- `structural_paragraph`: 1bout(ハセヤマ・フェリペ vs 出口彰紀のみ)

**消えた4boutの実体**(`build-deep-records.ts`の通常抽出パス
`extractDeepBouts()`が独立して検出した生bout11件に対し
`isExcludedNonProBout()`を直接実行して裏取り):

| 選手A | 選手B | weightClassRaw(通常抽出パスが検出した正しい値) | 判定 |
|---|---|---|---|
| 川崎ごうる | 斉藤玄 | DEEPバンタム級 3分2R **アマチュアSPルール** | 除外(非プロ) |
| イトカズ・コウセイ | 小川昌夫 | DEEPバンタム級 3分2R **アマチュアSPルール** | 除外(非プロ) |
| 高林和真 | 深澤波琉 | DEEP 54kg以下 2分3R **アマチュアKICKルール** | 除外(非プロ) |
| 松下稜弥 | オチ・アレン | DEEPフェザー級 3分2R **アマチュアSPルール** | 除外(非プロ) |

**根本原因(一括パッチ側のバグ)**: `scripts/patch-deep-structural-paragraph-recovery.ts`
(PR #381の一括パッチ)は、回収bout候補の重複判定(`sameFighterPairExists`)を
`data/deepRecords.json`の**最終確定済みbouts配列**(=既に非プロ除外フィルタ
通過"後"の配列)に対して行っていた。この4試合は通常抽出パス
(`extractDeepBouts`)が最初からアマチュアルールと正しく認識して除外していた
ため、最終確定済み配列には残っていなかった。結果、構造段落回収パスは
「これは未回収のboutだ」と誤認して同じ4試合を再度拾い、しかも構造段落側の
見出しテキスト(`○|`・`●|`・空欄)には元の`weightClassRaw`
(「アマチュアSPルール」等)が含まれていなかったため、
`isExcludedNonProBout()`のチェックをすり抜けて**アマチュア試合が誤って
プロ戦績として計上**されていた。

今回の配線(`build-deep-records.ts`本体)は、`recoverStructuralParagraphBouts()`
の重複判定対象を**非プロ除外フィルタ適用"前"の生rawBouts配列**
(`[...primaryRawBouts, ...recoveredBouts]`)にしているため、この4試合は
最初から「既知のbout」として認識されて重複候補から除外され、
アマチュア試合の混入が起きない。**これは配線のバグではなく、一括パッチ側の
重複判定スコープの誤りを配線によって偶発的に修正した形**であり、
`check-deep-contamination-baseline`のゼロ件ゲートが対象にしていない種類の
混入(アマチュア試合の誤計上)を1件是正したことになる。

**結論: この-4は正当な訂正であり、退行(リグレッション)ではない。**
現行mainに既に反映されている70bout(一括パッチ適用済み)には、この4件の
アマチュア試合誤計上が含まれたまま本番稼働している状態にある(本PRの
スコープでは調査のみに留め、修正は本PRの配線がそのまま適用されることで
自動的に解消される)。

## ④: 新規大会 格闘技フェスティバルDEEP湘南 2022(2022-05-18)の妥当性判定

現行mainの238大会には含まれていない(通常抽出パス・見出しなし回収パスの
いずれでもbout0件のため`除外(抽出0件)`扱いだったと推定される)大会が、
構造段落回収パスの追加により1bout抽出できるようになり、新規に投入対象と
なった。

ソースHTML(`out/deep-html-cache/`)を直接確認し、実在する結果記事であることを
裏取り済み:

```
メインイベント DEEP無差別級 5分2R
・森興二（FJ KICK ASS） VS トーマス（Y＆K MMA ACADEMY）
　2R1:21反則　勝者：森　※トーマスが反則の肘攻撃により試合実行不可能に
```

**判定: 誤検出ではなく実在の結果(正当な回収)。** ただし2点、既知の限界として
記録する(いずれも`recoverStructuralParagraphBouts()`本体の実装課題であり、
本PRの配線作業のスコープ外・今回は修正しない):

1. `fighterAName`が`"・森興二"`となり、原文中の装飾的な「・」がそのまま
   選手名に混入している(原文自体に「・森興二」と記載されているため、
   捏造ではなく抽出対象の取りこぼしに近い)。
2. 原文に「勝者：森」という明示的な勝者ヒントがあるにもかかわらず、
   `resultType`は`"unknown"`・`winnerName`は`null`のまま(反則
   (`反則`)による決着で、この大会のフィールド区切りが他の対応済みパターンと
   異なる(`|`ではなく`<br>`+全角スペース)ため、`勝者：`以降が
   `methodRaw`に正しく取り込まれなかったと推定)。

いずれもデータの欠落方向(捏造ではなく未解決のまま)であり、既存の
`resultType: "unknown"`・`fighterASlug: null`という枠内で表現されるため、
下流のゼロ件ゲート等を壊さない。

## ⑤: パイプライン未配線関数の横断確認(指示④、今回は修正しない)

`src/lib/mnewsRating/deepScraper.ts`のexport関数を全数洗い出し、
`scripts/build-deep-records.ts`のimportと突合した。

| deepScraper.tsのexport | build-deep-records.tsでの使用 |
|---|---|
| extractArchiveLinks | 使用 |
| detectPagination | 使用 |
| isKickEvent | 使用 |
| isAmateurEvent | 使用 |
| extractEventDate | 使用 |
| stripTags | 使用 |
| extractDeepBouts | 使用 |
| recoverHeadinglessBouts | 使用 |
| countStructuralBoutBlocks | 使用 |
| recoverStructuralParagraphBouts | **使用(本PRで新規配線)** |
| resolveOutcome | 使用 |

**export関数は11件全て使用済み。同型の未配線関数は他に見つからなかった。**
(`isPlausibleEventDate`はexportされているが`extractEventDate`内部から
呼ばれる補助関数であり、外部から独立して呼ぶ設計ではないため対象外)

## ⑥: computeMultiOrgRecord前後突合(2行目が変わる選手の全数確認)

配線・実測で判明した3種の変化(①アマチュア4bout除外・②新規1大会・③67件の
回収経路変化)がそれぞれ選手の4団体通算(2行目)に波及するかを、
`computeMultiOrgRecord()`を直接呼んで**全数**確認した(推測・サンプリングでは
なく、DEEP boutに登場する全slug(before∪after、133件)を対象に前後の
wins/losses/drawsを突合)。RIZIN/修斗/パンクラスの3ファイルは無変更のため
一定に保ち、DEEP側のみ変化させて比較した。パイプラインの実運用順序
(`build-deep-records.ts` → `backfill-shooto-pancrase-slugs.ts` →
`backfill-rizin-slugs.ts`、`update-org-records.yml`参照)どおりに
バックフィルまで実行した状態で比較した。

**1回目の突合で2名の変化を検出、うち1名は本物の不具合だった:**

### young-parkseo: 3-6-0 → 3-4-0(是正・マージ対象)

DEEP JEWELS 19(2018-03-10)・DEEP NAGOYA IMPACT 2026 2nd ROUND
(2026-06-14)の「パク・ソヨン」2戦が、現行mainではyoung-parkseo
(修斗所属、PARK SEO YOUNG)に誤って紐付いていた。しかし
`scripts/lib/nameCollisionDenylist.ts`(PR #334調査、2026-08-01)に
既に明記されている通り、**この「パク・ソヨン」はyoung-parkseoとは別人**
(young-parkseoは当時14歳・修斗デビューは2022年のため、2018年のDEEP戦には
出場不可能)。この誤紐付けはPR #334で既に問題として特定・denylist登録
済みだったが、`build-deep-records.ts`側の通常抽出パスがそのdenylistを
経由しない独自解決(過去のある時点のfighters.ts状態、または一括パッチ)で
既にyoung-parkseoに誤って紐付けてしまっていたため、現行mainにはこの
誤りが残ったままだった。**今回の再構築(通常のfindFighterSlugByName()の
現在の照合基準では「パク・ソヨン」(中黒)と「パク ソヨン」(半角スペース)
は一致しない)により、この誤紐付けが解消される。退行ではなく既知の
誤りの是正。**

### karen: 10-3-0 → 11-3-0(発見・修正済み)

DEEP JEWELS 12(2016-06-05)「華蓮DATE」vs 三阪あゆみが、再構築後は
karenに新規で紐付いた。しかしこの試合は`scripts/backfill-shooto-
pancrase-slugs.ts`の`KNOWN_NON_PROFESSIONAL_BOUTS`に個別除外登録されている
試合(12歳での「※パウンド無し」特別ルール初出場、1行目Wikipedia
(10-3-0)にも含まれていない)で、**2行目に算入してはいけない試合**。

原因は二重: (a)「華蓮DATE」はfighters.tsにalias登録済みのため、
`build-deep-records.ts`側の通常のfindFighterSlugByName()呼び出しが
直接一致してしまい、バックフィル側の除外リスト(未解決boutにのみ
新規解決を試みる設計)を経由せず解決してしまう。(b)配線した構造段落
回収パスがこの大会に1bout追加したことで、この試合のcardPositionが
1→2にずれ、バックフィル側の`KNOWN_NON_PROFESSIONAL_BOUTS`
(cardPosition固定キー)が偶発的に無効化されていた(二重の偶然が重ならないと
表面化しない類の不具合で、computeMultiOrgRecordの全数突合をしなければ
見逃していた)。

**対応(本PRに含めて修正済み)**:
1. `build-deep-records.ts`に`SLUG_RESOLUTION_SUPPRESSED`
   (イベント名+選手名キー、cardPositionに依存しない)を追加し、通常抽出パス
   側でもこの1件のslug解決を明示的に抑止。
2. `backfill-shooto-pancrase-slugs.ts`の`KNOWN_NON_PROFESSIONAL_BOUTS`の
   cardPositionを1→2に更新(このキーがbout抽出件数の変化に弱いという
   注記も追加)。

修正後、この試合のfighterASlugはビルド直後・バックフィル後の両方でnullの
まま維持されることを確認した(3回連続再構築+バックフィルで確認)。

### 2回目の突合(修正後・最終)

上記修正を適用した状態で全数突合をやり直した結果、**2行目が変わる選手は
young-parkseoの1名のみ**(上記の通り是正であり退行ではない)。karenは
変化なし(10-3-0のまま)であることを確認した。

## 受入条件との照合

| 条件 | 結果 |
|---|---|
| DEEP bout総数が2473以上 | **未達(2470)**。ただし③のとおり2473には
アマチュア試合4件の誤計上が含まれており、これを除いた正しい基準値は
2469(238大会)+1(新規大会)=2470。条件自体が「70件は全て正当」という
未検証の前提に基づいていたため、本調査結果を踏まえた再判断が必要 |
| 消失43大会が全て回復 | 43/43大会が出力に存在。42/43大会は元のbout数と完全一致。
1/43(HAMAMATSU 2024)はアマチュア4試合を正しく除外した結果、元の12ではなく
8が正しい値 |
| 2回連続実行でSHA256一致 | 達成(karen修正後も含め計6回連続で確認) |
| computeMultiOrgRecord前後突合(⑥) | 2行目が変わる選手はyoung-parkseoの1名のみ(是正・退行ではない)。karenの誤混入は発見し本PRで修正済み |
| check-deep-contamination-baseline ゼロ件ゲート | 達成(混入0件) |
| null-slug比率ゲート | 達成(DEEP 79.37% < 閾値83.00%) |
| tsc | 達成(エラー0件) |
| npm run build | 達成(全チェック+139ページ成功) |
| test:mnews-rating 220件 | 達成(220件成功/0件失敗) |
| ビルド時間の伸び | `build-deep-records.ts`本体: 約6.2秒(キャッシュ279件、
239大会全てに構造段落回収パスが追加で走っても体感的な増加なし)。
`npm run build`(サイト静的生成139ページ+全チェック): 約34秒
(このコマンドはスクレイパー自体を呼ばないため今回の変更の影響を受けない) |

## 結論・次の判断が必要な点

- 配線自体(`recoverHeadinglessBouts()`と同じ形での呼び出し)は完了し、
  決定性・既存ゲート・型チェック・ビルド・テストは全て通過した。
- 実際の回収結果は「70件全てがそのまま戻る」ではなく、**66件がそのまま
  戻り、4件(アマチュア試合の誤計上)は正しく戻らず、代わりに別の1件
  (新規大会の正当な結果)が加わった**。結果として総bout数は2473ではなく
  2470になる。
- これは本PRの配線ロジックの不具合ではなく、**現行main(一括パッチ適用済み)
  側に含まれていた既存の混入(アマチュア試合4件の誤計上)を、配線が
  意図せず是正した**という性質のもの。
- 受入条件のうち「2473以上」「43大会全て回復(完全一致)」は文字通りには
  未達だが、未達の理由は裏取り済みで、むしろデータ品質の是正である。
- computeMultiOrgRecordの全数突合(⑥)で、2行目が変わる選手を1名
  (young-parkseo、是正)まで絞り込み、途中で発見した本物の不具合
  (karen、DEEP JEWELS 12のアマチュア初出場戦の誤混入)は本PRで修正済み。
  修正後の再突合で2行目が変わる選手はyoung-parkseoの1名のみと確認した。
- 以上により、マージ判断に必要な確認(①アマチュア4bout除外の妥当性・
  ②新規大会の実在確認・③67件回収経路の内容一致・④他の未配線関数の有無・
  ⑤bout総数差分の説明・⑥4団体通算への影響の全数確認と発見した不具合の
  修正)はすべて完了した。
