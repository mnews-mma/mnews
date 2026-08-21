# -*- coding: utf-8 -*-
"""Stand up公式(standup-kick.com)のフェッチャ(U-1)。
   WP REST APIのcustom post type 'pronews'から記事一覧を取得し、'/pronews/result/'を
   含むURL(プロ結果記事)だけをレンダリング済みHTMLとして直接クロールする
   (ingest_standup.pyのコメントどおり、REST APIのcontent.renderedには本文が
   反映されない記事があるため)。ファイル名はURLのMD5先頭12文字(既存raw/の命名規則に合わせる)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_standup.py
"""
import hashlib
import json
import os
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

API_BASE = "https://standup-kick.com/wp-json/wp/v2/pronews"
OUT_DIR = "raw/standup_pro_results"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)
MANIFEST_PATH = f"{OUT_DIR}/_manifest.json"


def main():
    t0 = time.time()
    all_posts = []
    page = 1
    while True:
        ok, text, err = fetch(f"{API_BASE}?per_page=100&page={page}")
        if not ok:
            print(f"REST API page {page} 取得失敗: {err}")
            break
        d = json.loads(text)
        if not d:
            break
        all_posts.extend(d)
        if len(d) < 100:
            break
        page += 1
    print(f"REST API総投稿数: {len(all_posts)}")

    results = [p for p in all_posts if "/pronews/result/" in p.get("link", "")]
    print(f"'/pronews/result/'を含む記事: {len(results)}件")

    manifest = {}
    failed = []
    for i, p in enumerate(results):
        url = p["link"]
        h = hashlib.md5(url.encode()).hexdigest()[:12]
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{h}.html", "w", encoding="utf-8") as f:
                f.write(text)
            manifest[h] = {"url": url, "date": p.get("date")}
            print(f"[{i + 1}/{len(results)}] {h} ({url}): OK")
        else:
            failed.append({"hash": h, "url": url, "error": err})
            print(f"[{i + 1}/{len(results)}] {h} ({url}): FAILED ({err})")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")

    elapsed = time.time() - t0
    print(f"\n完了: {len(manifest)}/{len(results)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_standup_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_standup_failed.json")


if __name__ == "__main__":
    main()
