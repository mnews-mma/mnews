# -*- coding: utf-8 -*-
"""Stand up公式(standup-kick.com)からboutを抽出する。SCHEMA.mdに準拠。
   大会結果ページ型(選手ページに戦績表が無いため。/fighter/{id}/は写真・所属・階級のみで
   試合履歴なし、と3ページ実測で確認済み)。両サイドを走査し、名簿2,482人に解決できる側だけを
   fighter視点としてbout化する(ingest_rizin.py/ingest_deepkick.pyと同じ方針)。

   アマチュア結果記事(/amanews/result/)は「◇ワンマッチ勝利者」形式で勝者名のみ掲載・敗者(対戦相手)が
   一切記載されないため、そもそも1vs1のboutを構成できない(3記事実測で確認、構造的欠落であり
   件数の問題ではない)。よって対象外。

   プロ結果記事(/pronews/result/、WP REST APIのcustom post type 'pronews'から24件抽出)のみ対象。
   ただしレイアウトが年代で複数世代あり(vol.2は「×A vs ○B」1行形式、2021年は▼ヘッダ+マーク別行、
   2022年以降は▼ヘッダ行に両者・決着まで同居する形式)、さらに同一記事内でも「勝者だけマーク付きで
   紹介され敗者名は本文中の地の文にしか出てこない」ブロックが混在する(vol.21で実測確認)。
   マーク付きで両者が明示されているブロックのみboutにし、片方しか無いブロックは推測せず捨てる。
   WP REST APIのcontent.rendered には一部記事(vol.21等)で本文が反映されておらず(カスタムフィールド
   経由と見られる)、レンダリング済みHTMLを直接クロールする方式に切り替えて解消した。

   V-2(2026-08、見送り確定・5大会): 未収録大会のうち5大会が「勝者のみマーク付きで
   明示され、敗者名は本文中の地の文にしか出てこない」構造(上記の既知の構造的制約と
   同型)。他の未対応ソースのような特定テンプレートへの対応漏れではなく、出典側に
   敗者名を機械的に切り出せる形での掲載が無いこと自体が原因のため、推測で敗者名を
   補完しない方針上、恒久的に対象外(詳細は
   out/kick-njkf-nkb-standup-deferred-templates.md参照)。"""
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


# ================= イベント記事のパース =================

MARK_SEG_RE = re.compile(r'([○〇×◎△●])\s*([^○〇×◎△●]*)')
NAME_TAIL_RE = re.compile(r'^(.*?[）)])(.*)$')
PAREN_END = re.compile(r'[（(]([^）(]*)[）)]\s*$')
DEBUT_LEAD_RE = re.compile(r'^[※＊]\s*デビュー戦\s*')
DECISION_KW = re.compile(r'判定|不戦勝|ノーコンテスト|ドロー|反則|時間切れ|棄権|中止|失格|無効|TKO|KO|勝敗なし')
HDR_RE = re.compile(r'^(?:[▼◆]\s*)?第\d+試合|^[▼◆]\s*メインイベント')
DATE_VENUE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日[（(].[）)]\s*(.*)$')
DATE_VENUE_NOYEAR_RE = re.compile(r'^(\d{1,2})/(\d{1,2})[（(].[）)]\s*(.*)$')
TITLE_RE = re.compile(r'[「『](.+?)[」』]')


def split_name_aff(raw):
    m = PAREN_END.search(raw)
    aff = m.group(1).strip() if m else None
    name = PAREN_END.sub('', raw).strip()
    return name, aff or None


H2_RE = re.compile(r'(?s)<h2>(.*?)</h2>')


def extract_h2_title(path):
    h = open(path, encoding='utf-8', errors='replace').read()
    m = H2_RE.search(h)
    if not m:
        return None
    t = U(m.group(1))
    t = re.sub(r'^(?:プロイベント|試合結果)\s*', '', t)
    t = re.sub(r'\s*試合結果(?:記事)?\s*$', '', t)
    return t.strip() or None


def get_lines(path):
    h = open(path, encoding='utf-8', errors='replace').read()
    i = h.find('single_area')
    body = h[i:i + 60000] if i > 0 else h
    # フッター(直近記事一覧・コピーライト等)混入を避けるため本文領域の終端で打ち切る
    j = body.find('id="comments"')
    if j < 0:
        j = body.find('professional_area')
    if j > 0:
        body = body[:j]
    ps = re.findall(r'(?s)<p[^>]*>(.*?)</p>', body)
    return [U(p) for p in ps if U(p)]


