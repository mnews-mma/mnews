import json,re,unicodedata,collections,os

WP='https://ja.wikipedia.org/wiki/'
DECO='“”"\'’‘`「」『』【】〈〉《》〔〕'
def nfkc(s): return unicodedata.normalize('NFKC',s or '')
def nkey(s):
    s=nfkc(s)
    for c in DECO: s=s.replace(c,'')
    return re.sub(r'\s+','',s).replace('・','').replace('=','').replace('･','').lower()
def gkey(s):
    if not s: return None
    s=nfkc(s).lower()
    for c in DECO: s=s.replace(c,'')
    s=re.sub(r'(ジム|gym|きっくぼくしんぐ|キックボクシング|kickboxing|道場|会館|team|チーム)','',s)
    return re.sub(r'[\s　／/・\-,、。]','',s) or None
def kkey(s): return re.sub(r'\s+','',nfkc(s)).replace('・','')
def _h2k(s):
    return ''.join(chr(ord(c)+0x60) if 0x3041<=ord(c)<=0x3096 else c for c in s)
def kana_identity(s):
    """Name already written in kana -> that IS the reading (transliteration, not inference)."""
    t=re.sub(r'[\s・ー.．＝=“”"\'’]','',s or '')
    if not t or not all(('ァ'<=c<='ヺ') or ('ぁ'<=c<='ゖ') for c in t): return None
    return re.sub(r'\s+',' ',_h2k(s)).strip()
def is_kata(s): return kana_identity(s) is not None

WPK=json.load(open('raw/wp_kana.json'))          # leg 5: ja.wikipedia article lead sentences
ROM=json.load(open('raw/kana_from_romaji.json'))  # leg 4': official romaji, unambiguous only
rows=[]
def add(**kw):
    kw.setdefault('aliases',[]); kw.setdefault('en',None)
    kw.setdefault('kana_type','published' if kw.get('kana') else None)
    kw.setdefault('dob',None)
    rows.append(kw)

# 生年月日(birthdate)。表示には使わず名寄せの判別材料としてのみ保持する(2026-08-15追補)。
# K-1は個別ページに構造化フィールドがあるためraw/k1_parsed.json自体にdobを持つ。
# RISE/SHOOT BOXING/KNOCK OUTはextract_dob.pyが既取得ページから抽出したurl->dobマップを使う。
RISE_DOB=json.load(open('raw/rise_dob.json')) if os.path.exists('raw/rise_dob.json') else {}
SB_DOB=json.load(open('raw/sb_dob.json')) if os.path.exists('raw/sb_dob.json') else {}
KO_DOB=json.load(open('raw/ko_dob.json')) if os.path.exists('raw/ko_dob.json') else {}

for r in json.load(open('raw/wp_parsed.json')):
    t=r['wiki_target']
    url=WP+re.sub(r'\s','_',t or r['list_page'])
    al=[t] if (t and t!=r['name'] and '(' not in t and '（' not in t) else []
    if r.get('paren_alias'): al.append(r['paren_alias'])
    k=r['kana']
    if not k and t: k=WPK.get(t.replace('_',' '))          # leg 5: article opening sentence
    if not k: k=kana_identity(r['name'])
    add(src='wikipedia',name=r['name'],kana=k,gym=None,orgs=[],url=url,aliases=al)

BR=json.load(open('raw/k1_brands.json'))
for r in json.load(open('raw/k1_parsed.json')):
    k=r['kana'] or kana_identity(r['name'])
    add(src='k1',name=r['name'],kana=k,gym=r['gym'],orgs=BR.get(r['id'],['K-1']),
        url=f"https://www.k-1.co.jp/fighter/{r['id']}",en=r['en'],dob=r.get('dob'))

for r in json.load(open('raw/rise_parsed.json')):
    add(src='rise',name=r['name'],kana=kana_identity(r['name']),
        gym=r['gym'],orgs=['RISE'],url=r['url'],en=r['en'],dob=RISE_DOB.get(r['url']))

SBFIX={'朱里グラップリングシュートボクサーズジム':'朱里'}
for r in json.load(open('raw/sb_parsed.json')):
    n=SBFIX.get(r['name'],r['name'])
    add(src='shootboxing',name=n,kana=kana_identity(n),
        gym=r['gym'],orgs=['SHOOT BOXING'],url=r['url'],dob=SB_DOB.get(r['url']))

