# /kick モノニム誤統合リスク全件調査

作成日: 2026-08(PR: `fix/kick-mononym-mma-contamination`)

## 目的とスコープ

泰斗(taito)の誤統合(K-1公式の登録選手と、表記名一致だけで結合されたKROSS×OVER公式の
別人)を発端に、同型のリスクを持つ選手が他にどれだけいるかを**一覧化する**調査。
**この回では分離作業は行わない**(泰斗のみ`out/kick-taito-misidentification-audit.md`で
個別対応済み)。ここでの分類は原則としてデータ上の特徴(所属団体の変化・活動年の空白・
表記名の性質)からの**アルゴリズム的な一次判定**であり、泰斗のように krossover.jp 等の
一次資料まで遡って個別確認したものではない(そこまで実施したのは泰斗のみ)。今後の
個別調査の優先順位付けの材料として使うことを意図している。

## 母集団の作り方

1. **既知の重複表記名9グループ・21レコード**(`龍翔`4・`武蔵`3・`空龍`2・`KAI`2・
   `大輝`2・`悠斗`2・`璃久`2・`一輝`2・`龍聖`2)。PR #566
   (`scripts/check-kick-official-profile-coverage.ts`)の名前解決不能リストで最初に
   把握し、`data/kick/fighters.json`を直接突合して全件(21レコード)を確認した。
2. **1で拾いきれない、単独表記名(fighters.json上は1レコードのみ)だが活動年に
   不自然な空白があるモノニム**。`scripts/check-kick-identity-merge-risk.ts`
   (本PRで新設、活動空白5年以上+団体変化+後続団体が名前一致ベース結合、という
   代理指標で全3,300選手を機械走査した結果、52件検出)のうち、表記名が
   モノニム的(空白を含まない単一トークン、「姓 名」形式でない)ものを抽出した。

この2つを合わせて**42件**(9グループ21レコードの一部+単独モノニムの一部、重複除去後)
を対象に、所属・掲載団体・戦績数・活動年範囲(または検出された空白)を並べた。

## 全件一覧(42件)

分類の凡例:
- **統合可(参考)**: 団体間の移籍パターンとして違和感が無い(例: K-1/Krush→ONE
  Championshipは実際によく見られる移籍経路)。ただし識別子自体は名前一致のみで
  結合されているため、個別裏取りをしたわけではない。
- **別人の疑い**: 短い英字/カタカナ愛称(衝突しやすい)、または活動空白が10年前後と
  非常に長く、同一人物の連続活動として説明しにくいもの。
- **判定不能**: 上記いずれにも明確に該当せず、個別に出典を確認しないと判断できないもの
  (既に複数slugへ分離済みだが各slug自体がなお複数団体にまたがっているケースを含む)。

