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
    # PR-16: 旧regex(\bONE\b.*(Champ|FC)|ONE\d)は"ONE Friday Fights N"・"ONE SAMURAI N"・
    # "ONE N: 副題"等、2023年以降ONEが多用する「Championship」を省いた大会名表記に
    # 一致せず、これらがWikipedia(その他団体)に誤分類されてbouts_one.json(PR-15で取得済み)
    # との重複排除が効かなくなっていた(与座優貴で実測: 二重計上の原因)。
    # 大文字「ONE」が文頭にある場合のみ一致させる(大文字小文字を区別しない\bONE\bだと
    # "One Night in Bangkok"のような無関係な大会名も拾ってしまうため、大文字限定+文頭固定で
    # 実測59件中誤検知0件を確認)。
    ("ONE Championship", re.compile(r"\bONE\b.*(Champ|FC)|ONE\d|^ONE\b")),
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
# PR-16: build-kick-data.ts の boutFiles[].matchBy と同じ区分。sourceUrl系4団体は
# bout行のsource_urlがそのままfighters.jsonのsources[]に載っている前提が成り立つが、
# identity系11団体はbout行のfighter_slugが既にidentity(name|gym|sources[0])形式で
# 格納されており、source_urlは単なる出典記事URL(sources[]には無いことが多い)。
# 旧実装はこの区別をせず全団体をsource_url経由でfighters.jsonに逆引きしていたため、
# identity系11団体のbout行がperson_org_dated等のインデックスに一切乗らず、
# Wikipedia側の重複判定が機能していなかった(ONE Championshipで実測: 二重計上の原因)。
MATCH_BY = {
    "K-1": "sourceUrl", "RISE": "sourceUrl", "SHOOT BOXING": "sourceUrl", "KNOCK OUT": "sourceUrl",
    "RIZIN": "identity", "ONE Championship": "identity", "DEEP☆KICK": "identity", "NJKF": "identity",
    "HoostCup": "identity", "NKB": "identity", "Bigbang": "identity", "Stand up": "identity",
    "KROSS×OVER": "identity", "SNKA": "identity", "JKA": "identity",
}
ORG_TAG = {
    "K-1": "k1", "RISE": "rise", "SHOOT BOXING": "sb", "KNOCK OUT": "knockout", "RIZIN": "rizin",
    "ONE Championship": "one", "DEEP☆KICK": "deepkick", "NJKF": "njkf", "HoostCup": "hoostcup",
    "NKB": "nkb", "Bigbang": "bigbang", "Stand up": "standup", "KROSS×OVER": "krossover",
    "SNKA": "snka", "JKA": "jka",
}
MARK2RESULT = {"○": "win", "〇": "win", "◎": "win", "×": "loss", "△": "draw"}

# PR-14: 旧FIGHT_CONT_RE(非貪欲マッチで最初の"}}"を閉じタグとみなす)は、対戦相手欄に
# {{仮リンク|名前|en|英語名}}のようなネストしたテンプレートがあると、そのテンプレート自身の
# 閉じ"}}"で打ち切られ、決着・大会名・日付が丸ごと空になっていた(別セッションの計測、
# out/kana-leg4-report.md: 修正前15,058行中594行が空、修正後81行に減少)。
# ネストしたテンプレートの深さを数える方式に置き換える(find_fight_cont_blocks)。
FIGHT_CONT_START_RE = re.compile(r"\{\{Fight-cont\s*\|")
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
# {{仮リンク|...}}・{{flagicon|...}}等、[[wikilink]]以外のネストしたテンプレート全般。
# ネスト1段までを許容する(Fight-cont行内でさらにその中にテンプレートが入ることは無い前提)。
NESTED_TEMPLATE_RE = re.compile(r"\{\{([^{}|]+)((?:\|[^{}]*)*)\}\}")


