# worktree-ownership: S1-2 調査結果(followups-2026-07-26c ①)

生成日時(JST): 2026-07-26

**削除・close・統合は一切行っていない。以下は調査結果のみ。判断は人間に委ねる。**

## 0. S1-1について(先に報告)

指示書は「#216に1行追記してからマージする」としていたが、**調査開始時点で#216は既に別セッションによってマージ済みだった**(`2026-07-25T16:01:09Z`)。マージ済みの内容を確認したところ、指示書が求めていた「同一ブランチにforce-pushしない。リモートが進んでいたらrebaseで統合してからpushする」という趣旨は**既にCLAUDE.mdに反映済み**(該当行そのまま引用):

> 同一ブランチへforce-pushしない。リモートが進んでいたら`git rebase`で統合してからpushする(2つのセッションが同じブランチを同時に触るケースはdraft PR claimだけでは防げないため)

追加のマージ・追記作業は不要と判断し、何もしていない。

## 1. `git worktree list` 全件(調査時点)

73件のworktree登録がある(メインツリー含む)。全件は本レポート末尾の付録に掲載。ここでは`rankings-division-copy`関連と、lock状態の確認結果のみ本文に記載する。

### lock状態の確認

`git worktree list`の出力・`.git/worktrees/*/locked`ファイルの両方を確認したが、**現時点で`git worktree lock`によるロックがかかっているworktreeは0件だった**。指示書は「worktree `rankings-division-copy` が locked のまま」としているが、これは文字通りのgit lock機構ではなく、「別セッションが使用中」という状態を指していたと考えられる(下記2節で、実際に未コミット変更があることを確認した)。

## 2. `rankings-division-copy` 関連worktreeの詳細

**同名の`rankings-division-copy`という名前のworktreeが2つ存在する。**別のディレクトリ・別のブランチであり、混同しないこと。

