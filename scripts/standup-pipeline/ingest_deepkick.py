# -*- coding: utf-8 -*-
"""DEEP☆KICK公式(deep-kick.com)の大会結果ページからboutを抽出する。SCHEMA.mdに準拠。
   大会結果ページ型(選手ページではなく大会ごとの記事)のため、1試合につき両サイドを走査し、
   名簿2,482人に解決できる側だけをfighter視点としてbout化する(ingest_rizin.pyと同じ方針)。
   新規スクレイピングは robots.txt 全許可を確認済み(戦績第2期レグ③)。"""
import re, glob, html, json, unicodedata, collections, sys

sys.path.insert(0, '.')
import bouts as _bouts

U = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

# raw/deepkick_index/index.json(既知118件)を生成する手段が無い(2026-08-21調査、
# CACHE_DIRコメント参照 build.py 冒頭)。cache/deepkick_index/index.json(コミット済み)
# から読む。DEEP☆KICKは一覧ページがクライアントサイドレンダリングのため、この118件から
# 母集団を広げる自動手段が無く、恒久的にこの既知件数が上限になる(名簿自動拡張は対象外)。
IDX = json.load(open('cache/deepkick_index/index.json'))
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
    """(record_or_None, ambiguous_bool, candidates_or_None) — 第3弾の同名異人ルールを踏襲"""
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


# ================= イベントページのパース =================

HDR_RE = re.compile(r'^[▼◆](.+)$')
MARK_RE = re.compile(r'^([○〇×◎△])\s*(.+)$')
PAREN_END = re.compile(r'[（(]([^）(]*)[）)]\s*$')
VS_RE = re.compile(r'^\s*[vV][sS]\s*$')
DECISION_KW = re.compile(r'判定|不戦勝|ノーコンテスト|ドロー|反則|時間切れ|棄権|中止|失格|無効|TKO|KO|勝敗なし')
MARK2RESULT = {'○': 'win', '〇': 'win', '◎': 'win', '×': 'loss', '△': 'draw'}


def is_fline(l):
    # マークの無い「Name（Gym）」行は大会中止時の予定カード告知・トーナメント出場予定選手一覧
    # (階勇弥/KING皇兵など、1v1に対応しない羅列)と区別できないため、マーク必須とする。
    return bool(MARK_RE.match(l))


CANCEL_RE = re.compile(r'開催を中止|大会(?:の)?中止|開催中止')


def split_name_aff(raw):
    m = PAREN_END.search(raw)
    aff = m.group(1).strip() if m else None
    name = PAREN_END.sub('', raw).strip()
    return name, aff


def get_lines(html_path):
    h = open(html_path, encoding='utf-8', errors='replace').read()
    m = re.search(r'(?s)<div class="blog-article__content">(.*?)<div class="blog-article__footer">', h)
    body = m.group(1) if m else h
    # U-4(2026-08、合同記事「第N部」対応): 通常は<p>タグのみで十分だが、2大会分を1記事に
    # まとめた合同速報記事(例: DEEP☆KICK46・47)では、大会の切れ目を示す「第N部 大会名」の
    # 見出しが<h1>タグで挿入される(<p>タグでは無い)。<p>だけを見ると見出しが消えて2大会分の
    # bout行が地続きになり、build()が1つの大会名しか割り当てられなくなるため、<h1>も
    # document order通りに拾う。既存の単独大会記事(117件、サンプル17件で確認済み)は本文中に
    # <h1>を含まないため、この変更は既存の抽出結果に影響しない。
    tags = re.findall(r'(?s)<(?:h1|p)[^>]*>(.*?)</(?:h1|p)>', body)
    lines = [U(t) for t in tags]
    return [l for l in lines if l]


_FOOTER_DATE_RE = re.compile(r'([^◎\n]+?)(\d{4}年\s*\d{1,2}月\d{1,2}日|同日開催|同日)')


def _norm_footer_name(s):
    return s.strip('◎( )株式会社　 ').strip()


