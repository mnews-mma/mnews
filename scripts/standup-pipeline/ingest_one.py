# -*- coding: utf-8 -*-
import json,re,html,unicodedata,collections,datetime

U = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

# build-kick-data.tsのstripQuotedNickname()と同じ引用符ペア。ONE公式の<h1>には
# 「安保"Demolition Man"瑠輝也」のようにニックネームが引用符付きで入ることがあり、
# 既存bouts_one.json(手動パッチ分)はいずれもニックネーム無しの表記のため、表記を揃える
# (元はfetch_one_manifest_pages.pyにあったロジック、2026-08-22にbuild()新設に伴い移設)。
QUOTE_PAIRS = [("“", "”"), ('"', '"'), ("'", "'"), ("‘", "’")]


def strip_quoted_nickname(s):
    for open_q, close_q in QUOTE_PAIRS:
        oi = s.find(open_q)
        if oi == -1:
            continue
        ci = s.find(close_q, oi + len(open_q))
        if ci == -1:
            continue
        return s[:oi] + s[ci + len(close_q):]
    return s

def parse_page(path, fighter_name_hint=None):
    h = open(path, encoding='utf-8', errors='replace').read()
    slug = path.split('/')[-1][:-5]
    return parse_html(h, slug, fighter_name_hint)


def parse_html(h, slug, fighter_name_hint=None):
    # PR#580: fetch_one_manifest_pages.py が取得済みHTML文字列を直接渡すための経路
    # (parse_pageはファイルパス前提だが、manifestドライバはネットワーク取得したHTMLを
    # そのまま解析したいため分離した)。ロジック本体は元のparse_pageと同一。
    nm = re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S)
    fname = U(nm.group(1)) if nm else (fighter_name_hint or slug)
    out = []
    rows = re.findall(r'(?s)<tr class="is-data-row">(.*?)</tr>', h)
    for i, row in enumerate(rows):
        # PR-16: 日本語ロケール(/jp/athletes/)は対戦相手名がカタカナ表記で取得できる
        # (英語版は英語表記のみで、Wikipedia側のカタカナ表記との名寄せが効かなかった=
        # 相手名解決率2.2%の原因)。sport列も「Kickboxing」ではなく「キックボクシング」に
        # なるため、英語・日本語どちらの値でも判定できるようにする。
        sport = re.search(r'<td class="sport[^"]*">\s*([^<]+?)\s*</td>', row)
        sport = sport.group(1).strip() if sport else None
        if sport not in ('Kickboxing', 'Muay Thai', 'キックボクシング', 'ムエタイ'):
            continue  # PR-15: 立ち技(キックボクシング/ムエタイ)のみ対象。ONE内でのMMA/Submission Grappling等は対象外(推測で混ぜない)
        result = re.search(r'<div class="is-distinct is-(positive|negative|neutral)">([A-Z]+)</div>', row)
        RESULT = {'positive': 'win', 'negative': 'loss', 'neutral': 'draw'}
        if result:
            rtag, rlabel = result.group(1), result.group(2)
            if rlabel == 'NC' or 'NO CONTEST' in rlabel:
                result_val = 'no_contest'
            else:
                result_val = RESULT.get(rtag, 'unknown')
        else:
            # PR#584(⑩監査で発見): is-positive/negative/neutral以外に、英語の大文字
            # ラベルを持たない is-muted バリエーションがある(実例2件確認: デニス・
            # ピューリック×エリアス・マムーディ戦、ジョルジオ・ペトロシアン戦、いずれも
            # 中身が「ノーコンテスト」)。推測で決め打ちせず、実際のテキストを見て
            # 「ノーコンテスト」の場合のみno_contestとする。それ以外は従来通りunknownに
            # 落とす(未知のバリエーションを勝手にno_contest扱いしない)。
            muted = re.search(r'(?s)<div class="is-distinct is-muted[^"]*">(.*?)</div>', row)
            muted_text = U(muted.group(1)) if muted else ''
            rtag = None
            if 'ノーコンテスト' in muted_text or 'NO CONTEST' in muted_text.upper():
                rlabel = 'NC'
                result_val = 'no_contest'
            else:
                rlabel = None
                result_val = 'unknown'
        meth = re.search(r'<td class="method[^"]*">\s*([^<]+?)\s*(?:<div|</td>)', row)
        method_raw = U(meth.group(1)) if meth else ''
        rnd = re.search(r'<td class="round[^"]*">\s*([^<]+?)\s*</td>', row)
        round_raw = U(rnd.group(1)) if rnd else ''
        rm = re.search(r'R(\d+)', round_raw)
        round_num = int(rm.group(1)) if rm else None

        opp = re.search(r'(?s)<td class="opponent">.*?href="(https://www\.onefc\.com/(?:jp/)?athletes/([a-z0-9-]+)/)".*?<h5[^>]*>\s*([^<]+?)\s*</h5>', row)
        opp_url, opp_slug, opp_name = (opp.group(1), opp.group(2), U(opp.group(3))) if opp else (None, None, None)
        country = re.search(r'<div class="opponent-country[^"]*">([^<]*)</div>', row)
        opp_country = U(country.group(1)) if country else None

        ev = re.search(r'(?s)<td class="event[^"]*">.*?href="(https://www\.onefc\.com/(?:jp/)?events/[a-z0-9-]+/)".*?<h5[^>]*>\s*([^<]+?)\s*</h5>.*?data-timestamp="(\d+)"', row)
        if not ev:
            ev = re.search(r'(?s)opponent-event-and-date.*?href="(https://www\.onefc\.com/(?:jp/)?events/[a-z0-9-]+/)".*?<h5[^>]*>\s*([^<]+?)\s*</h5>.*?data-timestamp="(\d+)"', row)
        if ev:
            event_url, event_name, ts = ev.group(1), U(ev.group(2)), int(ev.group(3))
            date = datetime.datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d')
        else:
            event_url = event_name = date = None

        out.append(dict(
            bout_id=f'one:{slug}:{i}', date=date, event=event_name, venue=None,
            fighter_slug=slug, fighter_name=fname,
            opponent_raw=opp_name or '', opponent_name=opp_name or '',
            opponent_affiliation=opp_country, opponent_site_slug=opp_slug,
            opponent_ref=None, opponent_ref_gym=None, opponent_resolved=False,
            opponent_ambiguous=False, opponent_candidates=None,
            result=result_val, result_mark=f'one:{rlabel}', method=None, method_raw=method_raw,
            round=round_num, is_extension=False, ruleset=None, note=None, is_debut=False,
            title_type=None,  # ONE: event名(event_name)にタイトル語彙の記載なし(実測確認済み)
            pair_key=None, source_url=f'https://www.onefc.com/jp/athletes/{slug}/',
        ))
    return out


