# -*- coding: utf-8 -*-
"""PR-16: カバレッジ母集団をレグ③(記事の実在確認、718人)方式に差し替える。

旧 build_coverage_population.py は「男子/女子キックボクサー一覧」2ページの
wikilink先(候補509件)のみを母集団としていたが、レグ③の実測で記事が実在する
選手の24.7%(177/718件)がこの2ページから漏れていることが判明した
(与座優貴もこの177件の1人)。

本スクリプトは out/kana-leg3-wiki-existence.csv (status=exists, redirected=False,
718人)を母集団として使い、fighters.jsonと突合してslug相当の情報を付与する。

PR-和島大海欠落調査(2026-08): レグ③のexistence-checkはfighters.json側の name を
そのままWikipediaタイトル候補として検索していたため、K-1公式由来の「姓 名」表記
(半角スペース区切り、例:「和島 大海」)がWikipedia側の実際のタイトル「和島大海」
(スペース無し)と完全一致せず、記事が実在するのに missing 扱いになっていた選手が
いることが発覚した(和島大海自身がこの1人)。leg3のCSV自体は一回限りの取得物で
再生成スクリプトが残っていないため、このスクリプト側に「missing かつ名前に
半角/全角スペースを含む」候補に対するスペース除去フォールバック検索を追加する
(find_nospace_recoveries参照)。取得結果はネットワーク越しの実測に依存するため、
再実行のたびに多少の増減がありうる(Wikipedia側の記事新設・削除を都度反映するのは
むしろ望ましい)。
"""
import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request

LEG3_CSV = "/Users/kainakishiyoshi/Desktop/mnews/out/kana-leg3-wiki-existence.csv"
WIKI_API = "https://ja.wikipedia.org/w/api.php"
UA = "mnews-research/1.0 (research contact: kaina.k.07@gmail.com)"

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


def _api_query(params, retries=5):
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(3 * (attempt + 1))
                continue
            raise
    raise RuntimeError("Wikipedia API: リトライ上限に達しました")


def _fetch_wikitext(title):
    data = _api_query({
        "action": "query", "prop": "revisions", "rvslots": "main", "rvprop": "content",
        "titles": title, "format": "json",
    })
    for pid, p in data.get("query", {}).get("pages", {}).items():
        if pid == "-1":
            return None
        revs = p.get("revisions", [])
        if revs:
            return revs[0]["slots"]["main"]["*"]
    return None


def find_nospace_recoveries(missing_rows, already_seen_names):
    """レグ③でmissing判定だった行のうち、名前に半角/全角スペースを含むものについて、
    スペースを除去したタイトルでWikipedia記事が実在するかを再検索する。
    記事が見つかっても、それが同姓同名の別人(格闘家ではない)である誤爆を避けるため、
    記事本文に{{Fight-cont}}(キックボクシング/ムエタイの戦績表テンプレート)が
    含まれる場合のみ採用する(ingest_wikipedia.py・レグ③本来の母集団定義と同じ基準)。
    戻り値: [(元のfighters.json名, スペース除去タイトル), ...]
    """
    candidates = []
    for r in missing_rows:
        name = r["name"]
        if name in already_seen_names:
            continue
        nospace = name.replace(" ", "").replace("　", "")
        if nospace != name:
            candidates.append((name, nospace))

    # 1. 存在確認(バッチ)
    exists_found = []
    BATCH = 40
    for i in range(0, len(candidates), BATCH):
        chunk = candidates[i : i + BATCH]
        titles = [c[1] for c in chunk]
        data = _api_query({
            "action": "query", "titles": "|".join(titles), "format": "json", "redirects": "1",
        })
        pages = data.get("query", {}).get("pages", {})
        redirects = {r["from"]: r["to"] for r in data.get("query", {}).get("redirects", [])}
        normalized = {n["from"]: n["to"] for n in data.get("query", {}).get("normalized", [])}
        exists_titles = {p["title"] for pid, p in pages.items() if pid != "-1" and "missing" not in p}
        for orig_name, nospace in chunk:
            t = redirects.get(normalized.get(nospace, nospace), normalized.get(nospace, nospace))
            if t in exists_titles:
                exists_found.append((orig_name, t))
        time.sleep(0.4)

    # 2. Fight-cont確認(同姓同名の別人による誤爆防止)
    verified = []
    for orig_name, title in exists_found:
        wt = _fetch_wikitext(title)
        if wt and "Fight-cont" in wt:
            verified.append((orig_name, title))
        time.sleep(0.4)

    return verified


def main():
    fighters = json.load(open("fighters.json"))
    by_name = {}
    for f in fighters:
        by_name.setdefault(f["name"], []).append(f)

    rows = list(csv.DictReader(open(LEG3_CSV, encoding="utf-8-sig")))
    exists = [r for r in rows if r["status"] == "exists" and r["redirected"] == "False"]
    missing = [r for r in rows if r["status"] != "exists" or r["redirected"] != "False"]

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

    print(f"新母集団(レグ③718人ベース): {len(population)}人")

    # PR-和島大海欠落調査: スペース除去フォールバック回収
    recovered = find_nospace_recoveries(missing, seen_names)
    print(f"スペース除去フォールバックで回収: {len(recovered)}人")
    for name, title in recovered:
        if name in seen_names:
            continue
        seen_names.add(name)
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

    print(f"最終母集団: {len(population)}人")
    json.dump(population, open("coverage_population.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
