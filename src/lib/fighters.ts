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
  },
  {
    slug: "izawa-seika",
    nameJa: "伊澤 星花",
    nameEn: "Seika Izawa",
    org: "one",
    weightClass: "女子アトム級",
    wins: 19,
    losses: 0,
    draws: 0,
    ko: 4,
    sub: 10,
    decision: 5,
    history: [
      { date: "2026-01-18", opponent: "Itsuki Hirata", result: "win", method: "decision", event: "ONE Friday Fights", round: "R3" },
    ],
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
  },
  {
    slug: "horiguchi-kyoji",
    nameJa: "堀口 恭司",
    nameEn: "Kyoji Horiguchi",
    org: "rizin",
    weightClass: "バンタム級",
    wins: 30,
    losses: 5,
    draws: 0,
    ko: 18,
    sub: 6,
    decision: 6,
    history: [
      { date: "2025-12-31", opponent: "Yuki Motoya", result: "win", method: "KO", event: "RIZIN LANDMARK 12", round: "R1" },
    ],
  },
  {
    slug: "hagiwara-kyohei",
    nameJa: "萩原 京平",
    nameEn: "Kyohei Hagiwara",
    org: "rizin",
    weightClass: "フェザー級",
    wins: 18,
    losses: 4,
    draws: 0,
    ko: 10,
    sub: 4,
    decision: 4,
    history: [],
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
  },
  {
    slug: "wakamatsu-yuma",
    nameJa: "若松 佑弥",
    nameEn: "Yuma Wakamatsu",
    org: "ufc",
    weightClass: "フライ級",
    wins: 20,
    losses: 6,
    draws: 0,
    ko: 7,
    sub: 8,
    decision: 5,
    history: [],
  },
  {
    slug: "takeda-koji",
    nameJa: "武田 光司",
    nameEn: "Koji Takeda",
    org: "shooto",
    weightClass: "ライト級",
    wins: 22,
    losses: 5,
    draws: 0,
    ko: 8,
    sub: 9,
    decision: 5,
    history: [],
  },
];

export function getFighter(slug: string): Fighter | undefined {
  return FIGHTERS.find((f) => f.slug === slug);
}
