// test-calc-age-jst.ts から子プロセスとして呼び出される。TZ環境変数を
// 実際に変えたNodeプロセス内でcalcAgeJstを評価し、結果だけを1行出力する。
import { calcAgeJst } from "../src/lib/feeds/wikipedia";

const [, , birthYear, birthMonth, birthDay, nowMs] = process.argv;
process.stdout.write(
  String(calcAgeJst(Number(birthYear), Number(birthMonth), Number(birthDay), Number(nowMs)))
);
