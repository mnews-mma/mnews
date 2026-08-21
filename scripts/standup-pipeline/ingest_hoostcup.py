# -*- coding: utf-8 -*-
"""HOOST CUP公式(hoostcup.com)の大会結果ページからboutを抽出する。SCHEMA.mdに準拠。
   robots.txtファイル自体が存在しない(レグ③実測)ため、負荷をかけない前提でクロール間隔を
   広めに取った(1秒/リクエスト)。Shift_JISエンコード。テンプレートが2種類ある:
   旧(2012〜2013頃、let11/ppt11/box11クラス)と新(2015〜現在、f11/p11/d11クラス)。
   勝敗はマーク文字ではなく写真<p>タグのclass="win"の有無で判定する。"""
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


def txt(pattern, s, flags=re.S):
    m = re.search(pattern, s, flags)
    return U(m.group(1)) if m else None


# (?<!\d) で「10戦9勝1敗4KO」のようなプロフィール文中のKO数(戦績統計)を除外する。
# 決着文言のKO/TKOは数字に直接続かない(「1R KO」「3R終了時TKO」等、間に空白かR表記が入る)ため、
# この除外でも正規の決着文言は取りこぼさない。
DECISION_KW = re.compile(r'判定|不戦勝|ノーコンテスト|ドロー|引き分け|反則|時間切れ|棄権|中止|失格|無効|(?<!\d)TKO|(?<!\d)KO')


def labeled_paragraphs(s):
    """class名が数字違いでも(f11/f21/let11/let21等)構わず、単一classの<p>の中身を出現順に返す。
       写真<p class="p11 win">のような複数class・<img>のみのpタグは自然に除外される。
       戻り値は(生HTML片, U()整形済みテキスト)のタプル。生HTML片は決着文の<br/>分割に使う
       (同一<p>内に決着文とダウン詳細が<br/>区切りで同居する回があり、U()はそのまま
       スペースへ変換してしまい1行の決着として連結されてしまうため)。"""
    out = []
    for cls, val in re.findall(r'<p class="([a-z]+\d*)">(.*?)</p>', s, re.S):
        if cls == 'clear':
            continue
        v = U(val)
        if v:
            out.append((val, v))
    return out


def split_decision(raw):
    """決着<p>の生HTML片から、実際の決着文(1行目)と補足(2行目以降、<br/>区切り)を分離する。
       あわせて「※」以降(補足注記)も決着文から切り出す(先頭が「※」の場合は表記上の記号と
       みなし、2つ目の「※」を区切りに使う)。"""
    lines = [U(x) for x in re.split(r'<br\s*/?>', raw)]
    lines = [x for x in lines if x]
    if not lines:
        return None, None
    first, rest = lines[0], lines[1:]
    star_positions = [m.start() for m in re.finditer('※', first)]
    star_positions = [p for p in star_positions if p > 0]
    if star_positions:
        cut = star_positions[0]
        rest = [first[cut + 1:].strip()] + rest
        first = first[:cut].strip()
    # <br/>で別行になった注記(2行目以降)も先頭が「※」で始まる回があるため、行ごとに除去する。
    rest = [re.sub(r'^※', '', x).strip() for x in rest]
    detail = '、'.join(x for x in rest if x) or None
    return first or None, detail


def norm_loose(s):
    return re.sub(r'[\s・]', '', unicodedata.normalize('NFKC', s or '')).lower()


_VS_MARK2WIN = {'○': True, '●': True, '◯': True, '×': False}


