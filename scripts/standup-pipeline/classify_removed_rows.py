# -*- coding: utf-8 -*-
"""一時使用スクリプト(2026-08-21、削除行の機械分類調査用、恒久ゲートではない)。

promote_to_data_kick.py実行前(prev)と実行後(fresh)のbouts_*.jsonを比較し、
「削除された」行(prevにはあるがfreshに無い自然キー)を機械的にA/B/C/Dへ分類する。

分類ルール:
  A(KNOCK OUT名簿漏れ): sourceがknockoutで、fighter_slugがfighters.jsonのKNOCK OUT
    sourcesに存在しない(=fetch対象から漏れている)。
  C(RISE/SB名簿漏れ): sourceがrise/sbで、fighter_slug(生ページslug)に対応するURLが
    fighters.jsonのsourcesに存在しない。
  B(近傍一致、日付/表記ゆれの疑い): 上記A/Cに該当せず、fresh側に同一fighter_slug×
    正規化した同一相手名で、日付が別の行が存在する(±5日以内)。イベント名の表記ゆれ・
    複数記事投稿等が疑われる。
  D(未分類、要個別確認): 上記いずれにも該当しない残り。全件リストする。

実行方法: cd scripts/standup-pipeline && python3 classify_removed_rows.py
"""
import json
import re
import unicodedata
from collections import defaultdict
from datetime import date as _date

SOURCES = [
    "bigbang", "standup", "krossover", "snka", "jka", "hoostcup",
    "deepkick", "njkf", "nkb", "k1", "rise", "sb", "knockout",
]

DATA_KICK = "../../data/kick"


def normalize_name_for_key(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    for c in "“”\"'‘’｀「」『』【】〈〉《》〔〕・･":
        s = s.replace(c, "")
    s = re.sub(r"\s+", "", s)
    return s.lower()


def bout_key(b):
    return (b.get("fighter_slug"), b.get("date"), normalize_name_for_key(b.get("opponent_name")))


def parse_date(s):
    if not s:
        return None
    try:
        y, m, d = s.split("-")
        return _date(int(y), int(m), int(d))
    except (ValueError, AttributeError):
        return None


def main():
    fighters = json.load(open(f"{DATA_KICK}/fighters.json", encoding="utf-8"))
    ko_urls = {s for f in fighters for s in f.get("sources", []) if "knockoutkb.com" in s}
    ko_slugs = {u.rstrip("/").split("/")[-1] for u in ko_urls}
    rise_urls = {s for f in fighters for s in f.get("sources", []) if "rise-rc.com" in s}
    sb_urls = {s for f in fighters for s in f.get("sources", []) if "shootboxing.org" in s}

    classification = defaultdict(list)
    totals = defaultdict(int)

    for tag in SOURCES:
        fresh_path = f"bouts_{tag}.json"
        prev_path = f"{DATA_KICK}/bouts_{tag}.json"
        try:
            fresh = json.load(open(fresh_path, encoding="utf-8"))
        except FileNotFoundError:
            continue
        prev = json.load(open(prev_path, encoding="utf-8"))

        fresh_keys = {bout_key(b) for b in fresh}
        prev_by_key = {bout_key(b): b for b in prev}
        removed = set(prev_by_key) - fresh_keys
        if not removed:
            continue

        # B判定用: fresh側の (fighter_slug, normalized_opponent) -> [date,...]
        fresh_by_fo = defaultdict(list)
        for b in fresh:
            fresh_by_fo[(b.get("fighter_slug"), normalize_name_for_key(b.get("opponent_name")))].append(
                parse_date(b.get("date"))
            )

        for k in removed:
            row = prev_by_key[k]
            fighter_slug, dt, opp = k
            totals[tag] += 1

            if tag == "knockout" and fighter_slug not in ko_slugs:
                classification["A"].append((tag, k, row))
                continue
            if tag == "rise":
                # RISEのfighter_slugは生ページslug。fighters.jsonのURLから同じslugを再構成して照合。
                slugs = {u.rstrip("/").split("/")[-1] for u in rise_urls}
                if fighter_slug not in slugs:
                    classification["C"].append((tag, k, row))
                    continue
            if tag == "sb":
                slugs = {u.rstrip("/").split("/")[-1] for u in sb_urls}
                if fighter_slug not in slugs:
                    classification["C"].append((tag, k, row))
                    continue

            parsed_dt = parse_date(dt)
            near = fresh_by_fo.get((fighter_slug, opp), [])
            if parsed_dt and any(d and abs((d - parsed_dt).days) <= 5 for d in near):
                classification["B"].append((tag, k, row))
                continue

            classification["D"].append((tag, k, row))

    print(f"削除された行の総数: {sum(totals.values())}件(ソース別: {dict(totals)})")
    for cat in ["A", "B", "C", "D"]:
        items = classification[cat]
        print(f"\n=== 分類{cat}: {len(items)}件 ===")
        for tag, k, row in items:
            print(f"  [{tag}] key={k} event={row.get('event')!r} opponent_raw={row.get('opponent_raw')!r} source_url={row.get('source_url')!r}")

    残余 = len(classification["D"])
    print(f"\n残余(D、未分類): {残余}件")


if __name__ == "__main__":
    main()
