# -*- coding: utf-8 -*-
"""HoostCup公式(hoostcup.com)のフェッチャ(U-1)。
   試合結果一覧ページ(13fight/index.html)から個別イベントページのリンクを列挙して取得する。
   ページはShift_JISエンコード(ingest_hoostcup.pyのコメントどおり)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_hoostcup.py
"""
import json
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch, fetch_bytes

INDEX_URL = "https://www.hoostcup.com/13fight/index.html"
OUT_DIR = "raw/hoostcup_events"


def main():
    t0 = time.time()
    ok, html, err = fetch(INDEX_URL, encoding="shift_jis")
    if not ok:
        print(f"index page取得失敗: {err}")
        return
    links = sorted(set(re.findall(r'href="([\w\-]+\.html)"', html)))
    links = [x for x in links if x != "index.html"]
    print(f"index pageから発見したイベントページ: {len(links)}件")

    # ingest_hoostcup.pyはopen(path,'rb')で生バイトを読みshift_jisでデコードするため、
    # ここでも生バイトのまま保存する(UTF-8への変換往復による文字化けを避けるため)。
    failed = []
    n_ok = 0
    for i, fname in enumerate(links):
        url = f"https://www.hoostcup.com/13fight/{fname}"
        ok, raw_bytes, err = fetch_bytes(url)
        if ok:
            with open(f"{OUT_DIR}/{fname}", "wb") as f:
                f.write(raw_bytes)
            n_ok += 1
            print(f"[{i + 1}/{len(links)}] {fname}: OK")
        else:
            failed.append({"file": fname, "url": url, "error": err})
            print(f"[{i + 1}/{len(links)}] {fname}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(links)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_hoostcup_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_hoostcup_failed.json")


if __name__ == "__main__":
    main()