def find_fight_cont_blocks(wikitext):
    """{{Fight-cont|...}}のネスト対応版抽出。開き"{{Fight-cont|"から対応する閉じ"}}"までを、
    途中に現れるネストしたテンプレート("{{"の深さ)を数えて正しく特定する。
    戻り値は(開始位置, 中身)のタプルのリスト(PR-15でセクション判定に開始位置を使うため)。"""
    blocks = []
    for m in FIGHT_CONT_START_RE.finditer(wikitext):
        depth = 1
        i = m.end()
        n = len(wikitext)
        while i < n and depth > 0:
            two = wikitext[i : i + 2]
            if two == "{{":
                depth += 1
                i += 2
            elif two == "}}":
                depth -= 1
                i += 2
            else:
                i += 1
        content_end = i - 2 if depth == 0 else i
        blocks.append((m.start(), wikitext[m.end() : content_end]))
    return blocks


# PR-15: Wikipedia記事は戦績を見出し単位で「キックボクシング/ムエタイ」「総合格闘技/
# ミックスルール」「ボクシング」「空手」「エキシビション」「アマチュア」に分けて記述している
# (実測: 安保瑠輝也・HIROYA・AZUMA・アンディ・フグ等で確認)。旧来の15団体フィルタ
# (大会名からguess_orgでヒットしなければ全て除外)は、この記事自身のセクション区分を
# 無視しており、GLORY・ラジャダムナン・EM Legend等、15団体に含まれない立ち技団体の
# 試合まで一律に除外していた。
#
# 判定はハイブリッド方式(どちらか一方だけでは取りこぼす実例を両方確認したため):
#   1. {{Kickboxing/Muay Thai/MMA/Boxing recordbox}}テンプレートが直近の見出し配下に
#      あれば、その種別で確定する(最優先)。チョ・ジョンファン・バス・ルッテン等、
#      「== 戦績 ==」直下にいきなり{{MMA recordbox}}が来て見出しテキスト自体には
#      MMAを示す語が一切無い記事があり、見出しテキストだけでは判定できなかった。
#   2. recordboxが無い区間は見出しテキストをMMA・ボクシング・空手・エキシビション・
#      アマチュアの否定パターンで判定する。「シュートボクシング」「散打」のような
#      正当な立ち技の見出しでも通算成績のrecordboxテンプレート自体が無い記事があり
#      (AZUMA記事で実測)、recordbox必須方式だと取りこぼしていた。
NON_KICKBOXING_HEADING_RE = re.compile(
    r"総合格闘技|ミックスルール|MMA|プロレス|空手|異種格闘技|ラウェイ|エキシビション|エキシビジョン|アマチュア|"
    r"グラップリング|柔術|レスリング|サンボ|カスタムルール|"  # PR-16: MIKU(グラップリング)・スパイク・カーライル(カスタムルール=KNOCK OUT-UNLIMITED)で実測
    r"(?<!キック)ボクシング(?!グ)"  # 「キックボクシング」は除外しない。「ボクシング」単独(ボクシング戦績等)のみ除外
)
RECORDBOX_RE = re.compile(r"\{\{(Kickboxing recordbox|Muay Thai recordbox|MMA recordbox|Boxing recordbox)\b")
KICKBOXING_RECORDBOX_TYPES = {"Kickboxing recordbox", "Muay Thai recordbox"}
HEADING_RE = re.compile(r"^===?([^=\n]+)===?\s*$", re.M)


def tag_fight_cont_sections(wikitext):
    """各Fight-contブロックに、キックボクシング/ムエタイ系かどうかをタグ付けして返す。
    [(is_kickboxing, content), ...]"""
    events = []
    for pos, content in find_fight_cont_blocks(wikitext):
        events.append((pos, "cont", content))
    for m in HEADING_RE.finditer(wikitext):
        events.append((m.start(), "heading", m.group(1)))
    for m in RECORDBOX_RE.finditer(wikitext):
        events.append((m.start(), "recordbox", m.group(1)))
    events.sort(key=lambda x: x[0])
    heading_excluded = False
    recordbox_state = None  # None=未確定、True=キックボクシング系recordbox確定、False=MMA/ボクシング系recordbox確定
    tagged = []
    for _pos, kind, val in events:
        if kind == "heading":
            heading_excluded = bool(NON_KICKBOXING_HEADING_RE.search(val))
            recordbox_state = None
        elif kind == "recordbox":
            recordbox_state = val in KICKBOXING_RECORDBOX_TYPES
        else:
            is_kickboxing = recordbox_state if recordbox_state is not None else (not heading_excluded)
            tagged.append((is_kickboxing, val))
    return tagged


