// 指示書②-b: undetermined 4件の確定処理(トラックA、②-bの残件処理)。
// ②-bがローカルキャッシュしたHTMLを人間が目視で読み、判定根拠を明示した上で確定する
// (4件とも「第N試合」構造ではない未知のレイアウトのため、②の自動パーサ(BOUT_RE)を
// 拡張して再現することはしない=新しいパーサを追加しない、指示書の制約に従う)。
// 名前の突合は必ず findFighterSlugByName(fighters.ts、無改変)のみを使う。
//
// 実行: npx tsx scripts/resolve-loose-ends-track-a.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, findFighterSlugByName } from "../src/lib/fighters";

const OUT_DIR = path.join(process.cwd(), "out");
const ORIGINAL_PARTICIPANTS_CSV = path.join(
  "/Users/kainakishiyoshi/Desktop/mnews/.claude/worktrees/deep-event-roster-contamination-check/out/deep-event-participants.csv"
);

function findSlugIncludingHidden(name: string): string | null {
  const saved = FIGHTERS.map((f) => f.hidden);
  try {
    for (const f of FIGHTERS) f.hidden = false;
    return findFighterSlugByName(name);
  } finally {
    FIGHTERS.forEach((f, i) => {
      f.hidden = saved[i];
    });
  }
}
type Status = "listed" | "hidden" | "missing";
function classify(nameRaw: string): { slug: string; status: Status } {
  const listedSlug = findFighterSlugByName(nameRaw);
  if (listedSlug) return { slug: listedSlug, status: "listed" };
  const hiddenSlug = findSlugIncludingHidden(nameRaw);
  if (hiddenSlug) return { slug: hiddenSlug, status: "hidden" };
  return { slug: "", status: "missing" };
}