| slug | 表記名 | 所属 | 掲載団体 | 戦績数 | 活動年範囲/空白 | 重複名件数 | 分類 | 根拠 |
|---|---|---|---|---:|---|---:|---|---|
| `kai` | KAI | ARROWS GYM | K-1 / Krush / Krush-EX/KROSS×OVER | 6 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `andoryu-ken-buryusuta` | アンドリュー"KEN"ブリュースター | — | K-1 / Krush / Krush-EX/KROSS×OVER | 6 | 2012:K-1 / Krush / Krush-EX → 2018:KROSS×OVER(空白6年) | 1 | **判定不能** | 個別裏取り未実施 |
| `kuntapu-charonchai` | クンタップ・チャロンチャイ | タイ/TEAM KUNTAP | SHOOT BOXING/KNOCK OUT/NJKF/新日本キックボクシング協会(SNKA)/Wikipedia(その他団体)/全日本キックボクシング連盟 | 32 | 2010:Wikipedia(その他団体) → 2018:NJKF(空白8年) | 1 | **判定不能** | 個別裏取り未実施 |
| `kazuki` | 一輝 | MtF MUGEN GYM | RISE/KROSS×OVER | 9 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `中尾満` | 中尾満 | — | KROSS×OVER/JKA | 3 | 2018:KROSS×OVER → 2024:JKA(空白6年) | 1 | **判定不能** | 個別裏取り未実施 |
| `kotaro` | 光太郎 | — | K-1 / Krush / Krush-EX/DEEP☆KICK/NJKF/HoostCup | 8 | 2013:K-1 / Krush / Krush-EX → 2022:NJKF(空白9年) | 1 | **判定不能** | 個別裏取り未実施 |
| `kazuto` | 和斗 | 大和ジム | RISE/DEEP☆KICK/NJKF/JKA | 10 | 2017:NJKF → 2022:JKA(空白5年) | 1 | **判定不能** | 個別裏取り未実施 |
| `ooishi-shunsuke` | 大石駿介 | — | RISE/K-1 / Krush / Krush-EX/HoostCup/J-NETWORK/Wikipedia(その他団体)/ラジャダムナン | 36 | 2011:J-NETWORK → 2016:HoostCup(空白5年) | 1 | **判定不能** | 個別裏取り未実施 |
| `daiki-2` | 大輝 | ハリケーンジム/チーム男鹿キック | K-1 / Krush / Krush-EX/Bigbang | 5 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `daiki` | 大輝 | DK9 | K-1 / Krush / Krush-EX/DEEP☆KICK | 5 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `yamakawa-toshihiro` | 山川敏弘 | Maynish KickBoxingGym | RISE/KNOCK OUT/DEEP☆KICK/NJKF/HoostCup/NKB | 22 | 2012:NJKF → 2019:HoostCup(空白7年) | 1 | **判定不能** | 個別裏取り未実施 |
| `yuto-4` | 悠斗 | 東京町田金子ジム | KNOCK OUT/NJKF | 9 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `yuto` | 悠斗 | HUNGRY GYM | K-1 / Krush / Krush-EX | 5 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `musashi-2` | 武蔵 | デビルジム | K-1 / Krush / Krush-EX | 6 | - | 3 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `musashi-3` | 武蔵 | WIVERN | KNOCK OUT | 2 | - | 3 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `takigawa-ryou` | 瀧川リョウ | — | K-1 / Krush / Krush-EX/NJKF/KROSS×OVER/新日本キックボクシング協会(SNKA)/Wikipedia(その他団体)/J-NETWORK | 29 | 2012:新日本キックボクシング協会(SNKA) → 2019:KROSS×OVER(空白7年) | 1 | **判定不能** | 個別裏取り未実施 |
| `riku-2` | 璃久 | フリー | SHOOT BOXING | 10 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `riku` | 璃久 | シカGYM | K-1 / Krush / Krush-EX | 10 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `kota` | 皓太 | K-1ジム川口TEAM SIRIUS | K-1 / Krush / Krush-EX/NKB | 3 | 2018:K-1 / Krush / Krush-EX → 2023:NKB(空白5年) | 1 | **判定不能** | 個別裏取り未実施 |
| `aron-2` | 空龍 | 空修会館 | DEEP☆KICK/NJKF/KROSS×OVER | 6 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `aron` | 空龍 | ホライズンキックボクシングジム | RISE/K-1 / Krush / Krush-EX/NKB | 4 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `tateshima-atsushi` | 立嶋篤史 | — | NJKF/HoostCup/Bigbang/KROSS×OVER/新日本キックボクシング協会(SNKA)/Wikipedia(その他団体)/J-NETWORK/IT'S SHOWTIME | 101 | 2003:NJKF → 2009:新日本キックボクシング協会(SNKA)(空白6年) | 1 | **判定不能** | 個別裏取り未実施 |
| `sasatani-atsushi` | 笹谷淳 | — | NJKF/NKB | 6 | 2016:NJKF → 2021:NKB(空白5年) | 1 | **判定不能** | 個別裏取り未実施 |
| `tatsuto-2` | 龍翔 | EX ARES | K-1 / Krush / Krush-EX | 9 | - | 4 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `tatsuto-3` | 龍翔 | OU-BU GYM | RISE | 3 | - | 4 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `tatsuto` | 龍翔 | BLACK☆Jr | RISE/HoostCup | 13 | - | 4 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `ryusei-2` | 龍聖 | BRAID/TEAM SUERTE | KNOCK OUT/RIZIN/ONE Championship/Wikipedia(その他団体) | 26 | - | 2 | **判定不能** | 既に複数slugへ分離済みだが、各slug自体が複数団体(識別子ベース)にまたがっており二次的な誤結合の余地が残る |
| `akira` | AKIRA | — | K-1 / Krush / Krush-EX/DEEP☆KICK/NJKF/KROSS×OVER | 15 | 2014:NJKF → 2021:KROSS×OVER(空白7年) | 1 | **別人の疑い** | 短い英字/カタカナ愛称は衝突リスクが高い |
| `hayato` | HAYATO | CRAZY WOLF | SHOOT BOXING/RISE/K-1 / Krush / Krush-EX/NJKF/HoostCup/JKA/Wikipedia(その他団体)/ラジャダムナン | 71 | 2009:K-1 / Krush / Krush-EX → 2014:NJKF(空白5年) | 1 | **別人の疑い** | 短い英字/カタカナ愛称は衝突リスクが高い |
| `kengo-2` | KENGO | リアルディール | RISE/DEEP☆KICK/NJKF | 6 | 2011:DEEP☆KICK → 2016:NJKF(空白5年) | 1 | **別人の疑い** | 短い英字/カタカナ愛称は衝突リスクが高い |
| `yohei` | Yo-hei | — | K-1 / Krush / Krush-EX/KROSS×OVER | 7 | 2012:K-1 / Krush / Krush-EX → 2024:KROSS×OVER(空白12年) | 1 | **別人の疑い** | 短い英字/カタカナ愛称は衝突リスクが高い |
| `jieto-izumi` | ジェット・イズミ | — | SHOOT BOXING/RISE/NJKF/J-NETWORK/Wikipedia(その他団体) | 27 | 2010:J-NETWORK → 2022:NJKF(空白12年) | 1 | **別人の疑い** | 空白12年は同一人物の連続活動として長すぎる可能性 |
| `jon-uein-pa` | ジョン・ウェイン・パー | — | SHOOT BOXING/K-1 / Krush / Krush-EX/RIZIN/新日本キックボクシング協会(SNKA)/Wikipedia(その他団体)/WAKO SuperLeague | 39 | 2009:Wikipedia(その他団体) → 2019:RIZIN(空白10年) | 1 | **別人の疑い** | 空白10年は同一人物の連続活動として長すぎる可能性 |
| `nakasako-tsuyoshi` | 中迫剛 | — | RISE/K-1 / Krush / Krush-EX/HoostCup/新日本キックボクシング協会(SNKA)/Wikipedia(その他団体) | 49 | 2008:K-1 / Krush / Krush-EX → 2021:HoostCup(空白13年) | 1 | **別人の疑い** | 空白13年は同一人物の連続活動として長すぎる可能性 |
| `makoto` | 真琴 | STRING FIGHT LAB | KNOCK OUT/DEEP☆KICK/NJKF | 13 | 2010:NJKF → 2021:DEEP☆KICK(空白11年) | 1 | **別人の疑い** | 空白11年は同一人物の連続活動として長すぎる可能性 |
| `ishii-hirokazu` | 石井宏和 | — | DEEP☆KICK/NJKF/HoostCup/Wikipedia(その他団体) | 9 | 2011:Wikipedia(その他団体) → 2023:HoostCup(空白12年) | 1 | **別人の疑い** | 空白12年は同一人物の連続活動として長すぎる可能性 |
| `akuramu-hamidi` | アクラム・ハミディ | Team Valente | K-1 / Krush / Krush-EX/ONE Championship | 6 | 2018:K-1 / Krush / Krush-EX → 2023:ONE Championship(空白5年) | 1 | **統合可(参考)** | K-1/Krush→ONE Championshipは実際によくある移籍パターン |
| `antonio-oruden` | アントニオ・オルデン | El Origen Thaimartin/Orden Team | K-1 / Krush / Krush-EX/ONE Championship | 3 | 2017:K-1 / Krush / Krush-EX → 2023:ONE Championship(空白6年) | 1 | **統合可(参考)** | K-1/Krush→ONE Championshipは実際によくある移籍パターン |
| `danieru-uiriamusu` | ダニエル・ウィリアムス | — | K-1 / Krush / Krush-EX/ONE Championship | 5 | 2015:K-1 / Krush / Krush-EX → 2023:ONE Championship(空白8年) | 1 | **統合可(参考)** | K-1/Krush→ONE Championshipは実際によくある移籍パターン |
| `denisu-demirukapu` | デニス・デミルカプ | Elite Training Center/Team Elite | K-1 / Krush / Krush-EX/ONE Championship | 4 | 2019:K-1 / Krush / Krush-EX → 2024:ONE Championship(空白5年) | 1 | **統合可(参考)** | K-1/Krush→ONE Championshipは実際によくある移籍パターン |
| `denisu-pyuriku` | デニス・ピューリック | — | K-1 / Krush / Krush-EX/ONE Championship | 10 | 2015:K-1 / Krush / Krush-EX → 2022:ONE Championship(空白7年) | 1 | **統合可(参考)** | K-1/Krush→ONE Championshipは実際によくある移籍パターン |
| `akimoto-hiroki` | 秋元皓貴 | — | K-1 / Krush / Krush-EX/ONE Championship/Bigbang/Wikipedia(その他団体) | 32 | 2013:Wikipedia(その他団体) → 2019:ONE Championship(空白6年) | 1 | **統合可(参考)** | K-1/Krush→ONE Championshipは実際によくある移籍パターン |