SKIP=0
for r in json.load(open('raw/ko_parsed.json')):
    if (r['gym'] in ('--','---') or 'の勝利チーム' in r['name'] or (r['en'] or '').strip()=='TBA'
            or 'コーチ：' in r['name'] or 'コーチ:' in r['name']):
        SKIP+=1; continue
    add(src='knockout',name=r['name'],kana=kana_identity(r['name']),
        gym=r['gym'],orgs=['KNOCK OUT'],url=r['url'],en=r['en'],dob=KO_DOB.get(r['url']))
print('rows',len(rows),'KO non-fighter entries skipped',SKIP)

# ---- constrained union-find: same source => distinct; gyms must stay compatible
par=list(range(len(rows)))
srcs=[{r['src']} for r in rows]
gyms=[{gkey(r['gym'])} - {None} for r in rows]
def find(x):
    while par[x]!=x: par[x]=par[par[x]]; x=par[x]
    return x
def compat(A,B):
    for a in A:
        for b in B:
            if not(a==b or a in b or b in a): return False
    return True
def try_union(a,b,allow_conflict=False):
    ra,rb=find(a),find(b)
    if ra==rb: return False
    if srcs[ra] & srcs[rb]: return False
    if not allow_conflict and not compat(gyms[ra],gyms[rb]): return False
    par[rb]=ra; srcs[ra]|=srcs[rb]; gyms[ra]|=gyms[rb]; return True

cand=collections.defaultdict(list)
for i,r in enumerate(rows):
    for n in [r['name']]+r['aliases']: cand[nkey(n)].append(i)

def tier(i,j):
    gi,gj=gkey(rows[i]['gym']),gkey(rows[j]['gym'])
    if gi and gj: return 0 if compat({gi},{gj}) else 2
    return 1

merged=collections.Counter(); held=set()
def fullname(i):
    n=rows[i]['name']
    return (' ' in n or '　' in n or '・' in n or len(nkey(n))>=4)
# pass A: gym agrees
for k,v in cand.items():
    for a in range(len(v)):
        for b in range(a+1,len(v)):
            if tier(v[a],v[b])==0 and try_union(v[a],v[b]): merged['gym-match']+=1
# pass B: gym conflicts -> assume gym change, but ONLY for full names listed once per source
for k,v in cand.items():
    if len(v)!=len({rows[i]['src'] for i in v}): continue
    for a in range(len(v)):
        for b in range(a+1,len(v)):
            i,j=v[a],v[b]
            if tier(i,j)!=2: continue
            if not(fullname(i) and fullname(j)): held.add((k,'mononym-gym-conflict')); continue
            if try_union(i,j,allow_conflict=True): merged['gym-change']+=1
# pass C: attach gym-less rows (wikipedia) only when the name maps to a single org group
for k,v in cand.items():
    orgroots={find(i) for i in v if rows[i]['gym']}
    for a in range(len(v)):
        for b in range(a+1,len(v)):
            if tier(v[a],v[b])!=1: continue
            if len(orgroots)>1: held.add((k,'ambiguous-mononym')); continue
            if try_union(v[a],v[b]): merged['wp-attach']+=1
print('merges by tier:',dict(merged),'| held apart:',len(held))

groups=collections.defaultdict(list)
for i in range(len(rows)): groups[find(i)].append(rows[i])
print('unique fighters:',len(groups))
json.dump([v for v in groups.values()],open('raw/groups2.json','w'),ensure_ascii=False)

# ================= emit fighters.json =================
PRI=['k1','rise','knockout','shootboxing','wikipedia']
ORG_ORDER=['K-1 WORLD GP','Krush','Krush-EX','RISE','SHOOT BOXING','KNOCK OUT']
def norm_kana(k):
    return re.sub(r'\s+',' ',nfkc(k)).strip() if k else None

