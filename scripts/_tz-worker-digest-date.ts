// test-digest-date.ts から子プロセスとして呼び出される。TZ環境変数を
// 実際に変えたNodeプロセス内で「昨日(JST)」の式(x-preview/page.tsx・
// DigestPicker.tsx両方が使う式)を評価し、結果だけを1行出力する。
import { toJstDateStr, shiftDateStr } from "../src/lib/eventCountdown";

const nowMs = Number(process.argv[2]);
process.stdout.write(shiftDateStr(toJstDateStr(nowMs), -1));
