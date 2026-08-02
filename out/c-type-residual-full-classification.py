# out/c-type-scale-measurement.py が出した残件113件(DEEP/PANCRASE/RIZIN、対戦相手名
# クロス突合でも実在boutが見つからなかった行)を、以下4分類に機械的に仕分ける。
# サンプル20件で人力確認した内容を一般化したロジック。
#
#   1. 団体誤判定: 大会名に団体名の文字列を含むが、実際はその団体本体の興行では
#      ない(海外提携プロモーションの予選大会等)。キーワードヒューリスティックで
#      候補を抽出し、個別にWeb確認した結果を反映する。
#   2. 日付誤り疑い: 大会の「通し番号」(DEEP NN IMPACT / DEEP JEWELS NN /
#      RIZIN.N 等、時代を通して一意な番号)が団体データ側に実在し、日付だけが
#      食い違う。番号が一意なシリーズに限定し、年ごとに使い回される
#      「Nth ROUND」系の番号は対象外(誤爆リスクが高いため)。
#   3. 構造的カバレッジ不足: 該当ブランド(大会シリーズ)の団体データ収録が
#      始まる最古の日付より前。
#   4. 未解決: 上記いずれにも該当しない残り。
#
# 実行方法: out/fighter-records-abc-audit.py → out/c-type-scale-measurement.py の順に
# 実行した後、`python3 out/c-type-residual-full-classification.py`
import csv, json, os, re, collections

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRATCH = os.path.dirname(os.path.abspath(__file__))

org_files = {"RIZIN": "rizinRecords.json", "PANCRASE": "pancraseRecords.json", "DEEP": "deepRecords.json"}
org_events = {org: json.load(open(f"{BASE}/data/{fname}")) for org, fname in org_files.items()}

residual = list(csv.DictReader(open(f"{SCRATCH}/c-type-scale-measurement-residual.csv")))

# ---------------------------------------------------------------------------
# 1. 団体誤判定: キーワードヒューリスティックで候補抽出(手動確認結果を反映)
# ---------------------------------------------------------------------------
# 手動確認済み(このレポート作成過程・過去のPRで確認できたもの)。
CONFIRMED_ORG_MISATTRIBUTION = {
    ("gustavo-luis", "2016-07-23", "PANCRASE"),  # Imortal FC 5 - Road to Pancrase(ブラジル、提携予選)
}

MISATTRIBUTION_KEYWORD_RE = re.compile(
    r"road to|qualifier|contender|featuring|selection|予選|勝ち上がり", re.I
)

def misattribution_candidates(rows):
    hits = []
    for r in rows:
        key = (r["slug"], r["date"], r["org"])
        if key in CONFIRMED_ORG_MISATTRIBUTION:
            hits.append((r, "confirmed"))
        elif MISATTRIBUTION_KEYWORD_RE.search(r["event"]):
            hits.append((r, "keyword-candidate(要個別確認)"))
    return hits

# ---------------------------------------------------------------------------
# 2. 日付誤り疑い: 通し番号が一意なシリーズのみ対象
# ---------------------------------------------------------------------------
DEEP_MAIN_RE = re.compile(r"^DEEP\s*(?:2001)?\s*(\d+)(?:ST|ND|RD|TH)?\s+IMPACT\b", re.I)
DEEP_JEWELS_RE = re.compile(r"^DEEP\s*JEWELS\s*(\d+)\b", re.I)
RIZIN_NUM_RE = re.compile(r"^RIZIN[.\s]?(\d+)\b", re.I)
PANCRASE_NUM_RE = re.compile(r"^PANCRASE\s*(\d+)\b", re.I)

NUM_EXTRACTORS = {
    "DEEP": [("DEEP_MAIN", DEEP_MAIN_RE), ("DEEP_JEWELS", DEEP_JEWELS_RE)],
    "RIZIN": [("RIZIN_MAIN", RIZIN_NUM_RE)],
    "PANCRASE": [("PANCRASE_MAIN", PANCRASE_NUM_RE)],
}

def extract_number(org, event_name):
    name = event_name.strip()
    for brand, rx in NUM_EXTRACTORS.get(org, []):
        m = rx.match(name)
        if m:
            return brand, int(m.group(1))
    return None, None

# 団体データ側: (org, brand, number) -> [(date, eventName), ...]
org_number_index = collections.defaultdict(list)
for org, events in org_events.items():
    for ev in events:
        brand, num = extract_number(org, ev["eventName"])
        if brand:
            org_number_index[(org, brand, num)].append((ev["date"], ev["eventName"]))

def date_error_check(row):
    org = row["org"]
    brand, num = extract_number(org, row["event"])
    if not brand:
        return None
    candidates = org_number_index.get((org, brand, num), [])
    diff_date = [c for c in candidates if c[0] != row["date"]]
    if diff_date:
        return diff_date[0]  # (found_date, found_eventName)
    return None

