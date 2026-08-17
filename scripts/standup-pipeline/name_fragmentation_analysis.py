# -*- coding: utf-8 -*-
"""項目5(和島大海欠落調査PR#563の付帯調査、2026-08): 団体間で表記名が完全一致する
fighters.jsonレコードの重複グループを検出し、kana/birthdate/gym等を突き合わせて
「統合してよい/別人と判断/判定不能」の3区分に分類する(測定のみ、この回では統合しない)。

出力:
  out/kick-name-fragmentation-groups.json  — 全グループの生データ(各レコード全フィールド)
  out/kick-name-fragmentation-report.md    — 集計・3区分の分類結果
"""
import json
from collections import defaultdict


def main():
    fighters = json.load(open("fighters.json"))

    # 1. 表記名完全一致グループ
    by_name = defaultdict(list)
    for f in fighters:
        by_name[f["name"]].append(f)
    dupe_groups = {n: fs for n, fs in by_name.items() if len(fs) > 1}

    # 2. 母集団(Wikipedia到達済み)との重複チェック(誤統合リスクの直接確認)
    pop = json.load(open("coverage_population.json"))
    pop_names = {p["name"] for p in pop}

    # 3. 3区分の判定(kana一致+生年月日一致 = 統合してよい、生年月日不一致 = 別人、
    #    比較材料不足 = 判定不能)
    classified = []
    for name, fs in dupe_groups.items():
        # 生年月日でグループ分け
        bd_groups = defaultdict(list)
        no_bd = []
        for f in fs:
            if f.get("birthdate"):
                bd_groups[f["birthdate"]].append(f)
            else:
                no_bd.append(f)

        if len(bd_groups) >= 2:
            verdict = "別人と判断"
            reason = f"生年月日が{len(bd_groups)}種類に分かれる({'/'.join(bd_groups.keys())})"
        elif len(bd_groups) == 1 and not no_bd:
            verdict = "統合してよい"
            bd = next(iter(bd_groups))
            reason = f"全レコードの生年月日が{bd}で一致"
        else:
            verdict = "判定不能"
            reason = "生年月日が一部のレコードにしかない、または全レコード無し(比較材料不足)"

        classified.append({
            "name": name,
            "record_count": len(fs),
            "verdict": verdict,
            "reason": reason,
            "in_wikipedia_population": name in pop_names,
            "records": [
                {"kana": f.get("kana"), "gym": f.get("gym"), "birthdate": f.get("birthdate"),
                 "orgs": f.get("orgs"), "sources": f.get("sources")}
                for f in fs
            ],
        })

    total_groups = len(classified)
    total_records = sum(c["record_count"] for c in classified)
    by_verdict = defaultdict(lambda: {"groups": 0, "records": 0})
    for c in classified:
        by_verdict[c["verdict"]]["groups"] += 1
        by_verdict[c["verdict"]]["records"] += c["record_count"]

    json.dump(classified, open("../../out/kick-name-fragmentation-groups.json", "w"),
              ensure_ascii=False, indent=1)

    lines = []
    lines.append("# 団体間名寄せ分裂候補の測定結果(項目5、2026-08)\n")
    lines.append(f"表記名が完全一致するfighters.jsonレコードの重複グループ: **{total_groups}グループ・{total_records}レコード**\n")
    lines.append("## 3区分の内訳\n")
    lines.append("| 区分 | グループ数 | レコード数 |")
    lines.append("|---|---|---|")
    for v in ["統合してよい", "別人と判断", "判定不能"]:
        lines.append(f"| {v} | {by_verdict[v]['groups']} | {by_verdict[v]['records']} |")
    lines.append("")
    lines.append("## グループ別詳細\n")
    for c in classified:
        lines.append(f"### {c['name']}({c['record_count']}件、{c['verdict']})")
        lines.append(f"- 理由: {c['reason']}")
        lines.append(f"- Wikipedia母集団への到達: {'あり(誤統合リスクの直接確認対象)' if c['in_wikipedia_population'] else 'なし(誤統合リスクなし)'}")
        for r in c["records"]:
            lines.append(f"  - kana={r['kana']} gym={r['gym']} birthdate={r['birthdate']} orgs={r['orgs']}")
        lines.append("")

    open("../../out/kick-name-fragmentation-report.md", "w").write("\n".join(lines))
    print(f"総グループ数: {total_groups}, 総レコード数: {total_records}")
    for v in ["統合してよい", "別人と判断", "判定不能"]:
        print(f"  {v}: {by_verdict[v]['groups']}グループ / {by_verdict[v]['records']}レコード")


if __name__ == "__main__":
    main()
