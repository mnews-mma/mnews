# -*- coding: utf-8 -*-
"""週次自動更新ジョブ専用(2026-08-21新設): build.pyの出力
(scripts/standup-pipeline/bouts_*.json・fighters.json・fighters.csv)を
data/kick/ 配下へ昇格させる。

対象は13ソース(bigbang/standup/krossover/snka/jka/hoostcup/deepkick/njkf/nkb/
k1/rise/sb/knockout)のみ。RIZIN・Wikipediaはbuild.py側でKICK_SKIP_FROZEN_SOURCES=1
により今回のジョブでは一切出力されない(scripts/standup-pipeline/bouts_rizin.json・
bouts_wikipedia.jsonがそもそも書かれない)ため、このスクリプトも対象に含めていない。
data/kick/側の該当ファイルは触らずそのまま残る。これが「凍結」の実体。

NKB旧サイト分の凍結(2026-08-21): ingest_nkb.pyは新サイト(ライブ再取得)と
旧サイト(2012〜2018年、raw/nkb_old_events/*.html、生成手段が無く週次ジョブでは
取得しない)の両方を1本のbouts_nkb.jsonとして書き出す。空のraw/では旧サイト分の
行が0件で返るため、素直に上書きすると旧サイトの過去bout(約35件)が毎週消える。
旧サイト行はsource_urlが http://www.nkb-r.com/ で始まるという判別が可能
(新サイトはnkb-r.com/main/経由)なため、前回コミット済みのdata/kick/bouts_nkb.json
から旧サイト行だけを毎回引き継いで合成する。

同一性の判定について: bouts.py/ingest_*.pyが払い出すbout_idは「そのソース内での
出現順インデックス」を含む形式(例: k1:{fid}:{i})で、同一ボートでも取得元ページの
記載順が変わればbout_idがずれる可能性がある。そのため本スクリプトの追加/削除/変化
判定にはbout_idを使わず、(fighter_slug, opponent_raw, date, event, source_url)の
組を自然キーとして使う。

出力: 昇格した各ファイルについて、旧データとの差分サマリー(追加行数・削除行数・
既存行の変化の有無)をJSONとして標準出力に書く(呼び出し元のワークフローがPR本文の
組み立てに使う)。
"""
import json
import os
import sys

PIPE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(PIPE_DIR, "..", ".."))
DATA_KICK = os.path.join(REPO_ROOT, "data", "kick")

SOURCES = [
    "bigbang", "standup", "krossover", "snka", "jka", "hoostcup",
    "deepkick", "njkf", "nkb", "k1", "rise", "sb", "knockout",
]

NKB_OLD_SITE_PREFIX = "http://www.nkb-r.com/"


def bout_key(b):
    return (
        b.get("fighter_slug"),
        b.get("opponent_raw"),
        b.get("date"),
        b.get("event"),
        b.get("source_url"),
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
