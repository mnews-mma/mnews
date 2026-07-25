# ④: EVENTS更新経路の現状記述(読み取り専用)

読み取り専用。実装・設計・フィージビリティの結論は書かない。事前に他セッション・他ブランチとの重複を確認した([下記](#事前確認重複チェック))。

## 事前確認(重複チェック)

`git fetch origin`後、open PR(draft含む)を確認。EVENTS自動取り込みに関するPRは無い(#219=本書自身、#217=26dレポート保全、他はroster-coverage系や#177等でEVENTS自動化とは別スコープ)。`git worktree list`にも該当worktreeなし。「fighter-coverageのDEEPイベント起点」トラック(26dで確認済みの`deep-event-roster-discovery`(#201)・`deep-event-roster-contamination-check`(#203))は、**既存EVENTSデータから選手名簿を抽出する側**の作業であり、EVENTS自体の更新経路(本書の対象)とはスコープが異なる。重複なし。

## EVENTSデータはどのファイルに、どの形式で入っているか

[src/lib/events.ts](../src/lib/events.ts)(901行)。`export const EVENTS: MEvent[] = [...]`という**TypeScriptの静的配列リテラル**(106行目〜)としてソースコードに直接記述されている。データベースでも外部JSONでもない。1大会が1つの`MEvent`オブジェクト(`slug`/`org`/`status`/`eventName`/`date`/`venue`/`sourceUrl`/`bouts`(対戦カード配列)等のフィールドを持つ)で、`bouts`配列の中に個々の対戦カード(`fighterA`/`fighterB`/`weightClass`/`result`等)が入る。

## 誰が・どの操作で更新するか

**直接のコード編集(TypeScriptファイルの手動編集)+ 通常のgitコミット・PR経由。** admin画面からの更新機能は無い(`/admin/*`配下にEVENTS編集用のUIは存在しない。CLAUDE.mdの「数字で見る対戦カード」記事公開手順や`/admin/drafts`は既存EVENTSを**読む**側の機能であり、EVENTS自体を書き込む機能ではない)。

`git log`で`src/lib/events.ts`への直近15件のコミットを確認したところ、全てのコミット作者が`Kaina Kishiyoshi`(人間)または`mnews-mma`(このリポジトリの通常のコミット主体、Claude Codeセッション経由を含む)であり、**botアカウント(`mnews-bot`、cronジョブが使うコミッター名)によるコミットは1件も無い。** これは26c/26dで確認済みの「`.github/workflows/*.yml`に`events.ts`/`EVENTS`を書き換えるジョブが0件」という事実(静的確認)と、実際のコミット履歴(動的確認)の両面で「100%手動更新」が裏付けられたことを意味する。

コミットメッセージの傾向(`feat(events): RIZIN.54にヘビー級2カード追加`、`fix(events): DEEP TOKYO IMPACT 2026 4th ROUNDの対戦カード変更を反映`等)から、更新は「公式発表を見て該当箇所を手で書き換える」という粒度で行われている。

## 自動化を阻んでいる要因

- **データ形式**: TypeScriptのコード内配列であるため、更新には型チェック([src/lib/events.ts](../src/lib/events.ts)の`MEvent`/`Bout`型に沿った構造)を通す必要があり、単純なJSON追記では済まない(型安全性とのトレードオフ)。
- **手作業の判断(登録可否)**: CLAUDE.mdの「大会予定登録ルール」(103-119行目)が団体ごとに複雑な採否基準を定めている。例: 修斗は「サステイン主催のプロフェッショナル修斗公式戦」のみで地方主催(THE BLACK BELT JAPAN等)は同じ「Lemino修斗」の冠が付いていても除外、DEEPは「DEEP本体のナンバー興行+DEEP TOKYO IMPACTシリーズ+DEEP JEWELS」のみで「DEEP Fight Challenge・DEEP☆FUTURE」は除外、といった**配信ブランドや大会名の文字列だけでは機械的に判定できない、主催団体ベースの判断**が必須になっている。
- **手作業の判断(データ品質)**: CLAUDE.mdは「データ捏造禁止(会場未確定等は空/未定で扱い、具体名を補完しない)」を明記しており、公式発表の文言をそのまま転記するのではなく、確定情報と未確定情報を切り分ける判断が要る。
- **団体側の非機械可読性**: 対象3団体の公式サイトの当該ページ(下記)を今回改めてコードから確認した限り、EVENTS側の`sourceUrl`フィールドが指しているのはいずれも**個別大会の告知ページ(通常のHTML)**であり、構造化データ(JSON-LD等)や公開APIをEVENTS側のコードが利用している形跡は無い(スクレイピングジョブ自体が存在しないため、この点はコードからの間接的な確認に留まる。今回、実際に該当ページへHTTPアクセスして構造化データの有無を検証してはいない)。

## 対象団体の公式カード発表ページの所在(URLのみ)

[src/lib/sources.ts](../src/lib/sources.ts)の団体トップページと、[src/lib/events.ts](../src/lib/events.ts)内で実際に`sourceUrl`として使われている個別大会ページの実例(いずれもコード中の既存データからの引用、新規取得はしていない):

| 団体 | トップページ(SOURCES) | 個別大会ページの実例(sourceUrl) |
|---|---|---|
| RIZIN | `https://rizin-ff.com` | `https://jp.rizinff.com/_ct/17846026`、`https://jp.rizinff.com/_ct/17853585` |
| DEEP | `https://deep2001.com` | `https://www.deep2001.com/deep-133-impact/`、`https://www.deep2001.com/deep-tokyo-impact-2026-4th-round/` |
| パンクラス | `https://pancrase.co.jp` | `https://www.pancrase.co.jp/tour/2026/pancrase364/index.html` |

RIZINはSOURCES記載のトップドメイン(`rizin-ff.com`)と実際のsourceUrl(`jp.rizinff.com`、サブドメイン違い)が一致していない点に気づいたが、これは今回の調査範囲外(読み取り専用のため修正しない)。

## 見送った項目

- 自動化のフィージビリティ結論: 指示書により明示的に対象外。
- 実装・設計: 指示書により明示的に対象外。
- 各団体公式サイトへの実アクセスによる構造化データ有無の実地検証: 「読み取り専用・小」の範囲を超えると判断し、コード上の既存情報(sourceUrlの実例)のみで代替した。