def protect_wikilinks(s):
    # [[wikilink]]を先に保護してから{{template}}を保護する(順序はどちらが先でも独立して
    # 動作するが、[[の中に{{が来るケースは無い一方、{{の引数に[[が来ることはあるため
    # 内側から処理されるこの順で問題ない)。
    s = WIKILINK_RE.sub(lambda mm: "\x00" + (mm.group(2) or mm.group(1)).replace("|", "\x01") + "\x00", s)
    # {{仮リンク|名前|en|英語名}}等のネストしたテンプレートも、内部の"|"がFight-cont行の
    # フィールド区切りと誤認されないよう保護する(表示名として使えそうな最初の引数を残す)。
    s = NESTED_TEMPLATE_RE.sub(lambda mm: "\x00" + mm.group(2).lstrip("|").split("|")[0].replace("|", "\x01") + "\x00", s)
    return s


def restore_wikilinks(s):
    return s.replace("\x00", "").replace("\x01", "|")


def parse_fight_rows(wikitext):
    rows = []
    for is_kickboxing, block in tag_fight_cont_sections(wikitext):
        if not is_kickboxing:
            # recordboxテンプレートまたは見出しテキストがMMA/ボクシング/空手/エキシビション/
            # アマチュアと判定された区間はここで構造的に除外する。旧15団体フィルタとは独立した判定。
            continue
        protected = protect_wikilinks(block)
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


# PR-15: 15団体に一致しなくても、著名な海外プロモーションは表示上の団体名として個別に
# 認識しておく(掲載団体タグとしての正式配線=PR-12は既存15団体のみ対象で本レグでは
# 拡張しない)。ここに無いものは一律OTHER_ORG_LABELにまとめる。
SECONDARY_ORG_PATTERNS = [
    ("GLORY", re.compile(r"\bGLORY\b", re.I)),
    ("ラジャダムナン", re.compile(r"ラジャダムナン|Rajadamnern", re.I)),
    ("ルンピニー", re.compile(r"ルンピニー|Lumpinee", re.I)),
    ("Thai Fight", re.compile(r"Thai ?Fight", re.I)),
    ("IT'S SHOWTIME", re.compile(r"IT'?S SHOWTIME", re.I)),
    ("武林風", re.compile(r"武林风|武風林|Wu ?Lin ?Feng", re.I)),
    ("EM Legend", re.compile(r"EM Legend", re.I)),
    ("WAKO SuperLeague", re.compile(r"WAKO|SuperLeague", re.I)),
    ("全日本キックボクシング連盟", re.compile(r"全日本キックボクシング連盟")),
    ("J-NETWORK", re.compile(r"J-NETWORK", re.I)),
]
OTHER_ORG_LABEL = "Wikipedia(その他団体)"


