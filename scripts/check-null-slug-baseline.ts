// ビルドゲート(指示書E・2026-07-31): RIZIN・修斗・パンクラス・DEEPの4団体
// 構造化データ(data/{rizin,shooto,pancrase,deep}Records.json)のうち、
// fighterASlug/fighterBSlugがnullのまま残っているbout側(=名前は取得できて
// いるが選手DBのどのslugにも解決できていない)の総数を検知する。
//
// これらのboutは src/lib/mnewsRating/multiOrgRecord.ts の4団体通算集計
// (computeFighterDeepRecord等)からは静かに読み飛ばされ、Wikipedia由来の
// 通算戦績(1行目)との差分として表面化する(実例: 敢流(kanru)のDEEP 2戦、
// 天弥(tenya)のNEO BLOOD!系3戦。out/wiki_vs_multiorg_diff.json参照)。
//
// このスクリプトは自動修正やalias解決を行わない(検出・カウントのみ)。
// BASELINEは2026-07-31時点の実測値。今後の新規データ投入でこの値を超えたら
// ビルドを止め、増分の調査を促す。減った場合(alias追加+DEEP用バックフィル
// スクリプトの新設等で解消が進んだ場合)は、対応するPRでBASELINEを
// 実測値まで引き下げること(改善を固定化するため)。
//
// 実行: npx tsx scripts/check-null-slug-baseline.ts
import fs from "fs";
import path from "path";
import { countUnresolvedRizinBoutSides } from "../src/lib/mnewsRating/rizinRecordsAggregate";
import { countUnresolvedShootoBoutSides } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { countUnresolvedPancraseBoutSides } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { countUnresolvedDeepBoutSides } from "../src/lib/mnewsRating/deepRecordsAggregate";

const DATA_DIR = path.join(process.cwd(), "data");
function loadJson<T>(file: string): T {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [] as unknown as T;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

// 2026-07-31実測値(このPR時点)。org別に個別のベースラインを持つ
// (合計だけだと、ある団体の悪化を別団体の改善が相殺して隠す恐れがあるため)。
const BASELINE = {
  rizin: 1103,
  shooto: 2921,
  pancrase: 8500,
  deep: 3671,
};

function main() {
  const rizin = countUnresolvedRizinBoutSides(loadJson("rizinRecords.json"));
  const shooto = countUnresolvedShootoBoutSides(loadJson("shootoRecords.json"));
  const pancrase = countUnresolvedPancraseBoutSides(loadJson("pancraseRecords.json"));
  const deep = countUnresolvedDeepBoutSides(loadJson("deepRecords.json"));

  const current = { rizin, shooto, pancrase, deep };
  const total = rizin + shooto + pancrase + deep;
  const baselineTotal = BASELINE.rizin + BASELINE.shooto + BASELINE.pancrase + BASELINE.deep;

  console.log(
    `[null-slug検査] RIZIN:${rizin}(baseline${BASELINE.rizin}) 修斗:${shooto}(baseline${BASELINE.shooto}) ` +
      `パンクラス:${pancrase}(baseline${BASELINE.pancrase}) DEEP:${deep}(baseline${BASELINE.deep}) 合計:${total}(baseline${baselineTotal})`
  );

  const regressed: string[] = [];
  for (const key of Object.keys(BASELINE) as Array<keyof typeof BASELINE>) {
    if (current[key] > BASELINE[key]) {
      regressed.push(`${key}: ${BASELINE[key]} → ${current[key]}(+${current[key] - BASELINE[key]})`);
    }
  }

  if (regressed.length) {
    console.error(
      `[null-slug検査] ★slug未解決bout側がベースラインを超えて増加しています。デプロイをブロックします:\n` +
        `  ${regressed.join("\n  ")}\n` +
        `  対処法: 新規追加データの選手名がfighters.tsのnameJa/nameEn/aliasesと一致するか確認してください。` +
        `別人でなければaliasを追加し、該当団体のbuild-*-records.tsを再実行してdata/を再生成してください。`
    );
    process.exit(1);
  }

  console.log(`[null-slug検査] OK(いずれの団体もベースライン以下)`);
}

main();
