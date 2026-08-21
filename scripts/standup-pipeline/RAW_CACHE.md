# `raw/`キャッシュについて

## 2026-08-21追記: 週次自動更新ジョブ新設に伴う設計変更(このセクションが最新の運用)

`.github/workflows/update-kick-data.yml`(週次自動更新)を新設するにあたり、`build.py`が
無条件で要求していた以下11ファイルの生成手段がリポジトリのどこにも存在しないことが
判明した(空の`raw/`から`python3 build.py`を実行すると13ソース中1つも完走できない、
という致命的な事実。詳細調査結果はこのセッションの会話ログ参照):

`wp_kana.json`・`kana_from_romaji.json`・`wp_parsed.json`・`k1_parsed.json`・
`rise_parsed.json`・`sb_parsed.json`・`ko_parsed.json`・`k1_brands.json`・
`rise_dob.json`・`sb_dob.json`・`ko_dob.json`・`k1_delisted_merges.json`・
`ko_delisted_merges.json`(計13ファイル)、および`deepkick_index/index.json`・
`njkf_index/event_urls.json`(既知イベント一覧、これも生成手段が無い)。

これらは全て**生HTMLではなく小さな派生JSON**(名前・かな・所属・生年月日等の構造化
済みレコード、合計約824KB)だったため、**`raw/`の外(`scripts/standup-pipeline/cache/`、
`.gitignore`対象外)へ退避してコミットした**。`build.py`・`ingest_deepkick.py`・
`ingest_njkf.py`・`fetch_deepkick.py`・`fetch_njkf.py`の参照先もそちらに変更済み。
612MBの生HTML本体(tar.gz)はコミットしていない(各団体公式サイトの生データであり、
publicリポジトリでの公開はリスクが見合わないとユーザー判断済み)。

この変更により、**`raw/`自体はこのジョブでは一切永続化しない**(`actions/cache`も
GitHub Releaseも使わない)。週次ジョブは毎回`raw/`をゼロから作り、13ソースの
`fetch_*.py`をライブ実行し、ジョブ終了とともに`raw/`を破棄する。`fetch_k1.py`・
`fetch_knockout.py`は従来「既存`raw/`のファイル名(glob)」から再取得対象を復元する
設計だったため、空の`raw/`では0件しか取得できなかった(2026-08-21修正: `cache/`内の
名簿(`k1_parsed.json`・`ko_parsed.json`)のURLから既知ID/slugを導出する方式に変更)。
また全13本の`fetch_*.py`は`OUT_DIR`が存在しない前提で`os.makedirs`が無く、ローカルの
使い回し`raw/`では暗黙に動いていたが、真に空の`raw/`(GitHub Actionsの新規runner)では
全て`FileNotFoundError`で落ちることも判明し、全13本に`os.makedirs(OUT_DIR, exist_ok=True)`
を追加済み(ローカルでのdry-run実測で発見・修正)。

**したがって、以下の「2026-08-18時点」の記述(tar.gzが唯一の復元手段、という結論)は
週次自動更新ジョブのスコープでは既に過去のものである。** ただし以下の点は今も有効:
- `cache/`配下13ファイルそのものの生成手段は依然として存在しない(このコミットは
  "起動可能にする"だけで、生成スクリプトの再構築はしていない、今回は明示的に
  別タスクとする判断)。`cache/`の内容を将来更新する必要が生じた場合、今のところ
  人力で更新するしかない。
- DEEP☆KICK(`cache/deepkick_index/index.json`、既知118件)は一覧ページがJS描画のため
  ライブでの新規発見手段が無く、この既知件数が事実上の恒久的な母集団上限になる
  (名簿自動拡張は今回のジョブのスコープ外という判断と整合)。
- K-1のID空間走査(1,196件個別プローブによる退所選手の悉皆回収)・KNOCK OUTの大会一覧
  発見・NKB旧サイト(2012〜2018年、35ページ)は、いずれも現在のフェッチャでは再現
  できない(前者2つは「既知の名簿の範囲でのみ再取得」に限定、NKB旧サイトは
  完全凍結)。この意味で、tar.gz(`~/mnews-data-archive/`)は依然としてこれらの
  "初回発見"作業の記録として歴史的価値を持つ。

## 2026-08-21追記その2: fighters.json/fighters.csvも凍結対象(cache/名簿スナップショットの86件ずれ)

`cache/`の名簿スナップショット(2026-08-18時点)は、コミット済み`data/kick/fighters.json`
と**86件ずれている**(2026-08-21実測、`data/kick/kickRosterCacheDriftAudit.json`に全件
記録済み)。内訳: kana(読み仮名)消失50・sources(統合有無)13・aliases(別名統合)10・
orgs 5・gym 1、選手レコードの分裂5、コミット済み側のみに存在6、cache/側再生成のみに
存在11。これは`raw/`の57行の版差と同じ「退避したスナップショットが、現行コミット済み
データを生成した時点の入力と完全には一致しない」という既知の限界の一種で、cache/名簿の
生成手段が無い以上、解消手段も無い。

