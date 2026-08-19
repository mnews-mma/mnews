# -*- coding: utf-8 -*-
"""U-2: HTMLコメント内残骸の誤解析を全13ソースで機械的に測定する(調査専用、非コミット)。
   builtin open()をラップし、.html読み込み時のみ<!-- -->を除去したバージョンとの
   差分を取ることで、「コメントアウトされた領域から誤って抽出している行」を特定する。
   コメント除去なし(通常)の抽出結果 vs コメント除去ありの抽出結果の差分 = 誤って
   拾っていた行、という理屈(コメント除去で消える行だけが対象。増える行は無いはず)。
"""
import builtins
import io
import re
import sys
import importlib

_orig_open = builtins.open
_strip = True


class _StrippedReader:
    def __init__(self, text):
        self._t = text

    def read(self, *a, **k):
        return self._t


def _patched_open(path, *args, **kwargs):
    f = _orig_open(path, *args, **kwargs)
    if _strip and isinstance(path, str) and path.endswith('.html'):
        try:
            content = f.read()
        finally:
            f.close()
        if isinstance(content, bytes):
            stripped = re.sub(rb'(?s)<!--.*?-->', b'', content)
        else:
            stripped = re.sub(r'(?s)<!--.*?-->', '', content)
        return _StrippedReader(stripped)
    return f


def nk(b):
    return (b.get('fighter_slug'), b.get('event'), b.get('date'),
            b.get('opponent_raw'), b.get('method_raw'), b.get('result'))


def run_module(modname):
    global _strip
    mod = importlib.import_module(modname)
    builtins.open = _orig_open
    _strip = False
    normal, _ = mod.build()
    for m in list(sys.modules):
        pass
    builtins.open = _patched_open
    _strip = True
    stripped, _ = mod.build()
    builtins.open = _orig_open
    _strip = False
    return normal, stripped


def run_promos():
    import bouts as _bouts
    global _strip
    PROMOS = [
        ('sb', 'raw/sb_bouts/*.html', 'https://shootboxing.org/fighter/{}/', None),
        ('rise', 'raw/rise_bouts/*.html', 'https://rise-rc.com/fighter/{}/', None),
        ('knockout', 'raw/ko_bouts/*.html', 'https://knockoutkb.com/fighters/{}', _bouts.parse_ko_page),
        ('k1', 'raw/k1_bouts/*.html', 'https://www.k-1.co.jp/fighter/{}', _bouts.parse_k1_page),
    ]
    out = {}
    for tag, src, tpl, parser in PROMOS:
        builtins.open = _orig_open
        _strip = False
        normal = _bouts.build('fighters.json', src, tag, tpl, 'x', parser)
        builtins.open = _patched_open
        _strip = True
        stripped = _bouts.build('fighters.json', src, tag, tpl, 'x', parser)
        builtins.open = _orig_open
        _strip = False
        out[tag] = (normal, stripped)
    return out


MODULE_SOURCES = ['bigbang', 'deepkick', 'hoostcup', 'jka', 'krossover', 'njkf', 'nkb', 'snka', 'standup']

if __name__ == '__main__':
    results = {}
    for name in MODULE_SOURCES:
        modname = f'ingest_{name}'
        normal, stripped = run_module(modname)
        nset = {nk(b) for b in normal}
        sset = {nk(b) for b in stripped}
        lost = nset - sset          # comment除去で消えた行 = コメントから誤って拾っていた
        gained = sset - nset        # 増えた行(通常は無いはず、あれば要調査)
        results[name] = (len(normal), len(stripped), lost, gained)
        print(f'{name:12s} normal={len(normal):5d} stripped={len(stripped):5d} '
              f'lost={len(lost):3d} gained={len(gained):3d}')

    promos = run_promos()
    for tag, (normal, stripped) in promos.items():
        nset = {nk(b) for b in normal}
        sset = {nk(b) for b in stripped}
        lost = nset - sset
        gained = sset - nset
        results[tag] = (len(normal), len(stripped), lost, gained)
        print(f'{tag:12s} normal={len(normal):5d} stripped={len(stripped):5d} '
              f'lost={len(lost):3d} gained={len(gained):3d}')

    print()
    print('===== detail (lost rows = comment-leak candidates) =====')
    for name, (n, s, lost, gained) in results.items():
        if lost or gained:
            print(f'--- {name} ---')
            for k in sorted(lost):
                print('  LOST  ', k)
            for k in sorted(gained):
                print('  GAINED', k)
