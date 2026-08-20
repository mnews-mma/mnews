# -*- coding: utf-8 -*-
"""JKA(ジャパンキックボクシング協会、jka-japan-kickboxing-association.jp)からboutを抽出する。
   SCHEMA.mdに準拠。2019年設立のため旧団体分の遡及データは無い(既知情報どおり、実測でも
   最古の記事は2019年8月)。「試合結果」インデックス(/result/)から個別記事70件を収集
   (robots.txt全許可)。

   JKAは大会主催団体ではなく所属選手の統括団体で、記事は2種類ある:
   - JKA主催と見られる自団体興行(KICK Insistなど)は全カード掲載
   - 他団体(RISE/ONE/NJKF/KNOCK OUT等)の興行は、JKA所属選手が絡む試合のみ抜粋掲載
     (Bigbangと同型: 出典はJKA公式ページ、真の主催団体は問わない)
   いずれも `<div class="text">` 内が`<br />`区切りの行構造で、
   「第N試合 ルール情報」ヘッダ行 → マーク(○/×/△/●)+選手名(所属) の行が2行 → 決着行、
   という並びが基本(まれに旧い記事でマークが選手名の前後どちらに付くか一定しない例が
   1件あるが、推測で救わず自然に未解決へ落とす)。"""
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


PAREN_END = re.compile(r'[（(]([^）(]*)[）)]\s*$')
# V-2(2026-08): 見出し行が全角山括弧で括られる回(＜第N試合...＞)、および▼で始まる回
# (スック-ペッティンディー・one-friday-fights９５等)が別テンプレートとして存在する。
# 他ソース(krossover/standup)も▼始まりの見出しを持つため、同じ許容を追加した。
# 見出し行の中身自体は構造化データに使っていない(event/venue/dateは別divから取得)ため、
# 先頭の▼／＜を許容するだけで安全(誤ってbout行を見出しと誤認する副作用は無い)。
HDR_RE = re.compile(r'^[▼＜]?\s*(第\d+試合|オープニングファイト)')
# ○の異体字(◯U+25EF・〇U+3007)と◎(タイトル戦等での勝者表記、他ソースで既にwin扱い)を
# 追加。他9ソース中6ソース(njkf/nkb/standup/krossover/deepkick/bigbang)は既にこの4文字を
# 勝ちマークとして扱っており、JKAだけがこの変換表から漏れていた(実測: ◯44件・◎31件が
# 70記事中に出現、○×△●のみの前提では従来ここが軒並み未解決になっていた)。
MARK_LEAD_RE = re.compile(r'^([○◯〇◎×△▲●])\s*(.+)$')
DECISION_KW = re.compile(r'判定|不戦勝|ノーコンテスト|ドロー|反則|時間切れ|棄権|中止|失格|無効|TKO|KO|一本|勝敗なし')
MARK2RESULT = {'○': 'win', '◯': 'win', '〇': 'win', '◎': 'win', '×': 'loss', '●': 'loss', '△': 'draw', '▲': 'draw'}
DATE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日')
VENUE_RE = re.compile(r'[（(].[）)]\s*(.*)$')


def split_name_aff(raw):
    m = PAREN_END.search(raw)
    aff = m.group(1).strip() if m else None
    name = PAREN_END.sub('', raw).strip()
    return name, aff or None


def get_lines(text_html):
    parts = re.split(r'(?i)<br\s*/?>', text_html)
    return [U(p) for p in parts if U(p)]


def parse_blocks(lines):
    blocks = []
    i, n = 0, len(lines)
    while i < n:
        if not HDR_RE.match(lines[i]):
            i += 1
            continue
        j = i + 1
        fighters, decision = [], None
        while j < n and not HDR_RE.match(lines[j]):
            l = lines[j]
            mm = MARK_LEAD_RE.match(l)
            if mm and len(fighters) < 2:
                fighters.append((mm.group(1), mm.group(2)))
                j += 1
                continue
            if decision is None and DECISION_KW.search(l) and len(l) < 100:
                decision = l
                j += 1
                continue
            j += 1
        if len(fighters) == 2:
            blocks.append(dict(fighters=fighters, decision=decision))
        i = j if j > i else i + 1
    return blocks


bout_seq = collections.Counter()


def build():
    manifest = json.load(open('raw/jka_results/_manifest.json'))
    bouts = []
    stats = dict(articles=0, blocks=0, block_fail_sides=0, self_unresolved=0)
    for h, info in sorted(manifest.items()):
        stats['articles'] += 1
        path = f'raw/jka_results/{h}.html'
        full_html = open(path, encoding='utf-8', errors='replace').read()
        tm = re.search(r'(?s)<div class="text">(.*?)</div>\s*</div>', full_html)
        if not tm:
            continue
        lines = get_lines(tm.group(1))
        date = None
        dm = re.search(r'<div class="time">(\d{4})年(\d{1,2})月(\d{1,2})日</div>', full_html)
        if dm:
            date = '%s-%02d-%02d' % (int(dm.group(1)), int(dm.group(2)), int(dm.group(3)))
        title_m = re.search(r'<div class="title">(.*?)</div>', full_html)
        event = U(title_m.group(1)) if title_m else None
        venue = None
        pm = re.search(r'<p class="date">(.*?)</p>', full_html, re.S)
        if pm:
            praw = unicodedata.normalize('NFKC', U(pm.group(1)))
            vm = VENUE_RE.search(praw)
            if vm:
                venue = vm.group(1).strip() or None
        blks = parse_blocks(lines)
        stats['blocks'] += len(blks)
        for b in blks:
            (m1, raw1), (m2, raw2) = b['fighters']
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
            for (my_mark, my_name, my_aff, my_raw), (opp_mark, opp_name, opp_aff, opp_raw) in [
                    ((m1, n1, a1, raw1), (m2, n2, a2, raw2)),
                    ((m2, n2, a2, raw2), (m1, n1, a1, raw1))]:
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
                    bout_id=f'jka:{ident}:{idx}',
                    date=date, event=event, venue=venue,
                    fighter_slug=ident, fighter_name=rec['name'],
                    opponent_raw=opp_raw, opponent_name=opp_name, opponent_affiliation=opp_aff,
                    opponent_site_slug=None,
                    opponent_ref=oref['name'] if oref else None,
                    opponent_ref_gym=oref['gym'] if oref else None,
                    opponent_resolved=oref is not None,
                    opponent_ambiguous=oamb, opponent_candidates=ocands,
                    result=result, result_mark=my_mark, method=meth, method_raw=decision or '',
                    round=rnd, is_extension=ext, ruleset=rs, note=None, is_debut=False,
                    title_type=None,  # 5団体分は種別抽出の対象外(スコープ外指示)。型整合のためnullで統一
                    pair_key=None,
                    source_url=info['url'],
                ))
    return bouts, stats


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_jka.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_jka.json =====')
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
