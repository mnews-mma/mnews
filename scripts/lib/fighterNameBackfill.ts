// 選手slugバックフィル(修斗/パンクラス/DEEP・RIZIN共通)の正規化・近似照合ロジック。
// scripts/backfill-shooto-pancrase-slugs.tsから抽出した共通部分(2026-07-31、
// RIZINバックフィル追加時に切り出し)。正規化ルールはここが単一の正。
// 新しい正規化を追加する場合もこのファイルのみを変更する。
import { FIGHTERS } from "../../src/lib/fighters";

// 旧字体・異体字 -> 統一先。読みが同じ別字(斎/斉等)も実データ上サイトウ姓の
// 表記ゆれとして混在しているため統一対象に含める。
const VARIANT_CHAR_MAP: Record<string, string> = {
  "髙": "高",
  "﨑": "崎",
  "齋": "斉",
  "齊": "斉",
  "斎": "斉",
  "濵": "浜",
};
const VARIANT_CHAR_RE = new RegExp(`[${Object.keys(VARIANT_CHAR_MAP).join("")}]`, "g");

// 漢字とカタカナで字形が同じ/酷似する文字の統一(片方をもう片方に寄せる)。
const HOMOGRAPH_CHAR_MAP: Record<string, string> = {
  "ニ": "二",
  "ロ": "口",
  "カ": "力",
  "エ": "工",
  "ト": "卜",
};
const HOMOGRAPH_CHAR_RE = new RegExp(`[${Object.keys(HOMOGRAPH_CHAR_MAP).join("")}]`, "g");

// 引用符・区切り記号の除去対象(装飾ニックネームの囲みや中黒等)。
const QUOTE_SYMBOL_RE = /["'‘’“”〝〞〟・·‧]/g;

export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\s　]/g, "")
    .replace(QUOTE_SYMBOL_RE, "")
    .replace(VARIANT_CHAR_RE, (c) => VARIANT_CHAR_MAP[c])
    .replace(HOMOGRAPH_CHAR_RE, (c) => HOMOGRAPH_CHAR_MAP[c]);
}

// 正規化名 -> slug。複数選手が同名の場合はnull(曖昧・解決しない)を入れる。
export function buildNameIndex(): Map<string, string | null> {
  const index = new Map<string, string | null>();
  const claim = (raw: string, slug: string) => {
    const n = normalize(raw);
    if (!n) return;
    if (index.has(n)) {
      const existing = index.get(n);
      if (existing !== slug) index.set(n, null);
    } else {
      index.set(n, slug);
    }
  };
  for (const f of FIGHTERS) {
    claim(f.nameJa, f.slug);
    (f.aliases ?? []).forEach((a) => claim(a, f.slug));
  }
  return index;
}

// 指示書N(2026-07-31): パンクラス等の生表記に「姓"ニックネーム"名」型の挿入
// (例: 新居"コンバ王子"卓・植村"ジャック"龍介)が多数あり、これらはnormalize()
// (引用符記号の除去のみ・ニックネーム本文はそのまま残る)だけでは
// fighters.tsのnameJa(ニックネーム無し表記)と一致しない。挿入部を丸ごと
// (引用符+中身)除去した版も候補として試す。
// 引用符はカーリー/直線が混在する(例: 西浦"ウィッキー"聡生のように開始と
// 終了で別種の文字が使われるケースが実データに存在する)ため、開始・終了で
// 同一文字である必要はなく、種類を問わず引用符的文字のペアで囲まれた区間を
// 除去する。カギ括弧「」も同種の挿入に使われうるため対象に含める(実データでは
// 未観測だが指示書の指定通り対応する)。丸括弧は対象に含めない
// (fighterAName等の生表記側には出現せず、ジム名は別フィールドfighterAGymに
// 既に分離済みのため、丸括弧を対象にすると別の意味を持つ表記を誤って
// 壊す恐れがある)。
// この関数はsrc/lib/fighters.tsのstripDecorativeNickname()と機能的に同種
// (findFighterSlugByName側は元々この処理を持っていた)。バックフィル
// スクリプト側(このファイル)には無かったため今回追加した。
const QUOTED_INSERT_RE = /["'‘’“”][^"'‘’“”]*["'‘’“”]|「[^」]*」/g;

export function stripQuotedInsert(name: string): string {
  return name.replace(QUOTED_INSERT_RE, "");
}

export function resolveSlug(name: string, index: Map<string, string | null>): string | null {
  const n = normalize(name);
  const direct = n ? (index.get(n) ?? null) : null;

  const stripped = stripQuotedInsert(name);
  if (stripped === name) {
    // 引用符付き挿入が無い(通常ケース)。従来どおり直接一致の結果のみ返す。
    return direct;
  }
  const ns = normalize(stripped);
  const viaStrip = ns ? (index.get(ns) ?? null) : null;

  if (direct && viaStrip) {
    // 除去前後の両方でマッチした場合、同一slugなら採用、別slugなら
    // 曖昧(推測不能)として弾く(指示書N指定の安全策)。
    return direct === viaStrip ? direct : null;
  }
  return direct ?? viaStrip;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j], dp[j - 1]);
      prevDiag = temp;
    }
  }
  return dp[n];
}

export interface CandidateName {
  normName: string;
  displayName: string;
  slug: string;
}

export function buildCandidateList(): CandidateName[] {
  const seen = new Set<string>();
  const out: CandidateName[] = [];
  for (const f of FIGHTERS) {
    const names = [f.nameJa, ...(f.aliases ?? [])];
    for (const raw of names) {
      const norm = normalize(raw);
      if (!norm) continue;
      const key = `${norm}::${f.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ normName: norm, displayName: raw, slug: f.slug });
    }
  }
  return out;
}

export interface NearMiss {
  rawName: string;
  rawNameBoutCount: number;
  candidateName: string;
  candidateSlug: string;
  distance: number;
}

// 未解決の生表記(name -> 出現bout件数)ごとに、全候補名との編集距離を計算し、
// 距離1〜2のものだけを列挙する(距離0=完全一致は既に解決済みのはずなので
// ここには出現しない)。同一人物かどうかの判断はしない(機械的な列挙のみ)。
//
// 距離1については、正規化後の生表記が3文字以下の場合は候補を出さない
// (修我/亮我・圭太郎/金太郎・雅也/力也のような短いリングネーム同士は
// 距離1でもほぼ別人で、一覧のノイズになるため。2026-07-29追加)。
export function findNearMisses(unresolved: Map<string, number>, candidates: CandidateName[]): NearMiss[] {
  const out: NearMiss[] = [];
  for (const [rawName, count] of unresolved) {
    const norm = normalize(rawName);
    if (!norm) continue;
    for (const cand of candidates) {
      // 明らかに文字数差が大きい候補は距離2を超えるため計算を省略する(高速化)。
      if (Math.abs(cand.normName.length - norm.length) > 2) continue;
      const dist = levenshtein(norm, cand.normName);
      if (dist === 1 && norm.length <= 3) continue;
      if (dist === 1 || dist === 2) {
        out.push({ rawName, rawNameBoutCount: count, candidateName: cand.displayName, candidateSlug: cand.slug, distance: dist });
      }
    }
  }
  return out;
}
