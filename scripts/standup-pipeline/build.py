import json,re,unicodedata,collections,os

# cache/配下(2026-08-21追加): K-1/RISE/SHOOT BOXING/KNOCK OUT/Wikipediaの名簿系
# 派生JSONは、これを生成するスクリプトがリポジトリのどこにも存在しない(過去の
# アドホックな一回限りの作業で作られ、raw/(.gitignore対象・未コミット)にのみ
# 実体があった)。空のraw/から起動する週次自動更新ジョブ(.github/workflows/
# update-kick-data.yml)を成立させるため、この11ファイルだけをraw/の外
# (cache/、.gitignore対象外・コミット済み)に退避し、build.pyの参照先もこちらに
# 変更した。「生成手段が無いキャッシュが残っていること自体」は未解決の課題として
# 残る(このコミットで行ったのは"起動可能にする"until、生成スクリプトの再構築では
# ない)。将来これらのソースの名簿を更新する場合、cache/配下のファイルを手動で
# 更新すること(このリポジトリのどのスクリプトも自動更新しない)。
CACHE_DIR = 'cache'


# 週次自動更新ジョブ用のフラグ(2026-08-21追加): RIZIN・Wikipediaはこのジョブの
# 対象13ソースに含まれない(RIZINは4団体戦績data側で別途取得済み、Wikipediaは
# 名寄せ判定の手動確認コストが高く今回は対象外とした判断)。このフラグが立って
# いる間は両者の処理を完全にスキップし、data/kick/bouts_rizin.json・
# bouts_wikipedia.jsonは前回コミットの値のまま一切書き換えない(=凍結)。
#
# fighters.json/fighters.csv/README.txtも同じ扱いにする(2026-08-21追加)。
# generate_roster.py(旧・本ファイルのこの位置にあった約380行)が生成する名簿と
# コミット済みfighters.jsonを実測比較したところ86件の差分(うち50件がWikipedia
# 由来のkana消失、5件がレコード分裂、他sources/aliases/orgs/gym)があり、原因は
# cache/配下の名簿系派生JSON(2026-08-18時点のスナップショット、生成手段が無い)が
# 現在コミット済みのfighters.jsonを実際に生成した時点の入力と完全には一致しない
# ため(詳細はRAW_CACHE.md参照)。「名簿の自動拡張はしない」がこのジョブの
# スコープ外事項であり、そもそも名簿を再生成する必要が無いという判断のもと、
# SKIP_FROZEN_SOURCES=1の間はgenerate_roster.pyのimport自体を行わない
# (=fighters.json/fighters.csv/README.txtに一切触れない。チェックアウト直後の
# コミット済みの内容がそのまま使われる)。
SKIP_FROZEN_SOURCES = os.environ.get('KICK_SKIP_FROZEN_SOURCES') == '1'

if SKIP_FROZEN_SOURCES:
    print('[frozen] 名簿(fighters.json/fighters.csv/README.txt): '
          'KICK_SKIP_FROZEN_SOURCES=1のため再生成をスキップ(コミット済みの内容をそのまま使う)')
else:
    import generate_roster  # noqa: F401  (importすることで名簿生成が実行される)

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

# ================= bouts_*.json (旧・別実行が必要だった5団体、恒久統合) =================
# 2026-08-15判明: この5団体はEXTRA_ORGSと同じ「fighters.jsonのbyname解決」に依存する構造でありながら
# build.pyのオーケストレーションに含まれておらず、`python3 ingest_X.py`を個別に実行しない限り
# 名簿拡大(fighters.json増加)が反映されなかった。Bigbang/JKA/KROSS×OVER(旧レグ)、
# DEEP☆KICK/HoostCup/NJKF/NKB/RIZIN(本件)と3回同種の取りこぼしが発生したため、
# 「build.pyを一発実行すれば全15団体が再生成される」ことを構造的に保証するべく本ループへ統合する。
# unresolved_opponents.json の集計対象(_all)には含めない(EXTRA_ORGSと同じ理由・既存の集計を変えない)。
import ingest_deepkick, ingest_hoostcup, ingest_njkf, ingest_nkb