def extract_section_dates(html_path):
    """U-4(2026-08、合同記事の日付対応): 合同速報記事では日付が本文<p>/<h1>ではなく、
       末尾の<div class="blog-body__text">内の素の<br>区切りテキスト(大会名+日付が
       連続して1つのテキストノードになっている)にのみ現れる。get_lines()は<p>/<h1>のみを
       拾うためこの日付欄を取得できない。この関数はraw HTMLを直接読み、「大会名」+
       「YYYY年M月D日」または「同日開催/同日」のペアを本文全体から機械的に拾い、
       {大会名(先頭の◎・社名接頭辞等を除いた正規化形): date文字列} の辞書を返す
       (通常の単独大会記事にはこのパターンが無いため空辞書になり、既存の抽出には
       影響しない)。呼び出し側もキーを同じ正規化関数で揃えてから突き合わせること。"""
    h = open(html_path, encoding='utf-8', errors='replace').read()
    m = re.search(r'(?s)<div class="blog-article__content">(.*?)<div class="blog-article__footer">', h)
    body = m.group(1) if m else h
    texts = re.findall(r'(?s)<div class="blog-body__text[^"]*"[^>]*>(.*?)</div>', body)
    if not texts:
        return {}
    plain = re.sub(r'<br\s*/?>', '\n', texts[-1])
    plain = U(plain)
    pairs = _FOOTER_DATE_RE.findall(plain)
    result = {}
    last_date = None
    for name, date_or_same in pairs:
        name = _norm_footer_name(name)
        if date_or_same.startswith('同日'):
            date = last_date
        else:
            dm = re.match(r'(\d{4})年\s*(\d{1,2})月(\d{1,2})日', date_or_same)
            date = '%s-%02d-%02d' % (int(dm.group(1)), int(dm.group(2)), int(dm.group(3)))
            last_date = date
        if name and date:
            result[name] = date
    return result


