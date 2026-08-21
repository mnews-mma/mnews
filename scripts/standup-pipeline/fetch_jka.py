# -*- coding: utf-8 -*-
"""JKA(ジャパンキックボクシング協会)のフェッチャ(U-1)。
   「試合結果」インデックス(/result/)から個別記事のリンクを列挙して取得する。
   ファイル名は既存raw/の命名規則(URLのMD5先頭12文字)に合わせる。
   実行方法: cd scripts/standup-pipeline && python3 fetch_jka.py
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse

sys.path.insert(0, ".")
from fetch_common import fetch

INDEX_URL = "https://jka-japan-kickboxing-association.jp/result/"
OUT_DIR = "raw/jka_results"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)
MANIFEST_PATH = f"{OUT_DIR}/_manifest.json"


def main():
    t0 = time.time()
    ok, html, err = fetch(INDEX_URL)
    if not ok:
        print(f"index page取得失敗: {err}")
        return
    links = sorted(
        set(re.findall(r'href="(https://jka-japan-kickboxing-association\.jp/[^"]*result[^"]*)"', html))
    )
    links = [x for x in links if x.rstrip("/") != INDEX_URL.rstrip("/")]
    print(f"index pageから発見した記事リンク: {len(links)}件")

    manifest = {}
    failed = []
    for i, url in enumerate(links):
        h = hashlib.md5(url.encode()).hexdigest()[:12]
        slug = urllib.parse.unquote(url.rstrip("/").split("/")[-1])
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{h}.html", "w", encoding="utf-8") as f:
                f.write(text)
            manifest[h] = {"slug": slug, "url": url}
            print(f"[{i + 1}/{len(links)}] {h}: OK ({slug})")
        else:
            failed.append({"hash": h, "url": url, "error": err})
            print(f"[{i + 1}/{len(links)}] {h}: FAILED ({err})")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")

    elapsed = time.time() - t0
    print(f"\n完了: {len(manifest)}/{len(links)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_jka_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_jka_failed.json")


if __name__ == "__main__":
    main()
