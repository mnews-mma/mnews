# -*- coding: utf-8 -*-
"""NJKF公式(njkf.info)の大会結果ページからboutを抽出する。SCHEMA.mdに準拠。
   選手ページはあるが通算成績のみでbout詳細が無いため(レグ③実測)、大会結果ページのみを使う。
   1<p>=1boutが基本だが、17年分でテンプレートが複数回変化しており(VS行の有無、決着とfighter2が
   同一行に同居する回、マーク欠落1件など)、行順序に頼らずマーク文字の出現位置を軸にテキストを
   分割する方式にした。両サイドを走査し名簿に解決できる側だけをbout化する(レグ④と同じ方針)。

   V-2(2026-08、見送り確定・4件): 以下は1件ごとに別テンプレートで、再利用の効かない
   一点物のパースロジックが必要なため実装を見送る(推測で埋めない方針も含め詳細は
   out/kick-njkf-nkb-standup-deferred-templates.md参照)。
   - result/20210808_njkf-west-3rd_result.html(NJKF 2021 west 3rd): マーク文字(○×)が
     一切無く、勝敗は「0-3判定」等のスコア表記と地の文からしか読み取れない。判定戦のみ
     スコアから機械的に読めるが、TKO/KO戦は地の文推測になるため対象外。同一大会内で
     一部の決着方式だけ拾うと不完全な大会になるため、判定戦のみの部分実装も行わない。
   - result/20241110.html(NJKF CHALLENGER 6)・result2013/1201.html(Muay Thai Open 25):
     `<p>`タグに包まれない生の`<br>`区切りブロック(▼第N試合見出しで区切り)。
     `<p>`境界に依存する現行の抽出方式では発見不能。Muay Thai Open 25はさらに2013年当時の
     別サイト構造(WordPress移行前、`<article class="gridWrapper">`)で二重に非対応。
   - result/west-5th_result.html(NJKF 2021 west 5th): `<ul class="wp-block-list"><li>`
     単位で選手1名ずつ分割される構造(1boutが2つの`<li>`に分かれる)。現行の1`<p>`=1bout
     前提と根本的に異なる。"""
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


MARK_CHARS = '○×△◎〇◯▲'
MARK2RESULT = {'○': 'win', '◎': 'win', '〇': 'win', '◯': 'win', '×': 'loss', '△': 'draw', '▲': 'draw'}
COMPLEMENT = {'○': '×', '◎': '×', '〇': '×', '◯': '×', '×': '○', '▲': None, '△': None}
DECISION_KW = re.compile(r'判定|不戦勝|ノーコンテスト|ドロー|反則|時間切れ|棄権|中止|失格|無効|TKO|KO|本戦|延長')
PAREN_END = re.compile(r'[（(]([^）(]*)[）)]')


def split_name_aff(raw):
    raw = raw.strip(' 　・,、')
    m = PAREN_END.search(raw)
    if not m:
        return raw.strip() or None, None
    aff = m.group(1).strip()
    name = raw[:m.start()].strip()
    return name or None, aff or None


def get_lines_from_p(p):
    lines = [U(x) for x in re.split(r'<br\s*/?>', p)]
    return [l for l in lines if l]