def parse_vs_style(block):
    """2022年10月以降のテンプレート: 所属情報なし、<p class="t12">Name1<br/>VS<br/>Name2</p>の後に
       <p class="f31">【勝者:WinnerName】決着文</p>(部分一致の短縮名で書かれることがある)。
       まれに名前の先頭に写真マークと同じ意味の○/×が直接付き(【勝者】表記が無い回、
       実例: 2022-07-10 KINGS NAGOYA11の実方宏介×/MAMUTI○)、この場合は【勝者】表記を
       待たずマーク自体で勝敗を確定できる(旧テンプレのclass="win"判定と同じ情報源)。
       マークを剥がさずnameに含めると選手名解決(resolve)がマーク付き文字列で失敗するため、
       判定に使った後は必ずnameから除去する。"""
    m = re.search(r'<p class="t12[^"]*">(.*?)</p>', block, re.S)
    if not m:
        return None
    parts = [U(x) for x in re.split(r'<br\s*/?>', m.group(1))]
    names = [p for p in parts if p and p.strip().upper() != 'VS']
    if len(names) != 2:
        return None
    raw1, raw2 = names
    mark1 = raw1[0] if raw1[:1] in '△×○●◯' else None
    mark2 = raw2[0] if raw2[:1] in '△×○●◯' else None
    n1 = raw1[1:].strip() if mark1 else raw1
    n2 = raw2[1:].strip() if mark2 else raw2
    # 2026-08-21回帰修正: hoostcup.comが試合動画リンク段落(<p class="ali2">…試合動画は
    # こちらをCLICK…</p>)をVS表記と決着文の間に追加するテンプレート変更を行った
    # (実測: 2026-07-26 CENTRAL KICK Vol.1)。従来は「t12の直後の最初の<p class="...">」を
    # 決着文とみなしていたため、この動画リンク段落を誤って拾い0件になっていた。
    # これは新しいテンプレートへの対応ではなく、既存テンプレート(【勝者:…】/【ドロー】
    # 形式)の決着文を含む段落が現れるまで読み飛ばす形の回帰修正。
    tail = block[m.end():]
    decision_raw = None
    for pm in re.finditer(r'<p class="[a-z]+\d*">(.*?)</p>', tail, re.S):
        cand = U(pm.group(1))
        if re.match(r'【(勝者|ドロー|引き分け)', cand) or DECISION_KW.search(cand):
            decision_raw = cand
            break
    if decision_raw is None:
        return None
    wm = re.match(r'【勝者[:：]\s*([^】]*)】\s*(.*)$', decision_raw, re.S)
    if wm:
        winner_raw, decision = wm.group(1).strip(), wm.group(2).strip()
        w1 = norm_loose(winner_raw) in norm_loose(n1) or norm_loose(n1) in norm_loose(winner_raw)
        w2 = norm_loose(winner_raw) in norm_loose(n2) or norm_loose(n2) in norm_loose(winner_raw)
        if w1 == w2:  # どちらとも取れる／どちらとも取れない場合は決め打ちしない
            return None
    elif re.match(r'【(ドロー|引き分け)】', decision_raw):
        w1 = w2 = False
        decision = decision_raw
    elif mark1 in _VS_MARK2WIN and mark2 in _VS_MARK2WIN and _VS_MARK2WIN[mark1] != _VS_MARK2WIN[mark2]:
        w1, w2 = _VS_MARK2WIN[mark1], _VS_MARK2WIN[mark2]
        decision = decision_raw
    else:
        # △等、勝敗を一意に確定できないマークの組み合わせは推測しない(既存方針を維持)
        return None
    return dict(f1=(n1, None, w1), f2=(n2, None, w2), decision=decision)


def parse_page(html_text):
    """戻り値: [{f1:(name,gym,win_bool), f2:(...), decision:str}]
       テンプレートが複数世代あり(f11/f12使い回し、f11/f21/f31+f12/f22等)class名の数字が
       安定しないため、位置(側ブロック内で1番目=名前・2番目=所属)で拾う。"""
    hdr_iter = list(re.finditer(r'<h4[^>]*>(.*?)</h4>', html_text, re.S))
    bouts = []
    for i, m in enumerate(hdr_iter):
        start = m.end()
        end = hdr_iter[i + 1].start() if i + 1 < len(hdr_iter) else len(html_text)
        block = html_text[start:end]
        header_text = U(m.group(1))
        split_pos = None
        for marker in ('d12', 'box12'):
            p = block.find(marker)
            if p >= 0 and (split_pos is None or p < split_pos):
                split_pos = p
        if split_pos is None:
            vs_result = parse_vs_style(block)
            if vs_result:
                vs_result['label'] = header_text
                bouts.append(vs_result)
            continue
        side1, rest = block[:split_pos], block[split_pos:]
        win1 = 'win' in side1
        p1 = labeled_paragraphs(side1)
        if len(p1) < 2:
            continue
        n1, g1 = p1[0][1], p1[1][1]
        p2_all = labeled_paragraphs(rest)
        # restには「相手の名前/所属/戦績等」に続けて決着文・大会レポート文も混在するため、
        # 決着キーワードを含む最初の段落を decision として切り出し、それより前を相手情報として使う。
        # プロフィール文(生年月日・戦績等)の「N戦N勝N敗nKO」のような戦績統計はDECISION_KWの
        # 除外対象(数字直後のKO)なので、このマッチは実際の決着文のみを拾う。
        decision_idx = next((i2 for i2, (raw, v) in enumerate(p2_all) if DECISION_KW.search(v)), None)
        win2 = 'win' in rest[:rest.find(p2_all[decision_idx][0]) if decision_idx is not None else len(rest)]
        info2 = p2_all[:decision_idx] if decision_idx is not None else p2_all
        if len(info2) < 2:
            continue
        n2, g2 = info2[0][1], info2[1][1]
        # 決着<p>は<br/>区切りで「決着文」「ダウン詳細」等の複数行を1つのタグに収めている回が
        # あるため、1行目だけを決着文として使い、2行目以降はextra_detailとして分離する。
        decision_raw = p2_all[decision_idx][0] if decision_idx is not None else None
        decision, extra_detail = split_decision(decision_raw) if decision_raw is not None else (None, None)
        if not n1 or not n2:
            continue
        bouts.append(dict(f1=(n1, g1, win1), f2=(n2, g2, win2), decision=decision, label=header_text, extra_detail=extra_detail))
    return bouts


