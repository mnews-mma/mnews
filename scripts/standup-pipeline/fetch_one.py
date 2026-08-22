# -*- coding: utf-8 -*-
"""ONE Championship公式(onefc.com)のフェッチャ(2026-08-22追加、週次自動更新ジョブに編入)。

   取得対象はone_official_manifest.json(116人、固定)に限る。build_one_manifest.py
   (?country=jpタグの非網羅性の影響を受ける母集団再構築スクリプト)は週次ジョブからは
   一切呼ばない。この固定116人は「ONE公式に戦績表が存在すると個別に確認済みの選手」の
   集合であり、名簿の自動拡張(新しい選手の発見・追加)はこのジョブのスコープ外という
   既存方針([9]・data/kick/kickWeeklyKnownResidualGaps.json等参照)に従う。名簿自体を
   広げたい場合は人間がone_official_manifest.jsonを編集し、build_one_manifest.py等の
   既存の発見スクリプトを個別に実行して判断する(週次自動化とは別の作業)。
   このフェッチャが週次で行うのは、その固定116人分のプロフィールページの再取得のみ
   (最新の試合結果を反映するため)。

   実行方法: cd scripts/standup-pipeline && python3 fetch_one.py
"""
import json
import os
import sys
import time

sys.path.insert(0, ".")
from fetch_common import fetch

MANIFEST_PATH = "one_official_manifest.json"
OUT_DIR = "raw/one_manifest"
os.makedirs(OUT_DIR, exist_ok=True)


def main():
    t0 = time.time()
    manifest = json.load(open(MANIFEST_PATH, encoding="utf-8"))
    print(f"manifest(固定、build_one_manifest.pyは呼ばない): {len(manifest)}件")

    failed = []
    n_ok = 0
    for i, m in enumerate(manifest):
        slug = m["one_slug"]
        url = f"https://www.onefc.com/jp/athletes/{slug}/"
        ok, text, err = fetch(url)
        if ok:
            with open(f"{OUT_DIR}/{slug}.html", "w", encoding="utf-8") as f:
                f.write(text)
            n_ok += 1
            print(f"[{i + 1}/{len(manifest)}] {slug}: OK")
        else:
            failed.append({"slug": slug, "url": url, "error": err})
            print(f"[{i + 1}/{len(manifest)}] {slug}: FAILED ({err})")

    elapsed = time.time() - t0
    print(f"\n完了: {n_ok}/{len(manifest)}件取得, 失敗{len(failed)}件, 所要{elapsed:.1f}秒")
    if failed:
        json.dump(failed, open("fetch_one_failed.json", "w"), ensure_ascii=False, indent=1)
        print("取得不能一覧: fetch_one_failed.json")


if __name__ == "__main__":
    main()
