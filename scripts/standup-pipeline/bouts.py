# -*- coding: utf-8 -*-
"""SHOOT BOXING 公式の選手ページから bout を抽出する。SCHEMA.md に準拠。"""
import re,glob,html,json,unicodedata,collections

U=lambda s: re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()
SBFIX={'朱里グラップリングシュートボクサーズジム':'朱里'}   # SB側の入力ゆれ（名前に所属が連結）
# SB公式の日付欄がandy_sowerの3行のみ解析不能だったため、外部照合済みの日付で個別に補完
# (build.py再実行のたびにraw HTMLから再生成されても消えないよう、パース後の恒久パッチとして持つ)
SB_DATE_OVERRIDE={'sb:andy_sower:36':'2007-10-03','sb:andy_sower:52':'2005-07-20','sb:andy_sower:53':'2005-07-20'}

# ---- 同一event文字列の兄弟行からのnull日付補完(2026-08-15) ----
# 規則: 同一event文字列を持つ行のうち、日付を持つ行の日付がちょうど1種類に定まる場合のみ、
# 同一eventのnull日付行にその日付を入れる。2種類以上に割れる場合・日付を持つ兄弟行が
# 一件も無い場合は埋めない(推測しない)。直パッチではなくbuild()内の処理として組み込み、
# build.pyを素の状態から実行するだけで毎回同じ結果を再現する(raw HTMLの再解析結果に対して
# 常に適用されるため、手動パッチのようにbuild.py再実行で消えることがない)。
INFERRED_DATE_LOG=[]
def infer_sibling_dates(bouts):
    by_event=collections.defaultdict(list)
    for b in bouts:
        if b.get('event'): by_event[b['event']].append(b)
    filled=0
    for ev,rows in by_event.items():
        dated={r['date'] for r in rows if r['date']}
        if len(dated)!=1: continue
        the_date=next(iter(dated))
        for r in rows:
            if not r['date']:
                r['date']=the_date
                INFERRED_DATE_LOG.append({'bout_id':r['bout_id'],'event':ev,'date':the_date})
                filled+=1
    return filled
MARK2RESULT={'mark-win':'win','mark-ko':'win','mark-lose':'loss',
             'mark-hikiwake':'draw','mark-nocon':'no_contest'}

def parse_method(t):
    """決着セルの文字列 -> (method, round, is_extension, ruleset)"""
    ext = '延長' in t
    rs = 'mma' if '※MMA' in t or '※ＭＭＡ' in t else ('ofg' if 'OFG' in t or 'オープンフィンガー' in t else None)
    body = re.sub(r'※.*$','',t).strip()
    rnd = None
    m = re.search(r'(\d+)\s*R', body)
    if m: rnd = int(m.group(1))
    if not body: return None,rnd,ext,rs
    if '不戦' in body:                       meth='walkover'
    elif 'ノーコンテスト' in body or '無効' in body: meth='no_contest'
    elif '中止' in body:                     meth=None
    elif '失格' in body or '反則' in body:     meth='disqualification'
    elif '負傷判定' in body:                  meth='injury_decision'
    elif 'ドクター' in body:                  meth='doctor_stop'
    elif '時間切れ' in body:                  meth='time_limit'
    elif re.search(r'一本|固め|絞め|スリーパー|チョーク|ひしぎ|アームバー|裸絞|タップアウト|SUB|RNC',body): meth='submission'
    elif 'TKO' in body:                      meth='tko'
    elif 'KO' in body:                       meth='ko'
    elif '判定' in body:                     meth='decision'
    elif '引き分け' in body or '引分' in body or 'ドロー' in body: meth='draw'
    elif '終了時' in body:                    meth='time_limit'   # KO/TKO判定より後に置く
    else:                                    meth='other'
    return meth,rnd,ext,rs