def parse_bout_paragraph(lines):
    """1つの<p>ブロック(行リスト)から1boutを抽出。戻り値: dict or None"""
    text = ' @@ '.join(lines)
    mark_iter = [(m.start(), m.group(0)) for m in re.finditer('[' + MARK_CHARS + ']', text)]
    if len(mark_iter) == 0:
        return None
    if len(mark_iter) == 1:
        p0, c0 = mark_iter[0]
        vsm = re.search(r'VS', text)
        if not vsm:
            return None
        header = text[:min(p0, vsm.start())].replace('@@', ' ').strip()
        if p0 < vsm.start():
            known_seg, unknown_seg = text[:vsm.start()], text[vsm.end():]
            known_mark = c0
            known_raw = text[p0 + 1:vsm.start()]
            decision_and_rest = text[vsm.end():]
        else:
            known_mark = c0
            pre_vs = text[:vsm.start()]
            decision_and_rest = text[vsm.end():p0]
            known_raw = text[p0 + 1:]
            unknown_seg = pre_vs
        comp = COMPLEMENT.get(known_mark)
        if not comp:
            return None
        m1_mark, m1_raw = comp, unknown_seg
        m2_mark, m2_raw = known_mark, known_raw
        decision = decision_and_rest
        notes_text = ''
    else:
        p1, c1 = mark_iter[0]
        p2, c2 = mark_iter[1]
        header = text[:p1].replace('@@', ' ').strip()
        gap = text[p1 + 1:p2]
        vsm = re.search(r'VS', gap)
        if vsm:
            m1_raw = gap[:vsm.start()]
            decision = gap[vsm.end():]
        else:
            dkw = DECISION_KW.search(gap)
            if dkw:
                m1_raw = gap[:dkw.start()]
                decision = gap[dkw.start():]
            else:
                m1_raw, decision = gap, ''
        p3 = mark_iter[2][0] if len(mark_iter) > 2 else len(text)
        tail = text[p2 + 1:p3]
        note_pos = tail.find('※')
        if note_pos >= 0:
            m2_raw, notes_text = tail[:note_pos], tail[note_pos + 1:]
        else:
            m2_raw, notes_text = tail, ''
        m1_mark, m2_mark = c1, c2
    n1, a1 = split_name_aff(m1_raw.replace('@@', ' '))
    n2, a2 = split_name_aff(m2_raw.replace('@@', ' '))
    if not n1 or not n2:
        return None
    decision = re.sub(r'@@', ' ', decision).strip(' 　:：、,')
    notes_text = re.sub(r'@@', ' ', notes_text).strip()
    return dict(f1=(m1_mark, n1, a1), f2=(m2_mark, n2, a2), decision=decision or None,
                notes=[notes_text] if notes_text else [], label=header)


