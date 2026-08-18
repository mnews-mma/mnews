# -*- coding: utf-8 -*-
"""Bigbang〜統一への道〜公式(bigbang-kick.com)の選手ページからboutを抽出する。SCHEMA.mdに準拠。
   選手ページ型(SB/RISEと同型)だが、対戦相手へのサイト内リンクが無く、ラウンド数・相手所属も
   ほぼ全行で欠落している(戦績第2期レグ③実測どおり)。3ページ実測(hoshiryunosuke/atsumu/
   kenta-hayashi)でテーブル構造(figure.wp-block-table > table、行は
   <td data-align=center>マーク<br>決着方法</td><td>相手名<br>日付 / 大会名</td><td data-align=center>映像リンク</td>)
   が全ページ共通と確認済み。selfもfighters.jsonに解決できた場合のみ収録する(レグ④⑤と同じ方針。
   選手名鑑がBigbang独自ロースターでfighters.jsonの母体ではないため、SB/RISEのように無条件では
   採用しない)。
   相手の所属欄は無いが、まれに相手名末尾に括弧書き(不明（タイ国籍）等)が付くことがあるため、
   他団体と同じ末尾括弧抽出ルールをそのまま適用する(推測ではなく既存ルールの機械的適用)。"""
import re, glob, html, json, unicodedata, collections, sys

sys.path.insert(0, '.')
import bouts as _bouts

U = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

F = json.load(open('fighters.json'))


# 選手名寄せの正規化(2026-08、T-4追加): 旧字体/異体字のうち読み・字義が完全に同一と
# 確認できるペアのみを対象にした変換表。「たまたま漢字が似ている別人」まで巻き込まない
# よう、厳密に確認できたペアのみに絞っている(拡張時は個別に典拠を確認すること。
# 詳細はout/kick-name-resolution-split-report.md参照)。
_KANJI_VARIANT_TABLE = str.maketrans({
    '﨑': '崎', '髙': '高', '國': '国', '實': '実', '弍': '弐', '凜': '凛', '齋': '斎', '龍': '竜', '―': 'ー',
})


def nk(s):
    s = unicodedata.normalize('NFKC', s or '')
    for c in '“”"\'’‘`「」『』':
        s = s.replace(c, '')
    return re.sub(r'\s+', '', s).replace('・', '').replace('=', '').lower().translate(_KANJI_VARIANT_TABLE)


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


bout_seq = collections.Counter()


def emit(bouts, fighter_name_gym, opponent_name_gym, opponent_raw, result, method_raw,
         source_url, date, event, tag, stats):
    my_name, my_gym = fighter_name_gym
    opp_name, opp_gym = opponent_name_gym
    rec, amb, cands = resolve(my_name, my_gym)
    if amb or not rec:
        stats['self_unresolved'] += 1
        return False
    if method_raw:
        meth, rnd, ext, rs = _bouts.parse_method(method_raw)
    else:
        meth, rnd, ext, rs = None, None, False, None
    if method_raw == 'なし':      # 「勝敗 なし」— parse_methodの一般キーワードに当たらず'other'化するため上書き
        meth = None
    oref, oamb, ocands = resolve(opp_name, opp_gym)
    ident = f"{rec['name']}|{rec['gym'] or ''}|{rec['sources'][0] if rec['sources'] else ''}"
    idx = bout_seq[ident]
    bout_seq[ident] += 1
    bouts.append(dict(
        bout_id=f'bigbang:{ident}:{idx}',
        date=date, event=event, venue=None,
        fighter_slug=ident, fighter_name=rec['name'],
        opponent_raw=opponent_raw, opponent_name=opp_name, opponent_affiliation=opp_gym,
        opponent_site_slug=None,
        opponent_ref=oref['name'] if oref else None,
        opponent_ref_gym=oref['gym'] if oref else None,
        opponent_resolved=oref is not None,
        opponent_ambiguous=oamb, opponent_candidates=ocands,
        result=result, result_mark=tag, method=meth, method_raw=method_raw or '',
        round=rnd, is_extension=ext, ruleset=rs, note=None, is_debut=False,
        title_type=None,  # 5団体分は種別抽出の対象外(スコープ外指示)。型整合のためnullで統一
        pair_key=None,
        source_url=source_url,
    ))
    stats['rows'] += 1
    return True


PAREN_END = re.compile(r'[（(]([^）(]*)[）)]\s*$')
ROW_RE = re.compile(
    r'(?s)<tr>\s*<td[^>]*data-align="center"[^>]*>(.*?)</td>\s*'
    r'<td[^>]*>(.*?)</td>\s*<td[^>]*data-align="center"[^>]*>(.*?)</td>\s*</tr>')
NAME_ROW_RE = re.compile(r'(?s)<tr>\s*<td>名前</td>\s*<td>(.*?)</td>\s*</tr>')
GYM_ROW_RE = re.compile(r'(?s)<tr>\s*<td>所属ジム</td>\s*<td>(.*?)</td>\s*</tr>')
DATE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日')
MARK2RESULT = {'◎': 'win', '○': 'win', '×': 'loss', '△': 'draw'}


