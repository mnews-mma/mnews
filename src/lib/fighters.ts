import { SourceKey } from "./sources";

export interface FightRecord {
  date: string;
  opponent: string;
  result: "win" | "loss" | "draw";
  method: string;
  event: string;
  round: string;
}

export interface Fighter {
  slug: string;
  nameJa: string;
  nameEn: string;
  org: SourceKey;
  weightClass: string;
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  decision: number;
  history: FightRecord[];
  // English Wikipedia article title with a "{{MMA record start}}" table.
  // Only set when one is known to exist; omitted fighters keep seed data.
  wikiTitleEn?: string;
  // jp.ufc.com/athlete/<slug> — UFC所属選手のみ。ニックネームをWikipediaより
  // 優先してUFC公式プロフィールから取得するために使う。
  ufcSlug?: string;
}

// Seed data. Per mnews-spec.md this is normally synced from the Wikipedia API.
export const FIGHTERS: Fighter[] = [
  {
    slug: "taira-tatsuro",
    nameJa: "平良 達郎",
    nameEn: "Tatsuro Taira",
    org: "ufc",
    weightClass: "フライ級",
    wins: 18,
    losses: 1,
    draws: 0,
    ko: 3,
    sub: 14,
    decision: 1,
    history: [
      { date: "2026-02-01", opponent: "Joshua Van", result: "win", method: "submission (rear-naked choke)", event: "UFC 327", round: "R3" },
      { date: "2025-09-13", opponent: "Carlos Hernandez", result: "win", method: "decision", event: "UFC 319", round: "R3" },
      { date: "2025-04-12", opponent: "Brandon Royval", result: "win", method: "decision", event: "UFC 314", round: "R5" },
    ],
    wikiTitleEn: "Tatsuro Taira",
    ufcSlug: "tatsuro-taira",
  },
  {
    slug: "nakamura-rinya",
    nameJa: "中村 倫也",
    nameEn: "Rinya Nakamura",
    org: "ufc",
    weightClass: "バンタム級",
    wins: 10,
    losses: 1,
    draws: 0,
    ko: 2,
    sub: 6,
    decision: 2,
    history: [
      { date: "2025-12-07", opponent: "Cody Gibson", result: "win", method: "submission", event: "UFC Fight Night", round: "R2" },
    ],
    wikiTitleEn: "Rinya Nakamura",
    ufcSlug: "rinya-nakamura",
  },
  {
    slug: "horiguchi-kyoji",
    nameJa: "堀口 恭司",
    nameEn: "Kyoji Horiguchi",
    org: "ufc",
    weightClass: "フライ級",
    wins: 30,
    losses: 5,
    draws: 0,
    ko: 18,
    sub: 6,
    decision: 6,
    history: [
      { date: "2025-12-31", opponent: "Yuki Motoya", result: "win", method: "KO", event: "RIZIN LANDMARK 12", round: "R1" },
    ],
    wikiTitleEn: "Kyoji Horiguchi",
    ufcSlug: "kyoji-horiguchi",
  },
  {
    slug: "asakura-kai",
    nameJa: "朝倉 海",
    nameEn: "Kai Asakura",
    org: "ufc",
    weightClass: "バンタム級",
    wins: 18,
    losses: 4,
    draws: 0,
    ko: 0,
    sub: 0,
    decision: 0,
    history: [],
    wikiTitleEn: "Kai Asakura",
    ufcSlug: "kai-asakura",
  },
  {
    slug: "hiramoto-ren",
    nameJa: "平本 蓮",
    nameEn: "Ren Hiramoto",
    org: "rizin",
    weightClass: "フェザー級",
    wins: 14,
    losses: 4,
    draws: 0,
    ko: 7,
    sub: 3,
    decision: 4,
    history: [],
    wikiTitleEn: "Ren Hiramoto",
  },
  {
    slug: "asakura-mikuru",
    nameJa: "朝倉 未来",
    nameEn: "Mikuru Asakura",
    org: "rizin",
    weightClass: "フェザー級",
    wins: 19,
    losses: 5,
    draws: 0,
    ko: 0,
    sub: 0,
    decision: 0,
    history: [],
    wikiTitleEn: "Mikuru Asakura",
  },
  {
    slug: "koike-kleber",
    nameJa: "クレベル コイケ エルベスト",
    nameEn: "Kleber Koike Erbst",
    org: "rizin",
    weightClass: "フェザー級",
    wins: 30,
    losses: 9,
    draws: 0,
    ko: 0,
    sub: 0,
    decision: 0,
    history: [],
    wikiTitleEn: "Kleber Koike Erbst",
  },
  {
    slug: "akimoto-kyoma",
    nameJa: "秋元 強真",
    nameEn: "Kyoma Akimoto",
    org: "rizin",
    weightClass: "フェザー級",
    wins: 12,
    losses: 1,
    draws: 0,
    ko: 7,
    sub: 2,
    decision: 3,
    history: [],
    // 英語版Wikipediaに記事がまだ無いため戦績はシードデータのまま。
  },
];

export function getFighter(slug: string): Fighter | undefined {
  return FIGHTERS.find((f) => f.slug === slug);
}

export interface FighterRates {
  winRate: number | null; // 勝率（%） wins / (wins+losses+draws)
  finishRate: number | null; // フィニッシュ率（%） (KO+一本) / wins
}

export function calcFighterRates(f: Pick<Fighter, "wins" | "losses" | "draws" | "ko" | "sub">): FighterRates {
  const total = f.wins + f.losses + f.draws;
  const winRate = total > 0 ? Math.round((f.wins / total) * 100) : null;
  const finishRate = f.wins > 0 ? Math.round(((f.ko + f.sub) / f.wins) * 100) : null;
  return { winRate, finishRate };
}
