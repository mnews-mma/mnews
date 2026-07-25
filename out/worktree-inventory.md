# worktree 73件(実測75件)棚卸し — 26d④

読み取り専用。**削除・unlock・ブランチ削除・PR close は一切行っていない。**
`git worktree list --porcelain` の実測結果は75件(主体`/Users/kainakishiyoshi/Desktop/mnews`本体を含む)。26cの指示書が言う「73件」との差分は、26c→26d の間に別セッションが新規worktree(`jst-gate-pattern1-scope`)を1件作成し、同じく本調査対象の本体worktree(`followups-2026-07-26c`)を含めた数え方の揺れによるもの。件数の食い違い自体を実測値として報告し、73への手直しはしていない。

## 分類の定義と実装方法

- **duplicate**: worktreeディレクトリのbasenameが重複しているもの。実測で該当は`rankings-division-copy`の2箇所のみ(1組・2件)。追加でPR番号の重複紐付け、および同一ブランチが複数worktreeに紐づくケースも機械チェックしたが、いずれも0件。
- **active**: `git status --porcelain`で未コミット差分あり、**または**worktree内ファイルの最終更新時刻(`.git`/`node_modules`除く実ファイルのmtime走査、最大値)が調査時刻から24時間以内。
- **merged**: 対応するPRが`gh pr list`上で`MERGED`状態(ローカルブランチが`origin/main`の祖先かの`git branch --merged`判定も併用したが、squash-merge済みブランチは祖先関係が成立しないため、PRの状態を優先した)。
- **orphan**: 対応するPRが1件も見つからない、かつmerged/active条件にも該当しない。
- **open(PRあり・非アクティブ)**: 上記4分類のいずれにも該当しないが、closeされていないPRが紐づいているもの(4分類の指定に無いため独自追加。黙殺しないためそのまま出す)。
- 優先順位: main本体 > duplicate > active > merged > orphan > open、の順で1件1分類のみ割り当てた(実際には複数該当しうるが、表を単純にするため単一ラベルにした)。

## ★重要: 停止条件に該当(§6)

**`active`分類が21件で、指示書の停止条件(5件超)に該当した。ここで判断は代行しない。**

