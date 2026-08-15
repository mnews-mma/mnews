# -*- coding: utf-8 -*-
"""新日本キックボクシング協会(SNKA、shinnihonkickboxing.com)のboutを抽出する。SCHEMA.mdに準拠。
   公式サイト自体には戦績データが無く、グローバルナビの「News」「Fight」「Ranking」全てが
   Ameblo(https://ameblo.jp/skb-blog/)へ直接リンクしている(3ページ実測で確認)。
   「公式が明示的に案内している場合のみAmebloを出典として認める」の条件を満たすため、
   このAmebloブログを出典として採用した。

   「Fight」テーマ(ameblo.jp/skb-blog/theme-10031916288.html、興行予定、全39件)は
   SPAでページネーションがJSに依存しており、静的クロールでは初回ロード分の20件しか
   到達できない(実測確認、robots.txtはentry-*.htmlを許可)。さらにその20件中、
   実際に勝敗が書かれた「速報」記事は4件のみで、残りは対戦カード発表のみ(勝敗記載なし)
   だった。よって収録範囲は構造的にこの4記事に限定される(推測で件数を水増ししない)。

   4記事の書式は年代で2種類ある:
   - 2012年(■第N試合、<br>で「称号/ランク」「選手名（所属）」「VS」「称号/ランク」
     「選手名（所属）」が別行、勝者は「勝者：NAME」別段落)
   - 2016-2019年(☆第N試合、称号やラウンド形式は見出し行に同居、
     「選手名（所属）vs 選手名（所属）」は1行、勝者は「勝者　NAME」別段落)
   いずれも<br>/<p>境界を保持して行単位に分解すれば機械的に分離できる(タグを潰して
   1つの文字列にすると称号文と選手名が結合し名寄せを壊すため、意図的に行を保つ)。
   称号/ランク行は選手名の前に単独行で置かれることが多いが、「VS直前の行」
   「decision行直前の行」を選手名として採用し、それより前の行(称号)は使わない。
   勝者判定は「勝者」直後のトークンが両者どちらのraw名に部分一致するかで行い、
   両方/どちらにも一致しない場合は推測せずresult='unknown'とする。"""
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


PAREN_END = re.compile(r'[（(]([^）(]*)[）)]\s*$')
HDR_RE = re.compile(r'^[☆■]\s*第\d+試合|^\d+[.、]')
VS_LINE_RE = re.compile(r'^(.+[）)])\s*[vV][sS]\s*(.+[）)])\s*$')
VS_ALONE_RE = re.compile(r'^[vV][sS]$')
WINNER_RE = re.compile(r'勝者[：:\s　]*([^\s　]+)')
DRAW_RE = re.compile(r'^ドロー')
DECISION_LINE_RE = re.compile(r'勝者|^ドロー')
SCORE_CONT_RE = re.compile(r'^[\d（(]|^判定')


def split_name_aff(raw):
    m = PAREN_END.search(raw)
    aff = m.group(1).strip() if m else None
    name = PAREN_END.sub('', raw).strip()
    return name, aff or None


def get_lines(body_html):
    parts = re.split(r'(?i)<br\s*/?>|</p>|<p[^>]*>', body_html)
    return [U(p) for p in parts if U(p)]


OGTITLE_RE = re.compile(r'property="og:title" content="([^"]*)"')


def get_body(path):
    h = open(path, encoding='utf-8', errors='replace').read()
    i = h.find('entryBody')
    j = h.find('window.INIT_DATA', i)
    return h[i:j] if i > 0 and j > i else (h[i:i + 30000] if i > 0 else h)


def get_og_title(full_html):
    m = OGTITLE_RE.search(full_html)
    if not m:
        return None
    return re.sub(r'^『|』$', '', html.unescape(m.group(1))).strip()


def parse_blocks(lines):
    """戻り値: [{f1_raw, f2_raw, winner_tag(またはNone=draw/unknown), is_draw, decision}]"""
    blocks = []
    i, n = 0, len(lines)
    while i < n:
        if not HDR_RE.match(lines[i]):
            i += 1
            continue
        j = i + 1
        seg = []
        while j < n and not HDR_RE.match(lines[j]):
            seg.append(lines[j])
            j += 1
        # decision行(勝者/ドロー)の位置で対戦カード部とdecision部を分ける
        dec_idx = next((k for k, l in enumerate(seg) if DECISION_LINE_RE.search(l)), None)
        card_lines = seg[:dec_idx] if dec_idx is not None else seg
        f1_raw = f2_raw = None
        vs_line = next((l for l in card_lines if VS_LINE_RE.match(l)), None)
        if vs_line:
            m = VS_LINE_RE.match(vs_line)
            f1_raw, f2_raw = m.group(1).strip(), m.group(2).strip()
        else:
            vs_idx = next((k for k, l in enumerate(card_lines) if VS_ALONE_RE.match(l)), None)
            if vs_idx is not None and vs_idx > 0:
                f1_raw = card_lines[vs_idx - 1]
                after = [l for l in card_lines[vs_idx + 1:] if l]
                if after:
                    f2_raw = after[-1]
        decision = None
        winner_tag = None
        is_draw = False
        if dec_idx is not None:
            dtext = seg[dec_idx]
            if dec_idx + 1 < len(seg) and SCORE_CONT_RE.match(seg[dec_idx + 1]):
                dtext = dtext + ' ' + seg[dec_idx + 1]
            is_draw = bool(DRAW_RE.match(seg[dec_idx]))
            wm = WINNER_RE.search(seg[dec_idx])
            winner_tag = wm.group(1) if wm else None
            decision = dtext
        if f1_raw and f2_raw:
            blocks.append(dict(f1_raw=f1_raw, f2_raw=f2_raw, winner_tag=winner_tag,
                                is_draw=is_draw, decision=decision))
        i = j if j > i else i + 1
    return blocks