**将来cache/配下の名簿ファイルを更新する場合、無条件で上書きしてはいけない。** 86件の
差分を個別に確認し、コミット済み側が正しい場合はcache/側を個別に修正すること。

このため、週次自動更新ジョブ(`.github/workflows/update-kick-data.yml`)は
`fighters.json`/`fighters.csv`も凍結対象にした(RIZIN・Wikipedia・NKB旧サイトと
同じ扱い)。`scripts/standup-pipeline/build.py`は`KICK_SKIP_FROZEN_SOURCES=1`の間、
名簿生成ロジック(`generate_roster.py`、旧・build.py本体にあった約380行)自体を
importしない。「名簿の自動拡張はしない」がこのジョブのスコープ外事項であるため、
そもそも名簿を再生成する必要が無いという判断による。恒久ゲート
(`check-kick-fighters-frozen-gate.ts`)がHEADコミット時点と1バイトでも異なれば
ビルドを失敗させる。

以下、2026-08-18時点の元の記述(tar.gz退避の経緯・既知の限界):

---

**★重要(将来のセッションへ): このtar.gzは「これさえあれば現行データを完全に復元できるバックアップ」ではない。** 単体から`python3 build.py`を実行すると、13ソース中8ソース+RIZINは現行`data/kick/`とバイト単位で一致するが、**残り5ソース(RISE・Bigbang・NKB・NJKF・DEEP☆KICK)は合計57行が現行データと食い違う**(詳細は「既知の限界」節)。原因はraw版差(退避時点のrawが、現行データを生成した時点のrawより古い/一部欠けている)であり、**現行データを実際に生成した時点のraw自体はもう存在しない可能性が高い**(このマシン上のどのworktreeにも、今回退避した版より新しいrawは見つかっていない)。「このtar.gzを展開してbuild.pyを回せば元通りになる」と思い込んで無条件に上書きしないこと。57行の食い違いを許容できるかは都度判断する。

このディレクトリ(`scripts/standup-pipeline/`)配下の`ingest_*.py`・`build.py`はいずれも、公式サイトから取得した生HTML/生JSONをローカルの`raw/`ディレクトリから読み込む**パーサ**であり、ネットワークへのフェッチ処理(`requests.get`・`urllib.request.urlopen`等)は含んでいない(唯一の例外は`fetch_wikitext_cache.py`、MediaWiki APIを叩く一回限りのフェッチスクリプト)。

`raw/`は`.gitignore`(`scripts/standup-pipeline/raw/`)で意図的に除外されており、**このリポジトリには一度もコミットされたことがない**。

## どこにあるか

2026-08-18時点、`raw/`の完全なコピー(6,270ファイル、612MB)を以下に退避してある:

- 展開済み: `~/mnews-data-archive/standup-raw/`(このマシンのローカルディスク)
- アーカイブ: `~/mnews-data-archive/standup-raw-20260818.tar.gz`(91,604,499 bytes)
  - sha256: `7023d6fe25ed0f9be4c7e5b01adf259691a674a47254a962bd328e2bee7ced20`
  - チェックサムファイル: `~/mnews-data-archive/standup-raw-20260818.tar.gz.sha256`

このリポジトリにもマシンのディスクにも属さない第三の場所(クラウドストレージ等)へは退避していない。**このtar.gzが失われると、このマシン上の他のworktree(後述)にしか実体が残らない。**

## 何のために必要か

`python3 build.py`(このディレクトリで実行)は、`raw/`配下のファイルを読み、13団体+RIZINの`bouts_*.json`と選手名簿`fighters.json`を再生成する。`raw/`が無いと、この再生成は一切できない(各ソースの取得元一覧・生成に必要な作業内容は`out/kick-13source-regen-and-defect-audit-report.md`のA章を参照)。

## 失うと何が起きるか

- `raw/`を失った場合、13団体+RIZINのデータを作り直すには、各団体公式サイトから生HTMLを再取得するところからやり直しになる。現時点でこのリポジトリには生HTMLを取得するフェッチャ(自動化されたスクリプト)が存在しないため(ONE Championshipを除く)、再取得は手動作業になる。
- 2026-08-18時点、このマシンの以下2箇所のworktreeにも同内容(一部はサブセット)が残っている。ただしこれらは`git worktree remove`や作業終了時のクリーンアップで消える可能性があり、恒久的な保存先ではない:
  - `mnews-worktrees/standup-pipeline-migration/scripts/standup-pipeline/raw/`(6,269ファイル、今回退避した6,270件の部分集合、内容は完全一致)
  - `mnews-worktrees/wikipedia-record-ingestion/scripts/standup-pipeline/raw/`(6,270ファイル、今回退避した内容そのもの)

## 既知の限界(2026-08-18、再現性検証で判明)

