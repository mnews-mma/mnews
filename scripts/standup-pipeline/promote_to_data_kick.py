# -*- coding: utf-8 -*-
"""週次自動更新ジョブ専用(2026-08-21新設): build.pyの出力
(scripts/standup-pipeline/bouts_*.json・fighters.json・fighters.csv)を
data/kick/ 配下へ昇格させる。

対象は14ソース(bigbang/standup/krossover/snka/jka/hoostcup/deepkick/njkf/nkb/
k1/rise/sb/knockout/one)。RIZIN・Wikipediaはbuild.py側でKICK_SKIP_FROZEN_SOURCES=1
により今回のジョブでは一切出力されない(scripts/standup-pipeline/bouts_rizin.json・
bouts_wikipedia.jsonがそもそも書かれない)ため、このスクリプトも対象に含めていない。
data/kick/側の該当ファイルは触らずそのまま残る。これが「凍結」の実体。

ONE Championship(2026-08-22追加): 他13ソースと同じ「毎週フルに再取得・再生成する」
対象に含めた。ただしONE公式選手名簿(one_official_manifest.json、116人)自体は
固定であり、この週次ジョブでは一切拡張しない(build_one_manifest.pyを呼ばない、
build.py・fetch_one.py参照)。取得しているのはその固定116人分のプロフィールページの
中身(戦績)のみ。

NKB旧サイト分の凍結(2026-08-21): ingest_nkb.pyは新サイト(ライブ再取得)と
旧サイト(2012〜2018年、raw/nkb_old_events/*.html、生成手段が無く週次ジョブでは
取得しない)の両方を1本のbouts_nkb.jsonとして書き出す。空のraw/では旧サイト分の
行が0件で返るため、素直に上書きすると旧サイトの過去bout(約35件)が毎週消える。
旧サイト行はsource_urlが http://www.nkb-r.com/ で始まるという判別が可能
(新サイトはnkb-r.com/main/経由)なため、前回コミット済みのdata/kick/bouts_nkb.json
から旧サイト行だけを毎回引き継いで合成する。

同一性の判定について(2026-08-21、2度目の見直し): 当初は(fighter_slug, opponent_raw,
date, event, source_url)の5要素を自然キーにしていたが、実走テストで
event・source_urlの両方が不安定だと判明した。DEEP☆KICKで同一の実bout
(同一選手・同一相手・同一日・同一結果)が2つの異なる記事URL(件名も「DEEP☆KICK
ZERO 05」/「DEEP☆KICK ZERO」と表記ゆれ)に重複投稿されているケースを実測し、
5要素キーだとこれを「削除+追加」の別bout扱いしてしまっていた(1件深掘り、
DEEP☆KICK ZERO 05・Hotaru vs ボーちゃん)。bout_id自体も「そのソース内での
出現順インデックス」を含む形式(例: k1:{fid}:{i})で、ページの記載順が変われば
ずれる。いずれも表示に影響しない不安定な要素のため、識別には使わない。

(fighter_slug, date, 正規化した相手名)の3要素に絞った(2026-08-21)。全35,359件の
既存bout(data/kick/配下)で衝突を実測したところ、真に別の試合が衝突した例は
frozen対象(Wikipedia、週次ジョブの対象外)で1件のみ(藤原あらし、2002-09-06に
同じ相手と2試合、通算成績のダブルブッキングの可能性があるが未確認)、他は全て
「date未取得同士の衝突(9件、そもそも要素が無く区別しようがない)」または
「同一bout の重複投稿(40件、この3要素キーへの変更でむしろ正しく1件に統合される
ようになった、良い副作用)」だった。相手名の正規化は
check-kick-manual-edit-drift.tsのnormalizeNameForKey()と同じロジックを使う
(TS側と定義がズレると検知の意味が無くなるため、両ファイルを揃えて更新すること)。

出力: 昇格した各ファイルについて、旧データとの差分サマリー(追加行数・削除行数・
既存行の変化の有無)をJSONとして標準出力に書く(呼び出し元のワークフローがPR本文の
組み立てに使う)。
"""
import json
import os
import re
import sys
import unicodedata

PIPE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(PIPE_DIR, "..", ".."))
DATA_KICK = os.path.join(REPO_ROOT, "data", "kick")

SOURCES = [
    "bigbang", "standup", "krossover", "snka", "jka", "hoostcup",
    "deepkick", "njkf", "nkb", "k1", "rise", "sb", "knockout", "one",
]

NKB_OLD_SITE_PREFIX = "http://www.nkb-r.com/"

# bout数急減ガード(2026-08-21追加): 週次自動更新ジョブの実走テストで、Bigbang・
# Stand upのREST APIがGitHub Actionsのrunner環境からHTTP 403を返し(WAF等が
# クラウド事業者のIP帯域を弾く典型パターン、ローカル回線では再現しない)、
# fetch_*.pyが0件取得のまま正常終了(exit=0)した。ガードが無いと、このスクリプトが
# 0件を「新しいデータ」としてそのまま昇格させ、前回コミット済みの実データを
# 静かに空配列で上書きするところだった(Bigbang 1,526件・Stand up 89件、実測)。
# update-org-records.ymlの団体別bout数減少ガードと同型の安全弁をここに追加する。
REGRESSION_RATIO_THRESHOLD = 0.5  # 前回からこの割合以上減ったら異常とみなす(50%)


def normalize_name_for_key(s):
    # check-kick-manual-edit-drift.ts の normalizeNameForKey() と同じロジック
    # (TS側と定義がズレると検知の意味が無くなるため、両ファイルを揃えて更新すること)。
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    for c in "“”\"'‘’｀「」『』【】〈〉《》〔〕・･":
        s = s.replace(c, "")
    s = re.sub(r"\s+", "", s)
    return s.lower()


