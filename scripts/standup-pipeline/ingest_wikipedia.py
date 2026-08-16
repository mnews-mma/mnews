# -*- coding: utf-8 -*-
"""coverage_population.json(509人、ja.wikipedia個別記事に{{Fight-cont}}戦績表を持つ選手)の
Wikipedia戦績を、既存15団体のbouts_*.jsonと突き合わせて取り込む。対象は509人のみ
(名簿を広げると全団体再生成が必要になるため、新規選手は追加しない)。

重複判定(out/wikipedia-record-ingestion-feasibility-report.md の設計に従う):
  1. 選手+推定団体(大会名からguess_org)の組で、Wikipedia側boutの日付が既存bout(その団体、
     日付ありのもの)と(date, 正規化した相手名)で一致 -> 既存済みとみなし新規行を追加しない。
  2. 一致しない場合、その団体の既存bout(日付なしも含む)のうち正規化した相手名が一致するものを
     フォールバックキーとして探す。1件のみ一致 -> 既存済みとみなし追加しない。0件一致 ->
     選手にとってその団体・相手との対戦データが全く無いということなので、新規行として追加する。
     複数件一致(同じ相手と複数回対戦している等、日付で区別できない) -> 二重計上のリスクを
     取ってでも網羅性を優先する理由がないため、自動登録せず保留(held、出力はするが
     bouts_wikipedia.jsonには含めない)。
  3. 本人ページがその団体に無い(has_own_page=False)場合は、その団体・相手との対戦データが
     全く無いのと同じことなので2と同じロジックで新規追加または保留の対象になる。

出力: bouts_wikipedia.json (SCHEMA.mdの標準フィールド + source_type='wikipedia')。
      画面表示側でこのsource_typeにより公式一次ソース由来と区別する想定(kick-badgeパターン)。
"""
import collections
import json
import re
import unicodedata

import bouts as _bouts

ORG_PATTERNS = [
    ("K-1", re.compile(r"K-?1|Krush", re.I)),
    ("RISE", re.compile(r"\bRISE\b|R\.I\.S\.E\.")),
    ("SHOOT BOXING", re.compile(r"SHOOT ?BOXING|シュートボクシング")),
    ("KNOCK OUT", re.compile(r"KNOCK ?OUT")),
    ("RIZIN", re.compile(r"RIZIN")),
    ("ONE Championship", re.compile(r"\bONE\b.*(Champ|FC)|ONE\d")),
    ("DEEP☆KICK", re.compile(r"DEEP.?KICK")),
    ("NJKF", re.compile(r"NJKF|ニュージャパンキックボクシング連盟")),
    ("HoostCup", re.compile(r"HOOST ?CUP", re.I)),
    ("NKB", re.compile(r"\bNKB\b")),
    ("Bigbang", re.compile(r"Big ?bang|ビッグバン", re.I)),
    ("Stand up", re.compile(r"Stand ?up", re.I)),
    ("KROSS×OVER", re.compile(r"KROSS.?OVER", re.I)),
    ("SNKA", re.compile(r"SNKA|新日本キックボクシング協会")),
    ("JKA", re.compile(r"\bJKA\b|ジャパンキックボクシング協会")),
]
ORG_TO_SOURCE_DOMAIN = {
    "K-1": "k-1.co.jp", "RISE": "rise-rc.com", "SHOOT BOXING": "shootboxing.org",
    "KNOCK OUT": "knockoutkb.com",
}
BOUT_FILES = {
    "K-1": "bouts_k1.json", "RISE": "bouts_rise.json", "SHOOT BOXING": "bouts_sb.json",
    "KNOCK OUT": "bouts_knockout.json", "RIZIN": "bouts_rizin.json", "ONE Championship": "bouts_one.json",
    "DEEP☆KICK": "bouts_deepkick.json", "NJKF": "bouts_njkf.json", "HoostCup": "bouts_hoostcup.json",
    "NKB": "bouts_nkb.json", "Bigbang": "bouts_bigbang.json", "Stand up": "bouts_standup.json",
    "KROSS×OVER": "bouts_krossover.json", "SNKA": "bouts_snka.json", "JKA": "bouts_jka.json",
}
ORG_TAG = {
    "K-1": "k1", "RISE": "rise", "SHOOT BOXING": "sb", "KNOCK OUT": "knockout", "RIZIN": "rizin",
    "ONE Championship": "one", "DEEP☆KICK": "deepkick", "NJKF": "njkf", "HoostCup": "hoostcup",
    "NKB": "nkb", "Bigbang": "bigbang", "Stand up": "standup", "KROSS×OVER": "krossover",
    "SNKA": "snka", "JKA": "jka",
}
MARK2RESULT = {"○": "win", "〇": "win", "◎": "win", "×": "loss", "△": "draw"}

