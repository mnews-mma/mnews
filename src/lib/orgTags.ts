// 団体タグの付与ロジック(基盤)。"所属歴"ではなく"現在の立場/直近の実態"で付ける。
//   パンクラス … 現ランカーのみ(公式ランキング掲載選手)
//   修斗       … 現ランカーのみ(同上)
//   DEEP       … 2026以降のナンバーシリーズ(DEEP.### 本戦)出場者のみ
//   RIZIN      … 2026年1月以降にRIZIN主催のMMA興行に出場した選手のみ
// 順位はパンクラス/修斗タグにのみ紐づく付加情報。DEEP/RIZINは階級のみ(順位なし)。
// 順位・タグは静的に選手へ書かず、ランキングデータ+EVENT_RESULTSから毎回導出する
// (＝既存公開選手のデータを一切書き換えない)。
import { EVENT_RESULTS } from "./eventResults";
import type { FightRecord } from "./fighters";
import type { OrgRankingsFile } from "./orgRankingsData";

export type OrgTagKey = "ufc" | "rizin" | "deep" | "pancrase" | "shooto";

export const ORG_TAG_LABEL: Record<OrgTagKey, string> = {
  ufc: "UFC",
  rizin: "RIZIN",
  deep: "DEEP",
  pancrase: "パンクラス",
  shooto: "修斗",
};

export interface OrgTag {
  key: OrgTagKey;
  label: string;
  weightClass?: string; // タグに紐づく階級(パンクラス/修斗=順位の階級、他=選手の主戦階級)
  rank?: string; // パンクラス/修斗のみ(王者/暫定王者/番号)。UFC/RIZIN/DEEPは無し
}

const norm = (s: string) => s.replace(/[\s　・☆]/g, "");

// 二次PR以降に hidden→公開昇格した「新規表示分」の選手集合。
// 注: 団体タグ付与のゲートとしては使わない(computeFighterTagsは全選手に一律適用)。
// 現在は /deep-2026 の一覧を「新規昇格分のDEEP2026出場者」に絞る用途のみで参照する。
export const NEW_TAGGED_SLUGS = new Set<string>([
  "ohara-juri", "kuramoto-daigo", "shimada-ibuki", "sakai-ryo", "sekihara-sho", "rikiya",
  "gomyo-hiroto", "tsubaki-asuka", "hibino-junya", "kenshiro", "nakatani-yuga", "suzuki-taisei",
  "ushiku-kentaro", "muramoto-yutaro", "hiramatsu-sho", "sugiyama-sora", "abe-daiji", "takizawa-kenta",
  "nakamura-daisuke", "izumi-takeshi", "kindaichi-kosuke", "kubota-taito", "kozaki-ren", "seigo",
  "suwabe-teppei", "sugino-aren", "daiya", "strasser-kiichi", "kinoshita-karate", "naito-tank",
  "arato-hidetaka", "terasaki-ryu", "miyabi-shunsuke", "karino-yu", "yamamoto-soushi", "kadono-kohei",
  "ryoga", "takaoka-hiroki", "nakamura-yusaku", "nagai-kanata", "saito-shoji", "nose-shohei",
  "sasuke", "hikaru", "aoi-taichi", "tateo", "toma", "goto-ryo", "captain-africa", "nishio-shinsuke",
  "barboza-rafael", "kamiya-daichi", "kasuya-yusuke", "yanagawa-yuito", "rajabov-otabek", "hirata-naoki",
  "tajima-ryo", "matsui-ryo", "imura-rui",
  "shimizu-hiroto", "otsuka-tomoki",
  // DEEP133 IMPACT突合(2026-07)で追加した新規DEEP選手
  "nishitani-taisei", "shibisai-shoma", "kitakata-daichi", "kaito", "mitsui-shunki",
  "shirakawa-rikuto", "kitaoka-satoru", "yamasaki-yajuro", "nakatsukasa-taiyo", "max-yoshida",
  "okumura-airu",
  // 手動追加6名(2026-07)
  "park-siwoo", "lee-yeji", "miyake-kisa", "aoi-jin", "hamada-takumi", "tenya",
]);

// DEEP 2026以降のナンバー本戦出場者(名前集合)
const DEEP_2026_SLUGS = new Set(["deep-130-impact", "deep-131-impact", "deep-132-impact"]);
const deep2026Names = new Set<string>();
for (const e of EVENT_RESULTS) {
  if (!DEEP_2026_SLUGS.has(e.slug)) continue;
  for (const f of e.fights) {
    if (f.fighterA) deep2026Names.add(norm(f.fighterA));
    if (f.fighterB) deep2026Names.add(norm(f.fighterB));
  }
}

// 2025年1月以降にRIZIN主催MMA興行へ出場した選手(名前集合・EVENT_RESULTS由来)。
// EVENT_RESULTS の org==="rizin" はMMA興行のみ(キック=RIZIN FIGHTは含まれない)。
// しきい値を2026→2025に緩めたのは、片方の年がmnews未収録でもデータ欠損に強く
// するため("2026に出ていない"のではなく"mnewsが未記録"による誤タグ落ちを防ぐ)。
const RIZIN_SINCE = "2025-01-01";
const rizinRecentNames = new Set<string>();
for (const e of EVENT_RESULTS) {
  if (e.org !== "rizin" || e.date < RIZIN_SINCE) continue;
  for (const f of e.fights) {
    if (f.fighterA) rizinRecentNames.add(norm(f.fighterA));
    if (f.fighterB) rizinRecentNames.add(norm(f.fighterB));
  }
}