def bout_key(b):
    return (
        b.get("fighter_slug"),
        b.get("date"),
        normalize_name_for_key(b.get("opponent_name")),
    )


def _sort_key(k):
    # キーの各要素にNoneが混じりうる(date未取得行等)。Python3は None と str の比較で
    # TypeErrorになるため、ソート専用に None を空文字へ寄せる(出力自体のkは変えない)。
    return tuple("" if v is None else v for v in k)


def load(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    report = {}
    for tag in SOURCES:
        src_path = os.path.join(PIPE_DIR, f"bouts_{tag}.json")
        dst_path = os.path.join(DATA_KICK, f"bouts_{tag}.json")
        fresh = load(src_path)
        if fresh is None:
            report[tag] = {
                "status": "skipped_no_output",
                "reason": f"{os.path.basename(src_path)}が存在しない(このソースの取得・build自体が失敗した)",
            }
            continue

        prev = load(dst_path) or []
        note = None
        if tag == "nkb":
            old_site_prev = [b for b in prev if (b.get("source_url") or "").startswith(NKB_OLD_SITE_PREFIX)]
            fresh_keys_pre = {bout_key(b) for b in fresh}
            carried = [b for b in old_site_prev if bout_key(b) not in fresh_keys_pre]
            fresh = fresh + carried
            note = f"NKB旧サイト(凍結対象、raw/nkb_old_events/未取得)分{len(carried)}件を前回コミットから引き継いだ"

        if prev and len(fresh) <= len(prev) * (1 - REGRESSION_RATIO_THRESHOLD):
            # 昇格自体をスキップする。dst_path(data/kick/、本番の入力)は一切触らず
            # 前回コミット値をそのまま残す。src_path(scripts/standup-pipeline/、
            # build.pyが今回の実行で既に壊れた内容を書き込み済み)だけは、prevの内容で
            # 上書きして両ディレクトリを同期させる(check-kick-pipeline-mirror-sync.tsが
            # 両者のbout_id不一致をゼロ件ゲートで検査するため、放置すると昇格スキップとは
            # 別の理由でゲートが落ち、Issue本文にこの理由が載らなくなる)。
            with open(src_path, "w", encoding="utf-8") as f:
                json.dump(prev, f, ensure_ascii=False, indent=1)
                f.write("\n")
            # 「静かにスキップしない」ため、prev_count/fresh_countを明示したreasonを
            # 必ず残す(呼び出し元のワークフローがPR本文・Issue本文の両方で
            # この理由付きレポートをそのまま使う)。
            report[tag] = {
                "status": "skipped_regression",
                "prev_count": len(prev),
                "fresh_count": len(fresh),
                "reason": (
                    f"bout数が前回コミット時点({len(prev)}件)から{len(fresh)}件に急減"
                    f"(50%以上の減少)。取得失敗(WAF/ネットワーク等、fetch_*.py自体は"
                    f"exit=0で正常終了しているため気づきにくい)の疑いがあるため、"
                    f"このソースの昇格をスキップし前回コミット値をそのまま維持した。"
                ),
            }
            continue

        prev_keys = {bout_key(b) for b in prev}
        fresh_keys = {bout_key(b) for b in fresh}
        added = fresh_keys - prev_keys
        removed = prev_keys - fresh_keys
        prev_by_key = {bout_key(b): b for b in prev}
        fresh_by_key = {bout_key(b): b for b in fresh}
        changed = sorted((k for k in (prev_keys & fresh_keys) if prev_by_key[k] != fresh_by_key[k]), key=_sort_key)

        # 新規行のうちopponent_resolvedに失敗したもの(=名簿に無い選手が入ってきた指標)。
        added_rows = [fresh_by_key[k] for k in added]
        added_opponent_unresolved = sum(1 for b in added_rows if not b.get("opponent_resolved"))
        prev_events = {(b.get("event"), b.get("date")) for b in prev}
        added_new_events = len({(b.get("event"), b.get("date")) for b in added_rows} - prev_events)

        entry = {
            "status": "ok",
            "prev_count": len(prev),
            "fresh_count": len(fresh),
            "added_count": len(added),
            "added_new_event_count": added_new_events,
            "added_opponent_unresolved_count": added_opponent_unresolved,
            "removed_count": len(removed),
            "removed_keys": [list(k) for k in sorted(removed, key=_sort_key)],
            "changed_count": len(changed),
            "changed_keys": [list(k) for k in changed],
        }
        if note:
            entry["note"] = note
        report[tag] = entry

        # data/kick/とscripts/standup-pipeline/の両方に同じ内容を書く。
        # check-kick-pipeline-mirror-sync.ts が両ディレクトリの同名bouts_*.jsonを
        # bout_idキーで突合し「片方にしか無いbout_id」をゼロ件ゲートとして検査するため、
        # NKB旧サイト分の引き継ぎ(carried)のように片方だけを書き換えると即座に
        # このゲートに落ちる。常に両方へ同一内容を書いて同期を保つ。
        for out_path in (dst_path, src_path):
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(fresh, f, ensure_ascii=False, indent=1)
                f.write("\n")

    for fname in ("fighters.json", "fighters.csv"):
        src = os.path.join(PIPE_DIR, fname)
        if os.path.exists(src):
            with open(src, "rb") as f:
                content = f.read()
            with open(os.path.join(DATA_KICK, fname), "wb") as f:
                f.write(content)
            report.setdefault("_roster", {})[fname] = "promoted"

    json.dump(report, sys.stdout, ensure_ascii=False, indent=1)
    print()


if __name__ == "__main__":
    main()