# 機械的な「番号一致」検出(date_error_check)は、大会自体の実在は示すが、
# claimされた個々のboutが実際にその(訂正後の)大会に存在するかまでは保証しない
# (goto-jojiのケースで判明: 番号一致は2024-11-04のDEEP122 IMPACTを拾ったが、
# 実際のboutは延期で2024-11-23のDEEP TOKYO IMPACT 2024 5th ROUNDに移っていた)。
# DEEP公式サイト(deep2001.com)の大会ページでbout単位(対戦相手・決着方法)まで
# 個別に確認できたものだけを「確定」とし、recordOverrides.tsで実際に修正した。
# 確認できなかったものは自動検出候補から外し「未解決」に落とす。
CONFIRMED_DATE_ERROR_FIXED = {
    ("motoya-yuki", "2018-10-27", "釜谷真"): "2022-10-27",
    ("takeda-koji", "2018-10-27", "北岡悟"): "2022-10-27",
    ("kitaoka-satoru", "2018-10-27", "武田光司"): "2022-10-27",
    ("koya-kanda", "2020-11-02", "鬼山斑猫"): "2020-11-01",
    ("goto-joji", "2024-12-08", "マンド・グティエレス"): "2024-11-23",
}

# ---------------------------------------------------------------------------
# 3. 構造的カバレッジ不足: ブランドキー単位の最古日付より前
# ---------------------------------------------------------------------------
DEEP_BRAND_PATTERNS = [
    ("DEEP_JEWELS", re.compile(r"JEWELS", re.I)),
    ("TOKYO_IMPACT", re.compile(r"TOKYO\s*IMPACT", re.I)),
    ("CAGE_IMPACT", re.compile(r"CAGE\s*IMPACT", re.I)),
    ("NAGOYA_IMPACT", re.compile(r"NAGOYA", re.I)),
    ("OSAKA_IMPACT", re.compile(r"OSAKA\s*IMPACT", re.I)),
    ("HAMAMATSU_IMPACT", re.compile(r"HAMAMATSU|浜松", re.I)),
    ("OKINAWA_IMPACT", re.compile(r"OKINAWA", re.I)),
    ("DEEP_MAIN", re.compile(r"^DEEP\s*(?:2001)?\s*\d+(?:ST|ND|RD|TH)?\s+IMPACT\b", re.I)),
    ("DEEP_PROTECT", re.compile(r"PROTECT\s*IMPACT", re.I)),
]

def brand_key(org, event_name):
    if org == "DEEP":
        for key, rx in DEEP_BRAND_PATTERNS:
            if rx.search(event_name):
                return key
        return "DEEP_OTHER"
    return org  # RIZIN/PANCRASEは単一ブランド扱い

brand_earliest = collections.defaultdict(lambda: None)
for org, events in org_events.items():
    for ev in events:
        d = ev["date"]
        if not d:
            continue  # 日付未確定のイベント(null/空)は最古日付の判定対象外
        key = (org, brand_key(org, ev["eventName"]))
        if brand_earliest[key] is None or d < brand_earliest[key]:
            brand_earliest[key] = d

def structural_check(row):
    org = row["org"]
    key = (org, brand_key(org, row["event"]))
    earliest = brand_earliest.get(key)
    if earliest is None:
        # そのブランドが団体データに1件も存在しない = 完全な範囲外(構造的不足の一種)
        return "brand_absent"
    if row["date"] < earliest:
        return f"before_brand_earliest({earliest})"
    return None

# ---------------------------------------------------------------------------
# 分類本体
# ---------------------------------------------------------------------------
misattr_hits = {id(r) for r, _ in misattribution_candidates(residual)}
misattr_detail = {id(r): reason for r, reason in misattribution_candidates(residual)}

classified = {"団体誤判定": [], "日付誤り疑い": [], "構造的カバレッジ不足": [], "未解決": []}

for r in residual:
    if id(r) in misattr_hits:
        r["_detail"] = misattr_detail[id(r)]
        classified["団体誤判定"].append(r)
        continue
    key = (r["slug"], r["date"], r["opponent"])
    if key in CONFIRMED_DATE_ERROR_FIXED:
        r["_detail"] = f"確定・修正済み(recordOverrides.ts patch-date, correctedDate={CONFIRMED_DATE_ERROR_FIXED[key]})"
        classified["日付誤り疑い"].append(r)
        continue
    de = date_error_check(r)
    if de:
        # 番号一致は見つかったが、DEEP公式サイトでbout単位まで確認できなかった
        # (=CONFIRMED_DATE_ERROR_FIXEDに無い)ため、未解決として個別確認が必要。
        r["_detail"] = f"番号一致候補あり未確定(found_date={de[0]}, found_event={de[1]})。DEEP公式サイトで該当boutを確認できず修正見送り"
        classified["未解決"].append(r)
        continue
    sc = structural_check(r)
    if sc:
        r["_detail"] = sc
        classified["構造的カバレッジ不足"].append(r)
        continue
    r["_detail"] = ""
    classified["未解決"].append(r)

print("=== 分類件数(残件113件の内訳) ===")
total = 0
for k, v in classified.items():
    print(f"{k}: {len(v)}件")
    total += len(v)
print("合計:", total)

print("\n=== 団体別内訳 ===")
for k, v in classified.items():
    print(k, dict(collections.Counter(r["org"] for r in v)))

# CSV出力
fieldnames = ["slug", "name", "history_index", "date", "event", "opponent", "result", "org", "events_on_that_date", "_detail"]
for k, v in classified.items():
    fname_safe = {"団体誤判定": "org-misattribution", "日付誤り疑い": "date-error", "構造的カバレッジ不足": "structural-gap", "未解決": "unresolved"}[k]
    with open(f"{SCRATCH}/c-type-residual-{fname_safe}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in v:
            w.writerow({fn: row.get(fn, "") for fn in fieldnames})

print("\ndone (out/c-type-residual-{org-misattribution,date-error,structural-gap,unresolved}.csv)")
