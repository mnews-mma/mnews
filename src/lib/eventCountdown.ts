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
