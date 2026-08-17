# -*- coding: utf-8 -*-
"""安保瑠輝也の体系的パース漏れ調査で確立した手法(date単位でWikipedia Fight-cont行と
production行を突合する)を、pr16_recordbox_crosscheck.pyが検出した20件の「真の不一致」
全員に適用し、原因を機械分類する。
"""
import json
import sys
import unicodedata

sys.path.insert(0, ".")
import ingest_wikipedia as iw


def norm(s):
    return unicodedata.normalize("NFKC", s or "").replace(" ", "").replace("　", "").lower()


def main():
    genuine = json.load(open("/tmp/pr16_recordbox_genuine_mismatch.json"))
    population = json.load(open("coverage_population.json"))
    wikitexts = json.load(open("raw/wp_wikitext_v2.json"))
    generated_idx = json.load(open("../../data/kick/generated/index.json"))
    slug_by_name = {}
    for f in generated_idx["fighters"]:
        slug_by_name.setdefault(f["name"], []).append(f["slug"])

    pop_by_name = {p["name"]: p for p in population}

    for g in genuine:
        name = g["name"]
        p = pop_by_name.get(name)
        if not p:
            print(f"=== {name}: 母集団に見つからず(スキップ) ===")
            continue
        wt = wikitexts.get(p["wiki_title"])
        if not wt:
            print(f"=== {name}: wikitextキャッシュ無し(スキップ) ===")
            continue
        rows = iw.parse_fight_rows(wt)
        wiki_by_date = {}
        for r in rows:
            wiki_by_date.setdefault(r["date"], []).append((r["mark"].strip(), norm(r["opponent"])))

        slugs = slug_by_name.get(name)
        if not slugs:
            print(f"=== {name}: production未掲載 ===")
            continue
        gen = json.load(open(f"../../data/kick/generated/fighters/{slugs[0]}.json"))
        prod_by_date = {}
        for b in gen["bouts"]:
            prod_by_date.setdefault(b["date"], []).append((b["result"], norm(b["opponentName"])))

        print(f"=== {name} (wiki_total={g['wiki_total']} prod_total={g['prod_total']} diff={g['wiki_total']-g['prod_total']}) ===")
        all_dates = set(wiki_by_date) | set(prod_by_date)
        MARK2RESULT = {"○": "win", "〇": "win", "◎": "win", "×": "loss", "△": "draw"}
        for date in sorted(all_dates, key=lambda x: x or ""):
            w = wiki_by_date.get(date, [])
            pr = prod_by_date.get(date, [])
            if len(w) != len(pr):
                print(f"  [COUNT DIFF] date={date} wiki={w} prod={pr}")
                continue
            # 件数は同じでも中身(結果・相手名)がズレていないか確認
            w_norm = sorted((MARK2RESULT.get(m, m), o) for m, o in w)
            pr_norm = sorted(pr)
            if w_norm != pr_norm and date is not None:
                print(f"  [CONTENT DIFF, same count] date={date} wiki={w} prod={pr}")


if __name__ == "__main__":
    main()
