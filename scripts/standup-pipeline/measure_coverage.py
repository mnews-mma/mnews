# -*- coding: utf-8 -*-
"""coverage_sample.json(30人)を対象に、Wikipedia記事の戦績表(Fight-cont各行)と
自前データ(fighters.json+bouts_*.json、mnews側と同じ突合ロジック)を突き合わせ、
収録率と未収録の原因(A/C/範囲外)を測定する。読み取り専用。
"""
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"
API = "https://ja.wikipedia.org/w/api.php"

# event文字列 -> 追跡15団体のどれかを推定する(大会名の慣用表記から機械的に判定)。
# 該当なしは範囲外(GLORY・海外団体・タイのローカル興行等)として扱う。
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
    "KNOCK OUT": "knockoutkb.com", "RIZIN": None, "ONE Championship": None,
    "DEEP☆KICK": None, "NJKF": None, "HoostCup": None, "NKB": None,
    "Bigbang": None, "Stand up": None, "KROSS×OVER": None, "SNKA": None, "JKA": None,
}


def guess_org(event_text):
    for org, pat in ORG_PATTERNS:
        if pat.search(event_text or ""):
            return org
    return None


def fetch_wikitext_batch(titles):
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


FIGHT_CONT_RE = re.compile(r"\{\{Fight-cont\s*\|(.*?)\}\}", re.S)
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def protect_wikilinks(s):
    """[[target|display]]内部の'|'をテンプレート引数区切りと衝突させないよう退避する。"""
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
        dm = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", date_raw)
        date = f"{dm.group(1)}-{int(dm.group(2)):02d}-{int(dm.group(3)):02d}" if dm else None
        rows.append(dict(mark=mark, opponent=opponent, method=method, event=event_clean, date=date))
    return rows


def norm_opp(s):
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"\s+", "", s)
    s = s.replace("・", "").replace("･", "")
    return s.lower()