# ================= タイトル戦種別（既存rawの再パースのみ、新規クロールなし） =================
# SB公式の【】注記・DEEP☆KICK/NJKF/HOOST CUP/NKBのbout見出し・RIZINのheadingTextを実測した結果、
# 共通して現れる語彙は次の3種のみ（SCHEMA.md参照）。「CHAMPIONSHIP」等の大会シリーズ名だけでは
# 判定しない。複合表記（例:「NJKFライト級タイトルマッチ/WBCムエタイ日本統一ライト級挑戦者決定戦」）は
# 文字列中で最も早く出現したパターンを採用する。
TITLE_TYPE_PATTERNS=[
    (re.compile(r'挑戦者決定'),'challenger_decision'),
    (re.compile(r'王座決定|暫定王座決定'),'vacant_title_match'),
    (re.compile(r'タイトルマッチ|暫定タイトルマッチ'),'title_match'),
]
def classify_title_type(text):
    if not text: return None
    hits=[]
    for pat,label in TITLE_TYPE_PATTERNS:
        m=pat.search(text)
        if m: hits.append((m.start(),label))
    if not hits: return None
    hits.sort()
    return hits[0][1]

def parse_page(path,promo='sb',url_tpl='https://shootboxing.org/fighter/{}/'):
    h=open(path,encoding='utf-8',errors='replace').read()
    slug=path.split('/')[-1][:-5]
    nm=re.search(r'<h2 class="fight-title">(.*?)</h2>',h,re.S)           # SHOOT BOXING
    if not nm:                                                            # RISE
        nm=re.search(r'<h2 class="p-fighter__profile-name">(.*?)</h2>',h,re.S)
        if nm:
            class _M:
                def __init__(s2,v): s2._v=v
                def group(s2,i): return s2._v
            nm=_M(re.sub(r'(?s)<span>.*?</span>','',nm.group(1)))
    fname=U(nm.group(1)) if nm else slug
    fname=SBFIX.get(fname,fname)
    blk=re.search(r'(?s)<div class="fighter-senreki[^"]*">.*?</table>',h)
    out=[]
    if not blk: return out
    for i,tr in enumerate(re.findall(r'(?s)<tr>(.*?)</tr>',blk.group(0))):
        sy=re.search(r'(?s)<td class="syouhai">(.*?)</td>',tr)
        fn=re.search(r'(?s)<td class="fightername">(.*?)</td>',tr)
        tk=re.search(r'(?s)<td class="taikai">(.*?)</td>',tr)
        if not (sy or fn or tk): continue
        mk=re.search(r'/image/(mark-[a-z0-9\-]+)\.svg',sy.group(1)) if sy else None
        mark=mk.group(1) if mk else None
        mraw=U(sy.group(1)) if sy else ''
        meth,rnd,ext,rs=parse_method(mraw)
        result=MARK2RESULT.get(mark,'unknown')
        if meth=='walkover' and result=='unknown': result='cancelled'
        if mraw and '中止' in mraw: result='cancelled'

        oraw=U(fn.group(1)) if fn else ''
        osl=re.search(r"/fighter/([^/'\"]+)/",fn.group(1)) if fn else None
        p=re.search(r'[（(]([^）(]*)[）)]\s*$',oraw)
        oname=re.sub(r'[（(][^）(]*[）)]\s*$','',oraw).strip()
        # 大会セル: 大会名 / 【注記】 / 日付・会場
        ev=venue=date=note=None; debut=False
        if tk:
            g=tk.group(1)
            for n_ in re.findall(r'【(.*?)】',g):
                if 'デビュー' in n_: debut=True
                note=(note+' / ' if note else '')+U(n_)
            spans=re.findall(r'(?s)<span>(.*?)</span>',g)
            dv=None
            for s in spans:                                   # SHOOT BOXING: 日付は<span>内
                if re.search(r'\d{4}\.\d{1,2}\.\d{1,2}',U(s)): dv=U(s); break
            if dv:
                dm=re.match(r'(\d{4})\.(\d{1,2})\.(\d{1,2})\s*(.*)$',dv)
                date='%s-%02d-%02d'%(dm.group(1),int(dm.group(2)),int(dm.group(3)))
                venue=dm.group(4).strip() or None
                head=re.sub(r'(?s)<span>.*?</span>','',g)
                head=re.sub(r'【.*?】','',head)
                ev=U(head) or None
            else:
                # RISE: 日付は<span>を使わずセル内の平文。セル全体から日付位置で分割する
                flat=U(re.sub(r'【.*?】','',g))
                dm=re.search(r'(\d{4})\.(\d{1,2})\.(\d{1,2})',flat)
                if dm:
                    date='%s-%02d-%02d'%(dm.group(1),int(dm.group(2)),int(dm.group(3)))
                    ev=flat[:dm.start()].strip() or None
                    venue=flat[dm.end():].strip() or None
                else:
                    venue=U(spans[-1]) if spans else None
                    head=re.sub(r'(?s)<span>.*?</span>','',g)
                    head=re.sub(r'【.*?】','',head)
                    ev=U(head) or None
            if '※デビュー' in (ev or ''): debut=True
        bid=f'{promo}:{slug}:{i}'
        date=SB_DATE_OVERRIDE.get(bid,date)
        out.append(dict(bout_id=bid,date=date,event=ev,venue=venue,
            fighter_slug=slug,fighter_name=fname,
            opponent_raw=oraw,opponent_name=oname,
            opponent_affiliation=p.group(1).strip() if p else None,
            opponent_site_slug=osl.group(1) if osl else None,
            opponent_ref=None,opponent_ref_gym=None,opponent_resolved=False,
            opponent_ambiguous=False,opponent_candidates=None,
            result=result,result_mark=mark,method=meth,method_raw=mraw,
            round=rnd,is_extension=ext,ruleset=rs,note=note,is_debut=debut,
            title_type=classify_title_type(note),
            pair_key=None,
            source_url=url_tpl.format(slug)))
    return out

