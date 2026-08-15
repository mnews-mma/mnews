# -*- coding: utf-8 -*-
"""KROSS×OVER公式(krossover.jp)からboutを抽出する。SCHEMA.mdに準拠。
   大会結果ページ型。試合結果まとめページ(?page_id=203、robots.txtは404=事実上全許可、
   HOOST CUPと同じ扱い)から個別記事(?p=NNNN)52件を収集した。画像はAmebloのCDNを
   参照しているが、勝敗・対戦カード・決着方法などのテキストはkrossover.jp本体の
   <p>タグに直接書かれており、Amebloページ自体を出典にする必要は無かった(3記事実測で確認)。
   タスクの既知情報「ブログ形式」は、公式サイト自体が本文をブログ的に(大会結果記事の集合として)
   掲載している、という意味で正しかったが、出典ドメインはkrossover.jp単独で完結する。

   ヘッダ行は「▼第N試合...」「・アマ第N試合...」など全て▼または・で始まる(実測: ▼開始行618件・
   ・開始行777件を確認、すべて試合または次回大会告知のいずれかで、告知行はマーク0件のため
   自然に除外される)。プロは▼ヘッダ行1行に両者・決着まで同居する回が多く、アマチュアは
   ・ヘッダ行1行完結が基本。Stand upと同じ「行内のマーク区間を全て拾う」スキャナで両方を吸収する。
   両者マーク揃いのブロックのみboutにする(推測で埋めない方針)。"""
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


# ================= イベント記事のパース =================

MARK_SEG_RE = re.compile(r'([○〇◎△●]|×(?!\d))\s*([^○〇×◎△●]*)')
NAME_TAIL_RE = re.compile(r'^(.*?[）)])(.*)$')
PAREN_END = re.compile(r'[（(]([^）(]*)[）)]\s*$')
DEBUT_LEAD_RE = re.compile(r'^[※＊]\s*デビュー戦\s*')
DECISION_KW = re.compile(r'判定|不戦勝|ノーコンテスト|ドロー|反則|時間切れ|棄権|中止|失格|無効|TKO|KO|一本|勝敗なし')
HDR_RE = re.compile(r'^[▼・]')
DATE_VENUE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日[（(].[）)]\s*(.*)$')
DATE_NOYEAR_RE = re.compile(r'^(\d{1,2})[./](\d{1,2})\b')
BOLD_EVENT_RE = re.compile(r'(?s)<strong>\s*(KROSS[×xX]OVER[^<]{0,40}?)\s*</strong>')
TITLE_RE = re.compile(r'[「『]\s*(KROSS[×xX]OVER[^」』]{0,40}?)\s*[」』]')
H1_RE = re.compile(r'(?s)<h1[^>]*class="entry-title"[^>]*>(.*?)</h1>')
PUBLISHED_RE = re.compile(r'"datePublished":"(\d{4}-\d{2}-\d{2})')


def split_name_aff(raw):
    m = PAREN_END.search(raw)
    aff = m.group(1).strip() if m else None
    name = PAREN_END.sub('', raw).strip()
    return name, aff or None


def get_body_html(path):
    h = open(path, encoding='utf-8', errors='replace').read()
    i = h.find('entry-body')
    body = h[i:i + 100000] if i > 0 else h
    j = body.find('id="comments"')
    if j < 0:
        j = body.find('関連記事')
    if j > 0:
        body = body[:j]
    return h, body


BRAND_X_RE = re.compile(r'(?i)kross\s*×\s*over')


def get_lines(body_html):
    ps = re.findall(r'(?s)<p[^>]*>(.*?)</p>', body_html)
    lines = [U(p) for p in ps if U(p)]
    # 団体名「KROSS×OVER」の「×」がマーク文字(負け)と同一グリフのため、マーク走査の前に
    # ASCIIの'x'へ置換して衝突を避ける(そのまま流すと見出し行の団体名がloss判定として
    # 誤検出され、本物の対戦相手が枠から溢れて欠落する)。
    return [BRAND_X_RE.sub('KROSSxOVER', l) for l in lines]


