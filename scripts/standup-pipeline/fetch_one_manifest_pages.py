# -*- coding: utf-8 -*-
"""one_official_manifest.json に登録されたONE公式選手プロフィールページ
(https://www.onefc.com/jp/athletes/{slug}/)を取得し、ingest_one.pyのparse_html()で
解析してbouts_one.jsonへマージする。

PR#580: bouts_one.json(既存122件)はこれを全選手に対して回す再現可能なドライバが
存在せず、過去セッションで手動パッチされたものだった(SOURCES.md参照)。そのため
和島大海・安保瑠輝也のように実際にはONE公式プロフィールページが存在する選手でも、
その母集団に単純に含まれておらず、Wikipedia出典のまま表示されていた。
このスクリプトが再現可能な取得経路となる。新しく公式ページの存在が確認できた選手は
one_official_manifest.jsonに追記して再実行すれば、同じ手順で反映できる
(全選手を無差別にクロールする設計ではない。ONE公式サイトの選手一覧・大会結果ページが
JSクライアントレンダリングで生HTMLに戦績データを含まないため、候補slugを機械的に
洗い出す手段がなく、個別に確認した選手をmanifestに積み上げる方式にしている)。

実行方法: cd scripts/standup-pipeline && python3 fetch_one_manifest_pages.py
"""
import json
import time
import urllib.request

from ingest_one import parse_html

UA = "Mnews-research-audit/1.0 (mnews.mma@ymail.ne.jp)"

# build-kick-data.tsのstripQuotedNickname()と同じ引用符ペア。ONE公式の<h1>には
# 「安保"Demolition Man"瑠輝也」のようにニックネームが引用符付きで入ることがあり、
# 既存bouts_one.json(手動パッチ分38人)はいずれもニックネーム無しの表記のため、
# 表記を揃える(fighter_slugでの照合には使わない項目だが、データの一貫性のため)。
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


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def main():
    with open("one_official_manifest.json", encoding="utf-8") as f:
        manifest = json.load(f)
    with open("bouts_one.json", encoding="utf-8") as f:
        existing = json.load(f)

    manifest_slugs = {m["one_slug"] for m in manifest}
    # manifest対象slugの既存行を除去してから作り直す(再実行の冪等性のため)
    kept = [b for b in existing if not any(b["bout_id"].startswith(f"one:{slug}:") for slug in manifest_slugs)]

    new_bouts = []
    for i, m in enumerate(manifest):
        slug = m["one_slug"]
        url = f"https://www.onefc.com/jp/athletes/{slug}/"
        print(f"[{i + 1}/{len(manifest)}] fetching {url}")
        h = fetch(url)
        bouts = parse_html(h, slug)
        for b in bouts:
            # ingest_one.pyのparse_html()はfighter_slugにURLのslug(例: "hiromi-wajima")を
            # 入れるが、build-kick-data.tsのmatchBy:"identity"はfighter_slugに
            # `${name}|${gym}|${sources[0]}` 形式の識別子を要求する(既存bouts_one.jsonの
            # 全行がこの形式で手動パッチされていたのと同じ規約)。
            b["fighter_slug"] = m["fighter_identity"]
            b["fighter_name"] = strip_quoted_nickname(b["fighter_name"])
        print(f"  -> {len(bouts)}件")
        new_bouts.extend(bouts)
        if i < len(manifest) - 1:
            time.sleep(1)

    out = kept + new_bouts
    out.sort(key=lambda b: b["bout_id"])
    with open("bouts_one.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"bouts_one.json: {len(existing)}件 → {len(out)}件(manifest {len(manifest)}人分から{len(new_bouts)}件を追加/更新)")


if __name__ == "__main__":
    main()
