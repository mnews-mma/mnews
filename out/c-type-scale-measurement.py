# 指示書「C型288件の規模測定」用スクリプト。
#
# out/fighter-records-abc-audit.py (PR #349, 指示書R-5) が生成する C型(大会名・
# 日付が4団体データのどの大会とも一致しない)行を入力に取り、対戦相手名で
# クロス突合することで表記ゆれ由来の誤検知を落とす。先行調査(36件中22件が
# 誤検知)が使った手法をそのまま踏襲: 大会名の一致ではなく、その団体の全大会
# (日付を問わず)を対戦相手名で総なめし、一致するboutが見つかれば「事実は
# 存在する試合、大会名の表記ゆれ(または日付誤り)による誤検知」として除外する。
#
# 対象は DEEP・パンクラス・RIZIN のみ(修斗は指示書②-c/R-6〜R-8の修斗プロフィール
# 経路で別対応済みのため対象外)。
#
# 実行方法: `python3 out/c-type-scale-measurement.py`
# 前提: out/fighter-records-abc-audit.py を直前に実行し、
#       out/fighter-records-abc-audit-c-type.csv が最新化されていること。
import csv, json, os, re, collections

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRATCH = os.path.dirname(os.path.abspath(__file__))

TARGET_ORGS = {"DEEP", "PANCRASE", "RIZIN"}  # 修斗は別トラックで対応済みのため除外

org_files = {
    "RIZIN": "rizinRecords.json",
    "PANCRASE": "pancraseRecords.json",
    "DEEP": "deepRecords.json",
}
org_events = {org: json.load(open(f"{BASE}/data/{fname}")) for org, fname in org_files.items()}

# 団体ごとの全bout(日付を問わない)フラットリスト。相手名クロス突合はここを総なめする。
org_all_bouts = collections.defaultdict(list)
for org, events in org_events.items():
    for ev in events:
        for b in ev["bouts"]:
            org_all_bouts[org].append((ev, b))


def norm_name(s):
    if not s:
        return ""
    s = s.strip()
    s = re.sub(r"[\s　]+", "", s)
    s = re.sub(r"[・･]", "", s)
    return s


def names_match(a, b):
    a, b = norm_name(a), norm_name(b)
    if not a or not b:
        return False
    return a == b


fighter_records = json.load(open(f"{BASE}/data/fighterRecords.json"))
fighters_meta = json.load(open(f"{SCRATCH}/fighter-records-abc-audit-fighters.json"))
slug_to_name = {f["slug"]: f.get("nameJa", "") for f in fighters_meta}
slug_to_aliases = {f["slug"]: f.get("aliases", []) for f in fighters_meta}


def name_candidates_for(slug):
    fighter_name = slug_to_name.get(slug, "")
    aliases = slug_to_aliases.get(slug, [])
    return [n for n in ([fighter_name] + aliases) if n]

# 相手名クロス突合の実行中に発見した、選手「本人」側の異体字ゆれ(相手名ではなく
# 自分の名前の表記が団体データとfighters.tsで食い違うケース)。事後的に判明した
# ものをここに追加していく。normalize後の完全一致では拾えないため個別に列挙する。
# 例: kozaki-ren の fighters.ts側 nameJa は「小崎連」だが、deepRecords.jsonの
# 該当boutは「小崎蓮」表記(連/蓮、読みは同じ「こざきれん」)。
KNOWN_NAME_VARIANTS = {
    "kozaki-ren": ["小崎蓮"],
}


c_rows = list(csv.DictReader(open(f"{SCRATCH}/fighter-records-abc-audit-c-type.csv")))
target_rows = [r for r in c_rows if r["org"] in TARGET_ORGS]

resolved = []   # 対戦相手名クロス突合で実在boutが見つかった = 誤検知(表記ゆれ/日付誤り由来)
residual = []   # 見つからなかった = 大会自体の欠落 or 1行目側の誤りの疑い(未分離)

for r in target_rows:
    slug = r["slug"]
    org = r["org"]
    opponent = r["opponent"]
    date = r["date"]
    name_candidates = name_candidates_for(slug) + KNOWN_NAME_VARIANTS.get(slug, [])

    found = None
    for ev, b in org_all_bouts[org]:
        aSlug, bSlug = b.get("fighterASlug"), b.get("fighterBSlug")
        aN, bN = b.get("fighterAName", ""), b.get("fighterBName", "")
        is_a = bool(slug) and aSlug == slug
        is_b = bool(slug) and bSlug == slug
        if not (is_a or is_b):
            is_a = any(names_match(aN, nc) for nc in name_candidates)
            is_b = any(names_match(bN, nc) for nc in name_candidates)
        if not (is_a or is_b):
            continue
        opp_in_bout = bN if is_a else aN
        if names_match(opp_in_bout, opponent):
            found = (ev, b)
            break

    if found:
        ev, b = found
        resolved.append({
            **r,
            "found_event": ev["eventName"],
            "found_date": ev["date"],
            "date_matches": "yes" if ev["date"] == date else "no(日付誤りの疑い)",
        })
    else:
        residual.append(r)

print(f"対象(DEEP/PANCRASE/RIZIN) C型: {len(target_rows)}件")
print(f"  相手名クロス突合で実在bout発見(誤検知): {len(resolved)}件")
print(f"  残件(大会自体が見つからない): {len(residual)}件")

# 団体別・年別の残件集計
def year_of(date_str):
    m = re.match(r"(\d{4})", date_str or "")
    return m.group(1) if m else "unknown"

table = collections.defaultdict(int)
for r in residual:
    table[(r["org"], year_of(r["date"]))] += 1

print("\n団体別・年別 残件数:")
orgs_sorted = sorted({k[0] for k in table})
years_sorted = sorted({k[1] for k in table})
for org in orgs_sorted:
    for year in years_sorted:
        n = table.get((org, year), 0)
        if n:
            print(f"  {org} {year}: {n}件")

# CSV出力
def write_csv(name, rows, fieldnames):
    with open(f"{SCRATCH}/{name}", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fieldnames})

write_csv(
    "c-type-scale-measurement-resolved.csv", resolved,
    ["slug", "name", "history_index", "date", "event", "opponent", "result", "org",
     "events_on_that_date", "found_event", "found_date", "date_matches"],
)
write_csv(
    "c-type-scale-measurement-residual.csv", residual,
    ["slug", "name", "history_index", "date", "event", "opponent", "result", "org", "events_on_that_date"],
)
print("\ndone (out/c-type-scale-measurement-{resolved,residual}.csv)")
