# -*- coding: utf-8 -*-
"""項目4(和島大海欠落調査の追加依頼、2026-08): 団体公式プロフィールページの「戦績」
サマリー欄(N戦M勝L敗D分)と、本番の掲載試合数を、取得元URLを持つ全選手で突き合わせる。
測定のみ(修正はしない)。

対象4団体(公式サイトが選手個別ページを持ち、ページ内に戦績サマリーが記載されている):
K-1/Krush/Krush-EX・RISE・SHOOT BOXING・KNOCK OUT

各サイトのサマリー欄フォーマット(実測):
  K-1:         "戦績 29戦 22勝(18KO) 7敗 0分"
  RISE:        "戦歴／13戦10勝3敗（7KO）"        (引き分け0件のときは分の記載が無い)
  KNOCK OUT:   "戦績 21戦 12勝 (6KO) 8敗 1分"
  SHOOT BOXING: "戦歴／179戦159勝（91KO）19敗1分、MMA：5戦2勝3敗"
                (MMA内訳が続くことがあるため、キックボクシング分のみ先頭グループで捕捉)
"""
import concurrent.futures
import json
import re
import threading
import time
import urllib.error
import urllib.request

UA = "mnews-research/1.0 (research contact: kaina.k.07@gmail.com)"

PATTERNS = {
    # KO数の括弧は無い選手もいる(KO勝ちが0件の場合など)ため任意化。
    "k-1.co.jp": re.compile(r"戦績\s*(\d+)戦\s*(\d+)勝(?:\(\d+KO\))?\s*(\d+)敗\s*(\d+)分"),
    # 総合格闘技も掛け持ちする選手は「戦歴／キック 23戦...」のように競技ラベルが挟まる。
    # 引き分け0件の選手は「分」の記載自体が省略される。
    "rise-rc.com": re.compile(r"戦歴／\s*(?:キック\s*)?(\d+)戦\s*(\d+)勝\s*(\d+)敗\s*(?:（\d+KO）)?(?:\s*(\d+)分)?"),
    "knockoutkb.com": re.compile(r"戦績\s*(\d+)戦\s*(\d+)勝\s*(?:\(\d+KO\))?\s*(\d+)敗(?:\s*(\d+)分)?"),
    # 全角スラッシュ区切り。引き分け0件は「分」の記載が省略される。
    "shootboxing.org": re.compile(r"戦歴／\s*(\d+)戦\s*(\d+)勝\s*（\d+KO）(\d+)敗(?:／(\d+)分)?"),
}


def domain_of(url):
    for d in PATTERNS:
        if d in url:
            return d
    return None


def fetch_official_total(url, retries=3):
    domain = domain_of(url)
    if not domain:
        return None
    pat = PATTERNS[domain]
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", errors="replace")
            text = re.sub(r"<[^>]+>", " ", html)
            text = re.sub(r"\s+", " ", text)
            m = pat.search(text)
            if not m:
                return {"error": "pattern_not_found"}
            g = m.groups()
            total = int(g[0])
            wins = int(g[1])
            losses = int(g[2])
            draws = int(g[3]) if len(g) > 3 and g[3] else 0
            return {"total": total, "wins": wins, "losses": losses, "draws": draws}
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            return {"error": f"http_{e.code}"}
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
                continue
            return {"error": str(e)}
    return {"error": "retries_exhausted"}


def main():
    fighters = json.load(open("fighters.json"))
    generated_idx = json.load(open("../../data/kick/generated/index.json"))
    slug_by_name = {}
    for f in generated_idx["fighters"]:
        slug_by_name.setdefault(f["name"], []).append(f["slug"])
    boutcount_by_slug = {f["slug"]: f["boutCount"] for f in generated_idx["fighters"]}

    targets = []
    for f in fighters:
        for u in f.get("sources", []):
            d = domain_of(u)
            if d:
                targets.append((f["name"], u, d))
                break  # 1選手1URL(複数団体所属でもここでは最初の1件のみ、公式サマリーの突合が目的)

    print(f"対象(取得元URLを持つ選手): {len(targets)}人", flush=True)

    results = []
    lock = threading.Lock()
    done_count = [0]

    def worker(item):
        name, url, domain = item
        r = fetch_official_total(url)
        with lock:
            done_count[0] += 1
            if done_count[0] % 200 == 0:
                print(f"進捗 {done_count[0]}/{len(targets)}", flush=True)
        return (name, url, domain, r)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for name, url, domain, r in ex.map(worker, targets):
            results.append({"name": name, "url": url, "domain": domain, "official": r})

    json.dump(results, open("/tmp/official_profile_raw.json", "w"), ensure_ascii=False, indent=1)
    print("完了。/tmp/official_profile_raw.json に保存。", flush=True)


if __name__ == "__main__":
    main()