## 分類件数サマリー

| 分類 | 件数 |
|---|---:|
| 統合可(参考) | 6 |
| 別人の疑い | 9 |
| 判定不能 | 27 |
| **合計** | **42** |

## 泰斗との違い

泰斗のケースが確定できた決め手は、krossover.jp本文を直接取得し、**所属(LEOPARD GYM
vs 高本道場)とルール(キックボクシング vs MMA)という2つの独立した不一致**が見つかった
ことだった。本調査の42件は表記名・所属・掲載団体・活動年という`fighters.json`/
生成データの範囲内での機械的な一次判定に留まり、同水準の裏取りはしていない。
「別人の疑い」9件についても、確定的な誤統合という意味ではなく、**優先して個別確認すべき
候補**という位置づけである。

## 次のアクション(このPRでは実施しない)

- 「別人の疑い」9件を優先して、taitoと同じ手法(一次資料URLの本文確認)で個別検証する。
- 既に分離済みの9グループ21レコード(`判定不能`27件のうち多数を占める)についても、
  各slugが単独でなお複数団体にまたがっている点(例: `aron`がRISE/K-1/NKBの3団体、
  `tatsuto`がRISE/HoostCupの2団体)を、二次的な誤結合の可能性として個別に潰していく。
- `scripts/check-kick-identity-merge-risk.ts`は今後、新規の同型リスクが増えたら
  ビルドを失敗させる(ratchet、現状52件)。この52件のうち今回モノニムとして拾えなかった
  「姓 名」形式の10件についても、将来的に同様の調査を行う余地がある。
