# -*- coding: utf-8 -*-
"""カバレッジ測定用の母集団を機械的に定義する(読み取り専用、fighters.json等は変更しない)。

定義: ja.wikipedia個別記事が実在し、かつ記事内に戦績表を持つ選手。

機械判定条件(SOURCES.md「カバレッジ測定 母集団定義」参照):
  1. 記事の実在: raw/wp_parsed.jsonのwiki_target(名簿リストの[[wikilink]]先)を候補とし、
     MediaWiki API(action=query&prop=info)でredirect解決後のページが存在する
     (missing属性が付かない)ことを実測で確認する。[[wikilink]]構文はレッドリンク
     (未作成ページ)でも同じ形で書かれるため、構文の有無だけでは実在を判定できない。
  2. 戦績表を持つ: 記事のwikitextに`{{Fight-cont`テンプレートが1件以上出現する。
     日本語版Wikipediaの格闘家記事で戦績を試合単位で列挙する標準テンプレート
     (`{{Fight-start}}`〜`{{Fight-cont|...}}`〜`{{Fight-end}}`)であることをHIROYA記事の
     実例で確認済み。`{{Kickboxing recordbox|total=N|...}}`のような通算成績の要約のみで
     試合単位の列挙が無い記事(戦績「表」を持たない記事)は対象外とする。

出力: coverage_population.json ({slug, name, wiki_title, wiki_url, wiki_bout_count})
"""
import json
import re
import time
import urllib.parse
import urllib.request

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"
API = "https://ja.wikipedia.org/w/api.php"


def fetch_batch(titles):
    """タイトル最大20件をバッチ取得。存在確認(missing)とwikitextを同時に返す。"""
    joined = "|".join(titles)
    params = {
        "action": "query",
        "prop": "revisions|info",
        "rvprop": "content",
        "rvslots": "main",
        "titles": joined,
        "redirects": "1",
        "format": "json",
        "formatversion": "2",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def extract_bout_count(wikitext):
    m = re.search(r"\{\{Kickboxing\s*recordbox\s*\|[^}]*?total\s*=\s*(\d+)", wikitext, re.I | re.S)
    if m:
        return int(m.group(1))
    return None


def main():
    fighters = json.load(open("fighters.json"))
    by_name = {}
    for f in fighters:
        by_name.setdefault(f["name"], []).append(f)

    wp = json.load(open("raw/wp_parsed.json"))
    candidates = sorted({r["wiki_target"] for r in wp if r.get("wiki_target")})
    print(f"候補(名簿リストのwikilink先、重複除去): {len(candidates)}件")

    # 元の表記名(list上のname)への逆引き。1つのwiki_targetを複数名が指すことは基本ないが、
    # 一応リストで保持する。
    target_to_names = {}
    for r in wp:
        if r.get("wiki_target"):
            target_to_names.setdefault(r["wiki_target"], []).append(r["name"])

    population = []
    missing_count = 0
    no_fight_table_count = 0
    checked = 0

    BATCH = 20
    for i in range(0, len(candidates), BATCH):
        batch = candidates[i:i + BATCH]
        try:
            data = fetch_batch(batch)
        except Exception as e:
            print(f"  [ERROR] batch {i}: {e}")
            time.sleep(1)
            continue
        pages = data.get("query", {}).get("pages", [])
        for p in pages:
            checked += 1
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
            names = target_to_names.get(title, [title])
            for nm in names:
                match_records = by_name.get(nm, [])
                # fighters.json側の対応レコード(sources[0]がこのwikipedia記事のもの)を探す。
                # 見つからない場合はslugを持たない(まだmnews側slugが割り当たっていない)ため
                # nameで代用する。
                rec = None
                for r in match_records:
                    if any("ja.wikipedia.org/wiki/" in u and urllib.parse.unquote(u.split("/wiki/")[-1]).replace("_", " ") == title for u in r["sources"]):
                        rec = r
                        break
                if not rec and match_records:
                    rec = match_records[0]
                population.append({
                    "name": nm,
                    "wiki_title": title,
                    "wiki_url": "https://ja.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                    "wiki_bout_count": bout_count,
                    "fighters_json_gym": rec.get("gym") if rec else None,
                    "fighters_json_sources": rec.get("sources") if rec else None,
                })
        print(f"[{min(i+BATCH,len(candidates))}/{len(candidates)}] "
              f"population so far: {len(population)} / missing: {missing_count} / no_fight_table: {no_fight_table_count}")
        time.sleep(0.4)

    print(f"\n最終母集団: {len(population)}人")
    print(f"記事なし(missing/redirect先不明): {missing_count}")
    print(f"記事はあるが戦績表(Fight-cont)なし: {no_fight_table_count}")
    print(f"確認総数: {checked} (候補{len(candidates)}件のバッチ内訳)")

    json.dump(population, open("coverage_population.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