def match_winner(tag, name1, name2):
    if not tag:
        return None
    t = nk(tag)
    n1, n2 = nk(name1), nk(name2)
    h1 = t and (t in n1 or n1 in t)
    h2 = t and (t in n2 or n2 in t)
    if h1 and not h2:
        return 1
    if h2 and not h1:
        return 2
    return None  # 両方/どちらにも一致 -> 推測しない


bout_seq = collections.Counter()


def build():
    manifest = json.load(open('raw/snka_ameblo/_manifest.json'))
    bouts = []
    stats = dict(articles_crawled=0, articles_with_results=0, blocks=0,
                 winner_unresolved=0, self_unresolved=0)
    for eid, info in sorted(manifest.items()):
        stats['articles_crawled'] += 1
        path = f'raw/snka_ameblo/{eid}.html'
        full_html = open(path, encoding='utf-8', errors='replace').read()
        body = get_body(path)
        if '勝者' not in body:
            continue  # 対戦カード発表のみで結果記載なし(実測どおり)
        stats['articles_with_results'] += 1
        lines = get_lines(body)
        # 日付(冒頭数行の YYYY/M/D、YYYY年M月D日、YYYY・M・D いずれか)
        date = None
        for l in lines[:6]:
            dm = re.search(r'(\d{4})[年/・](\d{1,2})[月/・](\d{1,2})', l)
            if dm:
                date = '%s-%02d-%02d' % (int(dm.group(1)), int(dm.group(2)), int(dm.group(3)))
                break
        event = None
        for l in lines[:6]:
            if HDR_RE.match(l) or re.match(r'^(\d{4})[年/・]', l):
                break
            if l != 'entryBody">' and len(l) < 40:
                event = l
                break
        event = event or get_og_title(full_html)
        blks = parse_blocks(lines)
        stats['blocks'] += len(blks)
        for b in blks:
            n1, a1 = split_name_aff(b['f1_raw'])
            n2, a2 = split_name_aff(b['f2_raw'])
            if not n1 or not n2:
                continue
            decision = b['decision']
            if decision:
                meth, rnd, ext, rs = _bouts.parse_method(decision)
            else:
                meth, rnd, ext, rs = None, None, False, None
            if b['is_draw']:
                w = 0  # 両者draw
            else:
                w = match_winner(b['winner_tag'], n1, n2)
                if w is None:
                    stats['winner_unresolved'] += 1
            for my_i, my_name, my_aff, my_raw, opp_name, opp_aff, opp_raw in [
                    (1, n1, a1, b['f1_raw'], n2, a2, b['f2_raw']),
                    (2, n2, a2, b['f2_raw'], n1, a1, b['f1_raw'])]:
                rec, amb, cands = resolve(my_name, my_aff)
                if amb or not rec:
                    stats['self_unresolved'] += 1
                    continue
                if b['is_draw']:
                    result = 'draw'
                elif w is None:
                    result = 'unknown'
                else:
                    result = 'win' if w == my_i else 'loss'
                oref, oamb, ocands = resolve(opp_name, opp_aff)
                ident = f"{rec['name']}|{rec['gym'] or ''}|{rec['sources'][0] if rec['sources'] else ''}"
                idx = bout_seq[ident]
                bout_seq[ident] += 1
                bouts.append(dict(
                    bout_id=f'snka:{ident}:{idx}',
                    date=date, event=event, venue=None,
                    fighter_slug=ident, fighter_name=rec['name'],
                    opponent_raw=opp_raw, opponent_name=opp_name, opponent_affiliation=opp_aff,
                    opponent_site_slug=None,
                    opponent_ref=oref['name'] if oref else None,
                    opponent_ref_gym=oref['gym'] if oref else None,
                    opponent_resolved=oref is not None,
                    opponent_ambiguous=oamb, opponent_candidates=ocands,
                    result=result, result_mark=b['winner_tag'] if not b['is_draw'] else 'ドロー',
                    method=meth, method_raw=decision or '',
                    round=rnd, is_extension=ext, ruleset=rs, note=None, is_debut=False,
                    title_type=None,  # 5団体分は種別抽出の対象外(スコープ外指示)。型整合のためnullで統一
                    pair_key=None,
                    source_url=info['url'],
                ))
    return bouts, stats


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_snka.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_snka.json =====')
    print('クロールした記事数(Fightテーマ到達可能分):', stats['articles_crawled'])
    print('  うち結果記載あり(採用対象)          :', stats['articles_with_results'])
    print('対戦ブロック                          :', stats['blocks'])
    print('  勝者判定不能(推測せず捨てず、bothを含む)  :', stats['winner_unresolved'])
    print('  self未解決で破棄(側単位)            :', stats['self_unresolved'])
    print('bout rows written                     :', len(bouts))
    r = sum(1 for x in bouts if x['opponent_resolved'])
    print(f'opponent resolved                     : {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%' if bouts else 'no bouts')
    u = [x for x in bouts if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print('opponent unresolved rows:', len(u), ' distinct:', len({x["opponent_name"] for x in u}))
    print('opponent ambiguous rows :', sum(1 for x in bouts if x['opponent_ambiguous']))
    print('result内訳:', dict(collections.Counter(x['result'] for x in bouts)))
    print('method内訳:', dict(collections.Counter(x['method'] for x in bouts)))
    print('date欠落:', sum(1 for x in bouts if not x['date']))
    ycount = collections.Counter((x['date'] or '????')[:4] for x in bouts)
    print('年別件数:', dict(sorted(ycount.items())))
