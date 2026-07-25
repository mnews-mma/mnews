// test-event-date-format.ts から子プロセスとして呼び出される。TZ環境変数を
// 実際に変えたNodeプロセス内でformatEventDateJa/shiftDateStrを評価し、
// 結果だけを1行出力する(親プロセスでのprocess.env.TZ書き換えはV8のtzキャッシュ
// により反映が保証されないため)。
import { formatEventDateJa, shiftDateStr } from "../src/lib/eventCountdown";

const [, , kind, arg1, arg2] = process.argv;

if (kind === "format") {
  process.stdout.write(formatEventDateJa(arg1));
} else if (kind === "shift") {
  process.stdout.write(shiftDateStr(arg1, Number(arg2)));
} else {
  throw new Error(`unknown kind: ${kind}`);
}
