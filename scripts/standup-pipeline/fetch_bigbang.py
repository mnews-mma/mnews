# -*- coding: utf-8 -*-
"""Bigbang〜統一への道〜公式(bigbang-kick.com)のフェッチャ(U-1)。
   選手ページはWP REST APIの'pages'カスタム投稿タイプで、タイトルに
   「出場選手解説」を含むものが該当(実測確認、58件で既存raw/と一致)。
   ファイル名は既存raw/の命名規則(URLのMD5先頭12文字)に合わせる。
   実行方法: cd scripts/standup-pipeline && python3 fetch_bigbang.py
"""
import hashlib
import json
import re
import sys
import time
import urllib.parse

sys.path.insert(0, ".")
from fetch_common import fetch

API_BASE = "https://bigbang-kick.com/wp-json/wp/v2/pages"
OUT_DIR = "raw/bigbang_fighters"
MANIFEST_PATH = f"{OUT_DIR}/_manifest.json"


def main():
    t0 = time.time()
    all_pages = []
    page = 1
    while True:
        ok, text, err = fetch(f"{API_BASE}?per_page=100&page={page}")
        if not ok:
            print(f"REST API page {page} 取得失敗: {err}")
            break
        d = json.loads(text)
        if not d:
            break
        all_pages.extend(d)
        print(f"REST API page {page}: {len(d)}件")
        if len(d) < 100:
            break
        page += 1
    print(f"総pages数: {len(all_pages)}")

    fighters = [p for p in all_pages if "出場選手解説" in p.get("title", {}).get("rendered", "")]
    print(f"「出場選手解説」を含む選手ページ: {len(fighters)}件")

    manifest = {}
    failed = []
    for i, p in enumerate(fighters):
        url = p["link"]
        h = hashlib.md5(url.encode()).hexdigest()[:12]
        slug = urllib.parse.unquote(url.rstrip("/").split("/")[-1])
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{h}.html", "w", encoding="utf-8") as f:
                f.write(text)
            manifest[h] = {"slug": slug, "url": url}
            print(f"[{i + 1}/{len(fighters)}] {h}: OK ({slug})")
        else:
            failed.append({"hash": h, "url": url, "error": err})
            print(f"[{i + 1}/{len(fighters)}] {h}: FAILED ({err})")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")

    elapsed = time.time() - t0
    print(f"\n完了: {len(manifest)}/{len(fighters)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_bigbang_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_bigbang_failed.json")


if __name__ == "__main__":
    main()
