# -*- coding: utf-8 -*-
"""U-3(2026-08、名前解決失敗の編集距離2以上のゆれ測定、調査専用): 4軸で候補を生成し、
   可能な限り大会+日付での相互裏取り(cross-validation)を行う。修正は一切行わない。
   対象は指示どおり13ソース自体(data/kick/bouts_{source}.json)のopponent_resolved:false行。
   promotion表示ラベルでの絞り込みではない(Wikipedia由来の行がK-1等のラベルを持つことが
   あり、ラベルベースの絞り込みは範囲外のWikipedia行を誤って含めてしまうため)。"""
import json, os, csv, re, unicodedata, collections
from kana_romaji import katakana_to_romaji, normalize_romaji

SOURCE_FILES = {
    'RISE': 'bouts_rise.json', 'SHOOT BOXING': 'bouts_sb.json', 'NJKF': 'bouts_njkf.json',
    'Bigbang': 'bouts_bigbang.json', 'DEEP☆KICK': 'bouts_deepkick.json', 'K-1': 'bouts_k1.json',
    'HoostCup': 'bouts_hoostcup.json', 'KROSS×OVER': 'bouts_krossover.json', 'NKB': 'bouts_nkb.json',
    'JKA': 'bouts_jka.json', 'Stand up': 'bouts_standup.json', 'SNKA': 'bouts_snka.json',
    'KNOCK OUT': 'bouts_knockout.json',
}

GEN = '../../data/kick/generated/fighters'
F = json.load(open('fighters.json'))
with open('fighters.csv', encoding='utf-8') as f:
    CSVROWS = list(csv.DictReader(f))
CSV_NAMEKEY = [k for k in CSVROWS[0].keys() if 'name' in k][0]


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


# ---- 全fighterの生成済みbout(全promotion、cross-validation用) ----
fighter_bouts = {}
for fn in os.listdir(GEN):
    d = json.load(open(os.path.join(GEN, fn)))
    fighter_bouts[d['slug']] = d

# ---- 13ソース自体(sourceFile)の未解決行を収集 ----
rows = []
for label, fn in SOURCE_FILES.items():
    d = json.load(open(f'../../data/kick/{fn}'))
    for b in d:
        if not b['opponent_resolved'] and not b['opponent_ambiguous']:
            rows.append({
                'source_label': label, 'source_file': fn, 'bout_id': b['bout_id'],
                'fighter_slug': b['fighter_slug'], 'fighter_name': b['fighter_name'],
                'date': b['date'], 'event': b['event'],
                'opponentName': b['opponent_name'], 'opponentAffiliation': b['opponent_affiliation'],
            })

print(f'total unresolved rows (13-source scope, sourceFile-based): {len(rows)}')
print(f'unique opponent names: {len({r["opponentName"] for r in rows})}')
by_source_count = collections.Counter(r['source_label'] for r in rows)
for label, c in by_source_count.most_common():
    print(f'  {label:15s} {c:6d}')
print()


def cross_validate(candidate_slug, promotion_guess_promos, date, original_fighter_name):
    """候補選手の生成済み全戦績に、同じ日付・相手名が元の選手名と部分一致する行が
       あるかを確認する(promotionは厳密一致を要求せず、日付+名前一致のみで判定する。
       promotionラベルはソースにより表記揺れがあるため)。"""
    d = fighter_bouts.get(candidate_slug)
    if not d or not date:
        return False
    onk = nk(original_fighter_name)
    for b in d['bouts']:
        if b['date'] == date:
            opp = nk(b['opponentName'] or '')
            if opp and (opp in onk or onk in opp):
                return True
    return False


# ================= 軸1: かな読みでの完全一致 =================
by_kana = collections.defaultdict(list)
for f in F:
    if f.get('kana'):
        by_kana[nk(f['kana'])].append(f)

axis1 = []
for r in rows:
    cands = by_kana.get(nk(r['opponentName']))
    if cands:
        validated = [c for c in cands if cross_validate(
            f"{c['name']}|{c['gym'] or ''}|{c['sources'][0] if c['sources'] else ''}",
            None, r['date'], r['fighter_name'])]
        axis1.append({'row': r, 'candidates': cands, 'validated_names': [c['name'] for c in validated]})

# ================= 軸4: かな/ラテン→ローマ字転写での一致(yomi_romaji照合) =================
by_romaji = collections.defaultdict(list)
byname = collections.defaultdict(list)
for f in F:
    byname[f['name']].append(f)
for c in CSVROWS:
    if c['yomi_romaji']:
        by_romaji[normalize_romaji(c['yomi_romaji'])].append(c[CSV_NAMEKEY])