out=[]
for g in groups.values():
    g=sorted(g,key=lambda r:PRI.index(r['src']))
    name=g[0]['name']
    # kana: k1 first, then wikipedia, then any
    kana=None; ksrc=None; ktype=None
    def take(r):
        return norm_kana(r['kana']), r['url'], (r.get('kana_type') or 'published')
    for pref in ['k1','wikipedia']:
        for r in g:
            if r['src']==pref and r['kana']: kana,ksrc,ktype=take(r); break
        if kana: break
    if not kana:
        for r in g:
            if r['kana']: kana,ksrc,ktype=take(r); break
    if not kana:                                   # leg 4': transcribe official romaji
        for r in g:
            e=ROM.get(nkey(r['name']))
            if e: kana,ksrc,ktype=e['kana'],e['kana_source'],'from_romaji'; break
    seen={nkey(name)}; aliases=[]
    for r in g:
        for n in [r['name']]+r['aliases']:
            if nkey(n) not in seen: seen.add(nkey(n)); aliases.append(n)
    gym=next((r['gym'] for r in g if r['gym']),None)
    birthdate=next((r['dob'] for r in g if r['dob']),None)  # 表示しない、名寄せ判別材料専用
    orgs=sorted({o for r in g for o in r['orgs']},
                key=lambda x: ORG_ORDER.index(x) if x in ORG_ORDER else 99)
    srcs=[]
    for r in g:
        if r['url'] not in srcs: srcs.append(r['url'])
    out.append(dict(name=name,kana=kana,aliases=aliases,gym=gym,orgs=orgs,sources=srcs,
                    kana_source=({'type':ktype,'url':ksrc} if kana else None),birthdate=birthdate))

# ---------------- 表記ゆれによるレコード分裂の統合（2026-08-15、/kick公開監査で発見） ----------------
# 対象は「末尾記号・装飾記号の有無だけが違い、片方(Wikipedia由来)が所属・戦績とも
# 空でWikipedia以外に読みを持たない」2組に限定する。所属が異なる組(YU-YA/YUYA)や、
# 統合すると戦績側のambiguous判定に影響する組(海人)は対象外(SOURCES.md参照)。
#
# 旧字体2組(2026-08-15追補、SOURCES.md「旧字体・別表記による名簿重複」参照)。
# いずれも所属ジム一致(高山敦/髙山敦)またはかな完全一致(渡辺武/渡邉武)という独立根拠あり。
# 表記名はPRI優先順(k1>rise>knockout>shootboxing>wikipedia)の高い方を採用する
# (build.py既存の同順位ルールをそのまま踏襲、新しい基準を作らない):
#   渡辺武(K-1、PRI最上位) ⇔ 渡邉武(Wikipedia) → K-1側の表記を採用
#   髙山敦(KNOCK OUT) ⇔ 高山敦(SHOOT BOXING、KNOCK OUTより下位) → KNOCK OUT側の表記を採用
MANUAL_MERGE = [
    ('AKIRA Jr.', 'AKIRA Jr'),   # 末尾ピリオドの有無のみ。Jr側は所属・戦績なし
    ('SAHO', '☆SAHO☆'),          # 装飾記号☆の有無のみ。☆SAHO☆側は所属・戦績なし
    ('渡辺 武', '渡邉武'),        # 旧字体(邉→辺)。かな完全一致(ワタナベ タケシ)が根拠
    ('髙山 敦', '高山 敦'),       # 旧字体(髙→高)。所属ジム一致(Striking Gym Ares)が根拠
]
by_name = {r['name']: r for r in out}
merged_pairs = []
for primary, dup in MANUAL_MERGE:
    p, d = by_name.get(primary), by_name.get(dup)
    if not (p and d) or p is d:
        continue
    if dup not in p['aliases']:
        p['aliases'].append(dup)
    for u in d['sources']:
        if u not in p['sources']:
            p['sources'].append(u)
    p['gym'] = p['gym'] or d['gym']
    p['birthdate'] = p['birthdate'] or d['birthdate']
    p['orgs'] = sorted(set(p['orgs']) | set(d['orgs']),
                        key=lambda x: ORG_ORDER.index(x) if x in ORG_ORDER else 99)
    out.remove(d)
    merged_pairs.append((primary, dup))
print('\n手動統合(表記ゆれ):', merged_pairs)

