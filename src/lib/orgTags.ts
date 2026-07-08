// 団体タグの付与ロジック(基盤)。"所属歴"ではなく"現在の立場/直近の実態"で付ける。
//   パンクラス … 現ランカーのみ(公式ランキング掲載選手)
//   修斗       … 現ランカーのみ(同上)
//   DEEP       … 2026以降のナンバーシリーズ(DEEP.### 本戦)出場者のみ
//   RIZIN      … 2026年1月以降にRIZIN主催のMMA興行に出場した選手のみ
// 順位はパンクラス/修斗タグにのみ紐づく付加情報。DEEP/RIZINは階級のみ(順位なし)。
// 順位・タグは静的に選手へ書かず、ランキングデータ+EVENT_RESULTSから毎回導出する
// (＝既存公開選手のデータを一切書き換えない)。
import { EVENT_RESULTS } from "./eventResults";
import { EVENTS } from "./events";
import type { FightRecord } from "./fighters";
import type { OrgRankingsFile } from "./orgRankingsData";

export type OrgTagKey = "ufc" | "rizin" | "deep" | "pancrase" | "shooto" | "one";

export const ORG_TAG_LABEL: Record<OrgTagKey, string> = {
  ufc: "UFC",
  rizin: "RIZIN",
  deep: "DEEP",
  pancrase: "パンクラス",
  shooto: "修斗",
  one: "ONE",
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

// DEEPタグ: 2026年以降に開催されたDEEP主催イベント(orgフィールドが"deep")の
// 出場者を対象にする。ナンバーシリーズ(DEEP.###)に限定せず、地方大会
// (DEEP OSAKA IMPACT等)・DEEP JEWELS(女子)もorgが"deep"であれば同様に含む。
// スラッグの命名パターン(-impact等)でのヒューリスティック判定はしない
// (新規イベントが追加されるたびに個別slugリストを手動更新する構造は、
// 追加漏れによる取りこぼしの温床になるため廃止した)。
const DEEP_2026_SINCE = "2026-01-01";
const deep2026Names = new Set<string>();
function collectDeepNamesSince(
  events: { slug: string; org: string; date: string }[],
  fightersOf: (e: { slug: string; org: string; date: string }) => (string | undefined)[]
) {
  for (const e of events) {
    if (e.org !== "deep") continue;
    if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
      console.warn(`[orgTags] DEEPイベントの開催日が欠損/不正のためDEEPタグ集計から除外: slug=${e.slug} date=${e.date}`);
      continue;
    }
    if (e.date < DEEP_2026_SINCE) continue;
    for (const name of fightersOf(e)) {
      if (name) deep2026Names.add(norm(name));
    }
  }
}
collectDeepNamesSince(EVENT_RESULTS, (e) =>
  (e as typeof EVENT_RESULTS[number]).fights.flatMap((f) => [f.fighterA, f.fighterB])
);
collectDeepNamesSince(EVENTS, (e) =>
  (e as typeof EVENTS[number]).bouts.flatMap((b) => [b.fighterA, b.fighterB])
);

// 2025-2026年にRIZIN主催MMA興行へ2試合以上出場した選手のみRIZINタグを付ける
// (他団体タグと同じ"現行性"判定に統一。旧ルールは1試合でも付与しており、
// DEEP/パンクラス/修斗の選手に過去のRIZIN出場歴だけでタグが誤って残る事故が
// あったため2試合以上に強化)。カウント対象:
//   (a) EVENT_RESULTS(org==="rizin"・MMA興行のみ、キック=RIZIN FIGHTは含まれない)
//   (b) EVENTS(未消化=予定/開催前の対戦カード。確定済みだが結果未反映の
//       「次戦」も現行性の証拠として数える)
// (a)+(b)の合計で2試合に満たない場合のみ、wiki戦績側のRIZIN戦カウントを
// フォールバックとして併用する(mnews未収録の試合をwiki戦績から補う。
// 同一試合の二重計上を避けるため合算ではなく大きい方を採用)。
const RIZIN_SINCE = "2025-01-01";
const RIZIN_UNTIL = "2026-12-31";
const RIZIN_MIN_BOUTS = 2;

const rizinMnewsCounts = new Map<string, number>();
function addRizinCount(name: string) {
  const key = norm(name);
  rizinMnewsCounts.set(key, (rizinMnewsCounts.get(key) ?? 0) + 1);
}
for (const e of EVENT_RESULTS) {
  if (e.org !== "rizin" || e.date < RIZIN_SINCE || e.date > RIZIN_UNTIL) continue;
  for (const f of e.fights) {
    if (f.fighterA) addRizinCount(f.fighterA);
    if (f.fighterB) addRizinCount(f.fighterB);
  }
}
for (const e of EVENTS) {
  if (e.org !== "rizin" || e.date < RIZIN_SINCE || e.date > RIZIN_UNTIL) continue;
  for (const b of e.bouts) {
    if (b.fighterA) addRizinCount(b.fighterA);
    if (b.fighterB) addRizinCount(b.fighterB);
  }
}

