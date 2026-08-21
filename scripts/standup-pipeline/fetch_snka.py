# -*- coding: utf-8 -*-
"""SNKA(新日本キックボクシング協会)のフェッチャ(U-1)。
   出典はAmeblo(https://ameblo.jp/skb-blog/)。「Fight」テーマページ
   (theme-10031916288.html)はSPAでページネーションがJSに依存しており、
   静的取得では初回ロード分しか辿れない(ingest_snka.pyの既知の制約、実測どおり)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_snka.py
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

THEME_URL = "https://ameblo.jp/skb-blog/theme-10031916288.html"
OUT_DIR = "raw/snka_ameblo"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)
MANIFEST_PATH = f"{OUT_DIR}/_manifest.json"


def main():
    t0 = time.time()
    ok, html, err = fetch(THEME_URL)
    if not ok:
        print(f"theme page取得失敗: {err}")
        return
    ids = sorted(set(re.findall(r"entry-(\d+)\.html", html)))
    print(f"theme pageから発見した記事ID: {len(ids)}件")

    manifest = {}
    failed = []
    for i, eid in enumerate(ids):
        url = f"https://ameblo.jp/skb-blog/entry-{eid}.html"
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{eid}.html", "w", encoding="utf-8") as f:
                f.write(text)
            manifest[eid] = {"url": url}
            print(f"[{i + 1}/{len(ids)}] {eid}: OK")
        else:
            failed.append({"id": eid, "url": url, "error": err})
            print(f"[{i + 1}/{len(ids)}] {eid}: FAILED ({err})")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")

    elapsed = time.time() - t0
    print(f"\n完了: {len(manifest)}/{len(ids)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_snka_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_snka_failed.json")


if __name__ == "__main__":
    main()