# ---------------- K-1公式 退所選手の統合（2026-08-15、SOURCES.md「K-1公式 退所選手の
# ID空間走査による回収」参照） ----------------
# 氏名一致だけでは統合しない。所属ジム一致／既存レコードのWikipedia本文にK-1・Krush参戦歴の
# 記述／生年月日一致のいずれか独立根拠が取れたものだけ、check_k1_merge_criteria.pyの判定結果
# (raw/k1_delisted_merges.json)に基づいてsourcesにK-1 URLを追加する(新規レコードは作らない、
# 既存レコードの他フィールドも書き換えない)。根拠が取れなかった65件は
# raw/k1_delisted_held_ambiguous.jsonに記録済みでここでは一切触らない。
if os.path.exists('raw/k1_delisted_merges.json'):
    k1_merges = json.load(open('raw/k1_delisted_merges.json'))
    by_sources_key = {tuple(sorted(r['sources'])): r for r in out}
    k1_merge_applied = 0
    for m in k1_merges:
        target = by_sources_key.get(tuple(sorted(m['existing_sources'])))
        if not target:
            print(f"  [WARN] K-1統合対象が見つからない: {m['existing_name']} sources={m['existing_sources']}")
            continue
        if m['k1_url'] not in target['sources']:
            target['sources'].append(m['k1_url'])
            k1_merge_applied += 1
        target['birthdate'] = target['birthdate'] or m.get('dob')
    print(f'\nK-1公式退所選手の統合(独立根拠あり): {k1_merge_applied}/{len(k1_merges)}件')

# ---------------- KNOCK OUT公式 退所選手の統合（2026-08-15、SOURCES.md「KNOCK OUT公式
# 退所選手の悉皆回収」参照） ----------------
# K-1と同じ判定条件(所属ジム一致／Wikipedia本文参戦歴／生年月日一致)。
# raw/ko_delisted_merges.jsonに基づきsourcesにKNOCK OUT URLを追加するのみ(新規レコード
# は作らない、他フィールドは空欄のときだけbirthdateを補う)。
if os.path.exists('raw/ko_delisted_merges.json'):
    ko_merges = json.load(open('raw/ko_delisted_merges.json'))
    by_sources_key = {tuple(sorted(r['sources'])): r for r in out}
    ko_merge_applied = 0
    for m in ko_merges:
        target = by_sources_key.get(tuple(sorted(m['existing_sources'])))
        if not target:
            print(f"  [WARN] KNOCK OUT統合対象が見つからない: {m['existing_name']} sources={m['existing_sources']}")
            continue
        if m['new_url'] not in target['sources']:
            target['sources'].append(m['new_url'])
            ko_merge_applied += 1
        target['birthdate'] = target['birthdate'] or KO_DOB.get(m['new_url'])
    print(f'\nKNOCK OUT公式退所選手の統合(独立根拠あり): {ko_merge_applied}/{len(ko_merges)}件')

out.sort(key=lambda r:(r['kana'] or '￿', nkey(r['name'])))
json.dump(out,open('fighters.json','w'),ensure_ascii=False,indent=2)

# ---------------- stats ----------------
print('\n===== fighters.json =====')
print('total records :',len(out))
print('kana filled   :',sum(1 for r in out if r['kana']),
      f"({sum(1 for r in out if r['kana'])/len(out)*100:.1f}%)")
print('kana null     :',sum(1 for r in out if not r['kana']))
print('gym filled    :',sum(1 for r in out if r['gym']),
      f"({sum(1 for r in out if r['gym'])/len(out)*100:.1f}%)")
print('with aliases  :',sum(1 for r in out if r['aliases']))
print('no sources    :',sum(1 for r in out if not r['sources']))
SRCN={'ja.wikipedia.org':'Wikipedia (男子/女子キックボクサー一覧)','k-1.co.jp':'K-1 / Krush / Krush-EX 公式',
      'rise-rc.com':'RISE 公式','shootboxing.org':'SHOOT BOXING 公式','knockoutkb.com':'KNOCK OUT 公式'}
print('\n-- records per source (a record can cite several) --')
cnt=collections.Counter(); kcnt=collections.Counter()
for r in out:
    for d,lab in SRCN.items():
        if any(d in u for u in r['sources']):
            cnt[lab]+=1
            if r['kana']: kcnt[lab]+=1
