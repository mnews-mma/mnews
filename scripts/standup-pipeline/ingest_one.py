# -*- coding: utf-8 -*-
import re,html,unicodedata,collections,datetime

U = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

def parse_page(path, fighter_name_hint=None):
    h = open(path, encoding='utf-8', errors='replace').read()
    slug = path.split('/')[-1][:-5]
    nm = re.search(r'<h1[^>]*>(.*?)</h1>', h, re.S)
    fname = U(nm.group(1)) if nm else (fighter_name_hint or slug)
    out = []
    rows = re.findall(r'(?s)<tr class="is-data-row">(.*?)</tr>', h)
    for i, row in enumerate(rows):
        sport = re.search(r'<td class="sport[^"]*">\s*([A-Za-z ]+?)\s*</td>', row)
        sport = sport.group(1).strip() if sport else None
        if sport != 'Kickboxing':
            continue  # ONE内でのMMA/Muay Thai/Submission Grappling等は対象外(推測で混ぜない)
        result = re.search(r'<div class="is-distinct is-(positive|negative|neutral)">([A-Z]+)</div>', row)
        rtag, rlabel = (result.group(1), result.group(2)) if result else (None, None)
        RESULT = {'positive': 'win', 'negative': 'loss', 'neutral': 'draw'}
        if rlabel == 'NC' or (rlabel and 'NO CONTEST' in rlabel):
            result_val = 'no_contest'
        else:
            result_val = RESULT.get(rtag, 'unknown')
        meth = re.search(r'<td class="method[^"]*">\s*([^<]+?)\s*(?:<div|</td>)', row)
        method_raw = U(meth.group(1)) if meth else ''
        rnd = re.search(r'<td class="round[^"]*">\s*([^<]+?)\s*</td>', row)
        round_raw = U(rnd.group(1)) if rnd else ''
        rm = re.search(r'R(\d+)', round_raw)
        round_num = int(rm.group(1)) if rm else None

        opp = re.search(r'(?s)<td class="opponent">.*?href="(https://www\.onefc\.com/athletes/([a-z0-9-]+)/)".*?<h5[^>]*>\s*([^<]+?)\s*</h5>', row)
        opp_url, opp_slug, opp_name = (opp.group(1), opp.group(2), U(opp.group(3))) if opp else (None, None, None)
        country = re.search(r'<div class="opponent-country[^"]*">([^<]*)</div>', row)
        opp_country = U(country.group(1)) if country else None

        ev = re.search(r'(?s)<td class="event[^"]*">.*?href="(https://www\.onefc\.com/events/[a-z0-9-]+/)".*?<h5[^>]*>\s*([^<]+?)\s*</h5>.*?data-timestamp="(\d+)"', row)
        if not ev:
            ev = re.search(r'(?s)opponent-event-and-date.*?href="(https://www\.onefc\.com/events/[a-z0-9-]+/)".*?<h5[^>]*>\s*([^<]+?)\s*</h5>.*?data-timestamp="(\d+)"', row)
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
            pair_key=None, source_url=f'https://www.onefc.com/athletes/{slug}/',
        ))
    return out
