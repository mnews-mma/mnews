# data/fighterRecords.json(Wikipedia由来「1行目」戦績)を、data/配下の4団体
# 構造化データ(RIZIN・修斗・パンクラス・DEEP)と突合し、
#   A型: history配列の内訳とwins/losses/draws集計値の不一致
#   B型: 1行目の勝敗が4団体データと逆(または4団体側はdraw)
#   C型: 1行目の大会名・日付が4団体データのどの大会とも一致しない
# の3分類で悉皆列挙する(指示書R-5、2026-08-02)。read-only(このスクリプト自体は
# data/を一切書き換えない。集計結果は同ディレクトリのCSV3枚に出力する)。
#
# 実行方法: リポジトリルートで `python3 out/fighter-records-abc-audit.py`
# (標準ライブラリのみ使用。事前にNode.jsでsrc/lib/fighters.tsのFIGHTERS配列を
# JSON化しておく必要がある。未生成の場合は下記のNode一発コマンドを先に実行:
#   node -e '
#   const fs = require("fs");
#   const src = fs.readFileSync("src/lib/fighters.ts", "utf8");
#   const startMarker = "export const FIGHTERS: Fighter[] = [";
#   const start = src.indexOf(startMarker);
#   const arrStart = start + startMarker.length - 1;
#   let depth = 0, i = arrStart, end = -1;
#   for (; i < src.length; i++) {
#     const c = src[i];
#     if (c === "[") depth++;
#     else if (c === "]") { depth--; if (depth === 0) { end = i; break; } }
#   }
#   const arr = eval(src.slice(arrStart, end + 1));
#   fs.writeFileSync("out/fighter-records-abc-audit-fighters.json", JSON.stringify(arr));
#   '
# 大会名の突合はdate一致を軸に、装飾記号除去・presents系スポンサー接頭辞除去・
# 修斗⇔SHOOTO/パンクラス⇔PANCRASE等の表記ゆれ吸収・最長共通部分文字列フォール
# バックを組み合わせた近似マッチ。手法の限界(古い年代のSHOOTO/DEEPは4団体データ
# 側のカバレッジ不足が多く、C型の一部は真の誤りと取得漏れが機械的に区別できない)
# は out/fighter-records-abc-audit.md に記載。
import json, os, re, csv
from collections import defaultdict

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRATCH = os.path.dirname(os.path.abspath(__file__))
FIGHTERS_JSON = os.path.join(SCRATCH, "fighter-records-abc-audit-fighters.json")
if not os.path.exists(FIGHTERS_JSON):
    raise SystemExit(
        f"{FIGHTERS_JSON} が見つかりません。ファイル冒頭のコメントにあるNode一発\n"
        "コマンドを先にリポジトリルートで実行してFIGHTERS配列をJSON化してください。"
    )

fighter_records = json.load(open(f"{BASE}/data/fighterRecords.json"))
fighters_meta = json.load(open(FIGHTERS_JSON))

slug_to_name = {f["slug"]: f.get("nameJa", "") for f in fighters_meta}
slug_to_aliases = {f["slug"]: f.get("aliases", []) for f in fighters_meta}

org_files = {
    "RIZIN": "rizinRecords.json",
    "SHOOTO": "shootoRecords.json",
    "PANCRASE": "pancraseRecords.json",
    "DEEP": "deepRecords.json",
}
org_events = {org: json.load(open(f"{BASE}/data/{fname}")) for org, fname in org_files.items()}

org_date_index = defaultdict(lambda: defaultdict(list))
org_slug_index = defaultdict(lambda: defaultdict(list))
for org, events in org_events.items():
    for ev in events:
        org_date_index[org][ev["date"]].append(ev)
        for b in ev["bouts"]:
            for side_slug in (b.get("fighterASlug"), b.get("fighterBSlug")):
                if side_slug:
                    org_slug_index[org][side_slug].append((ev, b))

