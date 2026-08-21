# -*- coding: utf-8 -*-
"""SHOOT BOXING公式(shootboxing.org)のフェッチャ(U-1)。
   fighter-sitemap.xml(WordPress SEOプラグインが自動生成)から選手ページURLを
   全件列挙する(実測: 102件、既存raw/と一致)。/fighter/一覧ページは20件程度しか
   表示されずページネーションの仕組みも見つからなかったため、sitemapを正としている。
   実行方法: cd scripts/standup-pipeline && python3 fetch_sb.py
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

SITEMAP_URL = "https://shootboxing.org/fighter-sitemap.xml"
OUT_DIR = "raw/sb_bouts"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)


def main():
    t0 = time.time()
    ok, xml, err = fetch(SITEMAP_URL)
    if not ok:
        print(f"sitemap取得失敗: {err}")
        return
    all_urls = re.findall(r"<loc><!\[CDATA\[(https://shootboxing\.org/fighter/[^\]]+)\]\]></loc>", xml)
    print(f"sitemapから発見した選手ページ: {len(all_urls)}件")

    # 2026-08-21追加: fetch_rise.pyと同じ理由(コメント参照)で、cache/sb_parsed.json
    # (名簿、生成手段が無く更新できない)に無い新規選手は取得対象から外す。名簿に無い
    # 選手の戦績だけ取得すると、build-kick-data.tsのunmatchedBoutsゲートに毎週抵触し
    # ジョブが永久にブロックされる(「名簿の自動拡張はしない」というスコープ外事項との整合)。
    known_urls = {r["url"] for r in json.load(open("cache/sb_parsed.json"))}
    urls = [u for u in all_urls if u in known_urls]
    skipped = len(all_urls) - len(urls)
    if skipped:
        print(f"名簿(cache/sb_parsed.json)に無い新規選手 {skipped}件はスキップ(名簿自動拡張は対象外)")

    failed = []
    n_ok = 0
    for i, url in enumerate(urls):
        slug = url.rstrip("/").split("/")[-1]
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{slug}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok += 1
            print(f"[{i + 1}/{len(urls)}] {slug}: OK")
        else:
            failed.append({"slug": slug, "url": url, "error": err})
            print(f"[{i + 1}/{len(urls)}] {slug}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(urls)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_sb_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_sb_failed.json")


if __name__ == "__main__":
    main()
