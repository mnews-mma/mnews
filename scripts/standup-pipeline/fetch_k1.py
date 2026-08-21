# -*- coding: utf-8 -*-
"""K-1/Krush/Krush-EX公式(k-1.co.jp)のフェッチャ(U-1)。

   ★母集団の新規発見はできなかった(記録): 元の名簿構築(SOURCES.md記載)は、現行選手
   一覧ページ(/fighter?page=1〜77、609人)に加えて、退所/現役外の選手を拾うために
   ID空間の走査(1,196件のIDを個別プローブ)という多段階・大規模な処理を要した。
   本セッションでは時間の制約上この全量再現は行わず、既知の1,595件(既存raw/k1_bouts/の
   ファイル名)を再取得するのみに留める(NKB旧サイト・DEEP☆KICK・KNOCK OUTと同じ
   「既知一覧の再検証」方針)。新規の退所選手・新規デビュー選手の発見はできていない。
   実行方法: cd scripts/standup-pipeline && python3 fetch_k1.py
"""
import json
import os
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

OUT_DIR = "raw/k1_bouts"
# 2026-08-21追加: GitHub Actionsの新規runnerはraw/が空(サブディレクトリも無い)ため、
# 書き込み前に作る(ローカルの使い回しraw/では暗黙に存在していた)。
os.makedirs(OUT_DIR, exist_ok=True)
URL_TPL = "https://www.k-1.co.jp/fighter/{}"


def main():
    t0 = time.time()
    # 2026-08-21変更: 従来はglob.glob(f"{OUT_DIR}/*.html")で「既存raw/のファイル名」
    # から既知IDを復元していたが、週次自動更新ジョブはraw/が毎回空の状態から始まる
    # (.gitignore対象、CI runnerに前回状態が残らない)ため、この方式では0件になり
    # 何も取得できなくなる。cache/k1_parsed.json(コミット済み、名簿キャッシュ)の
    # id一覧を正とする(既存raw/が残っている場合の実行結果は変わらない)。
    #
    # cache/k1_delisted_merges.jsonのk1_idも合わせて対象にする(2026-08-21、ローカル
    # 実測で発見): 退所選手はk1_parsed.json(名簿)には別レコードとして載らず、既存の
    # RISE/KNOCK OUT等のレコードへ統合される(build.py参照)ため、k1_parsed.jsonの
    # idだけを使うと退所選手151人分の戦績ページ(raw/k1_bouts/)が丸ごと欠落し、
    # bouts_k1.jsonが1,595件→1,443件(-152件、-9.5%)まで減少する回帰を確認した。
    known_ids = {r["id"] for r in json.load(open("cache/k1_parsed.json"))}
    if os.path.exists("cache/k1_delisted_merges.json"):
        delisted = json.load(open("cache/k1_delisted_merges.json"))
        known_ids |= {m["k1_id"] for m in delisted}
    known_ids = sorted(known_ids, key=lambda x: (len(x), x))
    print(f"既知ID(cache/k1_parsed.json + k1_delisted_merges.jsonの名簿由来): {len(known_ids)}件(新規発見は今回未実施)")

    failed = []
    n_ok = 0
    for i, fid in enumerate(known_ids):
        url = URL_TPL.format(fid)
        ok, text, err = fetch(url)
        if ok and not text.lstrip().lower().startswith(("<!doctype", "<html")):
            ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{fid}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok += 1
            if (i + 1) % 50 == 0 or i + 1 == len(known_ids):
                print(f"[{i + 1}/{len(known_ids)}] {fid}: OK")
        else:
            failed.append({"id": fid, "url": url, "error": err})
            print(f"[{i + 1}/{len(known_ids)}] {fid}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(known_ids)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_k1_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_k1_failed.json")


if __name__ == "__main__":
    main()