def extract_date(lines, title, published):
    for l in lines[:8]:
        m = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', l)
        if m:
            return '%s-%02d-%02d' % (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    py, pm = int(published[:4]), int(published[5:7])
    for l in lines[:8]:
        m = re.search(r'(\d{1,2})月(\d{1,2})日', l)
        if m:
            mo, da = int(m.group(1)), int(m.group(2))
            year = py - 1 if mo > pm + 1 else py
            return '%s-%02d-%02d' % (year, mo, da)
    m = re.match(r'^(\d{1,2})\.(\d{1,2})\s', title)
    if m:
        mo, da = int(m.group(1)), int(m.group(2))
        year = py - 1 if mo > pm + 1 else py
        return '%s-%02d-%02d' % (year, mo, da)
    return None


def extract_venue(lines):
    for l in lines[:8]:
        m = re.search(r'(.+?)において', l)
        if m:
            v = re.sub(r'^.*\d{4}年\d{1,2}月\d{1,2}日（.）\s*', '', m.group(1))
            v = re.sub(r'^.*\d{1,2}月\d{1,2}日（.）\s*', '', v)
            v = v.strip()
            if v and len(v) < 40:
                return v
    for i, l in enumerate(lines[:8]):
        if re.match(r'^\d{4}年\d{1,2}月\d{1,2}日', l) and i + 1 < len(lines):
            nxt = lines[i + 1]
            if not HDR_RE.match(nxt) and '・' in nxt and len(nxt) < 30:
                return nxt
    return None


def extract_event_name(lines, title):
    # U-2(2026-08、大会名抽出バグ修正): 記事本文中の『』は大会名を示すのが通常だが、
    # 稀に選手の発言引用(「山口も『いつでもやってやる。…』と受諾した」)も同じ記号を
    # 使うため、そのまま最初の一致を採用すると引用文を大会名と誤認する
    # (実例: DEEP☆KICK 27、eid=4233860)。大会名は文として完結しない短い固有名詞で
    # 句点(。)を含まないのに対し、地の文中の引用は文になっているため句点を含む。
    # 全118件のうち句点を含む『』一致は上記1件のみ(2026-08-19実測)で、この判定を
    # 加えても既存の正しい大会名抽出には一切影響しない。
    # 2026-08-21追加(週次自動更新の実走で発見): 『』一致が句点を含まなくても、
    # タイトル由来の大会名(下記title_derived)の**短縮形の接頭辞**でしかない場合が
    # ある(実例: eid=41033316、本文中の非公式な言及『DEEP☆KICK ZERO』が、正しい
    # 大会名「DEEP☆KICK ZERO 05」の末尾の号数を欠いた短縮形になっていた)。全118件を
    # 機械突合した結果、この「quoteがtitle_derivedの真の接頭辞」パターンは3件のみで
    # (他15件はquote/title間で号数自体が食い違う別種の問題、個別確認が必要なため
    # 対象外)、この3件に限りtitle_derived側を採用する方が確実に正しい。
    title_derived_for_prefix_check = re.sub(r'\s*(試合)?結果速報\s*$|\s*(試合)?結果\s*$', '', title)
    title_derived_for_prefix_check = re.sub(r'^\d{1,2}\.\d{1,2}\s+\S+\s+', '', title_derived_for_prefix_check).strip()
    for l in lines[:8]:
        m = re.search(r'『(.+?)』', l)
        if m and '。' not in m.group(1):
            quote = m.group(1)
            if title_derived_for_prefix_check.startswith(quote) and title_derived_for_prefix_check != quote:
                return title_derived_for_prefix_check
            return quote
    # U-4(2026-08): 「○○結果速報」(速報記事)というタイトル末尾パターンにも対応。
    # 既存の「○○結果」「○○試合結果」は変更せず、追加のalternativeとして扱う。
    t = re.sub(r'\s*(試合)?結果速報\s*$|\s*(試合)?結果\s*$', '', title)
    t = re.sub(r'^\d{1,2}\.\d{1,2}\s+\S+\s+', '', t)
    return t.strip() or title


SECTION_RE = re.compile(r'^第(\d+)部\s*(.+)$')
# U-4(2026-08、合同記事対応の副作用修正): 「第N部」は本文の地の文でも普通に使われる表現
# (例: 「第1部『DEEP☆KICK ZERO 14』に続き、...」という試合レポートの書き出し)。
# 真の見出しは短い固有名詞のみ(句読点を含まない)で構成されるため、読点・句点を含む、
# または一定の長さを超える行は地の文とみなして見出し扱いしない(全124件のうち
# 地の文で誤爆したのは4件〈ZERO15・17・23・25〉、この判定でいずれも除外できることを確認済み)。
_SECTION_MAX_LEN = 30


def split_sections(lines):
    """U-4(2026-08、合同記事対応): 「第N部 大会名」の<h1>見出し(get_lines()でp/h1混在のまま
       document order通りに拾われている)を境に、(大会名, その区間のlines)の一覧へ分割する。
       見出しが無ければ従来通り全体を1区間として返す(大会名はNoneとし、呼び出し側で
       extract_event_name()を使わせる)。"""
    marks = []
    for i, l in enumerate(lines):
        m = SECTION_RE.match(l)
        if not m:
            continue
        name = m.group(2).strip('◎ 　').strip()
        if len(l) > _SECTION_MAX_LEN or '、' in name or '。' in name:
            continue
        # 「◎株式会社WAON presents」のように協賛社名で行が終わり、実際の大会名(DEEP☆KICK
        # ZERO 1等)が次のp/h1行に続くケースがある(実例: ZERO1・2合同記事)。「presents」で
        # 終わる場合のみ次行を連結する(協賛クレジット表記の慣用パターンとして機械的に判定、
        # それ以外の見出しを誤って連結しないよう限定的な条件にしている)。
        if name.lower().endswith('presents') and i + 1 < len(lines):
            name = f'{name} {lines[i + 1].strip()}'
        marks.append((i, name))
    if not marks:
        return [(None, lines)]
    segments = []
    for idx, (pos, name) in enumerate(marks):
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(lines)
        segments.append((name, lines[pos + 1:end]))
    return segments


def parse_bout_blocks(lines):
    """▼/◆ヘッダ以降を走査してbout単位に分解する。戻り値: [{fighters:[(mark,raw),...], decision, notes}]"""
    blocks = []
    i, n = 0, len(lines)
    while i < n:
        m = HDR_RE.match(lines[i])
        if not m:
            i += 1
            continue
        j = i + 1
        fighters, decision, notes = [], None, []
        skipped_detail = False
        detail_line = None
        while j < n:
            l = lines[j]
            if HDR_RE.match(l):
                break
            if VS_RE.match(l):
                j += 1
                continue
            mm = MARK_RE.match(l)
            if mm and len(fighters) < 2:
                fighters.append((mm.group(1), mm.group(2)))
                j += 1
                continue
            if l.startswith('※'):
                notes.append(l[1:].strip())
                j += 1
                continue
            # ヘッダ直後の「階級・ラウンド形式」詳細行(例: "DEEP☆KICK-63kgタイトルマッチ 3分3R")は
            # "3R"等を含み decision 行の判定と誤検出しうるため、fighter行がまだ無い最初の1行に限り
            # decision判定より先に読み飛ばす。
            if not skipped_detail and len(fighters) == 0 and decision is None and not notes and len(l) < 60:
                skipped_detail = True
                detail_line = l
                j += 1
                continue
            if decision is None and DECISION_KW.search(l) and len(l) < 60:
                decision = l
                j += 1
                continue
            break
        if len(fighters) == 2:
            label = m.group(1).strip()
            if detail_line:
                label = label + ' ' + detail_line
            blocks.append(dict(label=label, fighters=fighters, decision=decision, notes=notes))
            i = j
        else:
            i = i + 1  # このヘッダは実データを伴わない(重複見出し等) -> 読み飛ばす
    return blocks


def build():
    bouts = []
    self_unresolved = 0  # 両サイドとも名簿未解決で丸ごと落ちたbout側(側単位)
    block_fail = 0
    block_total = 0
    per_event_bouts = collections.Counter()
    ids = sorted(IDX.keys(), key=lambda e: IDX[e]['published'])
    bout_seq = collections.Counter()
    for eid in ids:
        meta = IDX[eid]
        path = f'raw/deepkick_events/{eid}.html'
        lines = get_lines(path)
        page_date = extract_date(lines, meta['title'], meta['published'])
        venue = extract_venue(lines)
        url = f'https://www.deep-kick.com/posts/{eid}?categoryIds=1233394'
        if any(CANCEL_RE.search(l) for l in lines[:6]):
            per_event_bouts[eid] = 0
            continue  # 大会自体が中止 -> 対戦カード告知のみで実施された試合ではないため対象外
        # U-4(2026-08、合同記事の日付対応): 合同速報記事の日付は本文<p>/<h1>には無く、
        # 末尾の<div class="blog-body__text">にのみ現れる。extract_date()(lines[:8]限定)
        # では見つからないため、区間ごとに別途footer_datesを引く。単独大会記事は
        # footer_datesが空になり従来通りpage_dateを使う。
        footer_dates = extract_section_dates(path)
        for section_name, section_lines in split_sections(lines):
            event = section_name if section_name else extract_event_name(lines, meta['title'])
            date = page_date or footer_dates.get(_norm_footer_name(event))
            blocks = parse_bout_blocks(section_lines)
            block_total += len(blocks)
            for b in blocks:
                (m1, raw1), (m2, raw2) = b['fighters']
                n1, a1 = split_name_aff(raw1)
                n2, a2 = split_name_aff(raw2)
                if not n1 or not n2:
                    block_fail += 1
                    continue
                decision = b['decision']
                notes = b['notes']
                inline_note = None
                if decision and '※' in decision:
                    decision, inline_note = decision.split('※', 1)
                    decision = decision.strip()
                    inline_note = inline_note.strip()
                all_notes = notes + ([inline_note] if inline_note else [])
                note_text = ' / '.join(all_notes) if all_notes else None
                if decision:
                    meth, rnd, ext, rs = _bouts.parse_method(decision)
                else:
                    meth, rnd, ext, rs = None, None, False, None
                if not decision and any('不戦勝' in nt for nt in all_notes):
                    meth = 'walkover'
                if decision and '勝敗なし' in decision:
                    meth = None
                for (my_mark, my_name, my_aff), (opp_mark, opp_name, opp_aff) in [
                        ((m1, n1, a1), (m2, n2, a2)), ((m2, n2, a2), (m1, n1, a1))]:
                    rec, amb, cands = resolve(my_name, my_aff)
                    if amb or not rec:
                        if not rec and not amb:
                            pass
                        self_unresolved += 1
                        continue
                    if my_mark:
                        result = MARK2RESULT.get(my_mark, 'unknown')
                    elif decision and '勝敗なし' in decision:
                        result = 'no_contest'
                    else:
                        result = 'unknown'
                    if meth == 'walkover' and my_mark in ('×',):
                        pass  # 不戦敗側もresultはmarkのまま(loss)。method だけwalkoverで揃える
                    oref, oamb, ocands = resolve(opp_name, opp_aff)
                    ident = f"{rec['name']}|{rec['gym'] or ''}|{rec['sources'][0] if rec['sources'] else ''}"
                    idx = bout_seq[ident]
                    bout_seq[ident] += 1
                    bouts.append(dict(
                        bout_id=f'deepkick:{ident}:{idx}',
                        date=date, event=event, venue=venue,
                        fighter_slug=ident, fighter_name=rec['name'],
                        opponent_raw=raw2 if my_name == n1 else raw1,
                        opponent_name=opp_name, opponent_affiliation=opp_aff,
                        opponent_site_slug=None,
                        opponent_ref=oref['name'] if oref else None,
                        opponent_ref_gym=oref['gym'] if oref else None,
                        opponent_resolved=oref is not None,
                        opponent_ambiguous=oamb, opponent_candidates=ocands,
                        result=result, result_mark=my_mark, method=meth, method_raw=decision or '',
                        round=rnd, is_extension=ext, ruleset=rs, note=note_text, is_debut=False,
                        title_type=_bouts.classify_title_type(b['label']),
                        pair_key=None,
                        source_url=url,
                    ))
                    per_event_bouts[eid] += 1

    bouts, dup_dropped = _dedupe_cross_article_duplicates(bouts)
    return bouts, dict(block_total=block_total, block_fail=block_fail, self_unresolved=self_unresolved,
                        events=len(ids), per_event_bouts=per_event_bouts, dup_dropped=dup_dropped)


def _dedupe_cross_article_duplicates(bouts):
    """2026-08-21追加: DEEP☆KICK公式サイト自体が、同一大会の結果を日付の異なる複数記事
    (例: DEEP☆KICK ZERO 1が id=32156986(2022-01-30) と id=32216607(2022-03-13) の
    2記事に重複投稿されている)として公開しているケースがある。上流の重複投稿そのものは
    直せないが、放置すると『どちらの記事をたまたま先に処理したか』でdateが変わり、
    週次実行のたびに実体の無い削除+追加がPR差分に出続けてしまう。
    採用ルール: 同一event名・同一対戦カード(選手2名の組み合わせ、順不同)の行が複数の
    記事(source_urlのpost ID)にまたがって存在する場合、post IDが最小の記事を正とし、
    それ以外の記事由来の行を削除する。post IDはDEEP☆KICK側の投稿順(実測: 若い方が先に
    投稿された記事)であり、後発の重複投稿より先行記事を優先するのが妥当という判断。
    どちらが日付として正しいかは上流記事だけでは判定できないため、決定性(毎回同じ結果に
    なること)を優先し、恣意的な補正はしない。"""
    def article_id(url):
        m = re.search(r'/posts/(\d+)', url or '')
        return int(m.group(1)) if m else None

    groups = collections.defaultdict(set)
    for b in bouts:
        aid = article_id(b['source_url'])
        if aid is None:
            continue
        pair = frozenset({nk(b['fighter_name']), nk(b['opponent_name'] or '')})
        groups[(b['event'], pair)].add(aid)

    winning_aid = {key: min(aids) for key, aids in groups.items() if len(aids) > 1}
    if not winning_aid:
        return bouts, 0

    kept = []
    dropped = 0
    for b in bouts:
        aid = article_id(b['source_url'])
        pair = frozenset({nk(b['fighter_name']), nk(b['opponent_name'] or '')})
        key = (b['event'], pair)
        if key in winning_aid and aid != winning_aid[key]:
            dropped += 1
            continue
        kept.append(b)
    return kept, dropped


if __name__ == '__main__':
    bouts, stats = build()
    json.dump(bouts, open('bouts_deepkick.json', 'w'), ensure_ascii=False, indent=1)
    print('===== bouts_deepkick.json =====')
    print('events crawled          :', stats['events'])
    print('bout blocks parsed      :', stats['block_total'])
    print('  block fail(name欠落)  :', stats['block_fail'])
    print('bout rows written       :', len(bouts))
    print('  同一カード重複記事の除去:', stats['dup_dropped'], '行(post ID最小の記事を採用)')
    print('  avg bouts/event       :', round(len(bouts) / stats['events'], 2))
    print('self-side unresolved(側単位、行を作らず破棄):', stats['self_unresolved'])
    r = sum(1 for x in bouts if x['opponent_resolved'])
    print(f'opponent resolved       : {r}/{len(bouts)} = {r/len(bouts)*100:.1f}%')
    u = [x for x in bouts if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print('opponent unresolved rows:', len(u), ' distinct:', len({x["opponent_name"] for x in u}))
    print('opponent ambiguous rows :', sum(1 for x in bouts if x['opponent_ambiguous']))
    print('result内訳:', dict(collections.Counter(x['result'] for x in bouts)))
    print('date欠落:', sum(1 for x in bouts if not x['date']), ' venue欠落:', sum(1 for x in bouts if not x['venue']))
    ycount = collections.Counter((x['date'] or '????')[:4] for x in bouts)
    print('年別件数:', dict(sorted(ycount.items())))
