import fs from "node:fs";
import path from "node:path";

/**
 * /kick 配下が使う読み出し口。scripts/build-kick-data.ts が生成した
 * data/kick/generated/ を読むだけで、集計は一切しない
 * (12,776boutの集計はビルド前のスクリプトで完了済み)。
 *
 * ページはすべて静的生成されるため、このfsアクセスはビルド時のみ走る。
 * リクエスト時には実行されない。
 */

const GEN = path.join(process.cwd(), "data/kick/generated");

export interface KickIndexEntry {
  slug: string;
  name: string;
  kana: string | null;
  romaji: string | null;
  kanaType: "published_kana" | "converted" | "romaji_only" | "none" | null;
  gym: string | null;
  orgs: string[];
  boutCount: number;
  bucket: string;
}

export interface KickBout {
  date: string | null;
  event: string | null;
  venue: string | null;
  promotion: string;
  opponentName: string;
  opponentAffiliation: string | null;
  /** 一意に解決できた相手のみ。ambiguous・未解決はnull(誤リンクを作らない)。 */
  opponentSlug: string | null;
  opponentAmbiguous: boolean;
  opponentCandidateCount: number;
  result: "win" | "loss" | "draw" | "no_contest" | "cancelled" | "scheduled" | "unknown";
  method: string | null;
  methodRaw: string;
  round: number | null;
  isExtension: boolean;
  ruleset: string | null;
  note: string | null;
  isDebut: boolean;
  sourceUrl: string;
  alsoFrom: string[];
}

export interface KickFighter {
  slug: string;
  name: string;
  kana: string | null;
  romaji: string | null;
  yomiSource: string | null;
  kanaSource: { type: string; url: string } | null;
  aliases: string[];
  gym: string | null;
  orgs: string[];
  sources: string[];
  bouts: KickBout[];
}

export interface KickStats {
  fighters: number;
  fightersWithBouts: number;
  boutRows: number;
  boutRowsRaw: number;
  mergedDuplicateRows: number;
  unmatchedBouts: number;
  kanaFilled: number;
  kanaMissing: number;
  kanaConverted: number;
  promotions: string[];
}

let cached: { stats: KickStats; fighters: KickIndexEntry[] } | null = null;

export function getKickIndex(): { stats: KickStats; fighters: KickIndexEntry[] } {
  if (!cached) cached = JSON.parse(fs.readFileSync(path.join(GEN, "index.json"), "utf8"));
  return cached!;
}

export function getKickFighter(slug: string): KickFighter | null {
  const f = path.join(GEN, "fighters", `${slug}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

/** 掲載団体(戦績の取得元)。/kick の収録範囲表示に使う。 */
export const KICK_PROMOTIONS = [
  { label: "SHOOT BOXING", url: "https://shootboxing.org/" },
  { label: "RISE", url: "https://rise-rc.com/" },
  { label: "KNOCK OUT", url: "https://knockoutkb.com/" },
  { label: "K-1 / Krush / Krush-EX", url: "https://www.k-1.co.jp/" },
];

/** 名簿の取得元(6ソース)。戦績4団体 + Wikipedia男女2一覧。 */
export const KICK_ROSTER_SOURCES = [
  "ja.wikipedia「男子キックボクサー一覧」",
  "ja.wikipedia「女子キックボクサー一覧」",
  "K-1 / Krush / Krush-EX 公式",
  "RISE 公式",
  "SHOOT BOXING 公式",
  "KNOCK OUT 公式",
];

/** 戦績表の「出典」列に出す短縮名。団体名をそのまま出すと列幅に対して長く、
 *  「K-1 / Krush / Krush-EX」がスラッシュ区切りの複数リンクに見えるため。 */
export const PROMOTION_SHORT: Record<string, string> = {
  "SHOOT BOXING": "SB公式",
  RISE: "RISE公式",
  "KNOCK OUT": "KO公式",
  "K-1 / Krush / Krush-EX": "K-1公式",
};

export const RESULT_LABEL: Record<KickBout["result"], string> = {
  win: "勝",
  loss: "敗",
  draw: "分",
  no_contest: "無効",
  cancelled: "中止",
  scheduled: "予定",
  unknown: "不明",
};
