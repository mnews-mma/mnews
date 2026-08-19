# -*- coding: utf-8 -*-
"""NJKF公式(njkf.info)のフェッチャ(U-1)。
   URLは年別プレフィックス(/resultYYYY/、2009〜2019)+直近分(/result/、ページネーション
   /result/page/N/)の2系統に分かれている(実測確認)。両方を辿って結合する。
   実行方法: cd scripts/standup-pipeline && python3 fetch_njkf.py
"""
import json
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

OUT_DIR = "raw/njkf_events"
INDEX_PATH = "raw/njkf_index/event_urls.json"


def discover():
    all_links = set()
    for y in range(2009, 2027):
        url = f"https://www.njkf.info/result{y}/"
        ok, text, err = fetch(url)
        if ok:
            links = set(re.findall(rf'href="(https://www\.njkf\.info/result{y}/[^"]+\.html)"', text))
            all_links |= links
    page = 1
    while page <= 10:
        url = "https://www.njkf.info/result/" if page == 1 else f"https://www.njkf.info/result/page/{page}/"
        ok, text, err = fetch(url)
        if not ok:
            break
        links = set(re.findall(r'href="(https://www\.njkf\.info/result[0-9]*/[^"]+\.html)"', text))
        if not links - all_links and page > 1:
            break
        all_links |= links
        page += 1
    return all_links


def main():
    t0 = time.time()
    discovered = discover()
    known = set(json.load(open(INDEX_PATH, encoding="utf-8")))
    print(f"発見(年別archive+直近ページネーション統合): {len(discovered)}件")
    print(f"既知(raw/njkf_index/event_urls.json): {len(known)}件")
    new_urls = sorted(discovered - known)
    missing_urls = sorted(known - discovered)
    print(f"新規発見(既知一覧に無い): {len(new_urls)}件")
    for u in new_urls:
        print(f"  NEW: {u}")
    print(f"既知だが今回未発見(サイト側の索引に無い): {len(missing_urls)}件")
    for u in missing_urls:
        print(f"  UNLINKED: {u}")

    targets = sorted(discovered | known)
    print(f"\n取得対象(和集合): {len(targets)}件")

    failed = []
    n_ok = 0
    for i, url in enumerate(targets):
        eid = re.sub(r"^https://www\.njkf\.info/result\d{0,4}/", "", url)[:-5]
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{eid}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok += 1
            print(f"[{i + 1}/{len(targets)}] {eid}: OK")
        else:
            failed.append({"eid": eid, "url": url, "error": err})
            print(f"[{i + 1}/{len(targets)}] {eid}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(targets)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_njkf_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_njkf_failed.json")
    json.dump({"new": new_urls, "unlinked": missing_urls}, open("fetch_njkf_population_diff.json", "w"),
               ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
