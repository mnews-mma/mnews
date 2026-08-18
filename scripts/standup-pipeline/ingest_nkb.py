# -*- coding: utf-8 -*-
"""NKB(日本キックボクシング連盟)のboutを抽出する。SCHEMA.mdに準拠。
   新サイト(nkb-r.com/main/、WordPress REST APIから2019〜2026年の90記事を取得、
   うちbox_t/box1_2/box3_2構造を持つ45記事が実際の試合結果)と、
   旧サイト(www.nkb-r.com、2012〜2018年、静的HTML35ページ)の両方を辿る。
   旧サイトは決着方法・ラウンドは見出しに書かれているが、勝敗を示すマーク等が無く
   (●は両者の名前に一つずつ付く単なる区切り記号で勝敗とは無関係と実測で確認)、
   推測で埋めないため旧サイト由来のboutは result='unknown' のまま収録する
   (method/roundは見出しのテキストから取得できるため、それはそのまま活かす)。"""
import re, glob, html, json, unicodedata, collections, sys

sys.path.insert(0, '.')
import bouts as _bouts

U = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

F = json.load(open('fighters.json'))


def nk(s):
    s = unicodedata.normalize('NFKC', s or '')
    for c in '“”"\'’‘`「」『』':
        s = s.replace(c, '')
    return re.sub(r'\s+', '', s).replace('・', '').replace('=', '').lower()


def gk(s):
    if not s:
        return None
    s = unicodedata.normalize('NFKC', s).lower()
    for c in '“”"\'’‘`':
        s = s.replace(c, '')
    s = re.sub(r'(ジム|gym|キックボクシング|kickboxing|道場|会館|塾|team|チーム|ボクシング)', '', s)
    return re.sub(r'[\s　／/・\-,、。.]', '', s) or None


GENERIC = {'フリー', '無所属', 'free', None}

byname = collections.defaultdict(list)
for r in F:
    for n in [r['name']] + r['aliases']:
        if r not in byname[nk(n)]:
            byname[nk(n)].append(r)


def resolve(name, aff):
    cands = byname.get(nk(name), [])
    if len(cands) == 0:
        return None, False, None
    if len(cands) == 1:
        return cands[0], False, None
    a = gk(aff)
    hit = []
    if a and aff not in GENERIC:
        hit = [r for r in cands if gk(r['gym']) and r['gym'] not in GENERIC
               and (gk(r['gym']) == a or a in gk(r['gym']) or gk(r['gym']) in a)]
    if len(hit) == 1:
        return hit[0], False, None
    return None, True, [{'name': r['name'], 'gym': r['gym'], 'orgs': r['orgs']} for r in cands]


MARK2RESULT = {'○': 'win', '◯': 'win', '〇': 'win', '×': 'loss', '△': 'draw'}
bout_seq = collections.Counter()


def emit(bouts, fighter_name_gym, opponent_name_gym, result, decision, source_url, date, event, venue, tag, label=None):
    my_name, my_gym = fighter_name_gym
    opp_name, opp_gym = opponent_name_gym
    rec, amb, cands = resolve(my_name, my_gym)
    if amb or not rec:
        return False
    if decision:
        meth, rnd, ext, rs = _bouts.parse_method(decision)
    else:
        meth, rnd, ext, rs = None, None, False, None
    oref, oamb, ocands = resolve(opp_name, opp_gym)
    ident = f"{rec['name']}|{rec['gym'] or ''}|{rec['sources'][0] if rec['sources'] else ''}"
    idx = bout_seq[ident]
    bout_seq[ident] += 1
    bouts.append(dict(
        bout_id=f'nkb:{ident}:{idx}',
        date=date, event=event, venue=venue,
        fighter_slug=ident, fighter_name=rec['name'],
        opponent_raw=f'{opp_name}（{opp_gym}）' if opp_gym else opp_name,
        opponent_name=opp_name, opponent_affiliation=opp_gym,
        opponent_site_slug=None,
        opponent_ref=oref['name'] if oref else None,
        opponent_ref_gym=oref['gym'] if oref else None,
        opponent_resolved=oref is not None,
        opponent_ambiguous=oamb, opponent_candidates=ocands,
        result=result, result_mark=tag, method=meth, method_raw=decision or '',
        round=rnd, is_extension=ext, ruleset=rs, note=None, is_debut=False,
        title_type=_bouts.classify_title_type(label),
        pair_key=None,
        source_url=source_url,
    ))
    return True