def build(fighters_path='fighters.json',src='raw/sb_bouts/*.html',
          promo='sb',url_tpl='https://shootboxing.org/fighter/{}/',link_host='shootboxing.org',
          parser=None):
    bouts=[]
    for f in sorted(glob.glob(src)):
        bouts += parser(f,promo) if parser else parse_page(f,promo,url_tpl)
    infer_sibling_dates(bouts)
    # ---- 相手の解決 ----
    F=json.load(open(fighters_path))
    def nk(s):
        s=unicodedata.normalize('NFKC',s or '')
        for c in '“”"\'’‘`「」『』': s=s.replace(c,'')
        return re.sub(r'\s+','',s).replace('・','').replace('=','').lower()
    def gk(x):
        if not x: return None
        x=unicodedata.normalize('NFKC',x).lower()
        for c in '“”"\'’‘`': x=x.replace(c,'')
        x=re.sub(r'(ジム|gym|キックボクシング|kickboxing|道場|会館|塾|team|チーム|ボクシング)','',x)
        return re.sub(r'[\s　／/・\-,、。.]','',x) or None
    GENERIC={'フリー','無所属','free',None}
    byname=collections.defaultdict(list)          # 同名異人があるので候補は全部持つ
    for r in F:
        for n in [r['name']]+r['aliases']:
            if r not in byname[nk(n)]: byname[nk(n)].append(r)
    byslug={}
    for r in F:
        for u in r['sources']:
            m=re.match(r'https://'+re.escape(link_host)+r'/fighters?/([^/?]+)/?$',u)
            if m: byslug[m.group(1)]=r
    for b in bouts:
        rec=None; amb=False; cands=None
        # 1) サイト内リンク（slugは人物ごとに一意）
        if b['opponent_site_slug']: rec=byslug.get(b['opponent_site_slug'])
        if not rec:
            c=byname.get(nk(b['opponent_name']),[])
            if len(c)==1:
                rec=c[0]
            elif len(c)>1:
                # 2) bout行の所属で絞り込む（identifyingな所属のみ）
                a=gk(b['opponent_affiliation'])
                hit=[]
                if a and b['opponent_affiliation'] not in GENERIC:
                    hit=[r for r in c if gk(r['gym']) and r['gym'] not in GENERIC
                         and (gk(r['gym'])==a or a in gk(r['gym']) or gk(r['gym']) in a)]
                if len(hit)==1: rec=hit[0]
                else:
                    amb=True
                    cands=[{'name':r['name'],'gym':r['gym'],'orgs':r['orgs']} for r in c]
        b['opponent_ref']=rec['name'] if rec else None
        b['opponent_ref_gym']=rec['gym'] if rec else None
        b['opponent_resolved']=rec is not None
        b['opponent_ambiguous']=amb; b['opponent_candidates']=cands
    # ---- pair_key ----
    own={}
    for r in F:
        for u in r['sources']:
            m=re.match(r'https://'+re.escape(link_host)+r'/fighters?/([^/?]+)/?$',u)
            if m: own[r['name']]=m.group(1)
    for b in bouts:
        if b['date'] and b['opponent_site_slug']:
            a,c=sorted([b['fighter_slug'],b['opponent_site_slug']])
            b['pair_key']=f"{b['date']}|{a}|{c}"
    return bouts


