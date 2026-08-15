# -*- coding: utf-8 -*-
"""coverage_population.json(509人)から再現可能な方法で30人を抽出する。

乱数シードは固定(20260815)。同じpopulation.jsonに対して常に同じ30人が選ばれる
(Python標準のrandom.sample、Pythonバージョン間の互換性はCPythonのMersenne Twister
実装に依存するため、同一環境での再実行を前提とする)。
"""
import json
import random

POPULATION_SEED = 20260815
SAMPLE_SIZE = 30


def main():
    population = json.load(open("coverage_population.json"))
    rng = random.Random(POPULATION_SEED)
    sample = rng.sample(population, SAMPLE_SIZE)
    json.dump(sample, open("coverage_sample.json", "w"), ensure_ascii=False, indent=1)
    print(f"母集団{len(population)}人から{len(sample)}人を抽出(seed={POPULATION_SEED})")
    for s in sample:
        print(" ", s["name"], "|", s["wiki_title"])


if __name__ == "__main__":
    main()
