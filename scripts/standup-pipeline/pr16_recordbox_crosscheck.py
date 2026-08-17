# -*- coding: utf-8 -*-
"""PR-16: Wikipedia記事のKickboxing/Muay Thai recordboxテンプレート(total/wins/losses)と
本番生成ページのヘッダー表示を718人全員で機械照合する(与座のような誤りを目視でなく
機械で捕まえる)。"""
import json
import re

import ingest_wikipedia as iw

RECORDBOX_FULL_RE = re.compile(
    # 非貪欲.*?}}だと、total=32<ref>{{Cite web|...}}</ref>のようにref内の
    # ネストしたテンプレートの}}で早期に打ち切られ、wins/losses等それより後ろの
    # フィールドを取りこぼす(才賀紀左衛門で実測)。recordboxテンプレートは
    # 末尾が改行+"|}}"で終わる慣習を利用し、そこまでを1ブロックとして取る。
    r"\{\{(Kickboxing recordbox|Muay Thai recordbox)\s*(.*?)\n\|\}\}", re.S
)
FIGHT_CONT_COUNT_RE = re.compile(r"\{\{Fight-cont\s*\|")


def parse_recordbox(block):
    def field(name):
        m = re.search(rf"\|\s*{name}\s*=\s*(-?\d+)", block)
        return int(m.group(1)) if m else None
    return {
        "total": field("total"),
        "wins": field("wins"),
        "losses": field("losses"),
        "draws": field("draws"),
    }


def main():
    import os
    population = json.load(open("coverage_population.json"))
    wikitexts = json.load(open("raw/wp_wikitext_v2.json"))
    generated_idx = json.load(open("../../data/kick/generated/index.json"))
    slug_by_name = {}
    for f in generated_idx["fighters"]:
        slug_by_name.setdefault(f["name"], []).append(f["slug"])
    fdir = "../../data/kick/generated/fighters"

    def load_fighter(name):
        slugs = slug_by_name.get(name)
        if not slugs:
            return None
        # 同姓同名が複数いる場合は最初の1件(本レグでは名寄せの厳密特定は範囲外)
        path = os.path.join(fdir, slugs[0] + ".json")
        if not os.path.exists(path):
            return None
        return json.load(open(path))

    rows_out = []
    mismatch = []
    no_recordbox = 0
    for p in population:
        wt = wikitexts.get(p["wiki_title"])
        if not wt:
            continue
        boxes = [parse_recordbox(m.group(2)) for m in RECORDBOX_FULL_RE.finditer(wt)]
        boxes = [b for b in boxes if b["total"] is not None]
        if not boxes:
            no_recordbox += 1
            continue
        # PR-16修正: 単純な全文Fight-cont数だと、MMA/キックボクシング両方の
        # セクションを持つ多競技選手(メルヴィン・マヌーフ等)でMMA分まで誤って
        # 「取得可能な行数」に含めてしまう。実際のパース関数(セクション判定込み)の
        # 出力数を使う(キックボクシング/ムエタイの表としてタグ付けされた行のみ)。
        article_fight_cont_count = len(iw.parse_fight_rows(wt))
        # 複数recordboxがある場合は合算(通算成績が期間で分割されている記事があるため)
        wiki_total = sum(b["total"] or 0 for b in boxes)
        wiki_wins = sum(b["wins"] or 0 for b in boxes)
        wiki_losses = sum(b["losses"] or 0 for b in boxes)

        gen = load_fighter(p["name"])
        if not gen:
            mismatch.append(dict(name=p["name"], reason="production未掲載",
                                  wiki_total=wiki_total, wiki_wins=wiki_wins, wiki_losses=wiki_losses,
                                  prod_total=None, prod_wins=None, prod_losses=None))
            continue
        rec = gen.get("record") or {}
        prod_total = rec.get("total")
        prod_wins = rec.get("wins")
        prod_losses = rec.get("losses")
        rows_out.append(dict(name=p["name"], wiki_total=wiki_total, wiki_wins=wiki_wins,
                              wiki_losses=wiki_losses, prod_total=prod_total,
                              prod_wins=prod_wins, prod_losses=prod_losses))
        # production は他団体分も合算されるため wiki_total 以上が期待値。
        # ただしWikipedia記事自体が「recordbox(通算集計)はあるがFight-cont(試合単位の列挙)は
        # 一部しか無い」ケースが多数あり(例: アジス・カトゥー total=57だが列挙10件のみ)、
        # この場合は記事内に元データが存在しないため取得しようがない(パイプラインのバグではない)。
        # article_fight_cont_count(記事が実際に列挙している試合数)を下回っている場合のみ
        # 「本来取得できるはずなのに足りない」真の不一致として報告する。
        if prod_total is None or prod_total < wiki_total:
            genuinely_recoverable = article_fight_cont_count >= wiki_total - 2  # 数件の誤差は許容
            mismatch.append(dict(
                name=p["name"],
                reason="production件数がWikipedia recordbox未満",
                wiki_total=wiki_total, wiki_wins=wiki_wins, wiki_losses=wiki_losses,
                prod_total=prod_total, prod_wins=prod_wins, prod_losses=prod_losses,
                article_fight_cont_count=article_fight_cont_count,
                genuinely_recoverable=genuinely_recoverable,
            ))

    genuine = [m for m in mismatch if m.get("genuinely_recoverable")]
    article_limited = [m for m in mismatch if not m.get("genuinely_recoverable")]
    print(f"recordboxあり: {len(rows_out) + len(mismatch)}人")
    print(f"recordboxなし(比較対象外): {no_recordbox}人")
    print(f"不一致合計(production < Wikipedia recordbox total): {len(mismatch)}人")
    print(f"  うち記事自体が試合単位で列挙していない分(パイプラインのバグではない、取得不能): {len(article_limited)}人")
    print(f"  うち記事は列挙しているのにproductionに反映されていない分(真の不一致・要調査): {len(genuine)}人")
    json.dump(mismatch, open("/tmp/pr16_recordbox_mismatch.json", "w"), ensure_ascii=False, indent=1)
    json.dump(genuine, open("/tmp/pr16_recordbox_genuine_mismatch.json", "w"), ensure_ascii=False, indent=1)
    json.dump(rows_out, open("/tmp/pr16_recordbox_all.json", "w"), ensure_ascii=False, indent=1)
    print("\n=== 真の不一致(記事は列挙済みなのに反映されていない分) ===")
    for m in genuine[:50]:
        print(m)


if __name__ == "__main__":
    main()
