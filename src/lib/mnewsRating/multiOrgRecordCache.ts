// multiOrgRecord.ts(computeMultiOrgRecord/computeMultiOrgBoutTable/computeMultiOrgRates)
// は純関数だがメモ化を持たず、呼ぶたびに4団体合算約1万boutを線形スキャンする。
// force-dynamicな/fighters/[slug]・/fightersが1リクエストごとにこれを選手あたり
// 最大6〜7回・一覧では対象選手数ぶん(数百回)呼んでいたことが、2026-08-02の
// Fluid Active CPU急増調査で判明した主因の一つ(データ取得層のキャッシュは
// multiOrgRecordsData.ts側で別途対応済み)。
//
// ここでは選手slug単位で計算結果(record/rows/rates)をプロセス内メモリキャッシュ
// する。有効期限は独立したタイマーではなく、元データのスナップショット
// (getMultiOrgSourceDataCached()が返すオブジェクト参照)が入れ替わったかどうかで
// 判定する。こうすることで「データは更新されたのに計算結果キャッシュだけ古い
// ままより長く残る」というズレが起きない(データキャッシュのTTL=1時間の範囲に
// 完全に同期する。multiOrgRecordsData.tsのコメント参照)。
//
// computeMultiOrgRecord等の実装そのものは一切変更していないため、キャッシュの
// 有無で表示される数値が変わることはない(同じ入力に対し常に同じ出力を返す
// 純関数をメモ化しているだけ)。
import { getMultiOrgSourceDataCached } from "../multiOrgRecordsData";
import { FighterRecordEntry } from "../fighterRecordsCache";
import {
  computeMultiOrgRecord,
  computeMultiOrgBoutTable,
  computeMultiOrgRates,
  shouldPreferMultiOrgRecord,
  withMultiOrgRecord,
  MultiOrgRecord,
  MultiOrgBoutRow,
  MultiOrgRates,
  MultiOrgSourceData,
} from "./multiOrgRecord";

export interface MultiOrgSummary {
  record: MultiOrgRecord;
  rows: MultiOrgBoutRow[];
  rates: MultiOrgRates;
}

let cachedSnapshotRef: MultiOrgSourceData | null = null;
const summaryBySlug = new Map<string, MultiOrgSummary>();

function computeSummary(slug: string, data: MultiOrgSourceData): MultiOrgSummary {
  const record = computeMultiOrgRecord(slug, data);
  const rows = computeMultiOrgBoutTable(slug, data);
  const rates = computeMultiOrgRates(record, rows);
  return { record, rows, rates };
}

// slug単位のrecord/rows/ratesをキャッシュして返す。同一プロセス内で同じデータ
// スナップショットが有効な間(=getMultiOrgSourceDataCached()のTTL内)は、同じ
// slugへの2回目以降の呼び出しは再計算せずキャッシュを返す。
export async function getMultiOrgSummaryCached(slug: string): Promise<MultiOrgSummary> {
  const data = await getMultiOrgSourceDataCached();
  if (data !== cachedSnapshotRef) {
    // データスナップショットが入れ替わった(=新規フェッチが発生した)ので、
    // 古いデータに基づく計算結果キャッシュを丸ごと破棄する。
    summaryBySlug.clear();
    cachedSnapshotRef = data;
  }
  const cached = summaryBySlug.get(slug);
  if (cached) return cached;
  const summary = computeSummary(slug, data);
  summaryBySlug.set(slug, summary);
  return summary;
}

// resolveDisplayRecord(multiOrgRecord.ts)のキャッシュ版。ロジック(判定条件・
// withMultiOrgRecordへの委譲)は元関数と完全に同一で、record/rows/ratesの取得元
// だけをキャッシュ経由に差し替えている。resolveDisplayRecord自体は/api/og/*
// (Edge runtime、別のfetch実装を使う)からも呼ばれているため変更せず残し、
// Node runtimeのページ(fighters/[slug]・visibleFighters経由の/fighters一覧)
// だけがこちらを使う。
export async function resolveDisplayRecordCached<T extends FighterRecordEntry & { slug: string }>(
  fighter: T
): Promise<T> {
  const { record, rows, rates } = await getMultiOrgSummaryCached(fighter.slug);
  if (!shouldPreferMultiOrgRecord(fighter, fighter.wins, fighter.losses, fighter.draws, record)) return fighter;
  if (record.wins === 0 && record.losses === 0 && record.draws === 0) return fighter;
  return withMultiOrgRecord(fighter, record, rates, rows);
}