def extract_date_venue(lines, published, source_url=None):
    for l in lines[:6]:
        m = DATE_VENUE_RE.search(l)
        if m:
            date = '%s-%02d-%02d' % (int(m.group(1)), int(m.group(2)), int(m.group(3)))
            venue = m.group(4).strip()
            venue = re.split(r'にて', venue)[0].strip()
            venue = venue if venue and len(venue) < 40 else None
            return date, venue
    # 年が省略された「6/13（日）会場」形式 -> 公開日の年で補う(deepkick方式と同じ、年またぎのみ-1で調整)
    py, pm = int(published[:4]), int(published[5:7])
    for l in lines[:6]:
        m = DATE_VENUE_NOYEAR_RE.match(l)
        if m:
            mo, da = int(m.group(1)), int(m.group(2))
            year = py - 1 if mo > pm + 1 else py
            venue = m.group(3).strip() or None
            return '%s-%02d-%02d' % (year, mo, da), venue
    # PR-10: 本文が複数日程(1回戦は7/24と9/18の2大会に分けて実施、等)を並記しているために
    # 上記どちらの形式にも一致しない記事があった。standup-kick.comのURLは
    # /pronews/result/YYYY/MM/DD/ID/ の形式で記事自身の公開日(=通常イベント当日または
    # 翌日)を含んでおり、本文からの日付抽出が全て失敗した場合の最終フォールバックとして使う。
    if source_url:
        um = re.search(r'/result/(\d{4})/(\d{2})/(\d{2})/', source_url)
        if um:
            return '%s-%s-%s' % (um.group(1), um.group(2), um.group(3)), None
    return None, None


SUBHDR_RE = re.compile(r'^▽\s*(.+)$')


def extract_event(lines, fallback_title):
    # 「▽Stand up vol.N」— 1記事が2大会分をまとめて掲載する回(vol.6&7)で、この記事が
    # どちら側の内容かを表す。冒頭の紹介文にある『Stand up vol.6』『vol.7』両方への
    # ブラケット一致より優先する(先勝ちだと常にvol.6を誤って拾うため)。
    for l in lines:
        m = SUBHDR_RE.match(l)
        if m:
            return m.group(1).strip()
    for l in lines[:6]:
        m = TITLE_RE.search(l)
        if m:
            return m.group(1)
    return fallback_title


def scan_line(l, fighters, decision):
    """1行からマーク区間を全て拾う。区間内の名前(括弧まで)と、括弧より後ろの残り(決着文言候補)を分ける。
       2022年以降の型は▼ヘッダ行1行に両者・決着まで同居するため、行頭一致ではなく行内探索が必要。"""
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
            if decision is None and tail and DECISION_KW.search(tail) and len(tail) < 60:
                decision = tail
    elif decision is None and DECISION_KW.search(l) and len(l) < 60:
        decision = l
    return fighters, decision


def parse_blocks(lines):
    """戻り値: [{fighters:[(mark,raw),...], decision}] — 両者マーク揃いのブロックのみ"""
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
    posts_meta = {p['h']: p for p in
                  [dict(h=h, **info) for h, info in json.load(open('raw/standup_pro_results/_manifest.json')).items()]}
    bouts = []
    stats = dict(articles=0, blocks=0, block_fail_sides=0, self_unresolved=0)
    for h, info in sorted(posts_meta.items(), key=lambda x: x[1]['date']):
        stats['articles'] += 1
        path = f'raw/standup_pro_results/{h}.html'
        lines = get_lines(path)
        date, venue = extract_date_venue(lines, info['date'], info.get('url'))
        event = extract_event(lines, extract_h2_title(path) or f'Stand up記事{h}')
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
                    bout_id=f'standup:{ident}:{idx}',
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
    json.dump(bouts, open('bouts_standup.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_standup.json =====')
    print('記事数(プロ試合結果のみ)  :', stats['articles'])
    print('両者マーク揃いのブロック  :', stats['blocks'])
    print('  名前欠落で破棄         :', stats['block_fail_sides'])
    print('  self未解決で破棄(側単位):', stats['self_unresolved'])
    print('bout rows written        :', len(bouts))
    r = sum(1 for x in bouts if x['opponent_resolved'])
    print(f'opponent resolved       : {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%' if bouts else 'no bouts')
    u = [x for x in bouts if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print('opponent unresolved rows:', len(u), ' distinct:', len({x["opponent_name"] for x in u}))
    print('opponent ambiguous rows :', sum(1 for x in bouts if x['opponent_ambiguous']))
    print('result内訳:', dict(collections.Counter(x['result'] for x in bouts)))
    print('method内訳:', dict(collections.Counter(x['method'] for x in bouts)))
    print('date欠落:', sum(1 for x in bouts if not x['date']), ' venue欠落:', sum(1 for x in bouts if not x['venue']))
    ycount = collections.Counter((x['date'] or '????')[:4] for x in bouts)
    print('年別件数:', dict(sorted(ycount.items())))