axis4 = []
for r in rows:
    conv = normalize_romaji(katakana_to_romaji(r['opponentName']))
    if not conv:
        continue
    cand_names = by_romaji.get(conv)
    if not cand_names:
        continue
    multi_token = len((r['opponentName'] or '').split()) >= 2 or ('・' in (r['opponentName'] or ''))
    resolved_cands = []
    for cn in cand_names:
        resolved_cands.extend(byname.get(cn, []))
    validated = [c for c in resolved_cands if cross_validate(
        f"{c['name']}|{c['gym'] or ''}|{c['sources'][0] if c['sources'] else ''}",
        None, r['date'], r['fighter_name'])]
    axis4.append({'row': r, 'candidates': cand_names, 'multi_token': multi_token,
                   'validated_names': [c['name'] for c in validated]})

# ================= 軸2: 姓のみ一致+大会・日付一致(affiliation corroboration併用) =================
by_surname = collections.defaultdict(list)
for f in F:
    parts = f['name'].split()
    if len(parts) >= 2:
        by_surname[nk(parts[0])].append(f)

axis2_raw = []
axis2_gym_corroborated = []
axis2_date_validated = []
for r in rows:
    parts = (r['opponentName'] or '').split()
    if len(parts) < 2:
        continue
    surname = nk(parts[0])
    cands = by_surname.get(surname)
    if not cands:
        continue
    axis2_raw.append({'row': r, 'candidates': [c['name'] for c in cands]})

    aff = gk(r['opponentAffiliation'])
    gym_hits = []
    if aff:
        gym_hits = [c for c in cands if gk(c['gym']) and
                    (gk(c['gym']) == aff or aff in gk(c['gym']) or gk(c['gym']) in aff)]
    if gym_hits:
        axis2_gym_corroborated.append({'row': r, 'candidates': [c['name'] for c in gym_hits]})

    date_hits = []
    for c in cands:
        slug = f"{c['name']}|{c['gym'] or ''}|{c['sources'][0] if c['sources'] else ''}"
        if cross_validate(slug, None, r['date'], r['fighter_name']):
            date_hits.append(c['name'])
    if date_hits:
        axis2_date_validated.append({'row': r, 'candidates': date_hits})

# ================= 軸3: 括弧内容の扱い違い(ジム名 or 別名注記) =================
PAREN_RE = re.compile(r'[（(]([^）(]*)[）)]')
axis3 = []
for r in rows:
    name = r['opponentName'] or ''
    m = PAREN_RE.search(name)
    if not m:
        continue
    base = PAREN_RE.sub('', name).strip()
    inner = m.group(1).strip()
    for cand_name, tag in ((base, 'base'), (inner, 'paren_content')):
        if not cand_name:
            continue
        frs = byname.get(cand_name) or by_kana.get(nk(cand_name))
        if frs:
            validated = [c for c in frs if cross_validate(
                f"{c['name']}|{c['gym'] or ''}|{c['sources'][0] if c['sources'] else ''}",
                None, r['date'], r['fighter_name'])]
            axis3.append({'row': r, 'candidates': [c['name'] for c in frs], 'matched_on': tag,
                           'validated_names': [c['name'] for c in validated]})

print('===== 軸別候補件数(sourceFileベース、正しい13ソース範囲) =====')
print(f'軸1(かな完全一致): {len(axis1)}行 (unique names: {len({a["row"]["opponentName"] for a in axis1})}) '
      f'/ date-cross-validated: {sum(1 for a in axis1 if a["validated_names"])}')
print(f'軸2raw(姓一致のみ): {len(axis2_raw)}行 (unique names: {len({a["row"]["opponentName"] for a in axis2_raw})})')
print(f'軸2(姓一致+所属欄corroboration): {len(axis2_gym_corroborated)}行')
print(f'軸2(姓一致+日付cross-validation): {len(axis2_date_validated)}行')
print(f'軸3(括弧内容の扱い違い): {len(axis3)}行 (unique names: {len({a["row"]["opponentName"] for a in axis3})}) '
      f'/ date-cross-validated: {sum(1 for a in axis3 if a["validated_names"])}')
print(f'軸4(かな/ラテン→ローマ字転写一致): {len(axis4)}行 (unique names: {len({a["row"]["opponentName"] for a in axis4})}) '
      f'/ date-cross-validated: {sum(1 for a in axis4 if a["validated_names"])} '
      f'/ multi-token: {sum(1 for a in axis4 if a["multi_token"])}')

json.dump({'axis1': axis1, 'axis2_raw': axis2_raw, 'axis2_gym': axis2_gym_corroborated,
           'axis2_date': axis2_date_validated, 'axis3': axis3, 'axis4': axis4},
          open('/tmp/u3_axis_results.json', 'w'), ensure_ascii=False, indent=1)
print()
print('詳細を /tmp/u3_axis_results.json に保存')
