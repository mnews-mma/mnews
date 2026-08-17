# -*- coding: utf-8 -*-
"""和島大海欠落調査(2026-08): coverage_population.json拡張で新規に取り込まれる
Wikipedia由来boutの増分について、検査A(ルール混入: MMA/エキシビジョン/アマチュア/
ボクシング/プロレス等、キックボクシングの戦績として掲載すべきでないもの)を機械的に
一次スクリーニングする。

このスクリプトはヒットを自動で除外はしない(誤検知を機械的に確定除外すると正当な
記述まで消しかねないため)。ヒットした行を一覧表示し、人間(このセッション)が
個別に事実確認したうえでmanualRuleExclusions.jsonに追加するかどうかを判断する
材料にする。

使い方: bouts_wikipedia.json の「before」(拡張前)と「after」(拡張後)を比較し、
afterにのみ存在する行(=今回の増分)だけを対象にキーワードスクリーニングする。
"""
import json
import sys

SUSPECT_PATTERNS = [
    "総合格闘技", "MMA", "グラップリング", "サブミッション",
    "エキシビション", "エキシビジョン", "余興",
    "アマチュア", "新人王",
    "ボクシングルール", "K-1ルール", "ボクシング（プロ）",
    "プロレス", "八百長", "ノーコンテスト（八百長）",
]


def load(path):
    return json.load(open(path))


def bout_key(b):
    return (b.get("fighter_slug"), b.get("date"), b.get("opponent_name"), b.get("method_raw"))


def main():
    before_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/bouts_wikipedia_before.json"
    after_path = sys.argv[2] if len(sys.argv) > 2 else "bouts_wikipedia.json"
    before = load(before_path)
    after = load(after_path)
    before_keys = {bout_key(b) for b in before}
    delta = [b for b in after if bout_key(b) not in before_keys]
    print(f"before: {len(before)}件 / after: {len(after)}件 / 増分(delta): {len(delta)}件")

    hits = []
    for b in delta:
        haystack = " ".join([
            b.get("event") or "", b.get("method_raw") or "", b.get("note") or "",
            b.get("ruleset") or "",
        ])
        for pat in SUSPECT_PATTERNS:
            if pat in haystack:
                hits.append((pat, b))
                break

    print(f"検査Aヒット(要人間確認): {len(hits)}件")
    for pat, b in hits:
        print(f"  [{pat}] fighter={b.get('fighter_name')} date={b.get('date')} "
              f"opponent={b.get('opponent_name')} event={b.get('event')!r} method={b.get('method_raw')!r}")

    json.dump(delta, open("/tmp/wajima_delta_bouts.json", "w"), ensure_ascii=False, indent=1)
    json.dump([b for _, b in hits], open("/tmp/wajima_delta_contamination_hits.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