def split_name_aff(raw):
    m = PAREN_END.search(raw)
    aff = m.group(1).strip() if m else None
    name = PAREN_END.sub('', raw).strip()
    return name, aff or None


def parse_fighter_page(path, url, stats):
    h = open(path, encoding='utf-8', errors='replace').read()
    nm = NAME_ROW_RE.search(h)
    if not nm:
        stats['no_name_row'] += 1
        return []
    fname_raw = U(nm.group(1).split('<br')[0]) if '<br' in nm.group(1) else U(re.split(r'(?i)<br\s*/?>', nm.group(1))[0])
    fgym_m = GYM_ROW_RE.search(h)
    fgym = U(fgym_m.group(1)) if fgym_m else None
    if not fname_raw:
        stats['no_name_row'] += 1
        return []

    bouts = []
    rows = ROW_RE.findall(h)
    stats['blocks'] += len(rows)
    for c1, c2, c3 in rows:
        parts = re.split(r'(?i)<br\s*/?>', c1)
        mark_tok = U(parts[0])
        method_tok = U(parts[1]) if len(parts) > 1 else None

        m2 = re.search(r'(?s)<strong>(.*?)</strong>\s*(?i:<br\s*/?>)\s*(.*)$', c2)
        if m2:
            opp_raw = U(m2.group(1))
            rest = m2.group(2)
        else:
            sp = re.split(r'(?i)<br\s*/?>', c2, maxsplit=1)
            opp_raw = U(sp[0])
            rest = sp[1] if len(sp) > 1 else ''
        if not opp_raw:
            stats['no_opponent'] += 1
            continue
        opp_name, opp_aff = split_name_aff(opp_raw)

        flat_rest = U(rest)
        dm = DATE_RE.search(flat_rest)
        if dm:
            date = '%s-%02d-%02d' % (int(dm.group(1)), int(dm.group(2)), int(dm.group(3)))
            event = re.sub(r'^[\s/]+', '', flat_rest[dm.end():]).strip() or None
        else:
            date = None
            event = flat_rest.strip() or None

        # ---- result / method の決定(独立した2軸。マークはresult、テキストはmethodへ) ----
        if mark_tok == 'NC' and method_tok is None:
            result, method_raw = 'no_contest', 'NC'
        elif mark_tok == '中止' and method_tok is None:
            result, method_raw = 'cancelled', '中止'
        elif mark_tok == '勝敗' and method_tok == 'なし':
            result, method_raw = 'unknown', 'なし'
        elif mark_tok == '' and not method_tok:
            result, method_raw = 'unknown', ''
        elif mark_tok in MARK2RESULT:
            result, method_raw = MARK2RESULT[mark_tok], (method_tok or '')
        elif mark_tok == '-' and method_tok == '無効':
            result, method_raw = 'no_contest', method_tok
        else:
            stats['unknown_mark'][mark_tok] += 1
            result, method_raw = 'unknown', (method_tok or mark_tok or '')

        emit(bouts, (fname_raw, fgym), (opp_name, opp_aff), opp_raw, result, method_raw,
             url, date, event, mark_tok, stats)
    return bouts


def build():
    manifest = json.load(open('raw/bigbang_fighters/_manifest.json'))
    stats = dict(pages=0, blocks=0, rows=0, self_unresolved=0, no_name_row=0, no_opponent=0,
                 unknown_mark=collections.Counter())
    all_bouts = []
    for h, info in sorted(manifest.items()):
        path = f'raw/bigbang_fighters/{h}.html'
        stats['pages'] += 1
        all_bouts += parse_fighter_page(path, info['url'], stats)
    return all_bouts, stats


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_bigbang.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_bigbang.json =====')
    print('選手ページ数           :', stats['pages'])
    print('戦績テーブル行(生)     :', stats['blocks'])
    print('  名前行なしで破棄     :', stats['no_name_row'])
    print('  相手名欠落で破棄     :', stats['no_opponent'])
    print('  self未解決で破棄     :', stats['self_unresolved'])
    print('  未知マーク           :', dict(stats['unknown_mark']))
    print('bout rows written      :', len(bouts))
    r = sum(1 for x in bouts if x['opponent_resolved'])
    print(f'opponent resolved      : {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%' if bouts else 'no bouts')
    u = [x for x in bouts if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print('opponent unresolved rows:', len(u), ' distinct:', len({x["opponent_name"] for x in u}))
    print('opponent ambiguous rows :', sum(1 for x in bouts if x['opponent_ambiguous']))
    print('result内訳:', dict(collections.Counter(x['result'] for x in bouts)))
    print('method内訳:', dict(collections.Counter(x['method'] for x in bouts)))
    print('date欠落:', sum(1 for x in bouts if not x['date']))
    print('round欠落:', sum(1 for x in bouts if x['round'] is None), '/', len(bouts))
    print('opponent_affiliation欠落:', sum(1 for x in bouts if not x['opponent_affiliation']), '/', len(bouts))
    ycount = collections.Counter((x['date'] or '????')[:4] for x in bouts)
    print('年別件数:', dict(sorted(ycount.items())))
    fset = {x['fighter_slug'] for x in bouts}
    print('名簿解決できた選手(このpageのself側)数:', len(fset))
