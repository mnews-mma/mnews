import { FIGHTERS, Fighter } from "./fighters";
import { ResolvedFighter } from "./feeds/resolveFighter";
import { fetchFighterRecords, resolveFightersFromRecords } from "./fighterRecordsCache";
import { shouldPreferMultiOrgRecord } from "./mnewsRating/multiOrgRecord";
import { getMultiOrgSummaryCached } from "./mnewsRating/multiOrgRecordCache";
import { SHOW_MULTI_ORG_RECORD } from "./featureFlags";

// /fighters 一覧・Xカードツールで共通の「公開母集団」を返す。
// 公開条件 = 非hidden かつ 非delisted(needsReview/HELDは hidden 側で既に除外) かつ
// 表示できる戦績が何かある(Wikipedia通算 または 4団体合算のいずれか)。除外条件は
// 「Wikipedia由来の戦績がない」ではなく「表示できる戦績が何もない」であるべき、
// という判断(2026-07-31)。SHOW_MULTI_ORG_RECORDがoffの間は従来どおりWikipedia通算
// のみで判定する。両画面で必ず同じ母集団になるようこの1関数に集約する(⑤の
// /fighters ↔ Xカード不整合の恒久解消)。
// delisted は hidden(新規投入バッチの公開審査待ち)とは別の恒久除外フラグ
// (2026-08、Fighter型定義参照)。選手ページ・sitemap自体には影響させず、この
// 一覧母集団からのみ外す。
//
// 戦績データはリクエスト時にWikipediaへライブfetchせず、バッチ(update-fighter-records.ts)が
// 焼き込んだ data/fighterRecords.json を読むだけにする(可視選手数がリクエストごとに
// 変動する問題の恒久対策)。
// hidden/delisted の2条件だけを除いたFIGHTERS(戦績の有無は問わない)。
// getVisibleFighters()より緩い母集団が要る場所向けの共有ヘルパー。
// 例: sitemap.tsの選手ルート — noRecordDataの選手(戦績データが無いだけで
// hidden/delistedではない)は、内部リンクからは到達できなくてもGoogle Search
// Console実測で外部検索からの流入がある「サイト内で孤立しているが検索エンジン
// 経由では発見される」ページが存在するため、getVisibleFighters()の「戦績あり」
// 条件をそのまま適用すると発見経路を失わせてしまう(2026-08確認)。
// hidden/delistedの除外条件自体はgetVisibleFighters()と同じ1行を共有し、
// sitemap.ts側で判定ロジックを再実装しない(#286の重複実装一本化を踏襲)。
export function getFightersExcludingHiddenAndDelisted(): Fighter[] {
  return FIGHTERS.filter((f) => !f.hidden && !f.delisted);
}

async function computeVisibleFighters(): Promise<ResolvedFighter[]> {
  const records = await fetchFighterRecords();
  const resolved = resolveFightersFromRecords(getFightersExcludingHiddenAndDelisted(), records);
  if (!SHOW_MULTI_ORG_RECORD) return resolved.filter((f) => !f.noRecordData);

  const withMultiOrg = await Promise.all(
    resolved.map(async (f) => {
      // noRecordData(戦績データ自体が無い)だけでなく、needsReview/recordFromResults
      // (1行目が単一ソース由来で限定的)も対象にする(fighters/[slug]の
      // suppressNoRecordRowと同じ判定。shouldPreferMultiOrgRecord参照)。
      // それ以外(通常のWikipedia選手)は4団体合算の計算自体を省略する(既存の
      // 性能特性を維持)。
      if (!f.noRecordData && !f.needsReview && !f.recordFromResults) return f;
      const { record: mr, rates } = await getMultiOrgSummaryCached(f.slug);
      if (!shouldPreferMultiOrgRecord(f, f.wins, f.losses, f.draws, mr)) return f;
      if (mr.wins === 0 && mr.losses === 0 && mr.draws === 0) return f;
      return { ...f, multiOrgRecord: { wins: mr.wins, losses: mr.losses, draws: mr.draws, ...rates } };
    })
  );
  return withMultiOrg.filter((f) => !f.noRecordData || !!f.multiOrgRecord);
}

