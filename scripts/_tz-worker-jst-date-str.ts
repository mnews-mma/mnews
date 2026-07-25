// test-jst-date-str.ts から子プロセスとして呼び出される。TZ環境変数を実際に
// 変えたNodeプロセス内でtoJstDateStr()を評価し、結果だけを1行出力する。
// (親プロセス内でprocess.env.TZを書き換えてもV8のtzキャッシュにより反映が
// 保証されないため、プロセス起動時にTZが確定している別プロセスで検証する)
import { toJstDateStr } from "../src/lib/eventCountdown";

const nowMs = Number(process.argv[2]);
process.stdout.write(toJstDateStr(nowMs));