print(f"{'source':<42}{'records':>8}{'kana':>7}{'rate':>8}")
for lab in SRCN.values():
    c=cnt[lab]; k=kcnt[lab]
    print(f"{lab:<42}{c:>8}{k:>7}{(k/c*100 if c else 0):>7.1f}%")
print('\n-- orgs coverage --')
oc=collections.Counter(o for r in out for o in r['orgs'])
for o in ORG_ORDER: print(f'  {o:<16}{oc[o]:>5}')
print(f"  {'(no org / WP only)':<16}{sum(1 for r in out if not r['orgs']):>5}")
print('\n-- kana_source breakdown --')
kb=collections.Counter((r['kana_source'] or {}).get('type','(none)') for r in out)
for t in ['published','from_romaji','(none)']:
    print(f"  {t:<14}{kb[t]:>6}  {kb[t]/len(out)*100:>5.1f}%")
miss=[r for r in out if r['kana'] and not (r['kana_source'] or {}).get('url')]
print('  kana without source URL:',len(miss))

print('\n-- multi-source (deduped) records --')
print('  cite >=2 sources:',sum(1 for r in out if len(r['sources'])>1))
print('  cite >=3 sources:',sum(1 for r in out if len(r['sources'])>2))

# ================= CSV for hand-off =================
import csv
ROMSRC=[('k1','raw/k1_parsed.json'),('knockout','raw/ko_parsed.json'),('rise','raw/rise_parsed.json')]
_rom={}
for _tag,_p in ROMSRC:                       # priority: surname-first sources first, then RISE
    for _r in json.load(open(_p)):
        if _r.get('en'): _rom.setdefault(nkey(_r['name']),(_r['en'],_tag))

_KANJI=re.compile(r'[一-鿿]'); _HIRA=re.compile(r'[ぁ-ゖ]')
_KATA=re.compile(r'[ァ-ヺ]');  _LAT=re.compile(r'[A-Za-z]')
def script_of(n):
    t=re.sub(r'[\s・ー.．＝=“”"\'’\-♡∞&]','',n or '')
    if _KANJI.search(t) or _HIRA.search(t): return 'japanese'
    if _KATA.search(t) and not _LAT.search(t): return 'katakana-only'
    if _LAT.search(t) and not _KATA.search(t): return 'latin-only'
    return 'mixed-kana-latin'

blanked=collections.Counter(); rows_csv=[]
for r in out:
    sc=script_of(r['name'])
    rm,_tag=_rom.get(nkey(r['name']),(None,None))
    # romaji is only a READING when the written name is in Japanese script.
    # Latin ring names = the name itself; katakana/mixed = original foreign spelling.
    if rm and sc!='japanese':
        blanked[sc]+=1; rm=None
    ktype=(r['kana_source'] or {}).get('type')
    if r['kana'] and ktype=='published':      yomi='published_kana'
    elif r['kana'] and ktype=='from_romaji':  yomi='converted'
    elif rm:                                  yomi='romaji_only'
    else:                                     yomi='none'
    rows_csv.append({'name':r['name'],'yomi_kana':r['kana'] or '','yomi_romaji':rm or '',
        'yomi_source':yomi,'gym':r['gym'] or '','orgs':'|'.join(r['orgs']),
        'source_urls':'|'.join(r['sources'])})

# UTF-8 with BOM + CRLF: opens cleanly in Excel (JP) and Google Sheets without a manual import step
with open('fighters.csv','w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['name','yomi_kana','yomi_romaji','yomi_source','gym','orgs','source_urls'],
                     quoting=csv.QUOTE_MINIMAL,lineterminator='\r\n')
    w.writeheader(); w.writerows(rows_csv)

print('\n===== fighters.csv =====')
yc=collections.Counter(r['yomi_source'] for r in rows_csv)
n=len(rows_csv)
for k in ['published_kana','converted','romaji_only','none']:
    print(f'  {k:<16}{yc[k]:>6}  {yc[k]/n*100:>5.1f}%')