# ================= 新サイト(2019〜2026、WordPress REST API) =================

def parse_new_site(posts):
    bouts = []
    for p in posts:
        c = p['content']['rendered']
        if 'mainbox_2' not in c:
            continue
        url = p['link']
        date = p['date'][:10]
        event = re.sub(r'^\d{4}年\d{1,2}月\d{1,2}日[（(].[）)]\s*', '', U(p['title']['rendered'])) or U(p['title']['rendered'])
        venue = None
        vm = re.search(r'■場所[：:]\s*([^\s<]+(?:\s[^\s<]+)?)', c)
        if vm:
            venue = U(vm.group(1))
        blocks = re.findall(
            r'(?s)<div class="box_t">(.*?)</div>.*?<div class="box1_2">(.*?)</div>\s*'
            r'<div class="box3_2">(.*?)</div>\s*</div>\s*(?:<div class="box_r">(.*?)</div>)?', c)
        for header, box1, box3, decision_raw in blocks:
            decision = U(decision_raw)
            f1 = parse_new_side(box1, suffix_mark=True)
            f2 = parse_new_side(box3, suffix_mark=False)
            if not f1 or not f2:
                continue
            (n1, g1, m1), (n2, g2, m2) = f1, f2
            # ○/×/△のマークが無い(mymarkがNone)場合のフォールバック(2026-08実装):
            # 決着文言に「試合中止」があれば選手の欠場等でそもそも試合が成立しなかった
            # ケース(cancelled)、「エキシビションマッ(チ)」があればエキシビションへの
            # 変更等で公式な勝敗を付けない試合(no_contest)と判定できる(実例4件+1件、
            # いずれも決着文言に明記されておりマークが無いのは構造的にそのため)。
            # どちらにも該当しない場合は従来どおり推測せずunknownのまま残す。
            for (my, opp, mymark) in [((n1, g1), (n2, g2), m1), ((n2, g2), (n1, g1), m2)]:
                result = MARK2RESULT.get(mymark)
                if result is None:
                    if decision and '試合中止' in decision:
                        result = 'cancelled'
                    elif decision and 'エキシビションマッ' in decision:
                        result = 'no_contest'
                    else:
                        result = 'unknown'
                emit(bouts, my, opp, result, decision, url, date, event, venue, mymark, label=U(header))
    return bouts


def parse_new_side(box_html, suffix_mark):
    ps = re.findall(r'<p>(.*?)</p>', box_html, re.S)
    if not ps:
        return None
    lines = [U(x) for x in re.split(r'<br\s*/?>', ps[0]) if U(x)]
    if len(lines) < 2:
        return None
    name_line, gym_line = lines[-2], lines[-1]
    gym = re.sub(r'^[（(]|[）)]$', '', gym_line).strip() or None
    m = re.match(r'^([○◯〇×△])?(.*?)([○◯〇×△])?$', name_line)
    mark = m.group(1) or m.group(3)
    name = m.group(2).strip()
    return name, gym, mark


# ================= 旧サイト(2012〜2018、静的HTML) =================