def main():
    sample = json.load(open("coverage_sample.json"))
    fighters = json.load(open("fighters.json"))
    by_name = {}
    for f in fighters:
        by_name.setdefault(f["name"], []).append(f)

    # 各団体の生bout(名簿解決済み・非scheduled)を fighter identity -> [(date, norm_opp)] に集約
    BOUT_FILES = {
        "K-1": "bouts_k1.json", "RISE": "bouts_rise.json", "SHOOT BOXING": "bouts_sb.json",
        "KNOCK OUT": "bouts_knockout.json", "RIZIN": "bouts_rizin.json", "ONE Championship": "bouts_one.json",
        "DEEP☆KICK": "bouts_deepkick.json", "NJKF": "bouts_njkf.json", "HoostCup": "bouts_hoostcup.json",
        "NKB": "bouts_nkb.json", "Bigbang": "bouts_bigbang.json", "Stand up": "bouts_standup.json",
        "KROSS×OVER": "bouts_krossover.json", "SNKA": "bouts_snka.json", "JKA": "bouts_jka.json",
    }

    def identity(f):
        return f"{f['name']}|{f['gym'] or ''}|{f['sources'][0] if f['sources'] else ''}"

    by_source_url = {}
    for f in fighters:
        for u in f["sources"]:
            by_source_url[u] = f

    # 選手ごと・団体ごとの (date, norm_opp) 集合、および「その団体に本人ページがあるか」
    person_org_bouts = {}  # identity -> {org: set((date, norm_opp))}
    person_org_has_page = {}  # identity -> {org: bool}
    for org, fn in BOUT_FILES.items():
        rows = json.load(open(fn))
        for b in rows:
            if b["result"] == "scheduled":
                continue
            f = by_source_url.get(b["source_url"])
            if not f:
                continue
            ident = identity(f)
            person_org_bouts.setdefault(ident, {}).setdefault(org, set())
            if b["date"]:
                person_org_bouts[ident][org].add((b["date"], norm_opp(b["opponent_name"])))
            person_org_has_page.setdefault(ident, {})[org] = True

    # 本人ページの有無(sourcesに該当ドメインを含むか)は全団体分厳密に判定する
    def has_own_page(rec, org):
        domain = ORG_TO_SOURCE_DOMAIN.get(org)
        if domain:
            return any(domain in u for u in rec["sources"])
        # RIZIN/ONE/DEEP等は名簿掲載元と戦績出典元が別なので、sourcesに直接ドメインが
        # 出ない。person_org_has_pageの集計(戦績が1件でも解決済みならページありと同義)を使う。
        return person_org_has_page.get(identity(rec), {}).get(org, False)

    # ---- Wikipedia記事取得(30人、バッチ) ----
    titles = [s["wiki_title"] for s in sample]
    wikitexts = {}
    BATCH = 10
    for i in range(0, len(titles), BATCH):
        batch = titles[i:i + BATCH]
        wikitexts.update(fetch_wikitext_batch(batch))
        time.sleep(0.4)
    print(f"Wikipedia記事取得: {len(wikitexts)}/{len(titles)}")

    results = []
    for s in sample:
        wt = wikitexts.get(s["wiki_title"])
        if not wt:
            results.append(dict(name=s["name"], wiki_title=s["wiki_title"], error="wikitext_fetch_failed"))
            continue
        fight_rows = parse_fight_rows(wt)
        cands = by_name.get(s["name"], [])
        rec = None
        for c in cands:
            if any(u == s["fighters_json_sources"][0] for u in c["sources"]) if s.get("fighters_json_sources") else False:
                rec = c
                break
        if not rec and cands:
            rec = cands[0]

        total = len(fight_rows)
        captured = 0
        a_count = 0
        c_count = 0
        out_of_scope = 0
        details = []
        for fr in fight_rows:
            org = guess_org(fr["event"])
            if not org:
                out_of_scope += 1
                details.append({**fr, "org": None, "status": "out_of_scope"})
                continue
            if not rec:
                a_count += 1
                details.append({**fr, "org": org, "status": "A(本人ページ不明)"})
                continue
            own_page = has_own_page(rec, org)
            if not own_page:
                a_count += 1
                details.append({**fr, "org": org, "status": "A(本人ページなし)"})
                continue
            key = (fr["date"], norm_opp(fr["opponent"])) if fr["date"] else None
            org_bouts = person_org_bouts.get(identity(rec), {}).get(org, set())
            if key and key in org_bouts:
                captured += 1
                details.append({**fr, "org": org, "status": "captured"})
            else:
                c_count += 1
                details.append({**fr, "org": org, "status": "C(bout欠落)"})

        rate = captured / total if total else None
        results.append(dict(
            name=s["name"], wiki_title=s["wiki_title"], total=total, captured=captured,
            a_count=a_count, c_count=c_count, out_of_scope=out_of_scope, rate=rate,
            wiki_bout_count_declared=s.get("wiki_bout_count"), details=details,
        ))

    json.dump(results, open("coverage_measurement.json", "w"), ensure_ascii=False, indent=1)

    valid = [r for r in results if r.get("total")]
    rates = [r["rate"] for r in valid]
    rates.sort()
    overall_captured = sum(r["captured"] for r in valid)
    overall_total = sum(r["total"] for r in valid)
    print(f"\n有効サンプル: {len(valid)}/30")
    print(f"全体収録率(captured合計/total合計): {overall_captured}/{overall_total} = {overall_captured/overall_total*100:.1f}%")
    print(f"個人別収録率の平均: {sum(rates)/len(rates)*100:.1f}%")
    mid = len(rates) // 2
    median = rates[mid] if len(rates) % 2 else (rates[mid - 1] + rates[mid]) / 2
    print(f"個人別収録率の中央値: {median*100:.1f}%")
    print(f"0%の人数: {sum(1 for r in rates if r == 0)}/{len(rates)}")
    print(f"100%到達者数: {sum(1 for r in rates if r == 1)}/{len(rates)}")
    print(f"A区分合計: {sum(r['a_count'] for r in valid)}")
    print(f"C区分合計: {sum(r['c_count'] for r in valid)}")
    print(f"範囲外合計: {sum(r['out_of_scope'] for r in valid)}")
    print(f"無効サンプル(wikitext取得失敗等): {30 - len(valid)}")


if __name__ == "__main__":
    main()
