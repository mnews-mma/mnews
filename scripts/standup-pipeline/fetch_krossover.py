# -*- coding: utf-8 -*-
"""KROSS×OVER公式(krossover.jp)のフェッチャ(U-1)。
   試合結果まとめページ(?page_id=203)から個別記事(?p=NNNN)のIDを列挙し、各記事を取得する。
   ファイル名はURLのMD5先頭12文字(既存raw/の命名規則に合わせる、実測で一致確認済み)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_krossover.py
"""
import hashlib
import json
import os
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

INDEX_URL = "https://krossover.jp/?page_id=203"
OUT_DIR = "raw/kross_results"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)


def main():
    t0 = time.time()
    ok, html, err = fetch(INDEX_URL)
    if not ok:
        print(f"index page取得失敗: {err}")
        return
    ids = sorted(set(re.findall(r"\?p=(\d+)", html)))
    print(f"index pageから発見した記事ID: {len(ids)}件")

    # ingest_krossover.py:308 が raw/kross_results/_manifest.json ({hash: {"url": ...}})
    # を要求するが、従来このフェッチャは書き出していなかった(2026-08-21判明の実装バグ)。
    # fetch/ingestの間でファイル形式が噛み合っておらず、フェッチ成功後もingest側が
    # FileNotFoundErrorで落ちていた。ここで生成して解消する。
    manifest = {}
    failed = []
    n_ok = 0
    for i, pid in enumerate(ids):
        url = f"https://krossover.jp/?p={pid}"
        h = hashlib.md5(url.encode()).hexdigest()[:12]
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{h}.html", "w", encoding="utf-8") as f:
                f.write(text)
            manifest[h] = {"url": url}
            n_ok += 1
            print(f"[{i + 1}/{len(ids)}] p={pid} ({h}): OK")
        else:
            failed.append({"p": pid, "hash": h, "url": url, "error": err})
            print(f"[{i + 1}/{len(ids)}] p={pid} ({h}): FAILED ({err})")

    json.dump(manifest, open(f"{OUT_DIR}/_manifest.json", "w"), ensure_ascii=False, indent=1)

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(ids)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_krossover_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_krossover_failed.json")


if __name__ == "__main__":
    main()