def extract_meta(html_text, eid_hint=''):
    m = re.search(r'<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>(.*?)</h1>', html_text, re.S)
    if not m:
        m = re.search(r'<title>(.*?)</title>', html_text, re.S)
    title = U(m.group(1)) if m else ''
    m2 = re.search(r'(?s)<div class="entry-content">(.*?)(?:<div class="post-item-metadata|</article>)', html_text)
    body = m2.group(1) if m2 else html_text
    date = None
    body_text = U(body)
    mm_ = re.search('[' + MARK_CHARS + ']', body_text)
    head_text = body_text[:mm_.start()] if mm_ else body_text[:1000]
    # ファイター個人成績カード付きの新テンプレート(生年月日を含む)では、本文全体を検索すると
    # 誕生日が大会日として誤検出されるため、まずファイル名のYYYYMMDDを優先する。
    fm = re.search(r'(20[0-2]\d)(\d{2})(\d{2})', eid_hint)
    if fm and 1 <= int(fm.group(2)) <= 12 and 1 <= int(fm.group(3)) <= 31:
        date = '%s-%s-%s' % (fm.group(1), fm.group(2), fm.group(3))
    else:
        dm = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', head_text)
        if dm:
            date = '%s-%02d-%02d' % (int(dm.group(1)), int(dm.group(2)), int(dm.group(3)))
        else:
            em = re.search(r'(平成|令和)(\d{1,2})年(\d{1,2})月(\d{1,2})日', head_text)
            if em:
                base = 1988 if em.group(1) == '平成' else 2018
                date = '%s-%02d-%02d' % (base + int(em.group(2)), int(em.group(3)), int(em.group(4)))
    if not date:
        # ファイル名に年だけ埋め込まれ、本文には月日のみ(年は「今年」等の相対表現)というケースの救済
        ym = re.search(r'(20[0-2]\d)', eid_hint)
        dm2 = re.search(r'(\d{1,2})月(\d{1,2})日', head_text) or re.search(r'(\d{1,2})月(\d{1,2})日', title)
        if ym and dm2:
            date = '%s-%02d-%02d' % (int(ym.group(1)), int(dm2.group(1)), int(dm2.group(2)))
    if not date:
        # U-2(2026-08、日付抽出バグ修正): 見出し・本文冒頭(head_text)には月日のみで年が
        # 無いイベントがある(実例: GODDESS OF VICTORY・DUEL.30)。本文の別セクション
        # (公式計量結果等)に年月日が明記されていることが多いため、まず月日を見出し/
        # タイトルから確定し、その月日と完全一致する「YYYY年M月D日」を本文全体
        # (head_textでは無くbody_text全体)から探す。誕生日等の無関係な日付との
        # 誤検出を避けるため、月日を固定した上でのみ本文全体を検索する
        # (無条件にbody_text全体を検索すると個人成績カードの生年月日を大会日と
        # 誤認する既知の問題があるため、head_text優先の既存方針は変えない)。
        dm3 = re.search(r'(\d{1,2})月(\d{1,2})日', head_text) or re.search(r'(\d{1,2})月(\d{1,2})日', title)
        if dm3:
            mo, da = int(dm3.group(1)), int(dm3.group(2))
            ym2 = re.search(r'(\d{4})年%d月%02d日' % (mo, da), body_text) or \
                re.search(r'(\d{4})年%d月%d日' % (mo, da), body_text)
            if ym2:
                date = '%s-%02d-%02d' % (int(ym2.group(1)), mo, da)
    if not date:
        # 本文のどこにも年月日の記載が無いケース(実例: Challnger11)の最終救済。
        # 記事のdatePublished(公開日時)は開催告知記事なら開催日の少し前であることが
        # 多く、少なくとも年は信頼できる(実測: Challnger11は開催12日前に公開)。
        # 月日は見出し/タイトルから確定済みのものを使う。
        dm4 = re.search(r'(\d{1,2})月(\d{1,2})日', head_text) or re.search(r'(\d{1,2})月(\d{1,2})日', title)
        pub = re.search(r'"datePublished"\s*:\s*"(\d{4})-\d{2}-\d{2}', html_text)
        if dm4 and pub:
            date = '%s-%02d-%02d' % (int(pub.group(1)), int(dm4.group(1)), int(dm4.group(2)))
    # 2026-08-21追加: 上記いずれかの経路で構成された日付が暦上存在しない場合の救済
    # (実例: 記事タイトル自体の誤記「11月31日 DUEL.22 試合結果」)。_bouts.py参照。
    date = _bouts.resolve_invalid_calendar_date(date, html_text)
    event = None
    h2 = re.search(r'<h2>(.*?)</h2>', body, re.S)
    if h2:
        event = U(h2.group(1))
    if not event:
        em = re.search(r'『(.+?)』', U(body)[:400])
        if em:
            event = em.group(1)
    if not event:
        event = re.sub(r'^\d{4}年\d{1,2}月\d{1,2}日\s*試合結果\s*', '', title) or title
    venue = None
    h4 = re.search(r'<h4>(.*?)</h4>', body, re.S)
    if h4:
        vt = U(h4.group(1))
        vm = re.search(r'\d{4}年\d{1,2}月\d{1,2}日[（(].[）)]\s*(.+)$', vt)
        if vm:
            venue = vm.group(1).strip() or None
    return title, date, event, venue, body