def infer_orgs(event_name):
    orgs = []
    up = event_name.upper()
    if "RIZIN" in up:
        orgs.append("RIZIN")
    if "修斗" in event_name or "SHOOTO" in up:
        orgs.append("SHOOTO")
    if "パンクラス" in event_name or "PANCRASE" in up:
        orgs.append("PANCRASE")
    if "DEEP" in up:
        orgs.append("DEEP")
    return orgs

BRACKETS = [("【","】"), ("(", ")"), ("（","）"), ("～","～"), ("~","~")]

def strip_brackets(s):
    for o, c in BRACKETS:
        while True:
            i = s.find(o)
            if i < 0:
                break
            j = s.find(c, i + len(o))
            if j < 0:
                break
            s = s[:i] + s[j + len(c):]
    return s

PLACE_EQUIV = [
    ("SAPPORO", "札幌"), ("OSAKA", "大阪"), ("NAGOYA", "名古屋"), ("TOKYO", "東京"),
    ("HAMAMATSU", "浜松"), ("YOKOHAMA", "横浜"), ("FUKUOKA", "福岡"), ("KOBE", "神戸"),
    ("SENDAI", "仙台"), ("HIROSHIMA", "広島"), ("NIIGATA", "新潟"), ("OKINAWA", "沖縄"),
    ("KYOTO", "京都"), ("SAITAMA", "埼玉"),
    # org/brand name translations: SHOOTO event names alternate between
    # native-Japanese and romanized forms across sources (Wikipedia vs
    # shooto-mma.com), so bridge the common ones or every such pair false-
    # positives as a "misattributed event".
    ("PROFESSIONAL", "プロフェッショナル"), ("SHOOTO", "修斗"), ("TORAO", "闘裸男"),
    ("SUMMER", "サマー"), ("FESTIVAL", "フェスティバル"), ("PANCRASE", "パンクラス"),
]

def apply_place_equiv(s):
    # unify romaji/kanji place names so e.g. "PANCRASE SAPPORO" and
    # "PANCRASE札幌大会" normalize to the same token
    for roman, kanji in PLACE_EQUIV:
        s = re.sub(roman, kanji, s, flags=re.I)
    return s

def core_normalize(s):
    s = strip_brackets(s)
    s = apply_place_equiv(s)
    s = s.upper()
    s = re.sub(r"[\s　.．・･/／,、\-－~～！!？?：:]", "", s)
    return s

def desponsor(s):
    # strip sponsor prefix ending in "presents" (case-insensitive), keep remainder
    m = list(re.finditer(r"presents", s, re.I))
    if m:
        last = m[-1]
        return s[last.end():]
    return s

def longest_common_substring_len(a, b):
    if not a or not b:
        return 0
    # simple DP; strings here are short (event names), fine performance-wise
    prev = [0] * (len(b) + 1)
    best = 0
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best = cur[j]
        prev = cur
    return best

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

def digit_boundary_ok(hay, needle, pos):
    """After matching `needle` inside `hay` at `pos`, ensure neither the char
    right before nor right after the match is a digit that would make this a
    partial-number collision (e.g. RIZIN5 matching inside RIZIN52)."""
    end = pos + len(needle)
    before_ok = pos == 0 or not hay[pos - 1].isdigit() or not needle[0].isdigit()
    after_ok = end == len(hay) or not hay[end].isdigit() or not needle[-1].isdigit()
    return before_ok and after_ok

def contains_safe(hay, needle):
    if not needle or not hay:
        return False
    start = 0
    while True:
        pos = hay.find(needle, start)
        if pos < 0:
            return False
        if digit_boundary_ok(hay, needle, pos):
            return True
        start = pos + 1

def event_name_matches(fr_event, org_event):
    fr_n = core_normalize(fr_event)
    org_n = core_normalize(org_event)
    org_desp_n = core_normalize(desponsor(org_event))
    if not fr_n or not org_n:
        return False
    if fr_n == org_n or fr_n == org_desp_n:
        return True
    MIN_LEN = 5
    if len(fr_n) >= MIN_LEN and contains_safe(org_n, fr_n):
        return True
    if len(org_desp_n) >= MIN_LEN and contains_safe(fr_n, org_desp_n):
        return True
    if len(fr_n) >= MIN_LEN and contains_safe(org_desp_n, fr_n):
        return True
    if len(org_n) >= MIN_LEN and contains_safe(fr_n, org_n):
        return True
    # fallback: longest common contiguous substring covers most of the
    # shorter string (handles inserted middle text like "...トーナメント...")
    shorter = min(len(fr_n), len(org_desp_n))
    if shorter >= 6:
        lcs = longest_common_substring_len(fr_n, org_desp_n)
        if lcs >= 6 and lcs / shorter >= 0.5:
            return True
    return False

