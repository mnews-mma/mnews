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
import glob
import json
import re
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

OUT_DIR = "raw/ko_bouts"


def real_url(stored_slug):
    """ファイル名(例: yushi_627__p2)から実URL(?page=N形式、実測確認済み)を組み立てる。
       __pN無しは1ページ目(?無し)。"""
    m = re.match(r"^(.+)__p(\d+)$", stored_slug)
    if m:
        base, page = m.group(1), m.group(2)
        if page == "1":
            return f"https://knockoutkb.com/fighters/{base}"
        return f"https://knockoutkb.com/fighters/{base}?page={page}"
    return f"https://knockoutkb.com/fighters/{stored_slug}"


def main():
    t0 = time.time()
    known_slugs = sorted(p.split("/")[-1][:-5] for p in glob.glob(f"{OUT_DIR}/*.html"))
    print(f"既知slug(既存raw/ko_bouts/のファイル名から復元): {len(known_slugs)}件(新規発見は今回未実施)")

    failed = []
    n_ok = 0
    for i, slug in enumerate(known_slugs):
        url = real_url(slug)
        ok, text, err = fetch(url)
        if ok and not text.lstrip().lower().startswith(("<!doctype", "<html")):
            ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{slug}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok += 1
            if (i + 1) % 25 == 0 or i + 1 == len(known_slugs):
                print(f"[{i + 1}/{len(known_slugs)}] {slug}: OK")
        else:
            failed.append({"slug": slug, "url": url, "error": err})
            print(f"[{i + 1}/{len(known_slugs)}] {slug}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(known_slugs)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_knockout_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_knockout_failed.json")


if __name__ == "__main__":
    main()
