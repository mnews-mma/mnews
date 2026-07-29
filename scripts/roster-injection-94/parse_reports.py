#!/usr/bin/env python3
"""#247/#248 の out/ 成果物(md + csv)を読み、投入候補の中間JSONを作る。読み取り専用。"""
import csv, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "out"

def read_md(p):
    return (OUT / p).read_text(encoding="utf-8").splitlines()

# ---------- 修斗 ----------
def parse_shooto():
    lines = read_md("shooto-records.md")
    # 1) サマリー表から 名前/区分/既存slug/shootoID/勝敗 を取る
    summary = {}
    for ln in lines:
        if not ln.startswith("| ") or ln.startswith("| 選手名") or set(ln) <= set("|- "):
            continue
        c = [x.strip() for x in ln.strip().strip("|").split("|")]
        if len(c) != 11:
            continue
        name, kind, slug, sid, total, w, l, d, nc, unres, ok = c
        if not sid.isdigit():
            continue
        summary[int(sid)] = dict(nameJa=name, kind=kind, existingSlug=slug,
                                 shootoId=int(sid), total=int(total), wins=int(w),
                                 losses=int(l), draws=int(d), nc=int(nc),
                                 unresolved=int(unres), buildable=ok.startswith("YES"))
    # 2) 詳細ブロックから ローマ字 / 階級ラベル を取る
    cur = None
    for ln in lines:
        m = re.match(r"^- shooto選手ID: (\d+) ", ln)
        if m:
            cur = int(m.group(1)); continue
        if cur is None:
            continue
        m = re.match(r"^- ローマ字表記\(テーブル列。URLには含まれない\): (.*)$", ln)
        if m:
            summary[cur]["romaji"] = m.group(1).strip(); continue
        m = re.match(r"^- 修斗選手紹介ページ階級ラベル: (.*)$", ln)
        if m:
            summary[cur]["weightLabel"] = m.group(1).strip(); continue
    return summary

def parse_shooto_bouts(targets):
    """shooto-bouts.csv を shooto_id で選手軸に組み替える(weight_label 付き)。"""
    per = {sid: [] for sid in targets}
    with (OUT / "shooto-bouts.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            for side, other in (("1", "2"), ("2", "1")):
                sid = r[f"fighter{side}_shooto_id"]
                if not sid.isdigit() or int(sid) not in per:
                    continue
                o = r["resolved_outcome"]
                if o == "DRAW":
                    res = "draw"
                elif o == "NO_CONTEST":
                    res = "nc"
                elif o == "UNRESOLVED":
                    res = None
                else:  # F1_WIN_F2_LOSS / F2_WIN_F1_LOSS
                    win_side = "1" if o.startswith("F1_WIN") else "2"
                    res = "win" if win_side == side else "loss"
                # result_type_text: 短縮コード(S/KO/TKO)または判定はスコア込みのフル
                # テキスト("判定 3-0")。result_method: 決まり技名(リアネイキッドチョーク等、
                # 判定には無い)。両方あれば "コード/技名" で連結(パンクラス側の表記
                # "TKO/グラウンドのパンチ" と揃える)。技名側だけ空の場合(判定・技名不明の
                # KO/TKO等)はコード側のみを採用する(捏造しない)。
                type_text = r["result_type_text"].strip()
                method_detail = r["result_method"].strip()
                if type_text and method_detail:
                    method = f"{type_text}/{method_detail}"
                else:
                    method = type_text or method_detail or ""
                per[int(sid)].append(dict(
                    date=r["event_date"], event=(r["event_title"].strip() or r["event_subtitle"].strip()),
                    opponent=r[f"fighter{other}_name"], result=res,
                    method=method,
                    resultClass=r["result_type_class"],
                    round=r["result_round"], time=r["result_time"],
                    weightLabel=r["weight_label"], orgFlags=r["event_org_flags"],
                    boutId=r["bout_id"],
                ))
    for sid in per:
        per[sid].sort(key=lambda b: (b["date"], b["boutId"]))
    return per

# ---------- パンクラス ----------
def parse_pancrase():
    lines = read_md("pancrase-records.md")
    fighters, cur, section = {}, None, None
    for ln in lines:
        if ln.startswith("## "):
            if "必達セット パンクラス35名" in ln:
                section = "missing"
            elif "収録済み(listed)" in ln:
                section = "listed"
            cur = None
            continue
        m = re.match(r"^### (.+?)(?: \(fighters\.ts slug: (.+?)\))?$", ln)
        if m and section:
            name = m.group(1).strip()
            cur = dict(nameJa=name, kind=section, existingSlug=(m.group(2) or ""),
                       bouts=[], urls=[])
            fighters[name] = cur
            continue
        if cur is None:
            continue
        if ln.startswith("プロフィールURL: "):
            cur["urls"] = [u.split("(")[0].strip() for u in ln[len("プロフィールURL: "):].split(" / ")]
            continue
        m = re.match(r"^\*\*レコード\(mnews集計、no_marker/nc除く\): (\d+)勝(\d+)敗(\d+)分 \(NC (\d+)件、マーカーなし/対象外 (\d+)件、bout総数(\d+)件\)\*\*$", ln)
        if m:
            cur.update(wins=int(m.group(1)), losses=int(m.group(2)), draws=int(m.group(3)),
                       nc=int(m.group(4)), noMarker=int(m.group(5)), total=int(m.group(6)))
            continue
        if ln.startswith("| ") and not ln.startswith("| 日付") and not set(ln) <= set("|- "):
            c = [x.strip() for x in ln.strip().strip("|").split("|")]
            if len(c) != 7:
                continue
            date, event, wc, opp, oppslug, res, method = c
            base = res.split(" ")[0]
            cur["bouts"].append(dict(date=date, event=event, weightLabel=wc, opponent=opp,
                                     opponentSlug=oppslug if oppslug != "-" else "",
                                     result=base if base in ("win", "loss", "draw") else None,
                                     resultRaw=res, method=method))
    return fighters

def dump_shooto_full_directory(out_path):
    """修斗名鑑全1898名(必達60名に限らない)のname_kanji→name_romajiをJSONへ。
    パンクラス専属者が修斗名鑑にも別途掲載されている場合のローマ字補完に使う
    (out/shooto-fighters.csvは既に取得済みなので再取得は発生しない)。"""
    d = {}
    with (OUT / "shooto-fighters.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            k, v = r["name_kanji"].strip(), r["name_romaji"].strip()
            if k and v and k not in d:
                d[k] = v
    Path(out_path).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")

if __name__ == "__main__":
    sh = parse_shooto()
    sb = parse_shooto_bouts(sh)
    for sid, f in sh.items():
        f["bouts"] = sb[sid]
    pc = parse_pancrase()
    data = dict(shooto=list(sh.values()), pancrase=list(pc.values()))
    Path(sys.argv[1]).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    dump_shooto_full_directory("/tmp/ri94_shooto_fulldir.json")
    print(f"shooto={len(sh)} (missing={sum(1 for f in sh.values() if f['kind']=='missing')}) "
          f"pancrase={len(pc)} (missing={sum(1 for f in pc.values() if f['kind']=='missing')})")