| 項目 | worktree A(PR-B本体) | worktree B(私が今回作成) |
|---|---|---|
| パス | `/Users/kainakishiyoshi/Desktop/mnews-worktrees/rankings-division-copy` | `/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/rankings-division-copy` |
| ブランチ | `feat/rankings-division-copy`(= #215のブランチそのもの) | `worktree-rankings-division-copy`(ブランチ名衝突のためrename失敗、放置されたローカルブランチ) |
| lock | なし | なし |
| **未コミット変更** | **あり**(下記参照) | なし(クリーン) |
| ディレクトリ最終更新 | 2026-07-25 23:02(過去)〜調査中に更新を検知(下記参照) | - |

### worktree A: 未コミット変更を検知(調査中にリアルタイムで変化した)

調査を2回に分けて実施したところ、**1回目と2回目の間でHEADのコミットSHAが変化していた**(コミットメッセージ・日時は同一)。

- 1回目確認: HEAD `c9fc73505eb4f88eaa6fa03f72358340fa576493`(2026-07-25 23:04:23、`git status`はクリーン)
- 2回目確認(数分後): HEAD `2f0d361882d9c822f5210f82b3c3966824d2755b`(同じ日時・同じメッセージ「feat(seo): /rankings/[division]に固有テキストを追加(PR-B)」)、かつ**`src/app/rankings/[division]/page.tsx`に未コミット変更あり**

これは**`git commit --amend`が実行され、かつ現在も編集が続いている**ことを示す。差分の内容を確認したところ(読み取り専用、変更は一切加えていない)、**指示書のB3-1(固有テキストをランキング表の下へ移動)そのものを実装している最中**だった(diffのコメントに「B3-1」と明記されている)。

**つまり、この指示書(followups-2026-07-26c)が想定している②の是正作業を、既に別セッションが並行して実施している。**

origin側(`origin/feat/rankings-division-copy`)は`c9fc73505eb4f88eaa6fa03f72358340fa576493`のままで、上記のamend・編集はまだpushされていない。

## 3. #215 ブランチの状態

- `gh pr view 215` → OPEN、`headRefName: feat/rankings-division-copy`
- リモートHEAD: `c9fc73505eb4f88eaa6fa03f72358340fa576493`(worktree Aの1回目確認時点のHEADと一致。worktree Aで進行中のamend・編集はまだ反映されていない)

## 4. 結論(判断は代行しない)

- **停止条件に該当**: 「worktreeに未コミット変更があった(＝別セッションが作業中)」に該当する。worktree Aは現在進行形で編集中。
- 私は**worktree Aに一切書き込んでいない**(git status/diff/logの読み取りのみ)。
- ②(PR-B是正)は、worktree Aで既に着手されている可能性が高い(B3-1と明記された差分が存在するため)。**このままworktree Aで完了するのを待つか、別セッションに任せるかは人間が決める。**
- worktree B(私が作成した空のworktree)は何の作業も含んでおらず、削除しても実害はないと考えられるが、**削除は指示書の不変ルールで禁止されているため実施していない**。

## 付録: `git worktree list` 全件(調査時点のスナップショット)

```
/Users/kainakishiyoshi/Desktop/mnews                                                                                          757ba07 [_scratch_deep]
/private/tmp/claude-501/.../orphan-audit-wt                                                                                   07f5211 (detached HEAD) prunable
/Users/kainakishiyoshi/Desktop/mnews-worktrees/a3-nakajima-taichi-rebase                                                      3daec84 [a3-nakajima-taichi]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/add-deep-pancrase-shooto-fighters                                              86a2975 [feat/add-deep-pancrase-shooto-fighters]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-digest-org-tag                                                           1aaa119 [fix/admin-digest-org-tag]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-drafts-single-function                                                   4503ee5 [feat/admin-drafts-single-function]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-menu-rename                                                              a72d392 [feat/admin-menu-rename]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin-ranking-article                                                          0af875e [feat/admin-ranking-article]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/admin1-post-reformat                                                           d90ac9e [feat/admin1-post-reformat]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/career-display                                                                 cc88630 [feat/career-display]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/claude-md-cron-inventory                                                       32033e4 [docs/claude-md-cron-inventory]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/claude-md-draft-pr-claim                                                       ef53f2b [docs/claude-md-draft-pr-claim]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/cron-table-nominal-caveat                                                      c0811a6 [docs/cron-table-nominal-caveat]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-card-expansion                                                           4b32069 [feat/dream-card-expansion]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-card-font-ceiling                                                        9fd165d [feat/dream-card-font-ceiling]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-corner-swap                                                              937cff3 [feat/dream-corner-swap]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-marker-removal                                                           ba19be0 [fix/dream-marker-removal]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-share-url-shorten                                                        fb9d11f [feat/dream-share-url-shorten]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/dream-vs-uniform-font                                                          75ee5a1 [feat/dream-vs-uniform-font]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/favicon-x-align                                                                aeea4ff [chore/favicon-x-align]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/gate2-a-regen                                                                  a8a929d [chore/gate2-a-regen]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/gate2-a-revert                                                                 70a438d [fix/revert-unverified-weight-exclusions]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/gate2-a-revert-regen                                                           2defe5d [chore/gate2-a-revert-regen]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/landmark15-results                                                             30f13af [fix/landmark15-results-move]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/matchup-post-final                                                             6cff810 [feat/matchup-post-final]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/misc-additions-aj-mckee-pancrase364-chorizin5                                  bc0dfce [fix/cho-rizin-5-hiramoto-dautbek-corner]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/nc-fix                                                                         44eeb22 [chore/nc-full-audit-and-wada-aoki]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/nodata-label-en                                                                ee8d3ef [fix/nodata-label-en]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/org-ranking-sort-fix                                                           63acaf8 [fix/org-ranking-description-sort]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/orphan-daily-digest-script                                                     4fe8910 [chore/orphan-daily-digest-script]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/p4p-investigation                                                              376b8db (detached HEAD)
/Users/kainakishiyoshi/Desktop/mnews-worktrees/p4p-production                                                                 a568384 [feat/p4p-production]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/p4p-trial-report                                                               c98ffb4 [feat/p4p-trial-report]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr2-weightclass-lint                                                           bd1921b [fix/naoki-inoue-record-overrides-patch-date]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr2a-weightclass-lint                                                          a5762a6 [feat/rizin-weightclass-null-lint]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr3-rank-attribution                                                           30ad6bd [feat/rank-attribution-report]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/pr567-dryrun                                                                   68029f4 [chore/567-bucket-audit-dryrun]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/publish-new-fighters                                                           77120ec [fix/publish-new-deep-pancrase-shooto-fighters]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/ranking-display-cap                                                            c694ed7 [feat/ranking-display-cap]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/rankings-division-copy                                                         2f0d361(調査中に変化。詳細は本文2節) [feat/rankings-division-copy]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/regen-final                                                                    5489bd3 [chore/regen-rankings-both-fixes]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/result-card-hide-round                                                         315d914 [fix/result-card-hide-round]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/rizin-records-refresh                                                          2bf2673 [chore/rizin-records-refresh]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/scraping-audit                                                                 e732aef [chore/scraping-audit-readonly]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/seo-meta-templates                                                             11ff9fc [feat/seo-meta-templates]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/vs-og-nickname-fix                                                             2f8613e [fix/vs-og-nickname-corner]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/vs-red-corner-param                                                            33379ea [feat/matchup-post-brushup]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/xpost-champion-label                                                           9b15023 [fix/xpost-champion-label]
/Users/kainakishiyoshi/Desktop/mnews-worktrees/xpost-seed-fighter                                                             a4f136a [feat/xpost-seed-fighter]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/agent-a6fe2ea76f1c692da                                                e0faec1 [fix/original-feed-48h-cutoff]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/agent-a904069ca64ac42cd                                                4ca3d46 [docs-fighter-record-display-label]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/agent-a9e7ab0d3d95a5241                                                74f3e30 [a4-ranking-delta-pipeline]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/audit-rating-drift-t3t4                                                36628fa [worktree-audit-rating-drift-t3t4]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/databug-fixes                                                          a327707 [chore/nav-menu-reorder]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/deep-event-roster-contamination-check                                  8a414d4 [feat/deep-event-roster-contamination-check]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/deep-event-roster-discovery                                            f56c677 [feat/deep-event-roster-discovery]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/feed-unify-buildfeed                                                   4b2a8a9 [main]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix+ranking-attribution-bugs                                           fa19036 [fix/ranking-attribution-akimoto-patricky-satoshi]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-deep-tokyo-impact-4th-card                                         952386a [worktree-fix-deep-tokyo-impact-4th-card]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-drafts-xpost                                                       a99a86f [fix/drafts-finishrate-history]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-finishrate-history                                                 4722f00 [fix/finishrate-nc-form]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/fix-super-rizin5-cardorder                                             fff3305 [worktree-fix-super-rizin5-cardorder]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/hidden-flag-semantics-audit                                            7a6be99 [feat/hidden-flag-semantics-audit]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pr209-f2b-provenance                                                   1e82efd [pr209-f2b-provenance]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pr209-jst-gate-fix                                                     68fe059 [pr209-jst-gate-fix]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pr210-run-guard-403                                                    448a9c8 [pr210-run-guard-403]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/pri3-ranking-description                                               ffcbe9d [feat/org-ranking-description-dynamic]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/rankings-division-copy                                                 376b8db [worktree-rankings-division-copy]  ← worktree B(私が作成、空)
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/rankings-revalidate-ci-guard                                           5642753 [chore/homepage-restructure]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/remove-fightername-underline                                           2e20748 [worktree-remove-fightername-underline]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/roster-coverage-audit                                                  12bcacb [feat/roster-coverage-audit]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/roster-loose-ends                                                      5c1d4bf [feat/roster-loose-ends]
/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/upbeat-hodgkin-bba21e                                                  36628fa (detached HEAD)
```