FORMERLY_STANDALONE_ORGS=[('deepkick','DEEP☆KICK',ingest_deepkick),('hoostcup','HoostCup',ingest_hoostcup),
            ('njkf','NJKF',ingest_njkf),('nkb','NKB',ingest_nkb)]
if SKIP_FROZEN_SOURCES:
    # RIZINは週次自動更新ジョブの対象13ソースに含まれない(凍結、上記CACHE_DIRの
    # コメント参照)。`import ingest_rizin`自体がモジュールレベルで
    # raw/rizinRecords.jsonを即座に読むため(このジョブは用意しない)、
    # リストから除外するだけでは足りずimport自体を丸ごとスキップする必要がある
    # (2026-08-21、ローカル実測で「リストから除外しても importが先に例外になる」
    # ことを発見・修正)。前回コミットされたdata/kick/bouts_rizin.jsonは
    # ワークフロー側で一切上書きしない。
    print('[frozen] RIZIN: KICK_SKIP_FROZEN_SOURCES=1のためimport ingest_rizin自体をスキップ')
else:
    import ingest_rizin
    FORMERLY_STANDALONE_ORGS.append(('rizin','RIZIN(キックボクシングのみ)',ingest_rizin))
for _tag,_label,_mod in FORMERLY_STANDALONE_ORGS:
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
    print('  gaps: date',sum(1 for x in _b if not x['date']))

# ================= bouts_wikipedia.json (Wikipedia戦績、母集団509人限定) =================
# coverage_population.json(509人、ja.wikipedia記事に{{Fight-cont}}戦績表を持つ選手)のみが対象。
# 名簿拡大は行わない(全団体再生成が必要になり間に合わないため)。重複判定・既存行との突合ロジックは
# ingest_wikipedia.py内で完結(日付一致→相手名フォールバック→複数候補は保留)。
# raw/wp_wikitext_509.json(fetch_wikitext_cache.pyで別途一回だけ取得したキャッシュ)を読むのみで、
# build.py実行時にWikipedia APIへは再アクセスしない(決定的に保つため)。
if SKIP_FROZEN_SOURCES:
    # Wikipediaは週次自動更新ジョブの対象13ソースに含まれない(凍結、上記CACHE_DIRの
    # コメント参照)。raw/wp_wikitext_v2.json(fetch_wikitext_cache_v2.pyが生成、この
    # ジョブでは呼ばない)が無いと例外になるため、ingest_wikipedia.build()自体を
    # 呼ばずスキップする。前回コミットされたdata/kick/bouts_wikipedia.jsonは
    # ワークフロー側で一切上書きしない。
    print('\n[frozen] Wikipedia: KICK_SKIP_FROZEN_SOURCES=1のためbouts_wikipedia.jsonの再生成をスキップ')
else:
    import ingest_wikipedia
    _wiki_bouts,_wiki_stats,_wiki_held=ingest_wikipedia.build()
    json.dump(_wiki_bouts,open('bouts_wikipedia.json','w'),ensure_ascii=False,indent=1)
    json.dump(_wiki_held,open('wikipedia_held_ambiguous.json','w'),ensure_ascii=False,indent=1)
    print('\n===== bouts_wikipedia.json (Wikipedia、母集団509人限定) =====')
    print('  Wikipedia側bout総数:',_wiki_stats['total_wiki_bouts'])
    print('  範囲外              :',_wiki_stats['out_of_scope'])
    print('  既存(日付一致)重複  :',_wiki_stats['dup_dated_match'])
    print('  既存(相手名)重複    :',_wiki_stats['dup_fallback_match'])
    print('  複数候補で保留      :',_wiki_stats['held_ambiguous'])
    print('  新規追加            :',_wiki_stats['new_added'])
    _wr=sum(1 for x in _wiki_bouts if x['opponent_resolved'])
    print(f'  opponent resolved   : {_wr}/{len(_wiki_bouts)} = {_wr/len(_wiki_bouts)*100:.1f}%' if _wiki_bouts else '  (no bouts)')
