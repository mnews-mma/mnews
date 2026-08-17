# -*- coding: utf-8 -*-
import json
import sys
import unicodedata
from datetime import datetime, timedelta

sys.path.insert(0, ".")
import ingest_wikipedia as iw


def norm(s):
    s = unicodedata.normalize("NFKC", s or "")
    s = s.split("・")[0].split("(")[0].split("（")[0]  # ジム名等の付随情報を落とす
    return s.replace(" ", "").replace("　", "").lower()


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
        afc = g.get("article_fight_cont_count")
        prod_total = g.get("prod_total")
        if afc == prod_total:
            continue  # 既にMATCH=recordbox要約が古いだけと判定済み、ここでは対象外
        p = pop_by_name.get(name)
        wt = wikitexts.get(p["wiki_title"]) if p else None
        if not wt:
            continue
        rows = iw.parse_fight_rows(wt)
        slugs = slug_by_name.get(name)
        gen = json.load(open(f"../../data/kick/generated/fighters/{slugs[0]}.json"))

        # prod側: (date, norm(opponent)) の multiset
        prod_keys = []
        for b in gen["bouts"]:
            prod_keys.append((b["date"], norm(b["opponentName"])))
        prod_used = [False] * len(prod_keys)

        unmatched_wiki = []
        for r in rows:
            key_date = r["date"]
            key_opp = norm(r["opponent"])
            matched = False
            # 1) 完全一致(日付+相手名)
            for i, (d, o) in enumerate(prod_keys):
                if prod_used[i]:
                    continue
                if d == key_date and o == key_opp:
                    prod_used[i] = True
                    matched = True
                    break
            if matched:
                continue
            # 2) ±1日ずれ許容
            if key_date:
                try:
                    kd = datetime.strptime(key_date, "%Y-%m-%d")
                except ValueError:
                    kd = None
            else:
                kd = None
            if kd:
                for i, (d, o) in enumerate(prod_keys):
                    if prod_used[i] or not d:
                        continue
                    try:
                        dd = datetime.strptime(d, "%Y-%m-%d")
                    except ValueError:
                        continue
                    if abs((dd - kd).days) <= 1 and o == key_opp:
                        prod_used[i] = True
                        matched = True
                        break
            if not matched:
                unmatched_wiki.append(r)

        unmatched_prod = [prod_keys[i] for i in range(len(prod_keys)) if not prod_used[i]]

        print(f"=== {name} (article_fight_cont_count={afc} prod_total={prod_total}) ===")
        print(f"  wiki側で未マッチ(production未反映の疑い): {len(unmatched_wiki)}")
        for r in unmatched_wiki:
            print(f"    {r}")
        print(f"  prod側で未マッチ(wiki記事に無い追加分): {len(unmatched_prod)}")
        for k in unmatched_prod:
            print(f"    {k}")


if __name__ == "__main__":
    main()