このtar.gzだけから`python3 build.py`を実行すると、13ソース中8ソース(K-1/Krush/Krush-EX・SHOOT BOXING・KNOCK OUT・JKA・KROSS×OVER・Stand up・SNKA・HoostCup)+RIZINは現行`data/kick/`のデータとバイト単位で完全一致するが、**残り5ソース(RISE・Bigbang・NKB・NJKF・DEEP☆KICK)は合計57行の差分がある**(全22,368件中0.26%)。

**2026-08-19追記: 原因を再調査し、全57件を2区分(残余ゼロ)に整理した**(全件の詳細は`out/kick-raw-cache-archive-verification-report.md`参照、このファイル自体はリポジトリにコミットしていない):

- **手動編集: 1件(RISE)**。決着(win/loss)を人間が確認して上書きしたコミット(`768f108`、PR-13「RISE公式サイト自体の誤り1件を修正」)によるもので、**RISE公式サイト自体の生HTMLが誤っている**ため、raw/をどれだけ再取得・再解析しても機械的には再現しない。
- **raw版差/欠損: 56件**。パーサのコード自体は現行と完全に同一(9ソース分の`ingest_*.py`は今回のraw/退避時点から一切変更していない)にもかかわらず結果が食い違うことから、原因は**退避したraw/自体が、現行コミット済みデータを生成した時点のraw/と完全には一致していない**ことだと個別に特定した:
  - 19件(稲垣澪・中島隆徳・勇志、Bigbang/NKB/NJKF/DEEP☆KICK): `raw/k1_parsed.json`・`raw/ko_parsed.json`・`raw/rise_parsed.json`という**選手名簿の二次キャッシュファイル自体**に、当時のバグ(K-1公式ページの「所属・ジム」欄が空の場合に隣接する「生年月日」欄の値を誤って拾う等)や複数団体所属者の名寄せ結果が**そのまま凍結されて残っていた**ことを、該当選手の生HTML・キャッシュJSONを直接確認して突き止めた(例: `raw/k1_parsed.json`のid=1065のエントリに`"gym": "生年月日"`が既に書き込まれていた。これは`build.py`実行時に毎回計算される値ではなく、退避前のある時点で一度だけ生成されて以来ファイルとして固定されている値)。
  - 26件(日付null埋め、Bigbang2件・NJKF24件): 同一event内の兄弟行から日付を補完するロジック(`infer_sibling_dates()`)自体は現行と同じだが、**退避raw内の該当イベントページに、日付を持つはずの兄弟行が(NJKF「DUEL.30」で実測確認した限り)欠けている**。兄弟行含め全行が`date: null`のまま出力されることを、退避raw単体からの再生成で直接確認した。
  - 10件(DEEP☆KICK 27の大会名がイベントページの本文コメントに化ける): 退避raw内の該当イベントページ自体が、現行データを生成した時点のページ内容と異なる可能性が高い(未確認)。
  - 1件(RISE、空の対戦相手・決着を持つゴミ行が退避raw regenのみに出現): 現行の単一行データとの対比から見て、退避raw内の該当選手ページに現行には無い余分な行が含まれている可能性が高い(未確認)。
- 検算: 1(手動編集) + 19 + 26 + 10 + 1(raw版差、計56) = 57 ✓

**今回のraw/退避物は、これらの版差を含んだ「ある時点のスナップショット」であり、これ以上新しいraw/を重ねて取得しない限り、この56件のズレは埋まらない**(スナップショット自体を更新する必要がある)。

### 手動編集1件の扱いについて(未実装、判断待ち)

RISE 1件の手動修正は、`data/kick/manualOverrides.json`(Wikipediaの改名選手5件で実績のある、再生成時の巻き戻り検知レジストリ)と同じ枠組みに登録するのが妥当と考える。理由:

- 「パーサを直す」対応は取れない。誤りは公式サイト自身の生データにあり、どんな解析ロジックを書いても正しい値を導出できないため。
- 過去に同種の事故(Wikipedia改訂選手5件の手動修正が、`ingest_wikipedia.py`再実行で無言に巻き戻った、PR-18→#563)が実際に起きており、同じ仕組み(レジストリ登録+`check-kick-manual-edit-drift.ts`によるビルド時検知)を使えば同型の再発を防げる。

対案として「何もしない」(現状、手動修正はレジストリ未登録で無防備)も選択肢としてはあるが、既知の類似事故がある以上、登録する方を推奨する。**この節は判断材料の提示のみで、レジストリへの実装はまだ行っていない。**

Wikipediaステップ(`ingest_wikipedia.py`)は、このtar.gzには`raw/wp_wikitext_v2.json`が含まれておらず(`raw/wp_wikitext_509.json`という別名のファイルのみ存在)、`python3 build.py`実行時にエラーで停止する。Wikipedia側の再現性は本キャッシュの対象外。

**したがって、このtar.gzは「13ソースの再生成コストをほぼゼロにする」という意味では価値が高いが、「これさえあれば現行データと完全に一致する」ことを保証するものではない。**