a_type, b_type, c_type, unverifiable = [], [], [], []
total_bc_checks = 0

for slug, rec in fighter_records.items():
    if rec.get("noRecordData"):
        continue
    history = rec.get("history", [])

    cnt = {"win": 0, "loss": 0, "draw": 0, "nc": 0}
    for h in history:
        r = h.get("result")
        if r in cnt:
            cnt[r] += 1
    top_wins, top_losses, top_draws = rec.get("wins", 0), rec.get("losses", 0), rec.get("draws", 0)
    if cnt["win"] != top_wins or cnt["loss"] != top_losses or cnt["draw"] != top_draws:
        a_type.append({
            "slug": slug, "name": slug_to_name.get(slug, ""),
            "top_wins": top_wins, "hist_wins": cnt["win"],
            "top_losses": top_losses, "hist_losses": cnt["loss"],
            "top_draws": top_draws, "hist_draws": cnt["draw"],
            "hist_nc": cnt["nc"], "history_len": len(history),
        })

    fighter_name = slug_to_name.get(slug, "")
    aliases = slug_to_aliases.get(slug, [])
    name_candidates = [n for n in ([fighter_name] + aliases) if n]

    for idx, h in enumerate(history):
        event_name = h.get("event", "")
        date = h.get("date", "")
        result = h.get("result")
        opponent = h.get("opponent", "")
        orgs = infer_orgs(event_name)
        if not orgs:
            continue

        for org in orgs:
            total_bc_checks += 1
            events_on_date = org_date_index[org].get(date, [])
            matched_events = [ev for ev in events_on_date if event_name_matches(event_name, ev["eventName"])]

            if not matched_events and len(events_on_date) == 1 and not re.search(r"\d", event_name):
                # fighterRecords sometimes writes a generic label with no
                # identifying number ("修斗", "プロフェッショナル修斗公式戦",
                # "PANCRASE SAPPORO") for an event whose real name/branding
                # differs textually. When there's exactly one org event that
                # day and the fighterRecords name carries no number that could
                # contradict it, treat it as the same event rather than a
                # false "misattribution" -- there's nothing specific to
                # contradict.
                matched_events = events_on_date

            if not matched_events:
                c_type.append({
                    "slug": slug, "name": slug_to_name.get(slug, ""),
                    "history_index": idx, "date": date, "event": event_name,
                    "opponent": opponent, "result": result, "org": org,
                    "events_on_that_date": "; ".join(ev["eventName"] for ev in events_on_date) or "(none)",
                })
                continue

            # event confirmed to exist; now collect ALL candidate bouts where
            # this fighter appears (a fighter can have >1 bout in one event,
            # e.g. same-night tournament rounds), then disambiguate by opponent.
            candidates = []
            for ev in matched_events:
                for b in ev["bouts"]:
                    aSlug, bSlug = b.get("fighterASlug"), b.get("fighterBSlug")
                    aN, bN = b.get("fighterAName", ""), b.get("fighterBName", "")
                    if slug and (aSlug == slug or bSlug == slug):
                        candidates.append((ev, b, aSlug == slug))
                        continue
                    is_a = any(names_match(aN, nc) for nc in name_candidates)
                    is_b = any(names_match(bN, nc) for nc in name_candidates)
                    if is_a or is_b:
                        candidates.append((ev, b, is_a))

            bout_found = None
            if len(candidates) == 1:
                bout_found = candidates[0]
            elif len(candidates) > 1:
                opp_matches = []
                for ev, b, is_a in candidates:
                    aN, bN = b.get("fighterAName", ""), b.get("fighterBName", "")
                    opp_in_bout = bN if is_a else aN
                    if names_match(opp_in_bout, opponent):
                        opp_matches.append((ev, b, is_a))
                if len(opp_matches) == 1:
                    bout_found = opp_matches[0]
                # if 0 or >1 opponent-disambiguated matches, leave bout_found
                # as None (ambiguous) rather than guessing wrong

            if not bout_found:
                unverifiable.append({
                    "slug": slug, "name": slug_to_name.get(slug, ""),
                    "history_index": idx, "date": date, "event": event_name,
                    "opponent": opponent, "result": result, "org": org,
                    "matched_event": matched_events[0]["eventName"],
                    "reason": "ambiguous_multiple_bouts" if len(candidates) > 1 else "no_candidate",
                })
                continue

            ev, b, is_a = bout_found
            aN, bN = b.get("fighterAName", ""), b.get("fighterBName", "")
            winner_name, winner_slug, result_type = b.get("winnerName"), b.get("winnerSlug"), b.get("resultType")
            my_name_in_bout = aN if is_a else bN
            opp_name_in_bout = bN if is_a else aN

            # Even in the single-candidate case, require the opponent name to
            # actually match (guards against tournament nights where a fighter
            # has 2 bouts but org data only scraped one of them, e.g. semifinal
            # captured but the final is missing -- picking that lone bout as
            # "the match" would compare against the wrong opponent entirely).
            if not names_match(opp_name_in_bout, opponent):
                unverifiable.append({
                    "slug": slug, "name": slug_to_name.get(slug, ""),
                    "history_index": idx, "date": date, "event": event_name,
                    "opponent": opponent, "result": result, "org": org,
                    "matched_event": ev["eventName"],
                    "reason": f"opponent_name_mismatch(org_bout_opponent={opp_name_in_bout})",
                })
                continue

            if result_type == "decisive":
                if winner_slug:
                    won = winner_slug == slug
                else:
                    won = names_match(winner_name, my_name_in_bout)
                expected = "win" if won else "loss"
                if result in ("win", "loss") and result != expected:
                    b_type.append({
                        "slug": slug, "name": slug_to_name.get(slug, ""),
                        "history_index": idx, "date": date, "event": event_name,
                        "opponent": opponent, "result": result, "org": org,
                        "event_matched": ev["eventName"], "opp_in_org": opp_name_in_bout,
                        "winner_in_org": winner_name, "expected_result": expected,
                    })
            elif result_type == "draw":
                if result != "draw":
                    b_type.append({
                        "slug": slug, "name": slug_to_name.get(slug, ""),
                        "history_index": idx, "date": date, "event": event_name,
                        "opponent": opponent, "result": result, "org": org,
                        "event_matched": ev["eventName"], "opp_in_org": opp_name_in_bout,
                        "winner_in_org": "draw(引き分け)", "expected_result": "draw",
                    })

print("A type (tally mismatch):", len(a_type))
print("B type (reversed win/loss):", len(b_type))
print("C type (event/date mismatch):", len(c_type))
print("unverifiable (event matched, bout not listed in org data):", len(unverifiable))
print("total bout-org checks:", total_bc_checks)

def write_csv(name, rows, fieldnames):
    with open(f"{SCRATCH}/{name}", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

write_csv("fighter-records-abc-audit-a-type.csv", a_type, ["slug","name","top_wins","hist_wins","top_losses","hist_losses","top_draws","hist_draws","hist_nc","history_len"])
write_csv("fighter-records-abc-audit-b-type.csv", b_type, ["slug","name","history_index","date","event","opponent","result","org","event_matched","opp_in_org","winner_in_org","expected_result"])
write_csv("fighter-records-abc-audit-c-type.csv", c_type, ["slug","name","history_index","date","event","opponent","result","org","events_on_that_date"])
write_csv("fighter-records-abc-audit-unverifiable.csv", unverifiable, ["slug","name","history_index","date","event","opponent","result","org","matched_event","reason"])
print("done (CSVs written to out/)")
