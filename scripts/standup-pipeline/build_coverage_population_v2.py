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

# PR-17: 表記名がfighters.json内で複数レコードに一致する場合(同姓同名の別人が
# 別団体に存在するケース)、下のフォールバックはfighters.json内の並び順で先頭の
# レコードを機械的に選ぶため、Wikipedia記事の本人と異なるレコードに紐づく事故が
# 起きうる(実例: 「龍聖」はfighters.json順でRISE所属レコードが先頭だが、
# Wikipedia記事の本人はKNOCK OUT所属「BRAID/TEAM SUERTE」の方だった。記事の
# インフォボックス|team=フィールドと一致させて判定した)。718人中この種の
# 曖昧な名前は3件(銀次・海人・龍聖)のみ確認しており、うち機械的に解決できたのは
# 龍聖のみ(他2件はインフォボックスにteam欄が無く、現時点では未解決)。
DISAMBIGUATION_OVERRIDES = {
    "龍聖": {"gym": "BRAID/TEAM SUERTE", "sources": ["https://knockoutkb.com/fighters/ryusei"]},
}


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
        override = DISAMBIGUATION_OVERRIDES.get(name)
        if override:
            population.append({
                "name": name, "wiki_title": title,
                "wiki_url": "https://ja.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                "wiki_bout_count": None,
                "fighters_json_gym": override["gym"],
                "fighters_json_sources": override["sources"],
            })
            continue
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
