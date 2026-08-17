# -*- coding: utf-8 -*-
"""PR-19: 「大会は取得済みだが行が落ちている」55件を、実際に日付一致の行が
存在するか(表記違いの可能性)/本当に存在しないか(真の欠落)で再検証する。"""
import csv
import json

ORG_FILES = {
    "K-1": "bouts_k1.json",
    "RISE": "bouts_rise.json",
    "KNOCK OUT": "bouts_knockout.json",
    "SHOOT BOXING": "bouts_sb.json",
}


def main():
    rows = list(csv.DictReader(open(
        "/Users/kainakishiyoshi/Desktop/mnews/out/kana-leg5-existing15-gap-causes.csv",
        encoding="utf-8-sig")))
    target = [r for r in rows if r["cause"].startswith("大会は取得済みだが行が落ちている")]
    print(f"対象: {len(target)}件")

    org_data = {}
    for org, fn in ORG_FILES.items():
        org_data[org] = json.load(open(fn))

    false_positive = []
    true_gap = []
    for r in target:
        org = r["org"]
        name = r["fighter_name"]
        date = r["date"]
        data = org_data.get(org, [])
        same_fighter_date = [b for b in data if b["fighter_name"] == name and b["date"] == date]
        if same_fighter_date:
            false_positive.append({**r, "matched_opponent": same_fighter_date[0]["opponent_name"]})
        else:
            # 表記ゆれ(スペース等)を考慮して氏名部分一致でも確認
            partial = [b for b in data if name.replace(" ", "").replace("　", "") in
                       (b["fighter_name"] or "").replace(" ", "").replace("　", "") and b["date"] == date]
            if partial:
                false_positive.append({**r, "matched_opponent": partial[0]["opponent_name"],
                                        "note": "fighter_name表記ゆれ"})
            else:
                true_gap.append(r)

    print(f"表記違いによる誤検知(既に存在): {len(false_positive)}件")
    print(f"真の欠落候補(その日付に何も無い): {len(true_gap)}件")
    print("\n=== 真の欠落候補 ===")
    for t in true_gap:
        print(t["fighter_name"], "|", t["org"], "|", t["date"], "|", t["opponent"], "|", t["event"])

    json.dump(false_positive, open("/tmp/pr19_false_positive.json", "w"), ensure_ascii=False, indent=1)
    json.dump(true_gap, open("/tmp/pr19_true_gap.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