// RIZINタグの明示例外(slug指定)。負傷欠場等で2試合基準を満たせないが、
// RIZIN主力として扱うべき選手のみ。例外は最小限に留める(原則は基準側で拾う)。
//   平本蓮 … 大怪我で出場が途切れ直近RIZIN戦が2024。RIZIN主力・負傷欠場中。
//   イリスベク・ティレノフ … 2026-07-18のRIZIN LANDMARK 15が本人初のRIZIN参戦
//     (2025-2026のRIZIN出場は0戦・7/18が1戦目。2試合基準未達)。イベント露出
//     優先の暫定付与。7/18より後にさらにRIZIN出場し2戦目条件を満たし次第、
//     この例外は削除する。
//   キム・スーチョル / イ・ジョンヒョン … RIZIN 2025-2026出場が各1戦のみ(2試合
//     基準未達)。RIZIN韓国人ロスターとして公開に合わせ暫定付与。次のRIZIN出場で
//     2戦目条件を満たし次第この例外は削除する(ヤン・ジヨンは2戦で自動付与のため対象外)。
//   エドポロキング/スダリオ剛/斎藤裕/ジェームズ・ギャラガー/ライアン・カファロ/
//     所英男/ジョン・ドッドソン/キム・ギョンピョ … 2026-07時点でRIZIN2025-2026
//     出場が各1戦のみ(2試合基準未達。適用前チェックで確認済み・データ欠損では
//     なく実際に1戦のみ)。RIZIN露出優先で暫定付与。次のRIZIN出場で2戦目条件を
//     満たし次第この例外は削除する。
//   水野新太 … RIZIN.54(2026-08-11 vsリー・カイウェン)出場が現時点で1戦のみ
//     (2試合基準未達・適用前チェックで確認済み)。RIZIN露出優先で暫定付与。次の
//     RIZIN出場で2戦目条件を満たし次第この例外は削除する。
const RIZIN_TAG_EXCEPTIONS = new Set<string>([
  "hiramoto-ren",
  "yrysbek-tilenov",
  "kim-soochul",
  "lee-junghyun",
  "edpolo-king",
  "sudario-tsuyoshi",
  "saito-yutaka",
  "gallagher-james",
  "cafaro-ryan",
  "tokoro-hideo",
  "dodson-john",
  "kim-kyungpyo",
  "mizuno-shinta",
]);

// 修斗タグの明示例外(slug指定)。公式ランキング対象4階級(フライ/バンタム/
// フェザー/ライト)以外の階級王者で、ランキングデータには載らないが現状の
// 立場としてタグを付けるべき選手のみ。例外は最小限に留める。
//   住村竜市朗 … 現修斗世界ウェルター級王者(ウェルター級は対象4階級外のため
//                orgRankings.jsonに掲載されずランカー判定に乗らない)。
const SHOOTO_TAG_EXCEPTIONS = new Set<string>(["sumimura-ryuichiro"]);

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

// 2025-2026年にRIZINへ2試合以上出場(予定含む)したか。
// (a)mnews記録(EVENT_RESULTS+EVENTS) / (b)解決済みwiki戦績のRIZIN戦 の
// 大きい方を採用(同一試合の二重計上を避けるため合算しない)。
// 捏造はしない(EVENT_RESULTSに無い試合を足さず、既にDBが持つwiki戦績から導く)。
export function isRizinRecent(f: TaggableFighter): boolean {
  if (RIZIN_TAG_EXCEPTIONS.has(f.slug)) return true;
  const mnewsCount = rizinMnewsCounts.get(norm(f.nameJa)) ?? 0;
  let wikiCount = 0;
  if (f.history) {
    for (const h of f.history) {
      if (h.date >= RIZIN_SINCE && h.date <= RIZIN_UNTIL && RIZIN_EVENT_RE.test(h.event)) wikiCount++;
    }
  }
  return Math.max(mnewsCount, wikiCount) >= RIZIN_MIN_BOUTS;
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
//   ONE       … fighter.org === "one"(UFCと同じく所属/出場の直接判定。ONEはEVENT_RESULTS/
//               orgRankingsを持たないため、他団体のような興行実績ベース判定はできない)。
// 並び順は表示フィルタと揃える: UFC / RIZIN / DEEP / パンクラス / 修斗 / ONE。
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
  if (f.org === "one") {
    tags.push({ key: "one", label: ORG_TAG_LABEL.one, weightClass: f.weightClass });
  }
  // パンクラス/修斗 = 現ランカー(公式ランキングに slug 一致で載っている)
  let shootoTagged = false;
  for (const key of ["pancrase", "shooto"] as const) {
    const data = orgRankings[key];
    if (!data) continue;
    for (const c of data.classes) {
      const hit = c.entries.find((e) => e.slug === f.slug);
      if (hit) {
        tags.push({ key, label: ORG_TAG_LABEL[key], weightClass: c.weightClass, rank: hit.rank });
        if (key === "shooto") shootoTagged = true;
        break;
      }
    }
  }
  // 修斗の明示例外(対象4階級外の王者)。ランキング一致で既に付いていれば二重に付けない。
  if (!shootoTagged && SHOOTO_TAG_EXCEPTIONS.has(f.slug)) {
    tags.push({ key: "shooto", label: ORG_TAG_LABEL.shooto, weightClass: f.weightClass, rank: "王者" });
  }

  return tags;
}
