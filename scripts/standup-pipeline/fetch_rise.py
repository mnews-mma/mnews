# -*- coding: utf-8 -*-
"""RISE公式(rise-rc.com)のフェッチャ(U-1)。
   fighter-sitemap.xml(WordPress SEOプラグインが自動生成)から選手ページURLを
   全件列挙する(実測: 710件、既存raw/rise_bouts/の708件に近い)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_rise.py
"""
import json
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

SITEMAP_URL = "https://rise-rc.com/fighter-sitemap.xml"
OUT_DIR = "raw/rise_bouts"


def main():
    t0 = time.time()
    ok, xml, err = fetch(SITEMAP_URL)
    if not ok:
        print(f"sitemap取得失敗: {err}")
        return
    urls = re.findall(r"<loc><!\[CDATA\[(https://rise-rc\.com/fighter/[^\]]+)\]\]></loc>", xml)
    print(f"sitemapから発見した選手ページ: {len(urls)}件")

    failed = []
    n_ok = 0
    for i, url in enumerate(urls):
        slug = url.rstrip("/").split("/")[-1]
        ok, text, err = fetch(url)
        if ok and not text.lstrip().lower().startswith(("<!doctype", "<html")):
            ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{slug}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok += 1
            if (i + 1) % 25 == 0 or i + 1 == len(urls):
                print(f"[{i + 1}/{len(urls)}] {slug}: OK")
        else:
            failed.append({"slug": slug, "url": url, "error": err})
            print(f"[{i + 1}/{len(urls)}] {slug}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(urls)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_rise_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_rise_failed.json")


if __name__ == "__main__":
    main()
