# -*- coding: utf-8 -*-
"""2026-08-21新設: K-1/RISE/SHOOT BOXING/KNOCK OUTの各fetch_*.pyが「既知ID/slug一覧」を
取得するための共通ヘルパー。

経緯: 従来はcache/k1_parsed.json・cache/rise_parsed.json・cache/sb_parsed.json・
cache/ko_parsed.json(2026-08-18時点の凍結スナップショット)を個別のID源として
使っていたが、これはfighters.json(コミット済み、こちらも凍結だが継続的に更新されて
きた"より新しい"名簿)とは別の"もう1つの凍結名簿"になっており、fighters.jsonには
存在するのにcache/*_parsed.jsonには存在しない選手(RISE: 飯田陸斗・石川龍之介等6名、
実測確認)が取得対象から漏れていた。また退所選手の統合(k1_delisted_merges.json・
ko_delisted_merges.json)は、この2ファイル由来のIDを個別に合算する形で対応していたが、
統合後のURLは既にfighters.json側の該当選手のsourcesに追加済みであるため、
fighters.json1本を正とすればこの個別対応も不要になる(2026-08-21実測で確認)。

fighters.json(このディレクトリの直下、build.pyのgenerate_roster.py実行時またはこの
ジョブでのfrozen状態のいずれでも存在する)のsourcesを走査し、指定したURLパターンに
一致するIDを全件抽出する。
"""
import json
import re


def extract_ids_from_fighters(url_pattern, fighters_path="fighters.json"):
    """url_pattern: 1つのキャプチャグループを持つ正規表現(IDまたはslugを抜き出す)。
       戻り値: 抽出したIDの集合(set[str])。"""
    fighters = json.load(open(fighters_path, encoding="utf-8"))
    rx = re.compile(url_pattern)
    ids = set()
    for f in fighters:
        for s in f.get("sources", []):
            m = rx.match(s)
            if m:
                ids.add(m.group(1))
    return ids