def extract_published(full_html):
    m = PUBLISHED_RE.search(full_html)
    return m.group(1) if m else None


def extract_date_venue(lines, published):
    for l in lines[:8]:
        m = DATE_VENUE_RE.search(l)
        if m:
            date = '%s-%02d-%02d' % (int(m.group(1)), int(m.group(2)), int(m.group(3)))
            venue = m.group(4).strip()
            venue = re.split(r'にて', venue)[0].strip()
            venue = venue if venue and len(venue) < 40 else None
            return date, venue
    if published:
        py, pm = int(published[:4]), int(published[5:7])
        for l in lines[:5]:
            m = DATE_NOYEAR_RE.match(l)
            if m:
                mo, da = int(m.group(1)), int(m.group(2))
                if 1 <= mo <= 12 and 1 <= da <= 31:
                    year = py - 1 if mo > pm + 1 else py
                    return '%s-%02d-%02d' % (year, mo, da), None
    return None, None


def extract_event(full_html, lines, h1_title):
    m = BOLD_EVENT_RE.search(full_html)
    if m:
        return U(m.group(1))
    for l in lines[:8]:
        m = TITLE_RE.search(l)
        if m:
            return m.group(1)
    t = h1_title or ''
    t = re.sub(r'^\d{1,2}[./]\d{1,2}\s*', '', t)
    t = re.split(r'[：:｜]', t)[0].strip()
    t = re.sub(r'\s*第[\d・部]+\s*(?:公式結果|試合結果)(?:＆レポート)?\s*$', '', t)
    t = re.sub(r'\s*(?:公式結果|試合結果)(?:＆レポート)?\s*$', '', t)
    return t.strip() or h1_title


def scan_line(l, fighters, decision):
    """1行からマーク区間を全て拾う(Stand upと同じロジック)。"""
    segs = MARK_SEG_RE.findall(l)
    if segs:
        for mark, raw in segs:
            raw = raw.strip()
            if not raw or len(fighters) >= 2:
                continue
            nm = NAME_TAIL_RE.match(raw)
            if nm:
                name_part, tail = nm.group(1).strip(), nm.group(2).strip()
            else:
                name_part, tail = raw, ''
            debut = False
            dm = DEBUT_LEAD_RE.match(tail)
            if dm:
                debut = True
                tail = tail[dm.end():].strip()
            fighters.append((mark, name_part, debut))
            # 決着文言のtailが次の地の文(レポート本文)と同じ<p>に連結される回があるため、
            # 文末の句点で切ってから判定する(句点以降は決着注記ではなくレポート散文)。
            dtail = tail.split('。')[0].strip()
            if decision is None and dtail and DECISION_KW.search(dtail) and len(dtail) < 200:
                decision = dtail
    elif decision is None and DECISION_KW.search(l) and len(l) < 60:
        decision = l
    return fighters, decision


def parse_blocks(lines):
    blocks = []
    i, n = 0, len(lines)
    while i < n:
        if not HDR_RE.match(lines[i]):
            i += 1
            continue
        fighters, decision = [], None
        fighters, decision = scan_line(lines[i], fighters, decision)
        j = i + 1
        while j < n:
            l = lines[j]
            if HDR_RE.match(l):
                break
            if len(fighters) >= 2 and decision is not None:
                break
            fighters, decision = scan_line(l, fighters, decision)
            j += 1
        if len(fighters) == 2:
            blocks.append(dict(fighters=fighters, decision=decision))
        i = j if j > i else i + 1
    return blocks


MARK2RESULT = {'○': 'win', '〇': 'win', '◎': 'win', '×': 'loss', '●': 'loss', '△': 'draw'}
bout_seq = collections.Counter()


