# -*- coding: utf-8 -*-
"""PR-17: recordbox不一致・真の不一致20人(龍聖除く)について、Wikipedia記事から
抽出される個別行のうち、production側に反映されていない行を特定する。"""
import json
import sys

import ingest_wikipedia as iw

TARGETS = [
    "アルトゥール・キシェンコ", "イゴール・ユルコビッチ", "石黒竜也", "草津賢治", "小宮山工介",
    "佐藤友則", "シナ・カリミアン", "フレディ・ケマイヨ", "雅駿介", "宮元啓介", "宮本武勇志",
    "山本元気",
]


def main():
    population = json.load(open("coverage_population.json"))
    wikitexts = json.load(open("raw/wp_wikitext_v2.json"))
    fighters = json.load(open("../../data/kick/fighters.json"))
    by_name = {}
    for f in fighters:
        by_name.setdefault(f["name"], []).append(f)

    def identity(f):
        return f"{f['name']}|{f['gym'] or ''}|{f['sources'][0] if f['sources'] else ''}"

    import os
    fdir = "../../data/kick/generated/fighters"
    slug_by_name = {}
    idx = json.load(open("../../data/kick/generated/index.json"))
    for f in idx["fighters"]:
        slug_by_name.setdefault(f["name"], []).append(f["slug"])

    held = json.load(open("wikipedia_held_ambiguous.json"))
    held_by_name = {}
    for h in held:
        held_by_name.setdefault(h["fighter"], []).append(h)

    for name in TARGETS:
        pop_entries = [p for p in population if p["name"] == name]
        if not pop_entries:
            print(name, ": NOT IN POPULATION"); continue
        p = pop_entries[0]
        wt = wikitexts.get(p["wiki_title"])
        if not wt:
            print(name, ": NO WIKITEXT"); continue
        rows = iw.parse_fight_rows(wt)
        print(f"=== {name} (article rows: {len(rows)}) ===")

        slug = slug_by_name.get(name, [None])[0]
        gen_path = os.path.join(fdir, f"{slug}.json") if slug else None
        gen = json.load(open(gen_path)) if gen_path and os.path.exists(gen_path) else None
        gen_dates_opps = set()
        gen_dates = set()
        if gen:
            for b in gen["bouts"]:
                gen_dates_opps.add((b["date"], b["opponentName"]))
                gen_dates.add(b["date"])

        missing_rows = []
        spelling_variant = []
        for fr in rows:
            key = (fr["date"], fr["opponent"])
            if key not in gen_dates_opps:
                if fr["date"] in gen_dates:
                    spelling_variant.append(fr)
                else:
                    missing_rows.append(fr)
        print(f"  wikitext行数={len(rows)}, 完全一致しない行={len(spelling_variant)+len(missing_rows)}"
              f"(うち同日に別表記で存在=表記違いの可能性{len(spelling_variant)}件、"
              f"同日に何も無い=真の欠落候補{len(missing_rows)}件)")
        for fr in missing_rows[:15]:
            print("   TRUE GAP CANDIDATE:", fr["date"], fr["opponent"], "|", fr["event"], "|", fr["method"])
        for fr in spelling_variant[:15]:
            print("   SPELLING VARIANT (same date exists):", fr["date"], fr["opponent"], "|", fr["event"])
        hh = held_by_name.get(name, [])
        if hh:
            print("  held_ambiguous:", hh)
        print()


if __name__ == "__main__":
    main()