// ============================================================
// A1/A2: 4件の判定結果(②-bキャッシュのHTMLを人間が目視で確認した根拠付き)
// ============================================================
interface Resolution {
  eventId: string;
  eventName: string;
  eventDate: string;
  url: string;
  reasonUndetermined: string;
  headerBoutCount: number;
  resolvedBoutCount: number;
  excerpt: string;
  determination: "result" | "partial_result" | "card_only" | "undetermined";
  determinationReason: string;
  inWindow: boolean;
  rosterImpact: string;
}
const RESOLUTIONS: Resolution[] = [
  {
    eventId:
      "%e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025",
    eventName: "DEEPフューチャーキングトーナメント2025",
    eventDate: "2026-04-19",
    url: "https://www.deep2001.com/%e3%80%90%e9%81%b8%e6%89%8b%e5%8b%9f%e9%9b%86%e3%80%91deep%e3%83%95%e3%83%a5%e3%83%bc%e3%83%81%e3%83%a3%e3%83%bc%e3%82%ad%e3%83%b3%e3%82%b0%e3%83%88%e3%83%bc%e3%83%8a%e3%83%a1%e3%83%b3%e3%83%882025/",
    reasonUndetermined: "「第N試合」見出しが本文に一切無い(header_bout_count=0)。ページ全体が16名トーナメント方式の大会概要で、通常のDEEP IMPACT系ページとは別レイアウト。",
    headerBoutCount: 0,
    resolvedBoutCount: 6,
    excerpt:
      "【決勝戦試合結果】フライ級決勝|〇須田雄律（SCORPION GYM）|●遠藤一心（鹿島道場）|1R 2分04秒 腕十字 … " +
      "(以下バンタム級・フェザー級・ライト級・ウェルター級・ミドル級の各決勝が同形式で続く。計6階級6試合)",
    determination: "partial_result",
    determinationReason:
      "6階級の決勝戦(計6試合・12名)は勝敗記号(〇/●)付きで明確に確定できる。ただし準決勝以前(16名×6階級の" +
      "トーナメント本戦)は「出場予定選手」名簿のみで個々の対戦結果が本文に記載されておらず、それらは判定不能。" +
      "決勝分のみ確定済みの結果として採用し、準決勝以前は対象外とする(捏造しない)。",
    inWindow: true,
    rosterImpact: "決勝進出12名(6勝6敗)を採用。準決勝以前の出場者は本文から追跡不能のため追加しない。",
  },
  {
    eventId: "deep-nagoya-impact-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88",
    eventName: "DEEP NAGOYA IMPACT 2023 公武堂ファイト 3rd ROUND/4th ROUND",
    eventDate: "2023-08-06",
    url: "https://www.deep2001.com/deep-nagoya-impact-2023-%e5%85%ac%e6%ad%a6%e5%a0%82%e3%83%95%e3%82%a1%e3%82%a4%e3%83%88/",
    reasonUndetermined:
      "②の日付抽出(正規表現「YYYY年M月D日」、間に空白なし)が失敗。本文の実際の表記は" +
      "「2023 年 8 月 6 日」のように数字と漢字の間に半角スペースが入る旧フォーマットで、正規表現が一致しなかった。" +
      "同じ理由で「第N試合」見出しも無く(旧フォーマットは「▼階級」または階級名のみを区切りに使う)、header_bout_count=0。",
    headerBoutCount: 0,
    resolvedBoutCount: 0,
    excerpt:
      "DEEP NAGOYA IMPACT 2023 公武堂ファイト 3rd ROUND/4th ROUND試合結果 | 2023 年 8 月 6 日(日) ホテルプラザ勝川 … " +
      "【3rd ROUND 試合結果】DEEPバンタム級5分2R|〇小崎蓮(リバーサルジム久喜)VS ×切嶋龍輝(マーシャルアーツクラブ中津川)|2ROUND 3：27 TKO",
    determination: "partial_result",
    determinationReason:
      "本文を目視すると実際には試合結果(勝敗記号〇/×付き)が記載されている。ただし本大会の開催日は" +
      "2023年8月6日であり、対象期間(直近12ヶ月=2025-07-25以降)の**大幅に対象期間外**。" +
      "②のeventDate抽出失敗により誤って対象期間内候補(40件)に混入していたバグであり、汚染の一種と言える" +
      "(②-bの汚染定義はheld_state=unheldのみを対象にしていたため捕捉できなかった漏れ)。",
    inWindow: false,
    rosterImpact: "対象期間外(2023年開催)のため名簿には追加しない。",
  },
  {
    eventId: "deep-osaka-impact-2023-2nd-round",
    eventName: "DEEP OSAKA IMPACT 2023 2nd ROUND",
    eventDate: "2023-07-30",
    url: "https://www.deep2001.com/deep-osaka-impact-2023-2nd-round/",
    reasonUndetermined: "上記と同じ理由(旧フォーマット、日付表記に半角スペース、header_bout_count=0)。",
    headerBoutCount: 0,
    resolvedBoutCount: 0,
    excerpt:
      "DEEP OSAKA IMPACT 2023 2nd ROUND試合結果 | 2023 年 7 月 30 日 （日 ) 錦秀会 住吉区民センター大ホール … " +
      "▼フライ級5分3R|○松場 貴志（パラエストラ加古川）|×松岡 ハヤト（NEX）|2R 3’00 KO(RNC)",
    determination: "partial_result",
    determinationReason:
      "本文に試合結果は記載されているが、開催日は2023年7月30日で対象期間の大幅に外。上記と同じ理由で" +
      "②の対象期間内候補への混入バグ。",
    inWindow: false,
    rosterImpact: "対象期間外(2023年開催)のため名簿には追加しない。",
  },
  {
    eventId: "deep-x-nariagari",
    eventName: "DEEP X NARIAGARI",
    eventDate: "2023-07-23",
    url: "https://www.deep2001.com/deep-x-nariagari/",
    reasonUndetermined: "本文に「第N試合」見出しが無い。",
    headerBoutCount: 0,
    resolvedBoutCount: 0,
    excerpt:
      "DEEP VS NARIAGARI試合結果 | 2023 年 7 月 23 日(日) ニューピアホール | (見出し直後は画像のみで、" +
      "試合結果はテキストとして本文に含まれていない。結果は画像内にのみ存在すると見られる)",
    determination: "undetermined",
    determinationReason:
      "試合結果がテキストとして本文に存在しない(画像のみ)。画像の内容は読み取れないため、勝敗を機械的にも" +
      "目視でも確定できない。推測で埋めない。加えて開催日は2023年7月23日で対象期間の大幅に外。",
    inWindow: false,
    rosterImpact: "判定不能かつ対象期間外のため、いずれにせよ名簿には追加しない。",
  },
];

