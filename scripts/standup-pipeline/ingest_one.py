# -*- coding: utf-8 -*-
import re,html,unicodedata,collections,datetime

U = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

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
