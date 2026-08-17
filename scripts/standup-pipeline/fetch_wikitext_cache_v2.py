# -*- coding: utf-8 -*-
"""coverage_population.json(509人)全員のWikipedia記事本文(wikitext)を取得し、
raw/wp_wikitext_v2.json にキャッシュする(一回限りの取得。ingest_wikipedia.pyは
このキャッシュのみを読み、build.py実行のたびに再取得はしない=決定的に保つ)。"""
import json
import time
import urllib.parse
import urllib.request

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"
API = "https://ja.wikipedia.org/w/api.php"


def fetch_batch(titles):
    joined = "|".join(titles)
    params = {"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
              "titles": joined, "redirects": "1", "format": "json", "formatversion": "2"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    out = {}
    for p in data.get("query", {}).get("pages", []):
        revs = p.get("revisions")
        if revs:
            out[p["title"]] = revs[0]["slots"]["main"]["content"]
    return out


def main():
    population = json.load(open("coverage_population.json"))
    titles = [p["wiki_title"] for p in population]
    print(f"対象: {len(titles)}人")
    wikitexts = {}
    BATCH = 20
    for i in range(0, len(titles), BATCH):
        batch = titles[i:i + BATCH]
        try:
            wikitexts.update(fetch_batch(batch))
        except Exception as e:
            print(f"  [ERROR] batch {i}: {e}")
            time.sleep(2)
            continue
        print(f"[{min(i+BATCH,len(titles))}/{len(titles)}] fetched so far: {len(wikitexts)}")
        time.sleep(0.4)
    json.dump(wikitexts, open("raw/wp_wikitext_v2.json", "w"), ensure_ascii=False)
    print(f"完了: {len(wikitexts)}/{len(titles)} 件を raw/wp_wikitext_v2.json に保存")


if __name__ == "__main__":
    main()
