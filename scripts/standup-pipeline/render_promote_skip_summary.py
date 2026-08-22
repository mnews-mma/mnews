# -*- coding: utf-8 -*-
"""週次自動更新ジョブ専用(2026-08-21新設): promote_to_data_kick.pyのレポートから
「bout数急減により昇格をスキップしたソース」の警告だけを抜き出し、Markdownとして
標準出力に書く。該当が無ければ何も出力しない(空文字列)。

ゲートが落ちてPRが作られない回でも、このスキップ情報だけは必ずIssue本文に載せる
必要がある(黙って前回値を使い続けると誰も気づけないため)。PR本文
(render_weekly_pr_body.py)・Issue本文(ワークフロー内のgithub-scriptステップ)の
両方から同じ内容を参照できるよう、判定ロジックをこのスクリプト1箇所に集約する。

引数: promote_to_data_kick.py の標準出力を保存したJSONファイルのパス。
"""
import json
import sys

SOURCE_LABELS = {
    "bigbang": "Bigbang", "standup": "Stand up", "krossover": "KROSS×OVER",
    "snka": "SNKA", "jka": "JKA", "hoostcup": "HoostCup", "deepkick": "DEEP☆KICK",
    "njkf": "NJKF", "nkb": "NKB", "k1": "K-1/Krush/Krush-EX", "rise": "RISE",
    "sb": "SHOOT BOXING", "knockout": "KNOCK OUT", "one": "ONE Championship",
}


def build_skip_summary(report):
    """report(promote_to_data_kick.pyの出力dict)から警告Markdownを組み立てる。
       該当ソースが無ければ空文字列を返す。"""
    skips = [
        (label, report[tag]) for tag, label in SOURCE_LABELS.items()
        if report.get(tag, {}).get("status") == "skipped_regression"
    ]
    if not skips:
        return ""

    lines = []
    lines.append("### ⚠️ bout数急減により昇格をスキップしたソース")
    lines.append(
        "取得自体はエラーを出さずに完了したが、bout数が前回コミット時点から50%以上"
        "減少したため、このソースだけ**昇格をスキップし前回コミット値をそのまま維持した**"
        "(取得失敗の疑いがある値をそのまま本番へ反映しないための安全弁)。"
        "取得元の状態(WAF/レート制限等)を確認し、正常化したら次回の週次実行で自動的に反映される。"
    )
    lines.append("| ソース | 前回件数 | 今回件数 |")
    lines.append("|---|---|---|")
    for label, e in skips:
        lines.append(f"| {label} | {e['prev_count']} | {e['fresh_count']} |")
    lines.append("")
    return "\n".join(lines)


def main():
    (report_path,) = sys.argv[1:2]
    with open(report_path, encoding="utf-8") as f:
        report = json.load(f)
    summary = build_skip_summary(report)
    if summary:
        print(summary)


if __name__ == "__main__":
    main()