covered=sum(1 for r in rows_csv if r['yomi_kana'] or r['yomi_romaji'])
print(f'  -- kana or romaji present: {covered}/{n} = {covered/n*100:.1f}%')
print(f'  -- kana present          : {sum(1 for r in rows_csv if r["yomi_kana"])}')
print(f'  -- romaji present        : {sum(1 for r in rows_csv if r["yomi_romaji"])}')
print('  -- romaji blanked (not a reading):',dict(blanked),'total',sum(blanked.values()))
print('  -- rows with a yomi but no source_urls:',
      sum(1 for r in rows_csv if (r['yomi_kana'] or r['yomi_romaji']) and not r['source_urls']))

# ---- README.txt shipped alongside the CSV ----
CONTACT='【訂正の宛先】X: @mnews_mma のDMへ'
readme=f"""立ち技名鑑 選手名簿  fighters.csv
生成日: 2026-08-14 / 全{n}件

{CONTACT}
　記載の誤り・読みの誤りを見つけた場合はこちらへご連絡ください。

────────────────────────────────────
■ ファイルの開き方（文字化け対策）
　文字コードは BOM付き UTF-8、改行は CRLF です。
　・Excel（Windows/Mac）… ダブルクリックでそのまま開けます。文字化けしません。
　　（BOMを付けてあるため「データ→テキストファイル」でのインポート操作は不要です）
　・Google スプレッドシート … ファイル→インポート→アップロード でそのまま開けます。
　※ 再保存する場合は「CSV UTF-8」形式を選んでください。Shift_JIS で保存すると
　　選手名の一部（﨑・𠮷 等）が失われます。

■ 列の説明
　name         表記名（各団体の公式表記）
　yomi_kana    かな。取得できたもののみ。{sum(1 for r in rows_csv if r['yomi_kana'])}件
　yomi_romaji  団体公式が公開しているローマ字（原文のまま）。{sum(1 for r in rows_csv if r['yomi_romaji'])}件
　yomi_source  読みの出どころ。下記4区分
　gym          所属
　orgs         掲載を確認した団体（複数は | 区切り）
　source_urls  出典URL（複数は | 区切り）

■ yomi_source の区分
　published_kana  団体公式・Wikipediaが公開しているかな。そのまま使えます（{yc['published_kana']}件）
　converted       公式ローマ字からこちらでカナ化したもの（{yc['converted']}件）
　　　　　　　　　　※ 誤変換の可能性があるため yomi_romaji も併記しています。
　　　　　　　　　　　食い違う場合は yomi_romaji（公式原文）を優先してください。
　romaji_only     かなは未取得。公式ローマ字のみ（{yc['romaji_only']}件）
　none            読みの公開元なし（{yc['none']}件）

■ yomi_romaji の注意点
　・団体が公開している原文をそのまま入れています。**姓名の語順は入れ替えていません。**
　　　K-1 / KNOCK OUT … 姓→名（例: Suzuki Shota、HISAI Taimu）表記名と同じ順
　　　RISE            … 名→姓（例: Sora Tanazawa）表記名と逆順
　　複数団体に掲載がある選手は、表記名と同じ語順になる K-1 / KNOCK OUT の表記を優先しました。
　・公式ローマ字は長音を省略します（ショウタ→Shota、コウタロウ→KOTARO）。
　　読み上げの際は長音が落ちている前提でお読みください。

■ yomi_romaji が空欄のもの（{sum(blanked.values())}件）
　名前そのものであって「読み」ではないため、意図的に空にしています。
　・表記名がラテン文字のリングネーム（ACHI、YA-MAN 等）… {blanked['latin-only']}件
　・外国人選手の原語表記（アブデラ・エズビリ = Abdallah Ezbiri 等）… {blanked['katakana-only']}件
　・カタカナ＋ラテン文字の混在（ペットシラー・FURUMURA-GYM 等）… {blanked['mixed-kana-latin']}件
　これらの多くは表記名自体がカナのため yomi_kana 側が埋まっています。

■ 収録範囲
　Wikipedia（男子/女子キックボクサー一覧）、K-1 / Krush / Krush-EX、RISE、
　SHOOT BOXING、KNOCK OUT の各公式に掲載の選手。戦績は含みません。
　かな・ローマ字のいずれかが入っているのは {covered}件（{covered/n*100:.1f}%）です。
"""
open('README.txt','w',encoding='utf-8').write(readme)
print('  -- README.txt written')

