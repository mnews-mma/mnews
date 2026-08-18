# `raw/`キャッシュについて

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

内訳(全件の詳細は退避時点のセッション記録`out/kick-raw-cache-archive-verification-report.md`参照、このファイル自体はリポジトリにコミットしていない):

- RISE 1件は公式サイト自体の誤りを人間が確認して上書きした**明確な手動編集**で、raw/をどれだけ再取得しても機械的には再現しない。
- 残りは名簿(`fighters.json`)の名寄せ・gym表記正規化ロジックの版差、日付補完ロジックの単発実行時の非再現性、DEEP☆KICK 27イベントページのraw HTML自体が版によって異なる可能性、の3種に整理される(いずれも原因の完全特定はできていない)。

Wikipediaステップ(`ingest_wikipedia.py`)は、このtar.gzには`raw/wp_wikitext_v2.json`が含まれておらず(`raw/wp_wikitext_509.json`という別名のファイルのみ存在)、`python3 build.py`実行時にエラーで停止する。Wikipedia側の再現性は本キャッシュの対象外。

**したがって、このtar.gzは「13ソースの再生成コストをほぼゼロにする」という意味では価値が高いが、「これさえあれば現行データと完全に一致する」ことを保証するものではない。**
