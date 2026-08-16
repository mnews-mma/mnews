# -*- coding: utf-8 -*-
"""bout0件だった275人のうち、coverage_population.json(509人)の候補プロセスに未到達だった
238人を対象に、同じ判定条件(記事の実在 + {{Fight-cont}}戦績表を持つ)で追加母集団を作る。
読み取り専用。fighters.json等は変更しない。

238人の内訳:
  A. fighters.json側のsourcesに既にja.wikipedia URLを持つ(181人) -> そのタイトルで直接確認
  B. 持たない(57人) -> 選手名そのものをタイトル候補としてMediaWiki APIで実在確認
     (build_coverage_population.pyと同じ手法。ただしこちらは各種名寄せの候補が無いため
     name完全一致のみを試す=前回の742件候補と同じ厳密さは無いことに注意)
"""
import json
import re
import time
import urllib.parse
import urllib.request

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"
API = "https://ja.wikipedia.org/w/api.php"


def fetch_batch_by_titles(titles):
    joined = "|".join(titles)
    params = {"action": "query", "prop": "revisions|info", "rvprop": "content", "rvslots": "main",
              "titles": joined, "redirects": "1", "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def extract_bout_count(wikitext):
    m = re.search(r"\{\{Kickboxing\s*recordbox\s*\|[^}]*?total\s*=\s*(\d+)", wikitext, re.I | re.S)
    return int(m.group(1)) if m else None


def main():
    targets = json.load(open("/tmp/238_targets.json"))
    fighters = json.load(open("fighters.json"))
    by_name = {}
    for f in fighters:
        by_name.setdefault(f["name"], []).append(f)

    # A群: 既知のwikipedia URLからタイトルを取り出す
    group_a = [t for t in targets if t["existing_wiki_source"]]
    group_b = [t for t in targets if not t["existing_wiki_source"]]
    print(f"A群(既知URL): {len(group_a)}人 / B群(名前で確認): {len(group_b)}人")

    def url_to_title(u):
        # https://ja.wikipedia.org/wiki/<title> (URLエンコード済み)
        t = u.split("/wiki/")[-1]
        return urllib.parse.unquote(t).replace("_", " ")

    a_title_map = {t["name"]: url_to_title(t["existing_wiki_source"]) for t in group_a}
    b_title_map = {t["name"]: t["name"] for t in group_b}  # 選手名そのものをタイトル候補にする

    all_title_map = {}
    all_title_map.update(a_title_map)
    all_title_map.update(b_title_map)
    titles = sorted(set(all_title_map.values()))
    print(f"問い合わせタイトル数(重複除去後): {len(titles)}")

    missing_count = 0
    no_fight_table_count = 0
    population = []

    BATCH = 20
    for i in range(0, len(titles), BATCH):
        batch = titles[i:i + BATCH]
        try:
            data = fetch_batch_by_titles(batch)
        except Exception as e:
            print(f"  [ERROR] batch {i}: {e}")
            time.sleep(1)
            continue
        pages = data.get("query", {}).get("pages", [])
        for p in pages:
            title = p.get("title")
            if p.get("missing"):
                missing_count += 1
                continue
            revs = p.get("revisions")
            if not revs:
                missing_count += 1
                continue
            wikitext = revs[0]["slots"]["main"]["content"]
            if "{{Fight-cont" not in wikitext and "{{fight-cont" not in wikitext.lower():
                no_fight_table_count += 1
                continue
            bout_count = extract_bout_count(wikitext)
            # このタイトルに対応する人物名(A/B群どちらの経路で来たか)を逆引き
            names = [nm for nm, ti in all_title_map.items() if ti == title]
            for nm in names:
                rec = by_name.get(nm, [None])[0]
                population.append({
                    "name": nm,
                    "wiki_title": title,
                    "wiki_url": "https://ja.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                    "wiki_bout_count": bout_count,
                    "fighters_json_gym": rec.get("gym") if rec else None,
                    "fighters_json_sources": rec.get("sources") if rec else None,
                })
        print(f"[{min(i+BATCH,len(titles))}/{len(titles)}] population so far: {len(population)} "
              f"/ missing: {missing_count} / no_fight_table: {no_fight_table_count}")
        time.sleep(0.4)

    print(f"\n=== 238人の内訳 ===")
    print(f"記事が実在しない(missing/redirect先不明): {missing_count}")
    print(f"記事は実在するが戦績表(Fight-cont)なし: {no_fight_table_count}")
    print(f"追加母集団(戦績表あり): {len(population)}")
    print(f"確認総数: {missing_count + no_fight_table_count + len(population)} (候補{len(titles)}件のバッチ内訳、"
          f"同一タイトル複数人紐付けの場合は母集団側で増える)")

    json.dump(population, open("coverage_population_238.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
