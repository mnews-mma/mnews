// 大会開催までの「残り日数」を算出する唯一の実装(single source of truth)。
//
// バグの背景: 以前は表示箇所ごとに new Date() + setHours(0,0,0,0) で日数を
// 計算しており、これは実行環境のタイムゾーン(Vercelのサーバーは UTC、詳細
// ページは静的ビルドのため build 時の UTC 0:00 基準)で「今日の0:00」を取って
// いた。JST 0:00〜9:00 の時間帯は UTC ではまだ前日のため、この帯だけ残り日数が
// +1 ずれていた(トップのライブ帯=JST基準=正 と食い違う)。
//
// 対策: 「今」も「開催日」も Asia/Tokyo(UTC+9 固定・DSTなし)の 0:00 に正規化
// してから差分を取る。実行環境のローカルタイムゾーンには一切依存せず、UTC 演算
// のみで算出するため、サーバー(UTC)・クライアント(任意のtz)いずれで実行しても
// 同じ値になる。開場/開始時刻は残り日数の計算に使わない(暦日の差のみ)。

const JST_OFFSET_MS = 9 * 3600_000;

// 指定時刻(既定=現在)が属する JST 暦日の 0:00 を UTC エポックms で返す。
export function startOfTodayJstMs(nowMs: number = Date.now()): number {
  const jst = new Date(nowMs + JST_OFFSET_MS);
  return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - JST_OFFSET_MS;
}

// 純粋な差分計算。呼び出し側が確定させた JST 0:00(startOfTodayJstMs)を渡す。
// SSR/ISR で時刻を固定したいライブ帯(page.tsx→computeLiveBand)が使う。
export function daysUntilEventJstFromMidnight(dateStr: string, todayJstMs: number): number {
  const eventMs = Date.parse(`${dateStr}T00:00:00+09:00`);
  return Math.round((eventMs - todayJstMs) / 86400000);
}

// 開催日(YYYY-MM-DD)までの残り日数。0=本日開催 / 1=明日 / 負数=開催済み。
// nowMs を渡せる形にしてあるのはテストで固定時刻を注入するため。
export function daysUntilEventJst(dateStr: string, nowMs: number = Date.now()): number {
  return daysUntilEventJstFromMidnight(dateStr, startOfTodayJstMs(nowMs));
}

// 指定時刻(既定=現在)が属する JST 暦日を "YYYY-MM-DD" で返す表示用ヘルパー。
// 残り日数計算(daysUntilEventJst等)とは責務が別(こちらは「更新日」「本日か」
// 表示・比較用のJST日付ラベル生成)。用途例: updatedAt(UTC ISO)をJST基準の
// 「最終更新日」表示に揃える、sitemapのlastModifiedをJST基準にする、等。
// nowMs には Date.parse(iso) の結果を渡せば任意のUTCタイムスタンプもJST日付
// 文字列に変換できる。startOfTodayJstMs()と同じ+9h固定オフセット正規化を
// 再利用しており、二重実装しない。
export function toJstDateStr(nowMs: number = Date.now()): string {
  const jstMidnightMs = startOfTodayJstMs(nowMs);
  return new Date(jstMidnightMs + JST_OFFSET_MS).toISOString().slice(0, 10);
}

const DAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

// 大会日文字列("YYYY-MM-DD")を「◯年◯月◯日（曜）」に整形する表示用ヘルパー。
// 大会日はJSTの暦日そのもの(時刻成分を持たない値)を正としているため、
// 「今」は一切関与しない(toJstDateStr/daysUntilEventJstとは別の関心事:
// あちらは時刻からJST暦日を導出、こちらは既知の暦日文字列を表示用に整形する
// だけ)。訪問者の実行環境tz(ブラウザのローカルtz等)に一切依存させないため、
// new Date(dateStr)のローカルgetter(getFullYear/getMonth/getDate/getDay)は
// 使わない — date-onlyの文字列はUTC 0時としてパースされる仕様があるため、
// ローカルgetterで読むとJSTより西のtzで日付・曜日が1日ズレるfootgunがある
// (監査#7)。文字列を直接split→Date.UTC()経由の曜日算出のみに限定することで
// tz非依存を保証する。
export function formatEventDateJa(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = DAY_JA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${dow}）`;
}

// 大会日文字列("YYYY-MM-DD")から deltaDays 日ずらした暦日文字列を返す
// (deltaDays=-1で前日)。純粋なカレンダー日算術のみ(時刻成分・タイムゾーンの
// 概念が一切登場しない)ため、"今"や"JST"のオフセットには依存しない。
// 監査#4: 従来は`+09:00`でJST anchorした後にローカルgetter(getDate/setDate)
// で加減算し、最後にtoISOString()(UTC)で出力していたため、anchorの効果が
// 最後のUTC変換で打ち消され、実行環境tzに関わらず常に1日多くズレていた。
export function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const shiftedMs = Date.UTC(y, m - 1, d) + deltaDays * 86400000;
  const shifted = new Date(shiftedMs);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}