# ================= bouts_*.json (団体別) =================
import bouts as _bouts

PROMOS=[('sb','SHOOT BOXING','raw/sb_bouts/*.html','https://shootboxing.org/fighter/{}/','shootboxing.org',None),
        ('rise','RISE','raw/rise_bouts/*.html','https://rise-rc.com/fighter/{}/','rise-rc.com',None),
        ('knockout','KNOCK OUT','raw/ko_bouts/*.html','https://knockoutkb.com/fighters/{}','knockoutkb.com',
         _bouts.parse_ko_page),
        ('k1','K-1 / Krush / Krush-EX','raw/k1_bouts/*.html','https://www.k-1.co.jp/fighter/{}','www.k-1.co.jp',
         _bouts.parse_k1_page)]
_all={}
for _tag,_label,_src,_tpl,_host,_parser in PROMOS:
    _b=_bouts.build('fighters.json',_src,_tag,_tpl,_host,_parser)
    if not _b:
        print(f'\n===== bouts_{_tag}.json ===== SKIPPED (no raw pages under {_src})'); continue
    json.dump(_b,open(f'bouts_{_tag}.json','w'),ensure_ascii=False,indent=1)
    _all[_tag]=_b
    _r=sum(1 for x in _b if x['opponent_resolved'])
    _u=[x for x in _b if not x['opponent_resolved']]
    print(f'\n===== bouts_{_tag}.json ({_label}) =====')
    print('  total bouts        :',len(_b))
    print('  source pages       :',len({x['fighter_slug'] for x in _b}))
    print(f'  opponent resolved  : {_r}/{len(_b)} = {_r/len(_b)*100:.1f}%')
    print(f'  opponent unresolved: {len(_u)}  (distinct {len({x["opponent_name"] for x in _u})})')
    print('    via site link    :',sum(1 for x in _b if x['opponent_resolved'] and x['opponent_site_slug']))
    print('    via name match   :',sum(1 for x in _b if x['opponent_resolved'] and not x['opponent_site_slug']))
    print('  opponent ambiguous :',sum(1 for x in _b if x['opponent_ambiguous']))
    print('  result             :',dict(collections.Counter(x['result'] for x in _b)))
    print('  result undetermined:',sum(1 for x in _b if x['result']=='unknown'))
    print('  is_extension       :',sum(1 for x in _b if x['is_extension']))
    print('  all have source_url:',all(x['source_url'] for x in _b))
    print('  gaps: date',sum(1 for x in _b if not x['date']),
          '| event',sum(1 for x in _b if not x['event']),
          '| venue',sum(1 for x in _b if not x['venue']))

# ---- 同一event文字列の兄弟行から補完したnull日付の一覧(2026-08-15、次回同種作業の照合用) ----
json.dump(_bouts.INFERRED_DATE_LOG, open('raw/inferred_dates_log.json','w'), ensure_ascii=False, indent=1)
print(f'\n同一event兄弟行からの日付補完: {len(_bouts.INFERRED_DATE_LOG)}件 -> raw/inferred_dates_log.json')

# ---- K-1: 戦績サマリーとの突合（独立検証） ----
if 'k1' in _all:
    _chk=_bouts.k1_summary_check()
    _full=[r for r in _chk if r.get('status')=='full']
    _part=[r for r in _chk if r.get('status')=='partial']
    _nos=[r for r in _chk if r.get('status')=='no_summary']
    _ok=[r for r in _full if r['got_win']==r['sum_win'] and r['got_lose']==r['sum_lose'] and r['got_draw']==r['sum_draw']]
    _kook=[r for r in _ok if r['got_ko']==r['sum_ko']]
    print('\n===== K-1 戦績サマリー突合（独立検証） =====')
    print('  選手ページ総数              :',len(_chk))
    print('  サマリー記載なし            :',len(_nos))
    print('  表の件数がサマリー総戦数と一致:',len(_full),'(= キャリアが全てK-1グループ内)')
    print('  　└ 勝/敗/分がすべて一致    :',f'{len(_ok)}/{len(_full)}',
          f'= {len(_ok)/len(_full)*100:.1f}%' if _full else '')
    print('  　　└ KO勝ち数も一致        :',f'{len(_kook)}/{len(_ok)}',
          f'= {len(_kook)/len(_ok)*100:.1f}%' if _ok else '')
    print('  表が部分掲載（他団体戦あり） :',len(_part))
    _bad=[r for r in _full if r not in _ok]
    print('  一致しなかった選手           :',len(_bad))
    for r in _bad[:8]:
        print(f"     {r['name']}: 取得 {r['got_win']}勝{r['got_lose']}敗{r['got_draw']}分"
              f" / サマリー {r['sum_win']}勝{r['sum_lose']}敗{r['sum_draw']}分")
    json.dump(_chk,open('raw/k1_summary_check.json','w'),ensure_ascii=False,indent=1)

