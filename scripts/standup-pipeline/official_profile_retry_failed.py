# -*- coding: utf-8 -*-
import concurrent.futures
import json
import threading

from official_profile_bout_count_crosscheck import fetch_official_total

results = json.load(open("/tmp/official_profile_raw.json"))
failed = [r for r in results if r["official"] and "error" in r["official"]]
print(f"再試行対象: {len(failed)}件", flush=True)

lock = threading.Lock()
done = [0]


def worker(item):
    r = fetch_official_total(item["url"])
    with lock:
        done[0] += 1
        if done[0] % 100 == 0:
            print(f"進捗 {done[0]}/{len(failed)}", flush=True)
    return r


with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    new_results = list(ex.map(worker, failed))

for item, new_r in zip(failed, new_results):
    item["official"] = new_r

recovered = sum(1 for r in new_results if r and "total" in r)
print(f"再試行で解決: {recovered}/{len(failed)}", flush=True)

json.dump(results, open("/tmp/official_profile_raw.json", "w"), ensure_ascii=False, indent=1)
print("保存完了", flush=True)