def build():
    """2026-08-22追加: 週次自動更新ジョブ(build.py)のFORMERLY_STANDALONE_ORGSと同じ
       呼び出し規約((bouts, stats)を返す)に合わせたドライバ。fetch_one.pyが取得した
       raw/one_manifest/*.htmlを、one_official_manifest.json(固定116人、このジョブは
       一切拡張しない)の登録順に読んで解析する。

       existingのbouts_one.json全112人分のfighter_slugは実測でmanifest全116人の
       identityの部分集合であり(2026-08-22確認、manifest外の手動パッチ行は無い)、
       他12ソースと同じ「raw/から毎回フルに作り直す」方式で安全に扱える。

       manifest登録済みだがraw/にファイルが無い(=fetch_one.pyがそのslugの取得に
       失敗した)場合は、そのbout行はこの回だけ0件になる。個別選手単位の取得失敗を
       検知する仕組みはcheck-kick-one-manifest-coverage.tsの検査A(zeroOfficialCount、
       ratchet)が既に持っているため、ここでは無理に前回値を引き継がず、失敗を
       正直に反映する(全体急減はpromote_to_data_kick.pyの回帰ガード、個別選手の
       消失はcheck-kick-one-manifest-coverage.tsが別々に検知する)。"""
    manifest = json.load(open('one_official_manifest.json', encoding='utf-8'))
    bouts = []
    n_fetched = 0
    n_missing = 0
    for m in manifest:
        slug = m['one_slug']
        path = f'raw/one_manifest/{slug}.html'
        try:
            with open(path, encoding='utf-8') as f:
                h = f.read()
        except FileNotFoundError:
            n_missing += 1
            continue
        n_fetched += 1
        for b in parse_html(h, slug):
            # ingest_one.pyのparse_html()はfighter_slugにURLのslug(例: "hiromi-wajima")を
            # 入れるが、build-kick-data.tsのmatchBy:"identity"はfighter_slugに
            # `${name}|${gym}|${sources[0]}` 形式の識別子を要求する(既存bouts_one.jsonの
            # 全行がこの形式で登録されているのと同じ規約)。
            b['fighter_slug'] = m['fighter_identity']
            b['fighter_name'] = strip_quoted_nickname(b['fighter_name'])
            bouts.append(b)
    stats = dict(manifest_count=len(manifest), fetched=n_fetched, missing=n_missing)
    return bouts, stats