内訳(21件のうち):
- 未コミット差分が実際にある(`dirty=true`)のは**2件のみ**: `mnews-worktrees/pr2-weightclass-lint`(fix/naoki-inoue-record-overrides-patch-date、PR#137は既にMERGED済みなのに未コミット差分が残存=作業後の掃除忘れの可能性)、`.claude/worktrees/audit-rating-drift-t3t4`(対応PRなし)。
- 残り19件は`dirty=false`で、根拠は「ファイルmtimeが24時間以内」のみ。このうち少なくとも10件(`deep-event-roster-contamination-check`, `deep-event-roster-discovery`, `hidden-flag-semantics-audit`, `pr209-f2b-provenance`, `pr209-jst-gate-fix`, `pr210-run-guard-403`, `pri3-ranking-description`, `roster-coverage-audit`, `roster-loose-ends`, `followups-2026-07-26c`自身)は、**本セッション自身が26c以前の指示書チェーン(①〜④、PR-F2b、PR-I等)で逐次(同時ではなく順番に)作成・使用してきたworktreeそのもの**であることを、これまでの会話履歴と照合して確認した。つまりこれらは「今まさに5個以上のセッションが同時並行している」ことの証拠ではなく、「本セッションの過去24時間分の作業履歴が単純にmtimeへ残っている」ことの反映である可能性が高い。
- 一方、`jst-gate-pattern1-scope`(mnews-worktrees、HEAD=`f204f58`=main最新tip)は本調査の最中に`locked initializing`状態を実際に観測し、数分後には lock が解除されていた。**これは本セッションとは無関係な別セッションが、今まさに新規worktreeを作成している最中である明確な証拠。** mtimeヒューリスティックとは独立に、lockという直接シグナルで検出できた唯一のケース。
- 結論として「本当に他セッションが同時並行している」ことが直接確認できたのは`jst-gate-pattern1-scope`の1件のみだが、mtimeベースの定義に厳密に従うと21件が`active`に分類される。**この曖昧さ自体を停止理由として提示し、どちらの基準で「同時並行が多すぎる」を判定するかは人間の判断に委ねる。** 以降の整理・削除提案は一切行っていない。

## 分類別件数

| 分類 | 件数 |
|---|---|
| main(本体) | 1 |
| active | 21(うちdirty=true実差分は2件) |
| merged | 44 |
| open(PRあり・非アクティブ) | 3 |
| orphan | 4 |
| duplicate | 2(`rankings-division-copy`の2箇所、1組) |
| **合計** | **75** |

## duplicate 全件明示

| パス | ブランチ | HEAD | 対応PR |
|---|---|---|---|
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/rankings-division-copy` | `feat/rankings-division-copy` | `8f1a8afece` | #215(OPEN) |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/rankings-division-copy` | `worktree-rankings-division-copy` | `376b8db5b0` | - |

26c の S1-2([out/worktree-ownership.md](../out/worktree-ownership.md))で報告済みの、別セッションが現在進行形で編集中のペア。**本書でも一切触っていない。**

## orphan 全件

| パス | ブランチ | 備考 |
|---|---|---|
| `/private/tmp/claude-501/.../scratchpad/orphan-audit-wt` | (detached) | prunable(gitdir参照先が既に存在しない。scratchpad配下=別セッションの一時ディレクトリが削除された後の残骸とみられる) |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/scraping-audit` | chore/scraping-audit-readonly | 対応PRなし。171時間(約7日)前が最終更新 |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-deep-tokyo-impact-4th-card` | worktree-fix-deep-tokyo-impact-4th-card | 対応PRなし。99.8時間前が最終更新 |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/upbeat-hodgkin-bba21e` | (detached) | 対応PRなし。75.2時間前が最終更新 |

## 全75件一覧

| パス | ブランチ | lock | HEAD | 対応PR | 未コミット | 最終更新 | 分類 |
|---|---|---|---|---|---|---|---|
| `/Users/kainakishiyoshi/Desktop/mnews` | `_scratch_deep` | - | `757ba07045` | - | なし | 2026-07-25 16:17(0.2h前) | main(本体) |
| `/private/tmp/claude-501/-Users-kainakishiyoshi-Desktop-mnews/aa2fd6ff-31e1-45bb-90fd-e9f8b4108e04/scratchpad/orphan-audit-wt` | `(detached)` | prunable:gitdir file points to non-existent location | `07f52119b1` | - | 不明(prunable) | - | orphan |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/a3-nakajima-taichi-rebase` | `a3-nakajima-taichi` | - | `3daec84f87` | #87(MERGED) | なし | 2026-07-18 12:53(171.6h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/add-deep-pancrase-shooto-fighters` | `feat/add-deep-pancrase-shooto-fighters` | - | `86a297579c` | #176(MERGED) | なし | 2026-07-21 15:35(96.9h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-digest-org-tag` | `fix/admin-digest-org-tag` | - | `1aaa11955b` | #168(MERGED) | なし | 2026-07-21 00:15(112.3h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-drafts-single-function` | `feat/admin-drafts-single-function` | - | `4503ee5922` | #170(MERGED) | なし | 2026-07-21 00:18(112.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-menu-rename` | `feat/admin-menu-rename` | - | `a72d392ec3` | #169(MERGED) | なし | 2026-07-21 00:17(112.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-ranking-article` | `feat/admin-ranking-article` | - | `0af875eee7` | #171(MERGED) | なし | 2026-07-21 11:37(100.9h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin1-post-reformat` | `feat/admin1-post-reformat` | - | `d90ac9e826` | #150(MERGED) | なし | 2026-07-20 08:13(128.3h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/career-display` | `feat/career-display` | - | `cc88630a61` | #115(MERGED) | なし | 2026-07-18 14:42(169.8h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/claude-md-cron-inventory` | `docs/claude-md-cron-inventory` | - | `32033e4623` | #205(MERGED) | なし | 2026-07-25 05:56(10.6h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/claude-md-draft-pr-claim` | `docs/claude-md-draft-pr-claim` | - | `ef53f2bf2c` | #216(MERGED) | なし | 2026-07-25 15:58(0.5h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/cron-table-nominal-caveat` | `docs/cron-table-nominal-caveat` | - | `c0811a6f28` | #211(MERGED) | なし | 2026-07-25 06:35(9.9h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-card-expansion` | `feat/dream-card-expansion` | - | `4b32069a30` | #129(MERGED) | なし | 2026-07-19 14:22(146.1h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-card-font-ceiling` | `feat/dream-card-font-ceiling` | - | `9fd165d8ae` | #141(MERGED) | なし | 2026-07-20 03:22(133.1h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-corner-swap` | `feat/dream-corner-swap` | - | `937cff316d` | #142(MERGED) | なし | 2026-07-20 03:34(132.9h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-marker-removal` | `fix/dream-marker-removal` | - | `ba19be008d` | #136(MERGED) | なし | 2026-07-19 15:04(145.5h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-share-url-shorten` | `feat/dream-share-url-shorten` | - | `fb9d11fd90` | #139(MERGED) | なし | 2026-07-19 17:33(143.0h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-vs-uniform-font` | `feat/dream-vs-uniform-font` | - | `75ee5a1791` | #149(MERGED) | なし | 2026-07-20 08:02(128.5h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/favicon-x-align` | `chore/favicon-x-align` | - | `aeea4ff918` | #204(MERGED) | なし | 2026-07-25 05:52(10.6h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/gate2-a-regen` | `chore/gate2-a-regen` | - | `a8a929dc08` | #148(MERGED) | なし | 2026-07-20 04:42(131.8h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/gate2-a-revert` | `fix/revert-unverified-weight-exclusions` | - | `70a438d8ba` | #153(MERGED) | なし | 2026-07-20 10:24(126.1h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/gate2-a-revert-regen` | `chore/gate2-a-revert-regen` | - | `2defe5dc8d` | #154(MERGED) | なし | 2026-07-20 10:27(126.1h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/jst-gate-pattern1-scope` | `fix/jst-gate-pattern1-scope` | - | `f204f58049` | - | なし | 2026-07-25 16:30(0.0h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/landmark15-results` | `fix/landmark15-results-move` | - | `30f13af8d9` | #125(MERGED) | なし | 2026-07-19 10:32(150.0h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/matchup-post-final` | `feat/matchup-post-final` | - | `6cff810f04` | #164(MERGED) | なし | 2026-07-20 14:10(122.4h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/misc-additions-aj-mckee-pancrase364-chorizin5` | `fix/cho-rizin-5-hiramoto-dautbek-corner` | - | `bc0dfce679` | #159(MERGED) | なし | 2026-07-20 12:44(123.8h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/nc-fix` | `chore/nc-full-audit-and-wada-aoki` | - | `44eeb22fe3` | #130(MERGED) | なし | 2026-07-19 14:19(146.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/nodata-label-en` | `fix/nodata-label-en` | - | `ee8d3ef7a3` | #160(MERGED) | なし | 2026-07-20 12:55(123.6h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/org-ranking-sort-fix` | `fix/org-ranking-description-sort` | - | `63acaf8ca7` | #214(MERGED) | なし | 2026-07-25 13:49(2.7h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/orphan-daily-digest-script` | `chore/orphan-daily-digest-script` | - | `4fe8910b2f` | #207(MERGED) | なし | 2026-07-25 05:58(10.6h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/p4p-investigation` | `(detached)` | - | `376b8db5b0` | - | なし | 2026-07-25 14:28(2.0h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/p4p-production` | `feat/p4p-production` | - | `a568384ad7` | #177(OPEN) | なし | 2026-07-24 07:35(32.9h前) | open(PRあり・非アクティブ) |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/p4p-trial-report` | `feat/p4p-trial-report` | - | `c98ffb42d5` | #172(OPEN) | なし | 2026-07-21 14:38(97.9h前) | open(PRあり・非アクティブ) |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr2-weightclass-lint` | `fix/naoki-inoue-record-overrides-patch-date` | - | `bd1921ba18` | #137(MERGED) | あり | 2026-07-19 15:28(145.1h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr2a-weightclass-lint` | `feat/rizin-weightclass-null-lint` | - | `a5762a6b7a` | #135(MERGED) | なし | 2026-07-19 15:52(144.7h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr3-rank-attribution` | `feat/rank-attribution-report` | - | `30ad6bd2d9` | #140(MERGED) | なし | 2026-07-20 01:41(134.8h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr567-dryrun` | `chore/567-bucket-audit-dryrun` | - | `68029f45bb` | #147(MERGED),#144(MERGED) | なし | 2026-07-20 04:39(131.9h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/publish-new-fighters` | `fix/publish-new-deep-pancrase-shooto-fighters` | - | `77120ecbb4` | #181(MERGED),#180(MERGED),#179(MERGED),#178(MERGED) | なし | 2026-07-21 16:37(95.9h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/ranking-display-cap` | `feat/ranking-display-cap` | - | `c694ed7060` | #113(MERGED) | なし | 2026-07-18 13:27(171.1h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/rankings-division-copy` | `feat/rankings-division-copy` | - | `8f1a8afece` | #215(OPEN) | なし | 2026-07-25 16:08(0.4h前) | duplicate |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/regen-final` | `chore/regen-rankings-both-fixes` | - | `5489bd3f1d` | #123(MERGED) | なし | 2026-07-19 09:13(151.3h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/result-card-hide-round` | `fix/result-card-hide-round` | - | `315d914ed6` | #110(MERGED) | なし | 2026-07-18 08:51(175.7h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/rizin-records-refresh` | `chore/rizin-records-refresh` | - | `2bf26734a2` | #114(MERGED) | なし | 2026-07-18 13:49(170.7h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/scraping-audit` | `chore/scraping-audit-readonly` | - | `e732aef205` | - | なし | 2026-07-18 13:32(171.0h前) | orphan |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/seo-meta-templates` | `feat/seo-meta-templates` | - | `11ff9fcbf6` | #199(MERGED) | なし | 2026-07-25 05:36(10.9h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/vs-og-nickname-fix` | `fix/vs-og-nickname-corner` | - | `2f8613e5db` | #112(MERGED) | なし | 2026-07-18 13:09(171.4h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/vs-red-corner-param` | `feat/matchup-post-brushup` | - | `33379ea103` | #161(MERGED) | なし | 2026-07-20 13:19(123.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/xpost-champion-label` | `fix/xpost-champion-label` | - | `9b1502375b` | #111(MERGED) | なし | 2026-07-18 11:16(173.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews-worktrees/xpost-seed-fighter` | `feat/xpost-seed-fighter` | - | `a4f136ab90` | #126(MERGED) | なし | 2026-07-19 12:00(148.5h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/agent-a6fe2ea76f1c692da` | `fix/original-feed-48h-cutoff` | - | `e0faec15e4` | #96(MERGED) | なし | 2026-07-18 02:16(182.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/agent-a904069ca64ac42cd` | `docs-fighter-record-display-label` | - | `4ca3d46132` | #93(OPEN) | なし | 2026-07-18 01:07(183.4h前) | open(PRあり・非アクティブ) |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/agent-a9e7ab0d3d95a5241` | `a4-ranking-delta-pipeline` | - | `74f3e30dbe` | #90(MERGED) | なし | 2026-07-18 13:00(171.5h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/audit-rating-drift-t3t4` | `worktree-audit-rating-drift-t3t4` | - | `36628fa31b` | - | あり | 2026-07-22 12:54(75.6h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/databug-fixes` | `chore/nav-menu-reorder` | - | `a3277072bf` | #92(MERGED) | なし | 2026-07-18 00:55(183.6h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/deep-event-roster-contamination-check` | `feat/deep-event-roster-contamination-check` | - | `8a414d426f` | #203(OPEN) | なし | 2026-07-25 05:40(10.8h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/deep-event-roster-discovery` | `feat/deep-event-roster-discovery` | - | `f56c677229` | #201(OPEN) | なし | 2026-07-25 03:43(12.8h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/feed-unify-buildfeed` | `main` | - | `4b2a8a918d` | - | なし | 2026-07-22 13:19(75.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix+ranking-attribution-bugs` | `fix/ranking-attribution-akimoto-patricky-satoshi` | - | `fa190367ed` | #138(MERGED) | なし | 2026-07-19 17:35(142.9h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-deep-tokyo-impact-4th-card` | `worktree-fix-deep-tokyo-impact-4th-card` | - | `952386acb2` | - | なし | 2026-07-21 12:42(99.8h前) | orphan |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-drafts-xpost` | `fix/drafts-finishrate-history` | - | `a99a86f762` | #165(MERGED) | なし | 2026-07-20 14:18(122.2h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-finishrate-history` | `fix/finishrate-nc-form` | - | `4722f00231` | #163(MERGED) | なし | 2026-07-20 14:02(122.5h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-super-rizin5-cardorder` | `worktree-fix-super-rizin5-cardorder` | - | `fff330564d` | #167(MERGED) | なし | 2026-07-20 23:51(112.7h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/followups-2026-07-26c` | `chore/followups-2026-07-26c-reports` | lock:claude session followups-2026-07-26c (pid 71331 start Sat Jul 25 13:29:10 2026) | `a025e49bdd` | #217(OPEN draft) | なし | 2026-07-25 16:17(0.2h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/hidden-flag-semantics-audit` | `feat/hidden-flag-semantics-audit` | - | `7a6be99b0a` | #198(OPEN) | なし | 2026-07-25 03:02(13.5h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pr209-f2b-provenance` | `pr209-f2b-provenance` | - | `1e82efd627` | - | なし | 2026-07-25 13:50(2.7h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pr209-jst-gate-fix` | `pr209-jst-gate-fix` | - | `68fe059cfd` | - | なし | 2026-07-25 06:57(9.6h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pr210-run-guard-403` | `pr210-run-guard-403` | - | `448a9c8746` | - | なし | 2026-07-25 06:50(9.7h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pri3-ranking-description` | `feat/org-ranking-description-dynamic` | - | `ffcbe9d3d7` | #212(CLOSED) | なし | 2026-07-25 07:13(9.3h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/rankings-division-copy` | `worktree-rankings-division-copy` | - | `376b8db5b0` | - | なし | 2026-07-25 14:22(2.1h前) | duplicate |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/rankings-revalidate-ci-guard` | `chore/homepage-restructure` | - | `5642753936` | #60(MERGED) | なし | 2026-07-16 23:51(208.7h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/remove-fightername-underline` | `worktree-remove-fightername-underline` | - | `2e20748af0` | #98(MERGED) | なし | 2026-07-18 02:56(181.6h前) | merged |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/roster-coverage-audit` | `feat/roster-coverage-audit` | - | `12bcacb8c6` | #197(OPEN) | なし | 2026-07-25 02:32(14.0h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/roster-loose-ends` | `feat/roster-loose-ends` | - | `5c1d4bfb45` | #208(OPEN) | なし | 2026-07-25 06:42(9.8h前) | active |
| `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/upbeat-hodgkin-bba21e` | `(detached)` | - | `36628fa31b` | - | なし | 2026-07-22 13:19(75.2h前) | orphan |