# ---- 未解決の相手（名簿拡張の材料） ----
if _all:
    agg={}
    for _tag,_b in _all.items():
        for x in _b:
            if x['opponent_resolved'] or x['opponent_ambiguous']: continue
            k=x['opponent_name']
            # 個人選手でないエントリ（ジム対抗戦のチーム名）は名簿拡張の対象外
            if 'コーチ：' in k or 'コーチ:' in k or 'の勝利チーム' in k: continue
            e=agg.setdefault(k,{'name':k,'count':0,'promotions':set(),
                                'affiliations':set(),'source_urls':[]})
            e['count']+=1; e['promotions'].add(_tag)
            if x['opponent_affiliation']: e['affiliations'].add(x['opponent_affiliation'])
            if x['source_url'] not in e['source_urls']: e['source_urls'].append(x['source_url'])
    unres=sorted(agg.values(),key=lambda e:(-e['count'],e['name']))
    for e in unres:
        e['promotions']=sorted(e['promotions']); e['affiliations']=sorted(e['affiliations'])
    json.dump(unres,open('unresolved_opponents.json','w'),ensure_ascii=False,indent=1)
    print('\n===== unresolved_opponents.json =====')
    print('  distinct unresolved opponents:',len(unres))
    print('  total unresolved bout rows   :',sum(e['count'] for e in unres))
    print('  appear in >1 promotion       :',sum(1 for e in unres if len(e['promotions'])>1))

# ================= bouts_*.json (条件付き6団体のうち取得済み5団体、統合フェーズ) =================
# 各団体のスクレイピング/パース方式が個々に異なる(選手ページ型/大会結果ページ型/Amebloブログ等)ため
# bouts.build()の共通パイプラインには乗らず、団体ごとのingest_*.pyが個別にbuild()を持つ。
# unresolved_opponents.json の集計対象(_all)には含めない — 既存4ソース基準の集計を変えない
# (レグ④⑤のDEEP☆KICK/NJKF/HOOST CUP/NKBと同じ扱い)。
import ingest_bigbang, ingest_standup, ingest_krossover, ingest_snka, ingest_jka

EXTRA_ORGS=[('bigbang','Bigbang',ingest_bigbang),('standup','Stand up',ingest_standup),
            ('krossover','KROSS×OVER',ingest_krossover),('snka','新日本キックボクシング協会(SNKA)',ingest_snka),
            ('jka','ジャパンキックボクシング協会(JKA)',ingest_jka)]
for _tag,_label,_mod in EXTRA_ORGS:
    _b,_stats=_mod.build()
    json.dump(_b,open(f'bouts_{_tag}.json','w'),ensure_ascii=False,indent=1)
    _r=sum(1 for x in _b if x['opponent_resolved'])
    _u=[x for x in _b if not x['opponent_resolved'] and not x['opponent_ambiguous']]
    print(f'\n===== bouts_{_tag}.json ({_label}) =====')
    print('  total bouts        :',len(_b))
    print(f'  opponent resolved  : {_r}/{len(_b)} = {_r/len(_b)*100:.1f}%' if _b else '  (no bouts)')
    print(f'  opponent unresolved: {len(_u)}  (distinct {len({x["opponent_name"] for x in _u})})')
    print('  opponent ambiguous :',sum(1 for x in _b if x['opponent_ambiguous']))
    print('  result             :',dict(collections.Counter(x['result'] for x in _b)))
    print('  title_type(全件null):',all(x.get('title_type') is None for x in _b))
    print('  gaps: date',sum(1 for x in _b if not x['date']))
