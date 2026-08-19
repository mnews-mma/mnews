# -*- coding: utf-8 -*-
"""U-3(2026-08、名前解決失敗のかな→ローマ字転写一致軸用): カタカナ→ヘボン式ローマ字の
   簡易変換テーブル。長音符(ー)は直前の母音を伸ばす形で処理し、促音(ッ)は次の子音を重ねる。
   完全な形態素解析ではなく機械的な音節変換のため、複合語境界の扱い等で厳密な公式表記と
   一致しない場合がある(照合の候補生成用途であり、最終判定は個別確認で行う前提)。"""
import re
import unicodedata

_DIGRAPHS = {
    'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
    'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
    'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
    'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
    'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
    'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
    'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
    'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
    'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
    'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
    'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
    'ファ': 'fa', 'フィ': 'fi', 'フェ': 'fe', 'フォ': 'fo', 'フュ': 'fyu',
    'ウィ': 'wi', 'ウェ': 'we', 'ウォ': 'wo',
    'ヴァ': 'va', 'ヴィ': 'vi', 'ヴェ': 've', 'ヴォ': 'vo', 'ヴ': 'vu',
    'ティ': 'ti', 'トゥ': 'tu', 'ディ': 'di', 'ドゥ': 'du',
    'チェ': 'che', 'シェ': 'she', 'ジェ': 'je',
    'ツァ': 'tsa', 'ツェ': 'tse', 'ツォ': 'tso',
}
_MONOGRAPHS = {
    'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
    'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
    'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
    'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
    'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
    'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
    'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
    'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
    'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
    'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
    'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
    'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
    'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
    'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
    'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
}
_VOWEL_AFTER = {'a': 'a', 'i': 'i', 'u': 'u', 'e': 'e', 'o': 'o'}


def katakana_to_romaji(s):
    """全角カタカナ(・、ー含む)をヘボン式ローマ字に変換する。非カタカナ文字はそのまま残す。"""
    s = unicodedata.normalize('NFKC', s or '')
    s = s.replace('ー', '\x00')  # 長音符は直前の母音を複製するため一旦マーク
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == '\x00':
            if out and out[-1] and out[-1][-1] in 'aiueo':
                out.append(out[-1][-1])
            i += 1
            continue
        if c == 'ッ':
            nxt2 = s[i + 1:i + 3]
            nxt1 = s[i + 1:i + 2]
            rom = _DIGRAPHS.get(nxt2) or _MONOGRAPHS.get(nxt1)
            if rom:
                out.append(rom[0] if rom[0] != 'c' else 't')
            i += 1
            continue
        two = s[i:i + 2]
        if two in _DIGRAPHS:
            out.append(_DIGRAPHS[two])
            i += 2
            continue
        if c in _MONOGRAPHS:
            out.append(_MONOGRAPHS[c])
            i += 1
            continue
        out.append(c)
        i += 1
    result = ''.join(out)
    # 撥音(ン)の後にp/b/mが続く場合はmに変える慣習(ヘボン式)は誤検出源になりうるため省略、
    # nのまま統一する(照合用の緩い正規化であり、完全な公式表記一致を狙わない)。
    return result


def normalize_romaji(s):
    """比較用: 空白・記号・大文字小文字差を無視した正規化。"""
    s = unicodedata.normalize('NFKC', s or '').lower()
    s = re.sub(r"[\s\-'’.]", '', s)
    return s