FIGHT_CONT_RE = re.compile(r"\{\{Fight-cont\s*\|(.*?)\}\}", re.S)
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def protect_wikilinks(s):
    return WIKILINK_RE.sub(lambda mm: "\x00" + (mm.group(2) or mm.group(1)).replace("|", "\x01") + "\x00", s)


def restore_wikilinks(s):
    return s.replace("\x00", "").replace("\x01", "|")


def parse_fight_rows(wikitext):
    rows = []
    for m in FIGHT_CONT_RE.finditer(wikitext):
        protected = protect_wikilinks(m.group(1))
        parts = [restore_wikilinks(p).strip() for p in protected.split("|")]
        while len(parts) < 5:
            parts.append("")
        mark, opponent, method, event, date_raw = parts[:5]
        opponent = re.sub(r"<[^>]+>", "", opponent).strip()
        event_clean = re.sub(r"<br\s*/?>", " ", event, flags=re.I)
        event_clean = re.sub(r"【[^】]*】", "", event_clean).strip()
        # PR-10: 「2011年（平成23年）5月15日」のように西暦年の直後に元号年の注記が挟まる
        # 表記があり、旧正規表現(年月日が連続することを要求)では日付が全く拾えていなかった
        # (date(null)監査で発見、黒田アキヒロの記事で38行中38行が該当していた)。
        # 元号注記(全角/半角括弧)を任意で許容する。
        dm = re.search(r"(\d{4})年(?:[（(][^）)]*[）)])?(\d{1,2})月(\d{1,2})日", date_raw)
        date = f"{dm.group(1)}-{int(dm.group(2)):02d}-{int(dm.group(3)):02d}" if dm else None
        rows.append(dict(mark=mark, opponent=opponent, method=method, event=event_clean, date=date))
    return rows


def guess_org(event_text):
    for org, pat in ORG_PATTERNS:
        if pat.search(event_text or ""):
            return org
    return None


def nk(s):
    s = unicodedata.normalize("NFKC", s or "")
    for c in "“”\"'’‘`「」『』":
        s = s.replace(c, "")
    return re.sub(r"\s+", "", s).replace("・", "").replace("=", "").lower()


def norm_opp(s):
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"\s+", "", s)
    return s.replace("・", "").replace("･", "").lower()


