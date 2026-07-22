// VSカード共通ロジック(docs/instructions/vs-card-spec.md準拠)。
// Web(MatchupTape等のCSS)とOGP(Satori)の両方から参照する単一ソース。
// レイアウト計算はすべて決定的(JS実行時の計測に依存しない)であること。

// 選手名フォントサイズの決定(spec §4.2)。改行は「・」直後とスペースのみ許可
// (renderWrappableNameのnowrapトークン化と対)という前提で、名前を2行以内に
// 分割したときに最も短くできる「最大行長」(code point数)を求め、その行が
// 最小想定カラム幅(モバイル360px時の名前カラム・勝敗マーク併記時≒105px)に
// 収まるサイズを返す。左右ペアでは呼び出し側がMath.minを取ることで
// 「長い側基準で両方縮小」になる。CSSの自動縮小(clamp/vw)はSatori非対応の
// ため使わず、決定的計算で揃える。
const NAME_LINE_BUDGET_PX = 105;
// nowrap(単語途中で折らない)を強制するトークン長の上限。これを超えるトークンは
// renderWrappableNameがnowrap化せず、通常のCJK折り返し(文字単位で任意の位置に
// 折れる)にフォールバックする。fighterNameSize()もこの挙動に合わせて計算する
// 必要があるため、定数はここ(react非依存のvsMath)に置きrenderWrappableNameが
// import する = 折り返しルールの単一ソース。
export const NOWRAP_TOKEN_MAX_LEN = 10;
// Web幅(/dream・/vsのオンページカード)側の選手名フォントサイズ天井。
// 単一定数で持ち、カード間で天井を必ず共有する(2026-07-20)。
export const CEILING_WEB = 20;
const NAME_SIZE_MIN = 11;

export function fighterNameSize(name: string): number {
  // 折り返し可能な単位: スペース区切り+「・」の直後(・は前の単位末尾に残す)。
  // さらに、NOWRAP_TOKEN_MAX_LENを超えるトークンはrenderWrappableNameがnowrap化
  // しない(=文字単位でどこでも折れる)ため、ここでも1文字ずつの単位に分解する。
  // これを忘れると「区切りの無い長い名前」を折り返し不能とみなして極端に小さい
  // サイズを返し、全カード共通サイズ(GLOBAL_FIGHTER_NAME_SIZE)まで巻き添えで
  // 引き下げてしまう(2026-07-22の11px事故の真因)。
  const units = name
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => w.split(/(?<=・)/))
    .flatMap((u) => ([...u].length > NOWRAP_TOKEN_MAX_LEN ? [...u] : [u]));
  const lens = units.map((u) => [...u].length);
  const total = lens.reduce((a, b) => a + b, 0);
  if (total === 0) return CEILING_WEB;
  // 2行以内に分割する全パターン(分割なし含む)のうち、最大行長が最小のもの
  let maxLine = total;
  let left = 0;
  for (let i = 0; i < lens.length - 1; i++) {
    left += lens[i];
    maxLine = Math.min(maxLine, Math.max(left, total - left));
  }
  return Math.min(CEILING_WEB, Math.max(NAME_SIZE_MIN, Math.floor(NAME_LINE_BUDGET_PX / maxLine)));
}

export interface TugShare {
  shareA: number; // 0.08〜0.92にクランプ済み、小数1位
  shareB: number; // 1 - shareA
  neutral: boolean; // true = 両方0(ゼロ除算)。バーはneutral色1本、基準線非表示
}

const MIN_SHARE = 0.08;
const MAX_SHARE = 0.92;

// 綱引きバーの分割比率(spec §5.1-5.2)。a/bは同じ指標の絶対値(勝率%・
// フィニッシュ率%等)。片方でもnullなら呼び出し側でバー非表示・数値「—」に倒す
// (この関数はその判定をしない=両方数値がある前提)。
export function computeTugShare(a: number, b: number): TugShare {
  if (a === 0 && b === 0) {
    return { shareA: 0.5, shareB: 0.5, neutral: true };
  }
  const raw = a / (a + b);
  const clamped = Math.min(MAX_SHARE, Math.max(MIN_SHARE, raw));
  const shareA = Math.round(clamped * 1000) / 1000;
  return { shareA, shareB: Math.round((1 - shareA) * 1000) / 1000, neutral: false };
}
