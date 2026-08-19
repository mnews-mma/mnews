# -*- coding: utf-8 -*-
"""13ソース分のフェッチャ共通処理(U-1、2026-08)。ONEトラック(discover_one_jp_athletes.py・
   build_one_manifest.py・fetch_one_manifest_pages.py)と同じ設計思想(urllib.request、
   User-Agent明示、タイムアウト、レート制限)を1箇所にまとめたもの。

   レート制限方針: 同一ホストへの並列アクセスはしない(単一プロセス・単一スレッドで
   順次実行、リクエスト間に必ずスリープを挟む)。ホストごとに間隔を変えられるよう
   HOST_DELAYSで調整可能にしている(未指定ホストはDEFAULT_DELAY秒)。
"""
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"
DEFAULT_DELAY = 1.0


def _encode_url(url):
    """日本語等の非ASCII文字を含むURL(IRI)をurllibが扱えるURIへエンコードする。
       既にパーセントエンコード済みの部分は壊さない(safe='%/:?=&#')。"""
    parts = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(parts.path, safe="/%")
    query = urllib.parse.quote(parts.query, safe="=&%")
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, query, parts.fragment))
HOST_DELAYS = {
    "ameblo.jp": 1.5,
}

_last_request_at = {}


def _host_of(url):
    return url.split("/")[2] if "://" in url else url


def polite_sleep(url):
    host = _host_of(url)
    delay = HOST_DELAYS.get(host, DEFAULT_DELAY)
    last = _last_request_at.get(host)
    if last is not None:
        elapsed = time.time() - last
        if elapsed < delay:
            time.sleep(delay - elapsed)
    _last_request_at[host] = time.time()


def fetch(url, timeout=20, retries=2, encoding=None):
    """成功時は(True, テキスト, None)、失敗時は(False, None, エラー文字列)を返す。
       致命的エラー(404等)でリトライしても意味がない場合は即座に失敗を返す。"""
    last_err = None
    for attempt in range(retries + 1):
        polite_sleep(url)
        try:
            req = urllib.request.Request(_encode_url(url), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                if encoding:
                    return True, raw.decode(encoding, errors="replace"), None
                return True, raw.decode("utf-8", errors="replace"), None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False, None, f"HTTP 404"
            last_err = f"HTTP {e.code}"
        except Exception as e:
            last_err = str(e)
        if attempt < retries:
            time.sleep(2 * (attempt + 1))
    return False, None, last_err


def fetch_bytes(url, timeout=20, retries=2):
    """生バイト列が必要な場合(Shift_JIS等、呼び出し側でdecodeする)。"""
    last_err = None
    for attempt in range(retries + 1):
        polite_sleep(url)
        try:
            req = urllib.request.Request(_encode_url(url), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return True, resp.read(), None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False, None, f"HTTP 404"
            last_err = f"HTTP {e.code}"
        except Exception as e:
            last_err = str(e)
        if attempt < retries:
            time.sleep(2 * (attempt + 1))
    return False, None, last_err
