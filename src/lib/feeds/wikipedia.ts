import { FightRecord } from "../fighters";

const FETCH_TIMEOUT_MS = 8000;
const REVALIDATE_SECONDS = 86400; // Wikipedia data changes slowly; refresh daily

async function fetchWikitext(lang: "en" | "ja", title: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
      title
    )}&prop=wikitext&format=json&formatversion=2`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MNewsBot/1.0 (https://www.mnews.jp; contact: mnews-mma)" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.parse?.wikitext ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cleanWikiMarkup(s: string): string {
  return s
    .replace(/\{\{small\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{small\|?\}\}/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/^align=center\|/i, "")
    .trim();
}

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function parseDtsDate(raw: string): string {
  // {{dts|2026|May|9}} or {{dts|2026|5|9}}
  const piped = raw.match(/\{\{dts\|(\d{4})\|([A-Za-z0-9]+)\|(\d{1,2})/i);
  if (piped) {
    const [, y, monRaw, d] = piped;
    const mon = /^\d+$/.test(monRaw) ? monRaw.padStart(2, "0") : MONTHS[monRaw.toLowerCase()] ?? "01";
    return `${y}-${mon}-${d.padStart(2, "0")}`;
  }
  // {{dts|2023.12.31}} (year.month.day in a single field)
  const dotted = raw.match(/\{\{dts\|(\d{4})\.(\d{1,2})\.(\d{1,2})/i);
  if (dotted) {
    const [, y, mon, d] = dotted;
    return `${y}-${mon.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function rowResult(field: string): "win" | "loss" | "draw" | null {
  const f = field.toLowerCase();
  if (f.includes("win")) return "win";
  if (f.includes("loss")) return "loss";
  if (f.includes("draw")) return "draw";
  return null; // e.g. NC (no contest) — not representable, skip
}

export function parseMmaRecordTable(wikitext: string): FightRecord[] {
  const startIdx = wikitext.search(/\{\{MMA record start\}\}/i);
  if (startIdx === -1) return [];
  const after = wikitext.slice(startIdx);
  const endMarkerIdx = after.search(/\{\{(MMA record end|end)\}\}/i);
  // Also stop at the next section heading (e.g. "==Kickboxing record==") in
  // case the explicit end marker is missing, so unrelated tables never leak in.
  const headingIdx = after.slice(1).search(/\n==[^=]/);
  const cutoffs = [endMarkerIdx, headingIdx === -1 ? -1 : headingIdx + 1].filter((i) => i !== -1);
  const region = cutoffs.length > 0 ? after.slice(0, Math.min(...cutoffs)) : after;

  const rowBlocks = region.split(/\n\|-/).slice(1); // first chunk is the start marker itself
  const records: FightRecord[] = [];

  for (const block of rowBlocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && !l.startsWith("|}"))
      .map((l) => l.replace(/^\|/, "").trim());

    if (lines.length < 6) continue;

    const result = rowResult(lines[0]);
    if (!result) continue;

    const opponent = cleanWikiMarkup(lines[2]);
    const method = cleanWikiMarkup(lines[3]);
    const event = cleanWikiMarkup(lines[4]);
    const date = parseDtsDate(lines[5]);
    const round = lines[6] ? cleanWikiMarkup(lines[6].replace(/^align=center\|/i, "")) : "";

    if (!opponent || !date) continue;

    records.push({
      date,
      opponent,
      result,
      method: method || "—",
      event: event || "—",
      round: round ? `R${round}` : "—",
    });
  }

  return records;
}

export interface WikiInfobox {
  nickname?: string;
  birthPlace?: string;
  age?: number;
}

function extractField(wikitext: string, field: string): string | null {
  // [ \t]* (not \s*) between "=" and the capture group: \s also matches
  // newlines, so a blank field (e.g. "| other_names     = \n| image ...")
  // would otherwise skip straight past the empty value onto the next line.
  const m = wikitext.match(new RegExp(`\\|[ \\t]*${field}[ \\t]*=[ \\t]*([^\\n]*)`, "i"));
  if (!m) return null;
  const value = cleanWikiMarkup(m[1]);
  return value || null;
}

function parseBirthDate(raw: string): { iso: string; age: number } | null {
  const templateMatch = raw.match(/\{\{birth date and age\|([^}]*)\}\}/i);
  if (!templateMatch) return null;
  // パラメータには "df=yes" のような名前付き引数が混じることがあるので、
  // "=" を含まない純粋な数値トークンの最初の3つを年・月・日とみなす。
  const numericParts = templateMatch[1]
    .split("|")
    .map((p) => p.trim())
    .filter((p) => /^\d{1,4}$/.test(p));
  if (numericParts.length < 3) return null;
  const [y, mo, d] = numericParts;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const birth = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() >= birth.getUTCDate());
  if (!hasHadBirthdayThisYear) age--;
  return { iso: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, age };
}

export function parseInfobox(wikitext: string): WikiInfobox {
  const result: WikiInfobox = {};

  const nicknameRaw = extractField(wikitext, "other_names");
  if (nicknameRaw) {
    // 通称が複数ある場合、"(former)" が付いた旧称は除外して最初の現役通称を使う
    // （例 "The Supernova (former), The Typhoon" → "The Typhoon"）。
    const firstCurrent = nicknameRaw
      .split(",")
      .map((s) => s.trim())
      .find((s) => s && !/\(former\)/i.test(s));
    if (firstCurrent) result.nickname = firstCurrent;
  }

  const birthPlaceRaw = extractField(wikitext, "birth_place");
  if (birthPlaceRaw) result.birthPlace = birthPlaceRaw;

  // weight_class は記事によって現在の階級が先頭とは限らず順序が信頼できない
  // ため取得しない（階級は手動管理データの方を表示に使う）。

  const birthDateRaw = wikitext.match(/\|[ \t]*birth_date[ \t]*=[ \t]*([^\n]*)/i)?.[1];
  if (birthDateRaw) {
    const parsed = parseBirthDate(birthDateRaw);
    if (parsed) result.age = parsed.age;
  }

  return result;
}

export interface WikiFighterData {
  history: FightRecord[];
  wins: number;
  losses: number;
  draws: number;
  ko: number;
  sub: number;
  decision: number;
  infobox: WikiInfobox;
}

function tally(history: FightRecord[]): Omit<WikiFighterData, "history" | "infobox"> {
  const wins = history.filter((h) => h.result === "win");
  const classify = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes("submission")) return "sub";
    if (m.includes("ko") || m.includes("tko")) return "ko";
    if (m.includes("decision")) return "decision";
    return "other";
  };
  const breakdown = wins.reduce(
    (acc, h) => {
      const c = classify(h.method);
      if (c !== "other") acc[c]++;
      return acc;
    },
    { ko: 0, sub: 0, decision: 0 }
  );
  return {
    wins: wins.length,
    losses: history.filter((h) => h.result === "loss").length,
    draws: history.filter((h) => h.result === "draw").length,
    ...breakdown,
  };
}

export async function fetchWikiFighterRecord(enTitle: string): Promise<WikiFighterData | null> {
  const wikitext = await fetchWikitext("en", enTitle);
  if (!wikitext) return null;
  const history = parseMmaRecordTable(wikitext);
  if (history.length === 0) return null;
  // Wikipedia tables list most recent fight first; keep that order for display.
  return { history, ...tally(history), infobox: parseInfobox(wikitext) };
}