interface Finalist {
  weightClass: string;
  name: string;
  gym: string;
  result: "win" | "loss";
  opponent: string;
  method: string;
}
const TOURNAMENT_FINALISTS: Finalist[] = [
  { weightClass: "フライ級", name: "須田雄律", gym: "SCORPION GYM", result: "win", opponent: "遠藤一心", method: "1R 2分04秒 腕十字" },
  { weightClass: "フライ級", name: "遠藤一心", gym: "鹿島道場", result: "loss", opponent: "須田雄律", method: "1R 2分04秒 腕十字" },
  { weightClass: "バンタム級", name: "今井風快", gym: "TRIBE TOKYO MMA", result: "win", opponent: "ケン モーリス", method: "判定2-1" },
  { weightClass: "バンタム級", name: "ケン モーリス", gym: "BLOWS", result: "loss", opponent: "今井風快", method: "判定2-1" },
  { weightClass: "フェザー級", name: "鈴木 覇", gym: "Fight Holic", result: "win", opponent: "青井 佑", method: "1R 3分18秒 腕十字" },
  { weightClass: "フェザー級", name: "青井 佑", gym: "寒天ファイトスピリット", result: "loss", opponent: "鈴木 覇", method: "1R 3分18秒 腕十字" },
  { weightClass: "ライト級", name: "大澤伸明", gym: "BLOWS", result: "win", opponent: "権藤悠太郎", method: "判定3-0" },
  { weightClass: "ライト級", name: "権藤悠太郎", gym: "NEX SPORTS", result: "loss", opponent: "大澤伸明", method: "判定3-0" },
  { weightClass: "ウェルター級", name: "窪田大羅", gym: "evermove", result: "win", opponent: "羽江哲郎", method: "判定2-1" },
  { weightClass: "ウェルター級", name: "羽江哲郎", gym: "CAVE", result: "loss", opponent: "窪田大羅", method: "判定2-1" },
  { weightClass: "ミドル級", name: "足立光弘", gym: "THE BLACKBELT JAPAN", result: "win", opponent: "早川豊司", method: "1R 1分18秒 TKO" },
  { weightClass: "ミドル級", name: "早川豊司", gym: "マーシャルアーツ中津川", result: "loss", opponent: "足立光弘", method: "1R 1分18秒 TKO" },
];

