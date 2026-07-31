// ビルドゲート(指示書E・2026-07-31、指示書U・比率化): RIZIN・修斗・パンクラス・
// DEEPの4団体構造化データ(data/{rizin,shooto,pancrase,deep}Records.json)のうち、
// fighterASlug/fighterBSlugがnullのまま残っているbout側(=名前は取得できて
// いるが選手DBのどのslugにも解決できていない)の比率を検知する。
//
// これらのboutは src/lib/mnewsRating/multiOrgRecord.ts の4団体通算集計
// (computeFighterDeepRecord等)からは静かに読み飛ばされ、Wikipedia由来の
// 通算戦績(1行目)との差分として表面化する(実例: 敢流(kanru)のDEEP 2戦、
// 天弥(tenya)のNEO BLOOD!系3戦。out/wiki_vs_multiorg_diff.json参照)。
//
// このスクリプトは自動修正やalias解決を行わない(検出・カウントのみ)。
//
// 絶対件数から比率(unresolved bout側数 ÷ 全bout側数)へ変更した経緯
// (2026-07-31): 絶対件数ベースのBASELINEだと、data/へ大会を追加する
// 正当なPR(新規大会=未登録選手を含むのが通常なのでunresolvedも増える)の
// たびにBASELINE自体を手で引き上げないとビルドが止まる構造だった。
// 実際に同日2回(#302マージ後・#312前)、無関係なPRのマージ順の巡り合わせで
// この理由により本番ビルドが止まった。比率にすれば、データ追加時は分子
// (unresolved)と分母(全bout側数)が連動して増えるため、正常な取り込みでは
// 閾値を超えない。閾値超過は「新規データの選手名解決率が既存データより
// 明らかに悪い」という異常時のみ発生するようになる。
//
// THRESHOLD_RATIOは2026-07-31時点の実測比率に、想定される自然な変動を
// 吸収できる程度の余裕(+2.0ポイント目安)を足した値。数値の根拠は
// PR説明に記載する。
import fs from "fs";
import path from "path";
import { countUnresolvedRizinBoutSides } from "../src/lib/mnewsRating/rizinRecordsAggregate";
import { countUnresolvedShootoBoutSides } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { countUnresolvedPancraseBoutSides } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { countUnresolvedDeepBoutSides } from "../src/lib/mnewsRating/deepRecordsAggregate";
import type { RizinRecordsEvent } from "../src/lib/mnewsRating/rizinScraper";
import type { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";
import type { PancraseRecordsEvent } from "../src/lib/mnewsRating/pancraseRecordsTypes";
import type { DeepRecordsEvent } from "../src/lib/mnewsRating/deepScraper";

const DATA_DIR = path.join(process.cwd(), "data");
function loadJson<T>(file: string): T {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [] as unknown as T;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

// 全bout側数(コーナー単位、bouts.length×2)。unresolvedの分母として使う
// (countUnresolved*BoutSidesと定義を揃えるため、name非空のスロットのみ
// 数えている点も同じにする必要はない。分母は「存在するコーナー数」の
// 単純な総数でよく、name欠落スロットが仮にあっても分子側にも入らないため
// 比率への影響は無視できるほど小さい)。
function countTotalBoutSides(events: Array<{ bouts: unknown[] }>): number {
  let total = 0;
  for (const ev of events) total += ev.bouts.length * 2;
  return total;
}

// 2026-07-31時点の実測比率(unresolved/total)に、正常なデータ追加による
// 自然な変動を吸収する余裕(概ね+2ポイント)を足した閾値。
//   RIZIN:    実測54.9% -> 閾値57.0%
//   修斗:     実測74.7% -> 閾値77.0%
//   パンクラス: 実測87.9% -> 閾値90.0%
//   DEEP:     実測80.7% -> 閾値83.0%
// この値を超えたら「新規追加データの選手名解決率が既存データより明らかに
// 悪い」という異常とみなしビルドを止める。data/へ大会・bout件数を追加した
// だけの正常なPRでは、分子・分母が連動して増えるため通常は超えない。
const THRESHOLD_RATIO = {
  rizin: 0.57,
  shooto: 0.77,
  pancrase: 0.9,
  deep: 0.83,
};

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function main() {
  const rizinEvents = loadJson<RizinRecordsEvent[]>("rizinRecords.json");
  const shootoEvents = loadJson<ShootoRecordsEvent[]>("shootoRecords.json");
  const pancraseEvents = loadJson<PancraseRecordsEvent[]>("pancraseRecords.json");
  const deepEvents = loadJson<DeepRecordsEvent[]>("deepRecords.json");

  const unresolved = {
    rizin: countUnresolvedRizinBoutSides(rizinEvents),
    shooto: countUnresolvedShootoBoutSides(shootoEvents),
    pancrase: countUnresolvedPancraseBoutSides(pancraseEvents),
    deep: countUnresolvedDeepBoutSides(deepEvents),
  };
  const total = {
    rizin: countTotalBoutSides(rizinEvents),
    shooto: countTotalBoutSides(shootoEvents),
    pancrase: countTotalBoutSides(pancraseEvents),
    deep: countTotalBoutSides(deepEvents),
  };

  const ratio = {
    rizin: total.rizin ? unresolved.rizin / total.rizin : 0,
    shooto: total.shooto ? unresolved.shooto / total.shooto : 0,
    pancrase: total.pancrase ? unresolved.pancrase / total.pancrase : 0,
    deep: total.deep ? unresolved.deep / total.deep : 0,
  };

  console.log(
    `[null-slug検査] RIZIN:${unresolved.rizin}/${total.rizin}=${pct(ratio.rizin)}(閾値${pct(THRESHOLD_RATIO.rizin)}) ` +
      `修斗:${unresolved.shooto}/${total.shooto}=${pct(ratio.shooto)}(閾値${pct(THRESHOLD_RATIO.shooto)}) ` +
      `パンクラス:${unresolved.pancrase}/${total.pancrase}=${pct(ratio.pancrase)}(閾値${pct(THRESHOLD_RATIO.pancrase)}) ` +
      `DEEP:${unresolved.deep}/${total.deep}=${pct(ratio.deep)}(閾値${pct(THRESHOLD_RATIO.deep)})`
  );

  const regressed: string[] = [];
  for (const key of Object.keys(THRESHOLD_RATIO) as Array<keyof typeof THRESHOLD_RATIO>) {
    if (ratio[key] > THRESHOLD_RATIO[key]) {
      regressed.push(`${key}: ${pct(ratio[key])} > 閾値${pct(THRESHOLD_RATIO[key])}(${unresolved[key]}/${total[key]})`);
    }
  }

  if (regressed.length) {
    console.error(
      `[null-slug検査] ★slug未解決bout側の比率が閾値を超えています。デプロイをブロックします:\n` +
        `  ${regressed.join("\n  ")}\n` +
        `  対処法: 新規追加データの選手名がfighters.tsのnameJa/nameEn/aliasesと一致するか確認してください。` +
        `別人でなければaliasを追加し、該当団体のbuild-*-records.tsを再実行してdata/を再生成してください。` +
        `data/に大会を追加したPRでは、通常は比率が閾値内に収まるはずです(分子・分母が連動して増えるため)。` +
        `それでも超える場合は、新規追加bout群の選手名解決率が既存データより明らかに悪いということなので、` +
        `個別に原因を確認してください。閾値自体を調整する場合はこのファイルのTHRESHOLD_RATIOとPR説明の根拠を` +
        `更新してください。`
    );
    process.exit(1);
  }

  console.log(`[null-slug検査] OK(いずれの団体も閾値以下)`);
}

main();