def build():
    population = json.load(open("coverage_population.json"))
    fighters = json.load(open("fighters.json"))
    wikitexts = json.load(open("raw/wp_wikitext_509.json"))

    def identity(f):
        return f"{f['name']}|{f['gym'] or ''}|{f['sources'][0] if f['sources'] else ''}"

    by_name = collections.defaultdict(list)
    for f in fighters:
        by_name[f["name"]].append(f)
    by_source_url = {}
    for f in fighters:
        for u in f["sources"]:
            by_source_url[u] = f

    # 選手×団体 -> (date, norm_opp)集合(日付ありのみ)/ norm_opp集合(日付有無問わず、フォールバック用)
    person_org_dated = collections.defaultdict(lambda: collections.defaultdict(set))
    person_org_opp_all = collections.defaultdict(lambda: collections.defaultdict(list))  # org -> [(norm_opp, date)]
    person_org_has_page = collections.defaultdict(dict)
    for org, fn in BOUT_FILES.items():
        rows = json.load(open(fn))
        for b in rows:
            if b["result"] == "scheduled":
                continue
            f = by_source_url.get(b["source_url"])
            if not f:
                continue
            ident = identity(f)
            no = norm_opp(b["opponent_name"])
            person_org_opp_all[ident][org].append((no, b["date"]))
            if b["date"]:
                person_org_dated[ident][org].add((b["date"], no))
            person_org_has_page[ident][org] = True

    def has_own_page(rec, org):
        domain = ORG_TO_SOURCE_DOMAIN.get(org)
        if domain:
            return any(domain in u for u in rec["sources"])
        return person_org_has_page.get(identity(rec), {}).get(org, False)

    byname_all = collections.defaultdict(list)
    for f in fighters:
        for n in [f["name"]] + f.get("aliases", []):
            if f not in byname_all[nk(n)]:
                byname_all[nk(n)].append(f)

    def resolve_opponent(name):
        cands = byname_all.get(nk(name), [])
        if len(cands) == 1:
            return cands[0], False, None
        if len(cands) > 1:
            return None, True, [{"name": c["name"], "gym": c["gym"], "orgs": c["orgs"]} for c in cands]
        return None, False, None

    stats = collections.Counter()
    bout_seq = collections.Counter()
    out = []
    held = []

    for p in population:
        wt = wikitexts.get(p["wiki_title"])
        if not wt:
            stats["wikitext_missing"] += 1
            continue
        cands = by_name.get(p["name"], [])
        rec = None
        srcs = p.get("fighters_json_sources") or []
        for c in cands:
            if srcs and any(u == srcs[0] for u in c["sources"]):
                rec = c
                break
        if not rec and cands:
            rec = cands[0]
        if not rec:
            stats["no_roster_match"] += 1
            continue

        for fr in parse_fight_rows(wt):
            stats["total_wiki_bouts"] += 1
            org = guess_org(fr["event"])
            if not org:
                stats["out_of_scope"] += 1
                continue
            no = norm_opp(fr["opponent"])
            if fr["date"]:
                dated_set = person_org_dated[identity(rec)][org]
                if (fr["date"], no) in dated_set:
                    stats["dup_dated_match"] += 1
                    continue
            # フォールバック: 相手名一致(日付問わず)
            all_opps = person_org_opp_all[identity(rec)][org]
            matches = [x for x in all_opps if x[0] == no]
            if len(matches) == 1:
                stats["dup_fallback_match"] += 1
                continue
            if len(matches) > 1:
                stats["held_ambiguous"] += 1
                held.append(dict(fighter=rec["name"], org=org, opponent=fr["opponent"],
                                  wiki_url=p["wiki_url"], candidates=len(matches)))
                continue
            if not fr["opponent"]:
                stats["skipped_no_opponent"] += 1
                continue

            # 新規bout
            meth, rnd, ext, rs = _bouts.parse_method(fr["method"])
            result = MARK2RESULT.get(fr["mark"], "unknown")
            oref, oamb, ocands = resolve_opponent(fr["opponent"])
            ident = identity(rec)
            idx = bout_seq[ident]
            bout_seq[ident] += 1
            out.append(dict(
                bout_id=f"wikipedia:{ident}:{idx}",
                date=fr["date"], event=fr["event"], venue=None,
                fighter_slug=ident, fighter_name=rec["name"],
                opponent_raw=fr["opponent"], opponent_name=fr["opponent"], opponent_affiliation=None,
                opponent_site_slug=None,
                opponent_ref=oref["name"] if oref else None,
                opponent_ref_gym=oref["gym"] if oref else None,
                opponent_resolved=oref is not None,
                opponent_ambiguous=oamb, opponent_candidates=ocands,
                result=result, result_mark=fr["mark"], method=meth, method_raw=fr["method"] or "",
                round=rnd, is_extension=ext, ruleset=rs, note=None, is_debut=False,
                title_type=_bouts.classify_title_type(fr["event"]),
                pair_key=None,
                source_url=p["wiki_url"],
                source_type="wikipedia",
                target_org=org,
            ))
            stats["new_added"] += 1

    return out, stats, held


if __name__ == "__main__":
    bouts, stats, held = build()
    json.dump(bouts, open("bouts_wikipedia.json", "w"), ensure_ascii=False, indent=1)
    json.dump(held, open("wikipedia_held_ambiguous.json", "w"), ensure_ascii=False, indent=1)
    print("===== bouts_wikipedia.json =====")
    print("対象母集団:", 509, "人 / wikitext取得成功:", 509 - stats["wikitext_missing"])
    print("名簿未一致(スキップ):", stats["no_roster_match"])
    print("Wikipedia側bout総数:", stats["total_wiki_bouts"])
    print("  範囲外(15団体以外):", stats["out_of_scope"])
    print("  相手名欠落でスキップ:", stats["skipped_no_opponent"])
    print("  既存(日付一致)で重複:", stats["dup_dated_match"])
    print("  既存(相手名フォールバック)で重複:", stats["dup_fallback_match"])
    print("  複数候補で判定不能・保留:", stats["held_ambiguous"])
    print("  新規追加:", stats["new_added"])
    residual = (stats["total_wiki_bouts"] - stats["out_of_scope"] - stats["skipped_no_opponent"]
                - stats["dup_dated_match"] - stats["dup_fallback_match"] - stats["held_ambiguous"]
                - stats["new_added"])
    print("残余(0であるべき):", residual)
    r = sum(1 for x in bouts if x["opponent_resolved"])
    print(f"opponent resolved: {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%" if bouts else "no bouts")
    print("result内訳:", dict(collections.Counter(x["result"] for x in bouts)))
    print("団体内訳:", dict(collections.Counter(x["target_org"] for x in bouts)))