# ================= KNOCK OUT =================
KO_CLASS2RESULT={'win':'win','lose':'loss','draw':'draw',
                 'nocontest':'no_contest','nocon':'no_contest','cancel':'cancelled'}

def parse_ko_page(path,promo='knockout'):
    h=open(path,encoding='utf-8',errors='replace').read()
    base=path.split('/')[-1][:-5]
    slug,_,pg=base.partition('__p')
    pg=int(pg or 1)
    nm=re.search(r'<h2 class="name">(.*?)</h2>',h,re.S)
    fname=U(nm.group(1)) if nm else slug
    out=[]
    for i,(cls,blk) in enumerate(re.findall(r'(?s)<li class="fight-log fight-log--([a-z]+)">(.*?)</li>',h)):
        result=KO_CLASS2RESULT.get(cls,'unknown')
        dec=re.search(r'(?s)summary__decision">(.*?)</div>',blk)
        mraw=U(dec.group(1)) if dec else ''
        meth,rnd,ext,rs=parse_method(mraw)
        oa=re.search(r'(?s)<h4>.*?<span>vs</span>(.*?)</h4>',blk)
        oraw=U(oa.group(1)) if oa else ''
        osl=re.search(r'/fighters/([a-z0-9_\-]+)"',oa.group(1)) if oa else None
        p=re.search(r'[（(]([^）(]*)[）)]\s*$',oraw)
        oname=re.sub(r'[（(][^）(]*[）)]\s*$','',oraw).strip()
        ev=venue=date=None
        el=re.search(r'(?s)<a class="event-link"[^>]*>(.*?)</a>',blk)
        if el:
            parts=[U(x) for x in re.split(r'<br\s*/?>',el.group(1)) if U(x)]
            if parts: ev=parts[0]
            tail=' '.join(parts[1:])
            dm=re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日',tail)
            if dm:
                date='%s-%02d-%02d'%(dm.group(1),int(dm.group(2)),int(dm.group(3)))
                venue=tail[dm.end():].strip() or None
            else:
                venue=tail.strip() or None
        out.append(dict(bout_id=f'{promo}:{slug}:{pg}:{i}',date=date,event=ev,venue=venue,
            fighter_slug=slug,fighter_name=fname,
            opponent_raw=oraw,opponent_name=oname,
            opponent_affiliation=p.group(1).strip() if p else None,
            opponent_site_slug=osl.group(1) if osl else None,
            opponent_ref=None,opponent_ref_gym=None,opponent_resolved=False,
            opponent_ambiguous=False,opponent_candidates=None,
            result=result,result_mark=f'fight-log--{cls}',method=meth,method_raw=mraw,
            round=rnd,is_extension=ext,ruleset=rs,note=None,is_debut=False,
            title_type=None,  # KNOCK OUT: 大会名・bout行のいずれにもタイトル戦種別の記載なし(実測確認済み)
            pair_key=None,
            source_url=f'https://knockoutkb.com/fighters/{slug}'))
    return out


# ================= K-1 / Krush / Krush-EX =================
K1_FRAG2RESULT={'judgment':'win','ko':'win','lose':'loss','draw':'draw'}

