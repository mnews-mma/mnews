# -*- coding: utf-8 -*-
"""ONE公式サイトの国籍フィルタ(https://www.onefc.com/athletes/country/jp/)を
ページネーションで最後まで辿り、日本国籍タグが付いた選手のURLスラッグ一覧を取得する。

PR#580フォローアップ①: one_official_manifest.jsonを和島・安保の手書きではなく
機械生成にするための第1段階(候補選手の発見)。出力はone_jp_country_slugs.jsonへ
保存し、build_one_manifest.pyが読む。

注意(実測で判明した既知の限界): この国籍フィルタはONE側のタグ付けに依存しており、
明らかに日本人名の選手(例: 髙橋聖人=takahashi-kiyoto)でも国籍タグが日本になって
いない場合がある。既存bouts_one.json(手動蓄積分)に含まれる38人中24人はこの
フィルタで発見できない(全員fighters.jsonへのマッチは確認済み、実在する選手)。
本スクリプトは要求どおり「ONE公式の日本人選手一覧」を機械的な発見源とするが、
この既知の非網羅性はbuild_one_manifest.pyの差分レポートで必ず可視化すること。

実行方法: cd scripts/standup-pipeline && python3 discover_one_jp_athletes.py
"""
import json
import re
import time
import urllib.error
import urllib.request

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"
BASE = "https://www.onefc.com/athletes/country/jp/"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def main():
    all_slugs = set()
    page = 1
    while True:
        url = BASE if page == 1 else f"{BASE}page/{page}/"
        try:
            h = fetch(url)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"page {page}: 404(ページ末尾に到達)")
                break
            raise
        links = set(re.findall(r'href="https://www\.onefc\.com/athletes/([a-z0-9-]+)/"', h))
        print(f"page {page}: {len(links)}件")
        if not links or links.issubset(all_slugs):
            print("新規スラッグなし、終了")
            break
        all_slugs |= links
        page += 1
        time.sleep(0.5)
        if page > 30:
            print("安全装置: 30ページで打ち切り")
            break

    result = sorted(all_slugs)
    with open("one_jp_country_slugs.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"合計{len(result)}件のslugをone_jp_country_slugs.jsonへ保存")


if __name__ == "__main__":
    main()