// 公開母集団の算出結果をプロセス内で1時間キャッシュする(2026-08-07)。
//
// computeVisibleFighters()はメモ化を持たず、呼ばれるたびに約360選手ぶんの
// resolveFightersFromRecords()を回していた。/dreamはgenerateMetadataと本体の
// 両方からresolveDreamSlugs()経由で呼ぶため1リクエストで2回、/vsも本体で1回
// 実行しており、両ルートがキャッシュの効かない動的レンダリングであることと
// あいまってFluid Active CPUの二大消費源になっていた(2026-08-07の本番停止時、
// Vercel Observabilityのルート別実測で/dream 6分/日・/vs 6分/日=全47ルート中の
// 上位2件)。
//
// 実装方針はmultiOrgRecordsData.ts(データ取得層の1時間キャッシュ)と
// multiOrgRecordCache.ts(計算層のスナップショット連動キャッシュ)で確立済みの
// 既存イディオムを踏襲する。unstable_cache等の新規APIは使わない。
// in-flightのPromiseを共有するため、同時に何箇所から呼ばれても実計算は1回に
// 収束する。空配列(元データ取得失敗時)はキャッシュしない(一時障害を1時間
// 固定化しない。multiOrgRecordsData.tsの同方針に合わせる)。
//
// 許容する古さ: 最大1時間。fetchFighterRecords()自体がrevalidate:3600の
// Data Cache経由であり、日次バッチ(update-fighter-records.yml)の反映が最大1時間
// 遅れることは2026-08-02の同種修正(3dc1eaa)で既に許容済みの範囲。この
// キャッシュとData Cacheの期限がずれた場合、公開母集団の反映は最大2時間遅れ
// うるが、遅れるのは「選手が一覧・選択候補に現れるタイミング」だけで誤った
// 戦績が出るわけではないため許容する。
const VISIBLE_FIGHTERS_REVALIDATE = 3600;

let inFlightVisible: Promise<ResolvedFighter[]> | null = null;
let resolvedVisible: { data: ResolvedFighter[]; expiresAt: number } | null = null;

// 一時計装(2026-08-08、Fluid Active CPU調査用。分析後に削除する):
// このキャッシュが実際にヒットしているか(=同一インスタンスが複数リクエストを
// 処理し続けているか、それとも毎回新規インスタンスでコールドになっているか)を
// 実測するため、呼び出しごとにHIT/MISSを記録する。instanceIdはモジュール
// ロード時(=インスタンス起動時)に1回だけ発行するランダム値で、同じ
// instanceIdでhitCountが増えていればプロセス内キャッシュが有効に機能して
// いる証拠になる。ログはVercel Runtime Logsで"[visible-fighters-cache-audit]"
// を検索して回収する。
const instanceId = Math.random().toString(36).slice(2, 8);
let hitCount = 0;
let missCount = 0;

export function getVisibleFighters(): Promise<ResolvedFighter[]> {
  const now = Date.now();
  if (resolvedVisible && resolvedVisible.expiresAt > now) {
    hitCount++;
    console.log(
      `[visible-fighters-cache-audit] HIT instance=${instanceId} hitCount=${hitCount} missCount=${missCount}`
    );
    return Promise.resolve(resolvedVisible.data);
  }
  if (inFlightVisible) {
    console.log(`[visible-fighters-cache-audit] IN-FLIGHT instance=${instanceId} (同時呼び出しの相乗り)`);
    return inFlightVisible;
  }

  missCount++;
  console.log(
    `[visible-fighters-cache-audit] MISS instance=${instanceId} hitCount=${hitCount} missCount=${missCount}`
  );
  inFlightVisible = computeVisibleFighters()
    .then((data) => {
      if (data.length > 0) {
        resolvedVisible = { data, expiresAt: Date.now() + VISIBLE_FIGHTERS_REVALIDATE * 1000 };
      }
      inFlightVisible = null;
      return data;
    })
    .catch((err) => {
      inFlightVisible = null;
      throw err;
    });
  return inFlightVisible;
}

// 上記と同じ可視性判定でslugのSetだけを返す。イベント/戦績ページの対戦相手リンク
// (findFighterSlugByNameのvisibleSlugs引数)で使う軽量ヘルパー。判定ロジックの
// 二重定義を避けるため、必ずこの関数(=getVisibleFighters)経由で導出する。
export async function getVisibleFighterSlugs(): Promise<Set<string>> {
  const visible = await getVisibleFighters();
  return new Set(visible.map((f) => f.slug));
}

// /ranking/{org}(現王者・序列表)で「名前+リンク」にできる選手を絞り込む。
// 「表示できる戦績が何かある」の判定はgetVisibleFighterSlugs()(=getVisibleFighters())
// 1箇所に一本化し、呼び出し側で同じ条件を再実装しない(2026-07-31、/fighters一覧と
// ランキングページで別実装の同一判定が存在していたことが原因の不整合を解消)。
export async function filterVisibleSlugs(slugs: Iterable<string>): Promise<string[]> {
  const visible = await getVisibleFighterSlugs();
  return Array.from(slugs).filter((s) => visible.has(s));
}
