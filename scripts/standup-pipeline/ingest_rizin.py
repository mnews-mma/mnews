# -*- coding: utf-8 -*-
"""data/rizinRecords.json(mnews既存資産)のruleType=キックボクシング分だけをbouts_*.jsonと同じ型で書き出す。
   RIZIN公式サイトへの新規スクレイピングは行わない(mnews側が既に取得済みの静的資産を読むだけ)。"""
import json,re,unicodedata,collections
import bouts as _bouts

d = json.load(open('raw/rizinRecords.json'))
F = json.load(open('fighters.json'))

def nk(s):
    s = unicodedata.normalize('NFKC', s or '')
    for c in '“”"\'’‘`「」『』': s = s.replace(c, '')
    return re.sub(r'\s+', '', s).replace('・', '').replace('=', '').lower()

byname = collections.defaultdict(list)
for f in F:
    for n in [f['name']] + f['aliases']:
        if f not in byname[nk(n)]: byname[nk(n)].append(f)
GENERIC = {'フリー', '無所属', 'free', None}
def gk(s):
    if not s: return None
    s = unicodedata.normalize('NFKC', s).lower()
    for c in '“”"\'’‘`': s = s.replace(c, '')
    s = re.sub(r'(ジム|gym|キックボクシング|kickboxing|道場|会館|塾|team|チーム|ボクシング)', '', s)
    return re.sub(r'[\s　／/・\-,、。.]', '', s) or None

RESULT = {'decisive': None, 'draw': 'draw', 'nc': 'no_contest'}  # decisiveはwinnerNameで個別判定

def parse_method(raw):
    if not raw: return None, None, False
    ext = '延長' in raw
    rm = re.search(r'(\d+)\s*R', raw)
    rnd = int(rm.group(1)) if rm else None
    body = raw
    if '判定' in body: meth = 'decision'
    elif 'TKO' in body: meth = 'tko'
    elif 'KO' in body: meth = 'ko'
    elif '一本' in body or '固め' in body or '絞め' in body: meth = 'submission'
    elif 'ノーコンテスト' in body or '無効' in body: meth = 'no_contest'
    elif '反則' in body: meth = 'disqualification'
    else: meth = 'other'
    return meth, rnd, ext

out = []
kick_bouts = [(e, b) for e in d for b in e['bouts'] if b['ruleType'] == 'キックボクシング']
bout_seq = collections.Counter()
for e, b in kick_bouts:
    for side, opp_side in [('A', 'B'), ('B', 'A')]:
        fname = b[f'fighter{side}Name']
        oname = b[f'fighter{opp_side}Name']
        if not fname: continue
        cands = byname.get(nk(fname), [])
        if not cands: continue  # 名簿2,482人に解決できるboutのみ収録

        # 同名異人は所属ジムで絞り込む(第3弾ルールを踏襲)。RIZINデータは対戦相手の所属情報を持たないため、
        # 自分側(fname)の同名解決は「1件に定まる場合のみ」とし、複数候補ならこのboutはスキップ(推測しない)。
        if len(cands) > 1:
            continue
        f = cands[0]

        meth, rnd, ext = parse_method(b.get('methodRaw'))
        if b['resultType'] == 'decisive':
            if b.get('winnerName') and nk(b['winnerName']) == nk(fname):
                result = 'win'
            elif b.get('winnerName') and nk(b['winnerName']) == nk(oname):
                result = 'loss'
            else:
                result = 'unknown'  # 勝者名が両者と一致しない・不明な場合は推測しない
        else:
            result = RESULT[b['resultType']]

        ocands = byname.get(nk(oname), [])
        oref = oref_gym = None
        amb = False; ocand_list = None
        if len(ocands) == 1:
            oref = ocands[0]['name']; oref_gym = ocands[0]['gym']
        elif len(ocands) > 1:
            amb = True
            ocand_list = [{'name': c['name'], 'gym': c['gym'], 'orgs': c['orgs']} for c in ocands]

        ident = f"{f['name']}|{f['gym'] or ''}|{f['sources'][0] if f['sources'] else ''}"
        i = bout_seq[ident]; bout_seq[ident] += 1
        out.append(dict(
            bout_id=f'rizin:{ident}:{i}',
            date=e['date'], event=e['eventName'], venue=None,
            fighter_slug=ident, fighter_name=f['name'],
            opponent_raw=oname, opponent_name=oname, opponent_affiliation=None,
            opponent_site_slug=None,
            opponent_ref=oref, opponent_ref_gym=oref_gym, opponent_resolved=oref is not None,
            opponent_ambiguous=amb, opponent_candidates=ocand_list,
            result=result, result_mark=f"rizin:{b['resultType']}", method=meth,
            method_raw=b.get('methodRaw') or '', round=rnd, is_extension=ext,
            ruleset=None, note=None, is_debut=False,
            title_type=_bouts.classify_title_type(b.get('headingText')),  # bout単位のheadingTextから判定
            pair_key=None,
            source_url=e['sourceUrl'],
        ))

json.dump(out, open('bouts_rizin.json', 'w'), ensure_ascii=False, indent=1)
print('RIZIN(キックボクシングのみ) bout件数:', len(out))
print('  対象大会内キックボクシング総数:', len(kick_bouts), '(両視点で最大', len(kick_bouts)*2, '行)')
print('  名簿未解決(自分側)で除外:', len(kick_bouts)*2 - sum(1 for e,b in kick_bouts for s in 'AB' if byname.get(nk(b[f'fighter{s}Name']))))
c = collections.Counter(x['result'] for x in out)
print('  result内訳:', dict(c))
print('  unknown件数:', c.get('unknown', 0))
oc = sum(1 for x in out if x['opponent_resolved'])
print(f'  相手解決率: {oc}/{len(out)} = {oc/len(out)*100:.1f}%')
print('  ambiguous:', sum(1 for x in out if x['opponent_ambiguous']))