def parse_old_site(path, eid):
    h = open(path, encoding='utf-8', errors='replace').read()
    bouts = []
    dm = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', U(h)[:300])
    if not dm:
        dm = re.match(r'^(\d{4})(\d{2})(\d{2})', eid)
        date = '%s-%s-%s' % dm.groups() if dm else None
    else:
        date = '%s-%02d-%02d' % (int(dm.group(1)), int(dm.group(2)), int(dm.group(3)))
    tm = re.search(r'<h4>(.*?)</h4>', h, re.S)
    event = U(tm.group(1)) if tm else eid
    event = re.sub(r'\s*\d{4}年\d{1,2}月\d{1,2}日[（(].[）)]\s*$', '', event).strip() or event
    vm = re.search(r'■場所[：:]\s*([^\s■<]+)', U(h))
    venue = vm.group(1).strip() if vm else None
    url = f'http://www.nkb-r.com/Fight/{eid[:4]}/{eid}.html'
    blocks = re.findall(
        r'(?s)<h6>(.*?)</h6>\s*<div id="box\d?_right">(.*?)</div>\s*<div id="box\d?_center"></div>\s*'
        r'<div id="box\d?_left">(.*?)</div>', h)
    for header, right, left, in blocks:
        header_txt = U(header)
        decision = None
        dm2 = re.search(r'[（(]([^）(]*(?:R|判定)[^）(]*)[）)]', header_txt)
        if dm2:
            decision = dm2.group(1).strip()
        r_lines = [U(x) for x in re.split(r'<br\s*/?>|</p>\s*<p>', right) if U(x)]
        l_lines = [U(x) for x in re.split(r'<br\s*/?>|</p>\s*<p>', left) if U(x)]
        r_lines = [re.sub(r'^<img[^>]*>', '', x).strip() for x in r_lines]
        r_lines = [x for x in r_lines if x]
        l_lines = [x for x in l_lines if x]
        if len(r_lines) < 2 or len(l_lines) < 2:
            continue
        n1_raw, g1_raw = r_lines[-2], r_lines[-1]
        n2_raw, g2_raw = l_lines[-2], l_lines[-1]
        n1 = re.sub(r'●', '', n1_raw).strip()
        n2 = re.sub(r'●', '', n2_raw).strip()
        g1 = re.sub(r'^[（(]|[）)]$', '', g1_raw).strip() or None
        g2 = re.sub(r'^[（(]|[）)]$', '', g2_raw).strip() or None
        if not n1 or not n2:
            continue
        for (my, opp) in [((n1, g1), (n2, g2)), ((n2, g2), (n1, g1))]:
            emit(bouts, my, opp, 'unknown', decision, url, date, event, venue, None, label=header_txt)
    return bouts


def build():
    all_bouts = []
    posts = json.load(open('raw/nkb_index/all_posts.json'))
    new_bouts = parse_new_site(posts)
    all_bouts += new_bouts
    old_files = sorted(glob.glob('raw/nkb_old_events/*.html'))
    old_bouts_total = 0
    for path in old_files:
        eid = path.split('/')[-1][:-5]
        ob = parse_old_site(path, eid)
        all_bouts += ob
        old_bouts_total += len(ob)
    return all_bouts, dict(new_events=len({p['slug'] for p in posts if 'mainbox_2' in p['content']['rendered']}),
                            old_events=len(old_files), new_bouts=len(new_bouts), old_bouts=old_bouts_total)


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_nkb.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_nkb.json =====')
    print('新サイト大会数:', stats['new_events'], '| 新サイトbout数:', stats['new_bouts'])
    print('旧サイト大会数:', stats['old_events'], '| 旧サイトbout数:', stats['old_bouts'])
    print('総events:', stats['new_events'] + stats['old_events'])
    print('bout rows written:', len(bouts))
    print('  avg bouts/event:', round(len(bouts) / (stats['new_events'] + stats['old_events']), 2))
    r = sum(1 for x in bouts if x['opponent_resolved'])
    print(f'opponent resolved: {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%' if bouts else 'no bouts')
    u = [x for x in bouts if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print('opponent unresolved rows:', len(u), ' distinct:', len({x["opponent_name"] for x in u}))
    print('opponent ambiguous rows:', sum(1 for x in bouts if x['opponent_ambiguous']))
    print('result内訳:', dict(collections.Counter(x['result'] for x in bouts)))
    print('method内訳:', dict(collections.Counter(x['method'] for x in bouts)))
    print('date欠落:', sum(1 for x in bouts if not x['date']), ' venue欠落:', sum(1 for x in bouts if not x['venue']))
    ycount = collections.Counter((x['date'] or '????')[:4] for x in bouts)
    print('年別件数:', dict(sorted(ycount.items())))
