# -*- coding: utf-8 -*-
"""RISE公式(rise-rc.com)のフェッチャ(U-1)。
   fighter-sitemap.xml(WordPress SEOプラグインが自動生成)から選手ページURLを
   全件列挙する(実測: 710件、既存raw/rise_bouts/の708件に近い)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_rise.py
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

SITEMAP_URL = "https://rise-rc.com/fighter-sitemap.xml"
OUT_DIR = "raw/rise_bouts"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)


def main():
    t0 = time.time()
    ok, xml, err = fetch(SITEMAP_URL)
    if not ok:
        print(f"sitemap取得失敗: {err}")
        return
    all_urls = re.findall(r"<loc><!\[CDATA\[(https://rise-rc\.com/fighter/[^\]]+)\]\]></loc>", xml)
    print(f"sitemapから発見した選手ページ: {len(all_urls)}件")

    # 2026-08-21追加: 週次自動更新ジョブでは、sitemapから新規発見した(=cache/rise_parsed.json
    # に無い)選手のbout HTMLは取得しない。cache/rise_parsed.json(名簿)は生成手段が無く
    # 更新できないため(build.pyのCACHE_DIRコメント参照)、名簿に無い選手の戦績だけ取得すると
    # build-kick-data.tsのunmatchedBoutsゲート(選手識別子がfighters.jsonのどれとも
    # 一致しない行をゼロ件ゲートで検知)に毎週必ず抵触し、ジョブが永久にブロックされる
    # (ローカル実測で確認: 新規デビュー選手6名の混入で24行が引っかかった)。「名簿の
    # 自動拡張はしない」というこのジョブのスコープ外事項と整合させるため、既知の名簿に
    # 載っている選手のみを対象にする(新規デビュー選手の戦績反映は次回の名簿更新まで持ち越し)。
    known_urls = {r["url"] for r in json.load(open("cache/rise_parsed.json"))}
    urls = [u for u in all_urls if u in known_urls]
    skipped = len(all_urls) - len(urls)
    if skipped:
        print(f"名簿(cache/rise_parsed.json)に無い新規選手 {skipped}件はスキップ(名簿自動拡張は対象外)")

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
