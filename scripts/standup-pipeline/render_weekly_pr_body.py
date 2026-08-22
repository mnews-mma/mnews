# -*- coding: utf-8 -*-
"""週次自動更新ジョブ専用(2026-08-21新設): promote_to_data_kick.pyのレポート・
取得失敗一覧・npm run kick:dataの前後統計から、PR本文(Markdown)を組み立てて
標準出力に書く。

引数: この順で6つの引数を取る。
  1. promote_to_data_kick.py の標準出力を保存したJSONファイル
  2. 取得失敗ソース一覧(ソーススクリプト自体が異常終了した場合。1行1ソース名、
     無ければ空ファイルでよい)
  3. npm run kick:data の「取得前」実行時の標準出力ログ(「[kick] generated {...}」行を含む)
  4. npm run kick:data の「取得後」実行時の標準出力ログ
  5. scripts/standup-pipeline/ ディレクトリのパス(各fetch_*.pyが書き出す
     fetch_{tag}_failed.json、ページ単位の個別取得失敗一覧をここから拾う)
  6. リポジトリルートのパス(data/kick/kickOfficialProfileCoverageBaseline.jsonの
     前後比較に使う。gitのHEAD時点の値と、ゲート実行後の現在値を突き合わせる)
"""
import glob
import json
import os
import re
import subprocess
import sys

from render_promote_skip_summary import SOURCE_LABELS, build_skip_summary