def build():
    bouts = []
    per_event_bouts = collections.Counter()
    block_total = 0
    self_unresolved = 0
    bout_seq = collections.Counter()
    files = sorted(glob.glob('raw/njkf_events/*.html'))
    for path in files:
        h = open(path, encoding='utf-8', errors='replace').read()
        eid = path.split('/')[-1][:-5]
        title, date, event, venue, body = extract_meta(h, eid)
        url = URLMAP.get(eid)
        ps = re.findall(r'(?s)<p[^>]*>(.*?)</p>', body)
        for p in ps:
            lines = get_lines_from_p(p)
            if not lines:
                continue
            parsed = parse_bout_paragraph(lines)
            if not parsed:
                continue
            block_total += 1
            for (my_mark, my_name, my_aff), (opp_mark, opp_name, opp_aff) in [
                    (parsed['f1'], parsed['f2']), (parsed['f2'], parsed['f1'])]:
                rec, amb, cands = resolve(my_name, my_aff)
                if amb or not rec:
                    self_unresolved += 1
                    continue
                result = MARK2RESULT.get(my_mark, 'unknown')
                decision = parsed['decision']
                if decision:
                    meth, rnd, ext, rs = _bouts.parse_method(decision)
                else:
                    meth, rnd, ext, rs = None, None, False, None
                oref, oamb, ocands = resolve(opp_name, opp_aff)
                ident = f"{rec['name']}|{rec['gym'] or ''}|{rec['sources'][0] if rec['sources'] else ''}"
                idx = bout_seq[ident]
                bout_seq[ident] += 1
                bouts.append(dict(
                    bout_id=f'njkf:{ident}:{idx}',
                    date=date, event=event, venue=venue,
                    fighter_slug=ident, fighter_name=rec['name'],
                    opponent_raw=f'{opp_name}（{opp_aff}）' if opp_aff else opp_name,
                    opponent_name=opp_name, opponent_affiliation=opp_aff,
                    opponent_site_slug=None,
                    opponent_ref=oref['name'] if oref else None,
                    opponent_ref_gym=oref['gym'] if oref else None,
                    opponent_resolved=oref is not None,
                    opponent_ambiguous=oamb, opponent_candidates=ocands,
                    result=result, result_mark=my_mark, method=meth, method_raw=decision or '',
                    round=rnd, is_extension=ext, ruleset=rs,
                    note=' / '.join(parsed['notes']) if parsed['notes'] else None, is_debut=False,
                    title_type=_bouts.classify_title_type(parsed.get('label')),
                    pair_key=None,
                    source_url=url or f'https://www.njkf.info/result/{eid}.html',
                ))
                per_event_bouts[eid] += 1
    return bouts, dict(block_total=block_total, self_unresolved=self_unresolved,
                        events=len(files), per_event_bouts=per_event_bouts)


# raw/njkf_index/event_urls.json(既知一覧)を生成する手段が無い(2026-08-21調査、
# CACHE_DIRコメント参照 build.py 冒頭)。cache/njkf_index/event_urls.json(コミット済み)
# から読む。fetch_njkf.pyのdiscover()はライブサイトから全量発見できるため、この
# 既知一覧は主に和集合の一部として使われるだけで、母集団拡大自体はブロックされない。
URLMAP = {}
for _u in json.load(open('cache/njkf_index/event_urls.json')):
    _id = re.sub(r'^https://www\.njkf\.info/result\d{0,4}/', '', _u)[:-5]
    URLMAP[_id] = _u


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_njkf.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_njkf.json =====')
    print('events crawled          :', stats['events'])
    print('bout paragraphs parsed  :', stats['block_total'])
    print('bout rows written       :', len(bouts))
    print('  avg bouts/event       :', round(len(bouts) / stats['events'], 2))
    print('self-side unresolved(側単位、行を作らず破棄):', stats['self_unresolved'])
    r = sum(1 for x in bouts if x['opponent_resolved'])
    print(f'opponent resolved       : {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%')
    u = [x for x in bouts if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print('opponent unresolved rows:', len(u), ' distinct:', len({x["opponent_name"] for x in u}))
    print('opponent ambiguous rows :', sum(1 for x in bouts if x['opponent_ambiguous']))
    print('result内訳:', dict(collections.Counter(x['result'] for x in bouts)))
    print('method内訳:', dict(collections.Counter(x['method'] for x in bouts)))
    print('date欠落:', sum(1 for x in bouts if not x['date']), ' venue欠落:', sum(1 for x in bouts if not x['venue']))
    ycount = collections.Counter((x['date'] or '????')[:4] for x in bouts)
    print('年別件数:', dict(sorted(ycount.items())))