def extract_event_meta(html_text, eid):
    title_m = re.search(r'<title>(.*?)</title>', html_text, re.S)
    title = U(title_m.group(1)) if title_m else eid
    dm = re.match(r'^(\d{4})(\d{2})(\d{2})', eid)
    date = '%s-%s-%s' % (dm.group(1), dm.group(2), dm.group(3)) if dm else None
    event = re.sub(r'【ホーストカップHoostCup】.*$', '', title).strip() or title
    venue = None
    vm = re.search(r'\d{4}年\d{1,2}月\d{1,2}日\s+(\S.*)$', title)
    if vm:
        venue = vm.group(1).strip() or None
    return title, date, event, venue


def build():
    bouts = []
    self_unresolved = 0
    bout_seq = collections.Counter()
    files = sorted(glob.glob('raw/hoostcup_events/*.html'))
    per_event = collections.Counter()
    for path in files:
        raw = open(path, 'rb').read()
        h = raw.decode('shift_jis', errors='replace')
        # U-2(2026-08、コメント内残骸の誤解析修正): テンプレート移行時にコメントアウトされた
        # 旧テンプレートの<h4>ブロックがそのままページに残っており、削除せずに<!-- -->で
        # 囲っただけになっている(実例: 2022-07-10のKINGS NAGOYA11、実方宏介戦・
        # 女子Sライト級タイトルマッチが該当)。parse_page()は<h4>を単純に全件走査して
        # ブロック境界を決めるため、コメント内の重複<h4>を実在の試合として数えてしまい、
        # ブロック境界が1件分ズレて隣接する試合の決着文が入れ替わる(剛王/康輝戦・
        # 清水大輝/田中恒星戦で実測)。ライブページの表示内容のみを対象にするのが本来の
        # 仕様であるため、以降の全抽出処理より前でコメントを除去する。
        h = re.sub(r'(?s)<!--.*?-->', '', h)
        eid = path.split('/')[-1][:-5]
        title, date, event, venue, = extract_event_meta(h, eid)
        url = f'https://www.hoostcup.com/13fight/{eid}.html'
        parsed_bouts = parse_page(h)
        for pb in parsed_bouts:
            (n1, g1, w1), (n2, g2, w2) = pb['f1'], pb['f2']
            decision = pb['decision']
            is_draw = bool(decision and ('ドロー' in decision or '引き分け' in decision))
            is_no_contest = bool(decision and '無効試合' in decision)
            # 判定スコアの数値比較によるフォールバック(2026-08実装): 写真の"win"クラスが
            # 両サイドとも検出できない(w1==w2==False)ケースの一部は、決着文に
            # 「判定N-M」(何人の審判がどちらを支持したかの集計値、生の採点(30-29等)とは別)が
            # そのまま書かれており、機械的に勝敗を導出できる。方向性は実測で較正済み:
            # 「判定N-M」のNは常にside1(f1、ページ上で先に登場する側)の支持数、Mはside2(f2)の
            # 支持数(2013-06-16のHoostCup KINGS実測: 佐藤嘉洋=side1=勝者=N側 で確認)。
            # N==Mは技術上の引き分け(3者ともドローと採点)であり、明示的な「ドロー」の
            # 文言が無くても引き分けとして扱ってよい。
            # 該当しない場合(判定N-Mの形式に一致しない、または既にwin1/win2で判定済み)は
            # 一切上書きしない(推測で埋めない既存方針を維持)。
            score_win1 = score_win2 = None
            if not w1 and not w2 and not is_draw and not is_no_contest and decision:
                sm = re.search(r'判定\s*[（(]?\s*(\d)\s*-\s*(\d)', decision)
                if sm:
                    s_n, s_m = int(sm.group(1)), int(sm.group(2))
                    if s_n > s_m:
                        score_win1, score_win2 = True, False
                    elif s_n < s_m:
                        score_win1, score_win2 = False, True
                    else:
                        is_draw = True
            for (my_name, my_aff, my_win, my_score_win), (opp_name, opp_aff, opp_win, opp_score_win) in [
                    ((n1, g1, w1, score_win1), (n2, g2, w2, score_win2)),
                    ((n2, g2, w2, score_win2), (n1, g1, w1, score_win1))]:
                rec, amb, cands = resolve(my_name, my_aff)
                if amb or not rec:
                    self_unresolved += 1
                    continue
                if is_draw:
                    result = 'draw'
                elif my_win:
                    result = 'win'
                elif opp_win:
                    result = 'loss'
                elif is_no_contest:
                    result = 'no_contest'
                elif my_score_win is True:
                    result = 'win'
                elif my_score_win is False and opp_score_win is True:
                    result = 'loss'
                else:
                    result = 'unknown'
                # 「※」以降(補足注記)は決着文言そのものではないため、method_raw自体から
                # 切り離してnoteへ回す(以前はnoteへ抽出するだけでmethod_rawには残したまま
                # だったため、決着欄に長大な注記が同居したまま残る不具合があった)。
                # parse_page経由の行はsplit_decisionで既に「※」除去済みだが、parse_vs_style
                # (2022年10月以降のテンプレート)経由の行はここで初めて処理する。
                note = pb.get('extra_detail')
                if decision and '※' in decision:
                    star_note = decision.split('※', 1)[1].strip() or None
                    decision = decision.split('※', 1)[0].strip() or None
                    note = f'{note}、{star_note}' if note and star_note else (note or star_note)
                if decision:
                    meth, rnd, ext, rs = _bouts.parse_method(decision)
                else:
                    meth, rnd, ext, rs = None, None, False, None
                oref, oamb, ocands = resolve(opp_name, opp_aff)
                ident = f"{rec['name']}|{rec['gym'] or ''}|{rec['sources'][0] if rec['sources'] else ''}"
                idx = bout_seq[ident]
                bout_seq[ident] += 1
                bouts.append(dict(
                    bout_id=f'hoostcup:{ident}:{idx}',
                    date=date, event=event, venue=venue,
                    fighter_slug=ident, fighter_name=rec['name'],
                    opponent_raw=f'{opp_name}（{opp_aff}）' if opp_aff else opp_name,
                    opponent_name=opp_name, opponent_affiliation=opp_aff,
                    opponent_site_slug=None,
                    opponent_ref=oref['name'] if oref else None,
                    opponent_ref_gym=oref['gym'] if oref else None,
                    opponent_resolved=oref is not None,
                    opponent_ambiguous=oamb, opponent_candidates=ocands,
                    result=result, result_mark='win' if my_win else ('win-opp' if opp_win else None),
                    method=meth, method_raw=decision or '',
                    round=rnd, is_extension=ext, ruleset=rs, note=note, is_debut=False,
                    title_type=_bouts.classify_title_type(pb.get('label')),
                    pair_key=None,
                    source_url=url,
                ))
                per_event[eid] += 1
    return bouts, dict(self_unresolved=self_unresolved, events=len(files), per_event=per_event)


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_hoostcup.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_hoostcup.json =====')
    print('events crawled          :', stats['events'])
    print('bout rows written       :', len(bouts))
    print('  avg bouts/event       :', round(len(bouts) / stats['events'], 2))
    print('self-side unresolved(側単位、行を作らず破棄):', stats['self_unresolved'])
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
    print('events with zero bouts  :', sum(1 for _ in glob.glob('raw/hoostcup_events/*.html')) - len({x['source_url'] for x in bouts}))
