# -*- coding: utf-8 -*-
"""DEEP☆KICK公式(deep-kick.com、Ameba Owndで構築)のフェッチャ(U-1)。

   ★母集団の新規発見はできなかった(記録): 大会結果カテゴリ(categoryIds=1233394)の
   一覧ページ(/posts/categories/1233394)はAmeba Owndのクライアントサイドレンダリングで、
   1ページ目(直近12件)しか静的取得できない。/page/2以降・?page=2等のクエリを試しても
   同じ12件が返るか空になるかのいずれかで、ページネーションはJS側で行われている
   (実測確認)。RSS(/rss.xml)・Atom(/atom.xml)も直近29〜30件(全カテゴリ横断)しか
   含まれず、118件の全量発見には使えない。ヘッドレスブラウザの導入はスコープ外の
   ため、母集団の新規発見はこのフェッチャでは行わない。

   よって本フェッチャは、既存raw/deepkick_index/index.json(118件、既知)に記録された
   IDのページを再取得するのみ(NKB旧サイトと同じ「既知一覧の再検証」方針)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_deepkick.py
"""
import json
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

OUT_DIR = "raw/deepkick_events"
INDEX_PATH = "raw/deepkick_index/index.json"


def main():
    t0 = time.time()
    known = json.load(open(INDEX_PATH, encoding="utf-8"))
    eids = sorted(known.keys())
    print(f"既知ID(raw/deepkick_index/index.json由来): {len(eids)}件(新規発見は今回未実施)")

    failed = []
    n_ok = 0
    for i, eid in enumerate(eids):
        url = f"https://www.deep-kick.com/posts/{eid}?categoryIds=1233394"
        ok, text, err = fetch(url)
        # 1回だけ観測した破損応答(gzipバイナリがそのまま返る、原因不明・再現せず)への
        # 簡易な自衛策: HTMLとして妥当な先頭でなければ1回だけ取り直す。
        if ok and not text.lstrip().lower().startswith(("<!doctype", "<html")):
            ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{eid}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok += 1
            print(f"[{i + 1}/{len(eids)}] {eid}: OK")
        else:
            failed.append({"eid": eid, "url": url, "error": err})
            print(f"[{i + 1}/{len(eids)}] {eid}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(eids)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_deepkick_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_deepkick_failed.json")


if __name__ == "__main__":
    main()
