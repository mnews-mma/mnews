# -*- coding: utf-8 -*-
"""KNOCK OUT公式(knockoutkb.com)のフェッチャ(U-1)。

   ★母集団の新規発見はできなかった(記録): トップページ・/fighters・/eventsいずれも
   サーバー側でリンクを返さない(クライアントサイドレンダリングのSPAと見られる、実測確認)。
   個別ページ(/fighters/{slug}、/events/{slug})はslugが分かっていれば直接アクセスできるが、
   一覧・sitemap経由でのslug一覧取得はできなかった。元のraw/(このリポジトリのraw/ko_events_manifest.json・
   raw/ko_event_fighter_slugs.json)は「大会ページを個別に辿り、対戦カードに登場する選手slugを
   収集する」という多段階の方式で構築されていたと見られる(71大会→523人)。同じ大会一覧の
   発見口自体が見つからなかったため、今回は新規発見をしていない。ヘッドレスブラウザの
   導入はスコープ外のため、この制約はそのまま記録する。

   よって本フェッチャは、既存raw/ko_bouts/*.htmlのファイル名(=既知slug)を再取得するのみ
   (NKB旧サイト・DEEP☆KICKと同じ「既知一覧の再検証」方針)。
   実行方法: cd scripts/standup-pipeline && python3 fetch_knockout.py
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

OUT_DIR = "raw/ko_bouts"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)


def page_url(slug, page):
    if page == 1:
        return f"https://knockoutkb.com/fighters/{slug}"
    return f"https://knockoutkb.com/fighters/{slug}?page={page}"


FIGHT_LOG_RE = re.compile(r'(?s)<li class="fight-log fight-log--[a-z]+">(.*?)</li>')

MAX_PAGES = 20  # 実測上限は2ページ(archive時点)だが将来の増加に備えた安全上限


def main():
    t0 = time.time()
    # 2026-08-21変更: 従来はglob.glob(f"{OUT_DIR}/*.html")で「既存raw/のファイル名」
    # から既知slugを復元していたが、週次自動更新ジョブはraw/が毎回空の状態から始まる
    # (.gitignore対象、CI runnerに前回状態が残らない)ため、この方式では0件になり
    # 何も取得できなくなる。cache/ko_parsed.json(コミット済み、名簿キャッシュ)のurlから
    # slugを復元する(既存raw/が残っている場合の実行結果は変わらない)。
    #
    # ページネーション(2026-08-21、ローカル実測で発見): cache/ko_parsed.jsonのurlは
    # 1ページ目のみで、単純にそこだけ取得すると2ページ目以降の戦績が丸ごと欠落し、
    # bouts_knockout.jsonが1,305件→1,236件(-70件)まで減少する回帰を確認した。しかも
    # 「?page=2」は2ページ目が実在しない選手にも200 OKで(別内容の)HTMLを返すため、
    # 既知の`__pN`ファイル一覧を事前チェックする方式は使えない。全選手について、
    # ページを1から順に取得し、直前ページと試合ログ(<li class="fight-log...">)の内容が
    # 完全一致した時点(=サイト側がページ範囲外を検知して同じ内容を繰り返す挙動、実測確認)
    # で打ち切る方式に変更した。安全上限MAX_PAGESも設ける。
    known_slugs = sorted(
        r["url"].rstrip("/").split("/")[-1] for r in json.load(open("cache/ko_parsed.json"))
    )
    print(f"既知slug(cache/ko_parsed.jsonの名簿由来): {len(known_slugs)}件(新規発見は今回未実施)")

    failed = []
    n_ok = 0
    total_pages = 0
    for i, slug in enumerate(known_slugs):
        prev_blocks = None
        slug_failed = False
        for page in range(1, MAX_PAGES + 1):
            url = page_url(slug, page)
            ok, text, err = fetch(url)
            if ok and not text.lstrip().lower().startswith(("<!doctype", "<html")):
                ok, text, err = fetch(url)
            if not ok:
                if page == 1:
                    failed.append({"slug": slug, "url": url, "error": err})
                    slug_failed = True
                break
            blocks = FIGHT_LOG_RE.findall(text)
            if page > 1 and (not blocks or blocks == prev_blocks):
                break
            with open(f"{OUT_DIR}/{slug}__p{page}.html", "w", encoding="utf-8") as f:
                f.write(text)
            total_pages += 1
            prev_blocks = blocks
        if not slug_failed:
            n_ok += 1
        if (i + 1) % 25 == 0 or i + 1 == len(known_slugs):
            print(f"[{i + 1}/{len(known_slugs)}] {slug}: {'OK' if not slug_failed else 'FAILED'}")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(known_slugs)}選手取得(延べ{total_pages}ページ), 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_knockout_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_knockout_failed.json")


if __name__ == "__main__":
    main()
