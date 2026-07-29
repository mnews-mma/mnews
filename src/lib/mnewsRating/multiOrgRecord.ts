// RIZIN・修斗・パンクラスの3団体公式データ(data/rizinRecords.json・
// data/shootoRecords.json・data/pancraseRecords.json)を合算した選手戦績
// (選手プロフィールページ「2行目」表示用)を薄くラップする。
//
// 集計元はこの3ファイルのみ。src/lib/fighters.tsのwins/losses/history
// フィールド(PR #252が投入した値)は一切参照しない(#252投入値は#258の
// 調査でドロー誤判定由来の誤りが見つかっており信頼できないため、必ず
// data/配下の生データから毎回再集計する)。
//
// 選手とboutの突合はslug完全一致のみで行う(名前によるフォールバック突合は
// 行わない)。data/shootoRecords.json・data/pancraseRecords.jsonの
// fighterASlug/fighterBSlugは、scripts/backfill-shooto-pancrase-slugs.tsに
// よるバックフィル(hidden選手も含めた完全一致解決)を経た値を前提とする。
//
// 各団体の集計本体(resultType別振り分け・ルール種別フィルタ)は
// rizinRecordsAggregate.ts(既存のcomputeFighterMmaRecordをそのまま使う)・
// shootoRecordsAggregate.ts・pancraseRecordsAggregate.tsにある。このファイルは
// 3団体の結果を合算するだけ。
import { RizinRecordsEvent } from "./rizinScraper";
import { computeFighterMmaRecord } from "./rizinRecordsAggregate";
import { ShootoRecordsEvent } from "./shootoScraper";
import { computeFighterShootoRecord } from "./shootoRecordsAggregate";
import { PancraseRecordsEvent } from "./pancraseRecordsTypes";
import { computeFighterPancraseRecord } from "./pancraseRecordsAggregate";

// 表示ラベル用の固定表記(実装済み3団体のみを列挙。DEEP等の未実装団体は
// data/配下に集計元ファイルが存在しないため含めない)。
export const MULTI_ORG_RECORD_LABEL = "RIZIN・パンクラス・修斗 通算";

export interface MultiOrgRecord {
  wins: number;
  losses: number;
  draws: number;
  // 集計に使った団体のうち、この選手について1件以上boutが見つかった団体
  // (表示には使わず、検証・デバッグ用の内訳として残す)。
  orgsWithBouts: string[];
}

export function computeMultiOrgRecord(
  slug: string,
  data: {
    rizinEvents: RizinRecordsEvent[];
    shootoEvents: ShootoRecordsEvent[];
    pancraseEvents: PancraseRecordsEvent[];
  }
): MultiOrgRecord {
  const rizin = computeFighterMmaRecord(data.rizinEvents, slug);
  const shooto = computeFighterShootoRecord(data.shootoEvents, slug);
  const pancrase = computeFighterPancraseRecord(data.pancraseEvents, slug);

  const orgsWithBouts: string[] = [];
  if (rizin.bouts.length > 0 || rizin.excluded.length > 0) orgsWithBouts.push("RIZIN");
  if (pancrase.bouts.length > 0 || pancrase.excluded.length > 0) orgsWithBouts.push("パンクラス");
  if (shooto.bouts.length > 0 || shooto.excluded.length > 0) orgsWithBouts.push("修斗");

  return {
    wins: rizin.wins + shooto.wins + pancrase.wins,
    losses: rizin.losses + shooto.losses + pancrase.losses,
    draws: rizin.draws + shooto.draws + pancrase.draws,
    orgsWithBouts,
  };
}