def build():
    manifest = json.load(open('raw/kross_results/_manifest.json'))
    bouts = []
    stats = dict(articles=0, blocks=0, block_fail_sides=0, self_unresolved=0)
    for h, info in sorted(manifest.items(), key=lambda x: int(x[1]['url'].split('=')[1])):
        stats['articles'] += 1
        path = f'raw/kross_results/{h}.html'
        full_html, body_html = get_body_html(path)
        lines = get_lines(body_html)
        published = extract_published(full_html)
        date, venue = extract_date_venue(lines, published)
        h1m = H1_RE.search(full_html)
        h1_title = U(h1m.group(1)) if h1m else None
        event = extract_event(body_html, lines, h1_title)
        blks = parse_blocks(lines)
        stats['blocks'] += len(blks)
        for b in blks:
            (m1, raw1, deb1), (m2, raw2, deb2) = b['fighters']
            n1, a1 = split_name_aff(raw1)
            n2, a2 = split_name_aff(raw2)
            if not n1 or not n2:
                stats['block_fail_sides'] += 1
                continue
            decision = b['decision']
            if decision:
                meth, rnd, ext, rs = _bouts.parse_method(decision)
            else:
                meth, rnd, ext, rs = None, None, False, None
            for (my_mark, my_name, my_aff, my_raw, my_debut), (opp_mark, opp_name, opp_aff, opp_raw, opp_debut) in [
                ((m1, n1, a1, raw1, deb1), (m2, n2, a2, raw2, deb2)),
                ((m2, n2, a2, raw2, deb2), (m1, n1, a1, raw1, deb1))]:
                rec, amb, cands = resolve(my_name, my_aff)
                if amb or not rec:
                    stats['self_unresolved'] += 1
                    continue
                result = MARK2RESULT.get(my_mark, 'unknown')
                oref, oamb, ocands = resolve(opp_name, opp_aff)
                ident = f"{rec['name']}|{rec['gym'] or ''}|{rec['sources'][0] if rec['sources'] else ''}"
                idx = bout_seq[ident]
                bout_seq[ident] += 1
                bouts.append(dict(
                    bout_id=f'krossover:{ident}:{idx}',
                    date=date, event=event, venue=venue,
                    fighter_slug=ident, fighter_name=rec['name'],
                    opponent_raw=opp_raw, opponent_name=opp_name, opponent_affiliation=opp_aff,
                    opponent_site_slug=None,
                    opponent_ref=oref['name'] if oref else None,
                    opponent_ref_gym=oref['gym'] if oref else None,
                    opponent_resolved=oref is not None,
                    opponent_ambiguous=oamb, opponent_candidates=ocands,
                    result=result, result_mark=my_mark, method=meth, method_raw=decision or '',
                    round=rnd, is_extension=ext, ruleset=rs, note=None,
                    is_debut=my_debut,
                    title_type=None,  # 5団体分は種別抽出の対象外(スコープ外指示)。型整合のためnullで統一
                    pair_key=None,
                    source_url=info['url'],
                ))
    return bouts, stats


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_krossover.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_krossover.json =====')
    print('記事数                  :', stats['articles'])
    print('両者マーク揃いのブロック :', stats['blocks'])
    print('  名前欠落で破棄        :', stats['block_fail_sides'])
    print('  self未解決で破棄(側単位):', stats['self_unresolved'])
    print('bout rows written       :', len(bouts))
    r = sum(1 for x in bouts if x['opponent_resolved'])
    print(f'opponent resolved      : {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%' if bouts else 'no bouts')
    u = [x for x in bouts if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print('opponent unresolved rows:', len(u), ' distinct:', len({x["opponent_name"] for x in u}))
    print('opponent ambiguous rows :', sum(1 for x in bouts if x['opponent_ambiguous']))
    print('result内訳:', dict(collections.Counter(x['result'] for x in bouts)))
    print('method内訳:', dict(collections.Counter(x['method'] for x in bouts)))
    print('date欠落:', sum(1 for x in bouts if not x['date']), ' venue欠落:', sum(1 for x in bouts if not x['venue']))
    ycount = collections.Counter((x['date'] or '????')[:4] for x in bouts)
    print('年別件数:', dict(sorted(ycount.items())))