// RIZINタグの明示例外(slug指定)。負傷欠場等で2025以降の自動判定から漏れるが、
// RIZIN主力として扱うべき選手のみ。例外は最小限に留める(原則は基準側で拾う)。
//   平本蓮 … 大怪我で出場が途切れ直近RIZIN戦が2024。RIZIN主力・負傷欠場中。
const RIZIN_TAG_EXCEPTIONS = new Set<string>(["hiramoto-ren"]);

// RIZIN戦とみなすイベント名(ja-wiki戦績のevent文字列)。
const RIZIN_EVENT_RE = /RIZIN|ライジン/i;

// 選手の weightClass ラベルを Mニュース5階級へ。5階級外(ストロー/ウェルター/ミドル/
// 女子)は null。DEEPメガトン等はヘビー級に寄せる。DEEP一覧のグルーピングに使う。
export type FiveClass = "フライ級" | "バンタム級" | "フェザー級" | "ライト級" | "ヘビー級";
export const FIVE_CLASSES: FiveClass[] = ["フライ級", "バンタム級", "フェザー級", "ライト級", "ヘビー級"];
export function toFiveClass(weightClass: string): FiveClass | null {
  const w = weightClass;
  if (/女子|アトム/.test(w)) return null;
  if (/メガトン|スーパーヘビー|ヘビー級/.test(w)) return "ヘビー級";
  if (/ストロー|ウェルター|ミドル|ライトヘビー/.test(w)) return null;
  if (/フライ級/.test(w)) return "フライ級";
  if (/バンタム級/.test(w)) return "バンタム級";
  if (/フェザー級/.test(w)) return "フェザー級";
  if (/ライト級/.test(w)) return "ライト級";
  return null;
}

export function isDeep2026(nameJa: string): boolean {
  return deep2026Names.has(norm(nameJa));
}

export interface TaggableFighter {
  slug: string;
  nameJa: string;
  weightClass: string;
  org: string;
  // 解決済みwiki戦績(あれば)。RIZINタグ判定にEVENT_RESULTSだけでなく
  // wiki戦績のRIZIN戦(2025以降)も併用してデータ欠損に強くするために使う。
  history?: FightRecord[];
}

// 2025年以降にRIZINへ出場したか。判定ソースをEVENT_RESULTS単独に限定せず、
// (a)EVENT_RESULTS 2025+ / (b)解決済みwiki戦績のRIZIN戦2025+ / (c)明示例外 を併用。
// 捏造はしない(EVENT_RESULTSに無い試合を足さず、既にDBが持つwiki戦績から導く)。
export function isRizinRecent(f: TaggableFighter): boolean {
  if (RIZIN_TAG_EXCEPTIONS.has(f.slug)) return true;
  if (rizinRecentNames.has(norm(f.nameJa))) return true;
  if (f.history) {
    for (const h of f.history) {
      if (h.date >= RIZIN_SINCE && RIZIN_EVENT_RE.test(h.event)) return true;
    }
  }
  return false;
}

// 選手の団体タグを導出。orgRankings は fetchOrgRankings() の結果。
// 全選手に同じ基準で一律適用する(旧NEW_TAGGED_SLUGSゲートは撤去)。団体表示は
// このタグ1系統に統一され、/fighters・選手ページ・Xカードで同じ結果になる。
// 付与ルール("所属歴"ではなく"現在の立場/直近の実態"で付ける):
//   UFC       … fighter.org === "ufc"(UFC所属/出場)。
//   RIZIN     … 2025年以降にRIZIN出場(isRizinRecent: EVENT_RESULTS 2025+ / wiki戦績の
//               RIZIN戦2025+ / 明示例外 の併用)。2024以前が最後の選手は付けない
//               (過去の単発出場は拾わない芯は維持・fighter.org単独では判定しない)。
//   DEEP      … 2026以降ナンバー本戦出場(EVENT_RESULTS由来) または fighter.org === "deep"。
//   パンクラス … 現ランカー(公式ランキングに slug 一致で掲載・順位つき)。
//   修斗       … 現ランカー(同上)。
// 並び順は表示フィルタと揃える: UFC / RIZIN / DEEP / パンクラス / 修斗。
export function computeFighterTags(f: TaggableFighter, orgRankings: OrgRankingsFile): OrgTag[] {
  const tags: OrgTag[] = [];

  if (f.org === "ufc") {
    tags.push({ key: "ufc", label: ORG_TAG_LABEL.ufc, weightClass: f.weightClass });
  }
  if (isRizinRecent(f)) {
    tags.push({ key: "rizin", label: ORG_TAG_LABEL.rizin, weightClass: f.weightClass });
  }
  if (isDeep2026(f.nameJa) || f.org === "deep") {
    tags.push({ key: "deep", label: ORG_TAG_LABEL.deep, weightClass: f.weightClass });
  }
  // パンクラス/修斗 = 現ランカー(公式ランキングに slug 一致で載っている)
  for (const key of ["pancrase", "shooto"] as const) {
    const data = orgRankings[key];
    if (!data) continue;
    for (const c of data.classes) {
      const hit = c.entries.find((e) => e.slug === f.slug);
      if (hit) {
        tags.push({ key, label: ORG_TAG_LABEL[key], weightClass: c.weightClass, rank: hit.rank });
        break;
      }
    }
  }

  return tags;
}