def parse_k1_page(path,promo='k1'):
    h=open(path,encoding='utf-8',errors='replace').read()
    fid=path.split('/')[-1][:-5]
    nm=re.search(r'class="hero__name-ja"[^>]*>(.*?)</h3>',h,re.S)
    fname=U(nm.group(1)) if nm else fid
    blk=re.search(r'(?s)<div class="battle">.*?</ul>',h)
    out=[]
    if not blk: return out
    for i,li in enumerate(re.findall(r'(?s)<li class="battle__item">(.*?)</li>',blk.group(0))):
        fr=re.search(r'icon_sprite\.svg#([a-z0-9_\-]+)',li)
        frag=fr.group(1) if fr else None
        rr=re.search(r'class="battle__result">(.*?)</span>',li,re.S)
        mraw=U(rr.group(1)) if rr else ''
        if frag=='exi':
            result='scheduled' if '試合前' in mraw else 'no_contest'
        else:
            result=K1_FRAG2RESULT.get(frag,'unknown')
        meth,rnd,ext,rs=parse_method(mraw)
        if mraw=='試合前': meth=None
        oa=re.search(r'class="battle__name">(.*?)</h4>',li,re.S)
        oraw=re.sub(r'^vs\s*','',U(oa.group(1))) if oa else ''
        p=re.search(r'[（(]([^）(]*)[）)]\s*$',oraw)
        oname=re.sub(r'[（(][^）(]*[）)]\s*$','',oraw).strip()
        ev=date=None
        pl=re.search(r'class="battle__place"[^>]*>(.*?)</a>',li,re.S)
        if pl:
            # 一部の行が康熙部首の ⽉/⽇ (U+2F49/U+2F47) を使うため NFKC で正規化する
            t=unicodedata.normalize('NFKC',U(pl.group(1)))
            dm=re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日\s*(?:[（(][^）)]{0,6}[）)])?\s*(.*)$',t)
            if dm:
                date='%s-%02d-%02d'%(dm.group(1),int(dm.group(2)),int(dm.group(3)))
                ev=dm.group(4).strip() or None
            else: ev=t or None
        out.append(dict(bout_id=f'{promo}:{fid}:{i}',date=date,event=ev,venue=None,
            fighter_slug=fid,fighter_name=fname,
            opponent_raw=oraw,opponent_name=oname,
            opponent_affiliation=p.group(1).strip() if p else None,
            opponent_site_slug=None,
            opponent_ref=None,opponent_ref_gym=None,opponent_resolved=False,
            opponent_ambiguous=False,opponent_candidates=None,
            result=result,result_mark=f'#{frag}' if frag else None,method=meth,method_raw=mraw,
            round=rnd,is_extension=ext or ('延長' in mraw),ruleset=rs,note=None,is_debut=False,
            title_type=None,  # K-1: タイトル語彙は大会名(battle__place)にのみ存在し、bout行単位ではない。
                               # 同一大会に無関係な undercard が同居するため大会名だけでは
                               # このbout自体がタイトル戦か判定できず、null のまま(SOURCES.md参照)。
            pair_key=None,
            source_url=f'https://www.k-1.co.jp/fighter/{fid}'))
    return out


def k1_summary_check(src='raw/k1_bouts/*.html'):
    """選手ページ冒頭の公式サマリーと、取得したboutの勝敗集計を突合する独立検証。"""
    rows=[]
    for f in sorted(glob.glob(src)):
        h=open(f,encoding='utf-8',errors='replace').read()
        fid=f.split('/')[-1][:-5]
        nm=re.search(r'class="hero__name-ja"[^>]*>(.*?)</h3>',h,re.S)
        sm=re.search(r'(\d+)戦\s*(\d+)勝\((\d+)KO\)\s*(\d+)敗\s*(\d+)分',U(h))
        if not sm: rows.append(dict(fid=fid,name=U(nm.group(1)) if nm else fid,status='no_summary')); continue
        tot,w,ko,l,d=map(int,sm.groups())
        b=[x for x in parse_k1_page(f) if x['result']!='scheduled']
        c=collections.Counter(x['result'] for x in b)
        kow=sum(1 for x in b if x['result_mark']=='#ko')
        got=c['win']+c['loss']+c['draw']+c['no_contest']
        rows.append(dict(fid=fid,name=U(nm.group(1)) if nm else fid,
            sum_total=tot,sum_win=w,sum_ko=ko,sum_lose=l,sum_draw=d,
            got_total=got,got_win=c['win'],got_ko=kow,got_lose=c['loss'],got_draw=c['draw'],
            status='full' if got==tot else 'partial'))
    return rows
