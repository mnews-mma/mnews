# -*- coding: utf-8 -*-
"""one_jp_country_slugs.json(discover_one_jp_athletes.pyが生成したONE公式の
日本国籍タグ選手候補)の各プロフィールページを取得し、<h1>の表記名をdata/kick/
fighters.jsonの選手名と突合してone_official_manifest.jsonを機械生成する。

PR#580フォローアップ①: 和島・安保の手書きmanifestを廃止し、再現可能な取得経路に
置き換える。

マッチング方式: <h1>のテキストからニックネーム引用符を除去し、空白(半角/全角)を
除去した文字列で、fighters.json側も同様に正規化した名前と完全一致するものだけを
採用する(同名異人の誤マッチを避けるため、複数一致した場合は不採用としログに残す)。

実行方法: cd scripts/standup-pipeline && python3 build_one_manifest.py
"""
import json
import re
import time
import urllib.request

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"

QUOTE_PAIRS = [("“", "”"), ('"', '"'), ("'", "'"), ("‘", "’")]


def strip_quoted_nickname(s):
    for open_q, close_q in QUOTE_PAIRS:
        oi = s.find(open_q)
        if oi == -1:
            continue
        ci = s.find(close_q, oi + len(open_q))
        if ci == -1:
            continue
        return s[:oi] + s[ci + len(close_q):]
    return s


def norm(s):
    return re.sub(r"[\s　]", "", strip_quoted_nickname(s))


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def identity(f):
    return f"{f['name']}|{f.get('gym') or ''}|{(f.get('sources') or [''])[0]}"


def main():
    with open("one_jp_country_slugs.json", encoding="utf-8") as f:
        slugs = json.load(f)
    with open("../../data/kick/fighters.json", encoding="utf-8") as f:
        fighters = json.load(f)

    by_norm_name = {}
    for fi in fighters:
        by_norm_name.setdefault(norm(fi["name"]), []).append(fi)

    manifest = []
    ambiguous = []
    unmatched = []
    errors = []

    for i, slug in enumerate(slugs):
        url = f"https://www.onefc.com/jp/athletes/{slug}/"
        try:
            h = fetch(url)
        except Exception as e:
            errors.append({"one_slug": slug, "error": str(e)})
            print(f"[{i + 1}/{len(slugs)}] {slug}: ERROR {e}")
            continue
        m = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
        raw_name = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", m.group(1))).strip() if m else ""
        candidates = by_norm_name.get(norm(raw_name), [])
        if len(candidates) == 1:
            fi = candidates[0]
            manifest.append(
                {
                    "one_slug": slug,
                    "fighter_identity": identity(fi),
                    "matched_name": fi["name"],
                    "one_profile_name": raw_name,
                }
            )
            print(f"[{i + 1}/{len(slugs)}] {slug} -> {raw_name!r} => 一致: {fi['name']}")
        elif len(candidates) > 1:
            ambiguous.append({"one_slug": slug, "one_profile_name": raw_name, "candidates": [fi["name"] for fi in candidates]})
            print(f"[{i + 1}/{len(slugs)}] {slug} -> {raw_name!r} => 同名{len(candidates)}件、不採用")
        else:
            unmatched.append({"one_slug": slug, "one_profile_name": raw_name})
            print(f"[{i + 1}/{len(slugs)}] {slug} -> {raw_name!r} => 名簿に無し")
        time.sleep(0.4)

    with open("one_official_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write("\n")

    report = {
        "candidateCount": len(slugs),
        "matchedCount": len(manifest),
        "ambiguousCount": len(ambiguous),
        "unmatchedCount": len(unmatched),
        "errorCount": len(errors),
        "ambiguous": ambiguous,
        "errors": errors,
    }
    with open("one_manifest_build_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(
        f"\n候補{len(slugs)}件 -> 一致{len(manifest)}件 / 同名不採用{len(ambiguous)}件 / "
        f"名簿無し{len(unmatched)}件 / 取得失敗{len(errors)}件"
    )


if __name__ == "__main__":
    main()
