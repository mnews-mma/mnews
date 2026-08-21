# -*- coding: utf-8 -*-
"""NKB(日本キックボクシング連盟)のフェッチャ(U-1)。
   新サイト(nkb-r.com/main/、WordPress): REST APIは標準パスではなく
   https://nkb-r.com/main/wp-json/wp/v2/posts (実測確認、標準の/wp-json/では404)。
   旧サイト(www.nkb-r.com/Fight/): トップページ(www.nkb-r.com/)は
   https://nkb-r.com/main/ へのmeta refreshのみになっており(実測確認、本文なし)、
   ディレクトリ一覧も403で新規のURL発見手段が無い。個別ページ自体は直接アクセス可能
   (実測確認、本文が普通に取れる)。よって旧サイトは新規発見ができず、既存raw/の
   ファイル名から復元した既知35件のURLを再取得するのみ(既知一覧の再検証、新規発見は
   スコープ外である旨をレポートに明記する)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_nkb.py
"""
import glob
import json
import os
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch, fetch_bytes

NEW_API_BASE = "https://nkb-r.com/main/wp-json/wp/v2/posts"
NEW_OUT_DIR = "raw/nkb_index"
OLD_OUT_DIR = "raw/nkb_old_events"
OLD_REFERENCE_DIR = "raw/nkb_old_events"  # 既知URL復元用(旧世代のraw/、上書き前に読む)
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。OLD_OUT_DIRは
# 週次自動更新ジョブでは対象外(NKB旧サイトは凍結、OLD_REFERENCE_DIRが空なので
# known_eids=[]になりOLD_OUT_DIRへの書き込み自体が発生しない)だが、念のため作る。
os.makedirs(NEW_OUT_DIR, exist_ok=True)
os.makedirs(OLD_OUT_DIR, exist_ok=True)


def fetch_new_site():
    all_posts = []
    page = 1
    while True:
        ok, text, err = fetch(f"{NEW_API_BASE}?per_page=100&page={page}")
        if not ok:
            print(f"新サイトREST API page {page}: 取得失敗 {err}")
            break
        d = json.loads(text)
        if not d:
            break
        all_posts.extend(d)
        print(f"新サイトREST API page {page}: {len(d)}件")
        if len(d) < 100:
            break
        page += 1
    with open(f"{NEW_OUT_DIR}/all_posts.json", "w", encoding="utf-8") as f:
        json.dump(all_posts, f, ensure_ascii=False, indent=1)
    print(f"新サイト: 総投稿数 {len(all_posts)}件")
    return len(all_posts)


def main():
    t0 = time.time()
    # 旧サイトの既知URL復元は「上書き前」に行う必要があるため先に実施
    known_eids = []
    for path in sorted(glob.glob(f"{OLD_REFERENCE_DIR}/*.html")):
        fname = path.split("/")[-1]
        known_eids.append(fname[:-5])

    new_count = fetch_new_site()

    failed_old = []
    n_ok_old = 0
    for i, eid in enumerate(known_eids):
        url = f"http://www.nkb-r.com/Fight/{eid[:4]}/{eid}.html"
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OLD_OUT_DIR}/{eid}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok_old += 1
            print(f"[旧{i + 1}/{len(known_eids)}] {eid}: OK")
        else:
            failed_old.append({"eid": eid, "url": url, "error": err})
            print(f"[旧{i + 1}/{len(known_eids)}] {eid}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: 新サイト{new_count}件 / 旧サイト{n_ok_old}/{len(known_eids)}件, 所要{elapsed:.1f}秒")
    if failed_old:
        json.dump(failed_old, open("fetch_nkb_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_nkb_failed.json")


if __name__ == "__main__":
    main()