def extract_stats(log_text):
    m = re.search(r"\[kick\] generated (\{.*\})", log_text, re.DOTALL)
    if not m:
        return None
    # JSON.stringify(stats, null, 1)の出力の直後に別の行が続くため、対応する
    # 閉じ括弧までを雑にではなく実際にパースして切り出す。
    start = m.start(1)
    depth = 0
    for i, ch in enumerate(log_text[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(log_text[start:i + 1])
    return None


def git_head_json(repo_root, rel_path):
    try:
        out = subprocess.run(
            ["git", "show", f"HEAD:{rel_path}"], cwd=repo_root, capture_output=True, check=True,
        ).stdout
        return json.loads(out)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def main():
    report_path, failures_path, before_log_path, after_log_path, pipe_dir, repo_root = sys.argv[1:7]
    with open(report_path, encoding="utf-8") as f:
        report = json.load(f)
    try:
        with open(failures_path, encoding="utf-8") as f:
            failures = [l.strip() for l in f if l.strip()]
    except FileNotFoundError:
        failures = []

    # ページ単位の個別取得失敗(ソース自体は成功終了したが、一部のページだけ
    # 取得できなかったケース)。各fetch_*.pyがfetch_{tag}_failed.jsonに書き出す。
    page_failures = []
    for path in sorted(glob.glob(os.path.join(pipe_dir, "fetch_*_failed.json"))):
        tag = os.path.basename(path)[len("fetch_"):-len("_failed.json")]
        label = SOURCE_LABELS.get(tag, tag)
        try:
            with open(path, encoding="utf-8") as f:
                items = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        for item in items:
            url = item.get("url", "?")
            err = item.get("error", "?")
            page_failures.append(f"{label}: {url} ({err})")
    with open(before_log_path, encoding="utf-8") as f:
        before_stats = extract_stats(f.read())
    with open(after_log_path, encoding="utf-8") as f:
        after_stats = extract_stats(f.read())

    lines = []
    lines.append("## /kick 週次自動更新")
    lines.append("")
    lines.append("14ソースを順次取得し、build.py → build-kick-data.ts → 全kickゲートを実行した結果です。")
    lines.append("RIZIN・Wikipediaはこのジョブの対象外(凍結)。NKB旧サイト分(2012〜2018年)も凍結、前回コミットの値をそのまま引き継いでいます。")
    lines.append("")

    lines.append("### 取得失敗ソース・ページ")
    if failures:
        lines.append("**ソース自体が異常終了(全ページ取得不能):**")
        for f_ in failures:
            lines.append(f"- {f_}")
    if page_failures:
        lines.append(f"**ページ単位の個別取得失敗({len(page_failures)}件、ソース自体は完了):**")
        for pf in page_failures:
            lines.append(f"- {pf}")
    if not failures and not page_failures:
        lines.append("なし(14ソースすべて全ページ取得成功)")
    lines.append("")

    skip_summary = build_skip_summary(report)
    if skip_summary:
        lines.append(skip_summary)

    lines.append("### ソース別 増減内訳")
    lines.append("| ソース | 大会数(前→後) | bout数(前→後) | 新規行のopponent_resolved失敗 | 既存行の変化 |")
    lines.append("|---|---|---|---|---|")
    total_added = 0
    total_removed = 0
    total_changed = 0
    any_changed_or_removed = False
    for tag, label in SOURCE_LABELS.items():
        e = report.get(tag, {})
        if e.get("status") != "ok":
            lines.append(f"| {label} | - | - | - | {e.get('reason', e.get('status', '不明'))} |")
            continue
        note = f"({e['note']})" if e.get("note") else ""
        changed_removed = e["removed_count"] + e["changed_count"]
        if changed_removed > 0:
            any_changed_or_removed = True
        verdict = "変化なし" if changed_removed == 0 else f"**要確認: 削除{e['removed_count']}件・変化{e['changed_count']}件**"
        lines.append(
            f"| {label} | +{e['added_new_event_count']} | "
            f"{e['prev_count']}→{e['fresh_count']}(+{e['added_count']}) {note} | "
            f"{e['added_opponent_unresolved_count']} | {verdict} |"
        )
        total_added += e["added_count"]
        total_removed += e["removed_count"]
        total_changed += e["changed_count"]
    lines.append("")
    lines.append(f"合計: 追加{total_added}件 / 削除{total_removed}件 / 変化{total_changed}件")
    lines.append("")

    if any_changed_or_removed:
        lines.append("### ⚠️ 既存行の削除・変化の全件リスト")
        lines.append("(key = fighter_slug, opponent_raw, date, event, source_url)")
        for tag, label in SOURCE_LABELS.items():
            e = report.get(tag, {})
            if e.get("status") != "ok":
                continue
            if e["removed_keys"]:
                lines.append(f"- **{label} 削除**:")
                for k in e["removed_keys"]:
                    lines.append(f"  - {k}")
            if e["changed_keys"]:
                lines.append(f"- **{label} 変化**:")
                for k in e["changed_keys"]:
                    lines.append(f"  - {k}")
        lines.append("")
    else:
        lines.append("既存行はすべて不変であることを確認しました(純粋な追加のみ)。")
        lines.append("")

    lines.append("### npm run kick:data 統計(前→後)")
    if before_stats and after_stats:
        keys = ["boutRows", "boutRowsRaw", "boutRowsOfficial", "boutRowsWikipedia",
                "mergedDuplicateRows", "resultUnknownCount", "unmatchedBouts"]
        lines.append("| 指標 | 前 | 後 |")
        lines.append("|---|---|---|")
        for k in keys:
            b = before_stats.get(k, "?")
            a = after_stats.get(k, "?")
            lines.append(f"| {k} | {b} | {a} |")
    else:
        lines.append("統計の抽出に失敗しました(ログ形式が変わった可能性、要手動確認)。")
    lines.append("")

    lines.append("### 団体公式プロフィール突合(自然増型、check:kick-official-profile-coverage)")
    lines.append("データ量に比例して自然に増える指標のため、1回の増分が50以内なら自動でベースラインを更新している(50を超えた場合はこのPR自体が作られずゲート失敗になる)。")
    before_baseline = git_head_json(repo_root, "data/kick/kickOfficialProfileCoverageBaseline.json")
    after_path = os.path.join(repo_root, "data/kick/kickOfficialProfileCoverageBaseline.json")
    after_baseline = None
    if os.path.exists(after_path):
        with open(after_path, encoding="utf-8") as f:
            after_baseline = json.load(f)
    if before_baseline and after_baseline:
        lines.append("| 指標 | 前 | 後 | 増分 |")
        lines.append("|---|---|---|---|")
        for k in ("deficitCount", "deficitSum"):
            b = before_baseline.get(k, "?")
            a = after_baseline.get(k, "?")
            delta = (a - b) if isinstance(a, (int, float)) and isinstance(b, (int, float)) else "?"
            lines.append(f"| {k} | {b} | {a} | {'+' if isinstance(delta, (int, float)) and delta >= 0 else ''}{delta} |")
    else:
        lines.append("ベースラインの前後値の抽出に失敗しました(要手動確認)。")
    lines.append("")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
