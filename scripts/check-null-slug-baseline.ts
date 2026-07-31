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

// 2026-07-31実測値(指示書I: backfill-shooto-pancrase-slugs.tsを#301の
// alias追加後に再実行した結果を反映。RIZINは対象外=backfill-rizin-slugs.ts
// 側の管轄で今回は未実行のため据え置き)。org別に個別のベースラインを持つ
// (合計だけだと、ある団体の悪化を別団体の改善が相殺して隠す恐れがあるため)。
//
// deepのみ3670→3808に再修正(PR #297作業時に判明): PR #294(DEEP取りこぼし
// 17大会+疑い6大会の取り込み)がこのゲート追加(0bec1be)より前に分岐された
// ブランチのままrebase無しでマージされ、再パースで新規に捕捉されたbout(以前は
// パース失敗でそもそもdata/に入っていなかった)に伴うslug未解決分+138が
// ベースライン比較から漏れていた。増分の内訳を旧deepRecords.json(コミット
// 0bec1be時点)と現在とで大会単位に突合し、増加した15大会(DEEP HAMAMATSU
// IMPACT 2023/2024・DEEP 81/94/92/100 IMPACT・DEEP JEWELS 22/43/19・DEEP
// TOKYO IMPACT 2025 1st/3rd/4th ROUND・DEEP＆PANCRASE大阪大会・DEEP NAGOYA
// IMPACT 2022公武堂ファイト/2026 2nd ROUND)が全てPR #294の対象23大会に
// 含まれること、data/deepRecords.json自体がPR #294マージ後は他コミットで
// 変更されていないことを確認済み(詳細はPR #294のout/deep-parse-failure-fix-
// report.md参照)。無関係な大会からの混入は無い。
const BASELINE = {
  rizin: 1103,
  shooto: 2921,
  pancrase: 8497,
  deep: 3808,
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
        `別人でなければaliasを追加し、該当団体のbuild-*-records.tsを再実行してdata/を再生成してください。\n` +
        `  注意: data/{rizin,shooto,pancrase,deep}Records.jsonに新規大会を追加するPRでは、` +
        `再パースで新たに捕捉されたbout分だけ未解決件数が自然に増えることがあります。` +
        `増分が追加大会由来だと確認できたら、このPRの中でBASELINEも実測値に更新してください` +
        `(古いbranchから分岐したままrebase無しでマージすると、このゲート追加後の他PRの` +
        `増分に気づけず後から一括で発覚します)。`
    );
    process.exit(1);
  }

  console.log(`[null-slug検査] OK(いずれの団体もベースライン以下)`);
}

main();