// 最小限のCSV行パーサ(ダブルクォート内のカンマ・エスケープされた""に対応)。
// 元CSV(②由来)はgym_raw等にカンマを含む値(例: 「リバーサルジム新宿ME,WE」)が実在するため、
// 素朴なsplit(",")では列がずれる。読み込み側でも書き込み側(csvEscape)と対称なパースにする。
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cols.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cols.push(cur);
  return cols;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function writeCsv(filename: string, headers: string[], rows: Record<string, string>[]): void {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h] ?? "")).join(","));
  fs.writeFileSync(path.join(OUT_DIR, filename), lines.join("\n") + "\n");
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ---- undetermined-resolution.csv ----
  writeCsv(
    "undetermined-resolution.csv",
    [
      "event_id",
      "event_name",
      "event_date",
      "url",
      "reason_undetermined",
      "header_bout_count",
      "resolved_bout_count",
      "excerpt",
      "determination",
      "determination_reason",
      "in_window",
      "roster_impact",
    ],
    RESOLUTIONS.map((r) => ({
      event_id: r.eventId,
      event_name: r.eventName,
      event_date: r.eventDate,
      url: r.url,
      reason_undetermined: r.reasonUndetermined,
      header_bout_count: String(r.headerBoutCount),
      resolved_bout_count: String(r.resolvedBoutCount),
      excerpt: r.excerpt,
      determination: r.determination,
      determination_reason: r.determinationReason,
      in_window: String(r.inWindow),
      roster_impact: r.rosterImpact,
    }))
  );

  // ---- A3: 名簿への影響再集計 ----
  const originalCsv = fs.readFileSync(ORIGINAL_PARTICIPANTS_CSV, "utf-8");
  const originalLines = originalCsv.trim().split("\n");
  const header = originalLines[0];
  const originalRows = originalLines.slice(1);

  // 元CSVのname_normalizedを集める(4列目=event_date,...,9列目=name_normalized。ヘッダーから列位置を動的に取る)
  const headerCols = header.split(",");
  const nameNormIdx = headerCols.indexOf("name_normalized");
  const existingNormNames = new Set(
    originalRows.map((line) => {
      // 簡易CSVパース(name_raw等にカンマが含まれる行は無いことを確認済み。含まれる場合は別途手当てが必要)
      const cols = parseCsvLine(line);
      return cols[nameNormIdx];
    })
  );

  const newParticipantRows: Record<string, string>[] = [];
  const addedNamesSummary: { name: string; slug: string; status: Status }[] = [];
  const eventIdForTournament = RESOLUTIONS[0].eventId;
  for (const f of TOURNAMENT_FINALISTS) {
    const { slug, status } = classify(f.name);
    const nameNorm = f.name.normalize("NFKC").replace(/[\s　]/g, "");
    newParticipantRows.push({
      event_id: eventIdForTournament,
      brand: "other",
      event_date: RESOLUTIONS[0].eventDate,
      bout_index: "1",
      side: f.result === "win" ? "A" : "B",
      result: f.result,
      name_raw: f.name,
      gym_raw: f.gym,
      name_normalized: nameNorm,
      weight_class_raw: `${f.weightClass}決勝`,
      source_url: RESOLUTIONS[0].url,
      fetched_at: "2026-07-25",
      mnews_slug: slug,
      status,
      match_confidence: slug ? "exact" : "none",
      name_confidence: "clean",
    });
    if (!existingNormNames.has(nameNorm)) {
      addedNamesSummary.push({ name: f.name, slug, status });
    }
  }

  // 重複を除いた「新規追加される名前」(重複判定はname_normalizedベース、①②と同じ方式)
  const uniqueAddedNames = [...new Map(addedNamesSummary.map((a) => [a.name.normalize("NFKC").replace(/[\s　]/g, ""), a])).values()];

  writeCsv(
    "deep-event-participants-updated.csv",
    [
      "event_id",
      "brand",
      "event_date",
      "bout_index",
      "side",
      "result",
      "name_raw",
      "gym_raw",
      "name_normalized",
      "weight_class_raw",
      "source_url",
      "fetched_at",
      "mnews_slug",
      "status",
      "match_confidence",
      "name_confidence",
    ],
    [
      ...originalRows.map((line) => {
        const cols = parseCsvLine(line);
        const obj: Record<string, string> = {};
        headerCols.forEach((h, i) => (obj[h] = cols[i] ?? ""));
        return obj;
      }),
      ...newParticipantRows,
    ]
  );

  // 再集計
  const allRows = [
    ...originalRows.map((line) => parseCsvLine(line)),
    ...newParticipantRows.map((r) =>
      [
        r.event_id,
        r.brand,
        r.event_date,
        r.bout_index,
        r.side,
        r.result,
        r.name_raw,
        r.gym_raw,
        r.name_normalized,
        r.weight_class_raw,
        r.source_url,
        r.fetched_at,
        r.mnews_slug,
        r.status,
        r.match_confidence,
        r.name_confidence,
      ]
    ),
  ];
  const statusIdx = headerCols.indexOf("status");
  const byName = new Map<string, string>();
  for (const cols of allRows) {
    byName.set(cols[nameNormIdx], cols[statusIdx]);
  }
  const newUniqueCount = byName.size;
  const newStatusCounts = { listed: 0, hidden: 0, missing: 0 };
  for (const s of byName.values()) newStatusCounts[s as Status]++;

  // ---- report ----
  const md: string[] = [];
  md.push("# loose-ends-report: ②-b残件処理(指示書②-c トラックA)");
  md.push("");
  md.push(`生成日時(JST): 2026-07-25`);
  md.push("");
  md.push("## A. undetermined 4件の判定結果");
  md.push("");
  for (const r of RESOLUTIONS) {
    md.push(`### ${r.eventName}(${r.eventDate}, ${r.inWindow ? "対象期間内" : "対象期間外"})`);
    md.push("");
    md.push(`- 判定: **${r.determination}**`);
    md.push(`- 根拠: ${r.determinationReason}`);
    md.push(`- 名簿への影響: ${r.rosterImpact}`);
    md.push("");
  }
  md.push("## B. 481 → " + newUniqueCount);
  md.push("");
  md.push("| | ② | ②-c後 |");
  md.push("|---|---|---|");
  md.push(`| ユニーク選手数 | 481 | ${newUniqueCount} |`);
  md.push(`| listed | 64 | ${newStatusCounts.listed} |`);
  md.push(`| hidden | 4 | ${newStatusCounts.hidden} |`);
  md.push(`| missing | 413 | ${newStatusCounts.missing} |`);
  md.push("");
  md.push(`新規追加された選手(${uniqueAddedNames.length}名、DEEPフューチャーキングトーナメント2025決勝進出者):`);
  md.push("");
  md.push("| name | mnews_slug | status |");
  md.push("|---|---|---|");
  for (const a of uniqueAddedNames) md.push(`| ${a.name} | ${a.slug || "(なし)"} | ${a.status} |`);
  md.push("");
  md.push(
    `増加数${newUniqueCount - 481}名は停止条件(20名以上)を${newUniqueCount - 481 >= 20 ? "超過" : "超過しない"}。`
  );
  md.push("");

  fs.writeFileSync(path.join(OUT_DIR, "loose-ends-report-track-a.md"), md.join("\n") + "\n");

  console.log(`Track A完了: ユニーク481→${newUniqueCount}(listed=${newStatusCounts.listed} hidden=${newStatusCounts.hidden} missing=${newStatusCounts.missing}) / 新規追加${uniqueAddedNames.length}名`);
}

main();
