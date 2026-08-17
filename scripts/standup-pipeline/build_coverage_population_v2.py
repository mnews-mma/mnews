# -*- coding: utf-8 -*-
"""PR-16: カバレッジ母集団をレグ③(記事の実在確認、718人)方式に差し替える。

旧 build_coverage_population.py は「男子/女子キックボクサー一覧」2ページの
wikilink先(候補509件)のみを母集団としていたが、レグ③の実測で記事が実在する
選手の24.7%(177/718件)がこの2ページから漏れていることが判明した
(与座優貴もこの177件の1人)。

本スクリプトは out/kana-leg3-wiki-existence.csv (status=exists, redirected=False,
718人)を母集団として使い、fighters.jsonと突合してslug相当の情報を付与する。
"""
import csv
import json
import urllib.parse

LEG3_CSV = "/Users/kainakishiyoshi/Desktop/mnews/out/kana-leg3-wiki-existence.csv"


def main():
    fighters = json.load(open("fighters.json"))
    by_name = {}
    for f in fighters:
        by_name.setdefault(f["name"], []).append(f)

    rows = list(csv.DictReader(open(LEG3_CSV, encoding="utf-8-sig")))
    exists = [r for r in rows if r["status"] == "exists" and r["redirected"] == "False"]

    seen_names = set()
    population = []
    for r in exists:
        name = r["name"]
        if name in seen_names:
            continue
        seen_names.add(name)
        title = r["final_title"]
        match_records = by_name.get(name, [])
        rec = None
        for rr in match_records:
            if any(
                "ja.wikipedia.org/wiki/" in u
                and urllib.parse.unquote(u.split("/wiki/")[-1]).replace("_", " ") == title
                for u in rr["sources"]
            ):
                rec = rr
                break
        if not rec and match_records:
            rec = match_records[0]
        population.append({
            "name": name,
            "wiki_title": title,
            "wiki_url": "https://ja.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
            "wiki_bout_count": None,
            "fighters_json_gym": rec.get("gym") if rec else None,
            "fighters_json_sources": rec.get("sources") if rec else None,
        })

    print(f"新母集団: {len(population)}人(レグ③718人ベース)")
    json.dump(population, open("coverage_population.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