def guess_org_or_other(event_text):
    """15団体に一致しなくても、キックボクシング/ムエタイのセクション内の行である以上
    ここでは捨てない。著名な海外団体は個別ラベル、それ以外は共通ラベルにまとめて必ず
    何らかのtarget_orgを返す。"""
    org = guess_org(event_text)
    if org:
        return org
    for org, pat in SECONDARY_ORG_PATTERNS:
        if pat.search(event_text or ""):
            return org
    return OTHER_ORG_LABEL


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
    wikitexts = json.load(open("raw/wp_wikitext_v2.json"))

    def identity(f):
        return f"{f['name']}|{f['gym'] or ''}|{f['sources'][0] if f['sources'] else ''}"

    by_name = collections.defaultdict(list)
    for f in fighters:
        by_name[f["name"]].append(f)
    by_source_url = {}
    for f in fighters:
        for u in f["sources"]:
            by_source_url[u] = f
    known_identities = {identity(f): f for f in fighters}

    # 選手×団体 -> (date, norm_opp)集合(日付ありのみ)/ norm_opp集合(日付有無問わず、フォールバック用)
    person_org_dated = collections.defaultdict(lambda: collections.defaultdict(set))
    person_org_opp_all = collections.defaultdict(lambda: collections.defaultdict(list))  # org -> [(norm_opp, date)]
    person_org_has_page = collections.defaultdict(dict)
    # PR-16: 日付のみ一致(相手名は問わない)のフォールバック。ONE Championship等、
    # Wikipedia側は対戦相手をカタカナ表記、公式サイト側は英語表記のことがあり、
    # norm_opp()では一致しない(与座優貴で実測: 二重計上の原因)。同一選手・同一団体・
    # 同一日付の公式bout件数をここで数え、ちょうど1件のときのみ「同じ試合」とみなす
    # 安全弁とする(複数件ある日=ダブルヘッダーの可能性があるため、その場合は適用しない)。
    person_org_date_count = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    for org, fn in BOUT_FILES.items():
        rows = json.load(open(fn))
        for b in rows:
            if b["result"] == "scheduled":
                continue
            if MATCH_BY.get(org) == "identity":
                f = known_identities.get(b.get("fighter_slug"))
            else:
                f = by_source_url.get(b["source_url"])
            if not f:
                continue
            ident = identity(f)
            no = norm_opp(b["opponent_name"])
            person_org_opp_all[ident][org].append((no, b["date"]))
            if b["date"]:
                person_org_date_count[ident][org][b["date"]] += 1
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
            # parse_fight_rows は既にWikipedia記事自身のセクション区分(recordboxの種別)で
            # キックボクシング/ムエタイの表のみに絞り込み済み(PR-15)。ここでのorgは
            # 「既存の公式ソースと重複判定するための団体キー」の意味のみで、15団体に
            # 一致しなくても行を捨てない(旧: 15団体フィルタでここが範囲外扱いされていた)。
            stats["total_wiki_bouts"] += 1
            org = guess_org_or_other(fr["event"])
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
            # フォールバック2: 同一選手・同一団体・同一日付の公式boutがちょうど1件のときのみ
            # 「相手名の表記違い(カタカナ⇔英語表記等)による同一試合」とみなす(PR-16)。
            if fr["date"] and person_org_date_count[identity(rec)][org].get(fr["date"]) == 1:
                stats["dup_dateonly_match"] += 1
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
    _pop_size = len(json.load(open("coverage_population.json")))
    print("対象母集団:", _pop_size, "人 / wikitext取得成功:", _pop_size - stats["wikitext_missing"])
    print("名簿未一致(スキップ):", stats["no_roster_match"])
    print("Wikipedia側bout総数:", stats["total_wiki_bouts"])
    print("  範囲外(15団体以外):", stats["out_of_scope"])
    print("  相手名欠落でスキップ:", stats["skipped_no_opponent"])
    print("  既存(日付一致)で重複:", stats["dup_dated_match"])
    print("  既存(相手名フォールバック)で重複:", stats["dup_fallback_match"])
    print("  既存(同日付のみ、表記違い許容)で重複:", stats["dup_dateonly_match"])
    print("  複数候補で判定不能・保留:", stats["held_ambiguous"])
    print("  新規追加:", stats["new_added"])
    residual = (stats["total_wiki_bouts"] - stats["out_of_scope"] - stats["skipped_no_opponent"]
                - stats["dup_dated_match"] - stats["dup_fallback_match"] - stats["dup_dateonly_match"] - stats["held_ambiguous"]
                - stats["new_added"])
    print("残余(0であるべき):", residual)
    r = sum(1 for x in bouts if x["opponent_resolved"])
    print(f"opponent resolved: {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%" if bouts else "no bouts")
    print("result内訳:", dict(collections.Counter(x["result"] for x in bouts)))
    print("団体内訳:", dict(collections.Counter(x["target_org"] for x in bouts)))
