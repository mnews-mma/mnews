// #247(修斗59名)/#248(パンクラス35名)のout/成果物(parse_reports.pyで作った中間JSON)を
// fighters.ts に投入する候補データへ変換する。読み取り専用スクリプト(fighters.tsへの
// 書き込みは行わない。生成結果をJSON+レポートに出力し、人間が確認したうえで
// fighters.ts へのTSスニペット挿入は別途手動で行う)。
import { readFileSync, writeFileSync } from "fs";
import { FIGHTERS } from "../../src/lib/fighters";
import { WEIGHT_KG } from "../../src/lib/weightClasses";
import { tallyMethods } from "../../src/lib/methodClassify";

interface RawBout {
  date: string;
  event: string;
  opponent: string;
  result: "win" | "loss" | "draw" | "nc" | null;
  method: string;
  weightLabel?: string;
  round?: string;
  time?: string;
  resultRaw?: string;
}

interface RawFighter {
  nameJa: string;
  kind: string;
  existingSlug: string;
  shootoId?: number;
  romaji?: string;
  weightLabel?: string;
  urls?: string[];
  bouts: RawBout[];
}

interface RawData {
  shooto: RawFighter[];
  pancrase: RawFighter[];
}

const raw: RawData = JSON.parse(readFileSync("/tmp/ri94.json", "utf8"));

function normNameForMatch(s: string): string {
  return s.replace(/[\s　]/g, "");
}

// ---------- パンクラス bouts: 決着方法生データ(例 "1R 1:01、TKO/グラウンドのパンチ") ----------
// round/time/method に分解する。分解できない場合は method 全体をそのまま残す
// (推定で埋めない)。
function splitPancraseMethod(raw: string): { round?: string; time?: string; method: string } {
  const m = raw.match(/^(\d+R)\s+(\d+:\d+)、(.*)$/);
  if (m) return { round: m[1], time: m[2], method: m[3] };
  return { method: raw };
}

// ---------- 名鑑ローマ字 → slug候補 ----------
interface SlugResult {
  slug: string;
  nameEn: string;
  confidence: "romaji_shooto" | "url_token_pancrase_unsegmented" | "latin_literal" | "unconfirmed_placeholder";
  note: string;
}

function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

function slugFromShootoRomaji(romaji: string): SlugResult | null {
  const tokens = romaji.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (tokens.length === 1) {
    return {
      slug: clean(tokens[0]),
      nameEn: titleCase(tokens[0]),
      confidence: "romaji_shooto",
      note: `単一語表記(リングネーム/モノニム扱い): "${romaji}"`,
    };
  }
  if (tokens.length === 2) {
    // shootoテーブルの表記順は "Given Family"(西洋式)。既存DBは family-given の
    // ハイフン区切りが規約(例 taira-tatsuro ← "Tatsuro Taira")なので反転する。
    // nameEnは元の Given Family 順のまま(既存DBのnameEn表記と同じ順序)。
    const [given, family] = tokens;
    return {
      slug: `${clean(family)}-${clean(given)}`,
      nameEn: `${titleCase(given)} ${titleCase(family)}`,
      confidence: "romaji_shooto",
      note: `2語表記(Given Family): "${romaji}" → family-given`,
    };
  }
  // 3語以上: 最終語=姓、それ以外=名として結合(例 "JONG JUN PARK" → park-jongjun)。
  const family = tokens[tokens.length - 1];
  const given = tokens.slice(0, -1).join("");
  return {
    slug: `${clean(family)}-${clean(given)}`,
    nameEn: tokens.map(titleCase).join(" "),
    confidence: "romaji_shooto",
    note: `3語以上表記(姓名構造が非典型の可能性。人間確認推奨): "${romaji}" → family-given`,
  };
}

function slugFromPancraseUrl(url: string): SlugResult {
  const base = url.split("/").pop()!.replace(/\.html?$/i, "");
  const token = base.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    slug: token,
    nameEn: titleCase(token),
    confidence: "url_token_pancrase_unsegmented",
    note: `パンクラス名鑑URL由来(語境界未確定・ハイフン未挿入。姓名の切れ目・nameEnとも人間確認が必要): ${url}`,
  };
}

// 修斗ローマ字が完全に空だった5名の個別判断(捏造しない: 読みが一意に確定しない
// 漢字名は placeholder のまま人間判断に回す。ラテン文字表記済み/カタカナ音写が
// 機械的に明確なものだけ最善推定を出す)。
const ZERO_ROMAJI_OVERRIDES: Record<number, SlugResult> = {
  1875: { slug: "unconfirmed-shooto-1875", nameEn: "Unconfirmed", confidence: "unconfirmed_placeholder", note: "砂辺光久: 読み(スナベ/イソベ等)が一意に確定できずローマ字表記も無し。slug/nameEnともplaceholder。" },
  1849: { slug: "unconfirmed-shooto-1849", nameEn: "Unconfirmed", confidence: "unconfirmed_placeholder", note: "沙門: 読み(シャモン/サモン等)が一意に確定できずローマ字表記も無し。slug/nameEnともplaceholder。" },
  1911: { slug: "henry", nameEn: "Henry", confidence: "latin_literal", note: "HENRY: nameJa自体が既にラテン文字表記。" },
  1680: { slug: "nakajima-riku", nameEn: "Riku Nakajima", confidence: "unconfirmed_placeholder", note: "中島陸: 一般的な読み(Nakajima Riku)からの最善推定。ローマ字表記での確認はできていない。" },
  1919: { slug: "valenzuela-victor", nameEn: "Victor Valenzuela", confidence: "unconfirmed_placeholder", note: "ヴィクター バレンズエラ: カタカナ音写(Victor Valenzuela)からの最善推定。ローマ字表記での確認はできていない。" },
};

// ---------- 階級ラベル正規化 ----------
const CANON_LABELS = new Set(Object.keys(WEIGHT_KG));
function normalizeWeightLabel(raw: string | undefined, isFemale: boolean): string | null {
  if (!raw) return null;
  let s = raw
    .replace(/&#9315;/g, "")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "")
    .replace(/^.*[｛{](?=\S*級)/, "") // "①ネオブラッドトーナメント｛フライ級" のようなトーナメント名プレフィックスを除去
    .replace(/\s*\[.*?\]\s*/g, "") // 修斗の "[ -52.2 Kg ]" 体重区間表記を除去
    .replace(/[A-Z]$/, "") // 修斗の階級ラベル末尾 A/B(ブロック分け)を除去
    .replace(/\s*\d+回戦\s*/g, "")
    .trim();
  if (!s || s === "(欠損)") return null;
  if (s.startsWith("女子")) return CANON_LABELS.has(s) ? s : null;
  // 女子選手は「フライ級」等の生ラベルが男子と同じ字面でも「女子フライ級」を優先する
  // (両方ともCANON_LABELSに実在するため、先に男子ラベルへマッチさせてしまうバグを防ぐ)。
  if (isFemale) {
    const withFemale = `女子${s}`;
    if (CANON_LABELS.has(withFemale)) return withFemale;
  }
  if (CANON_LABELS.has(s)) return s;
  return null; // 未知ラベル(トライアウト/アマチュア修斗/グラップリング等)は判定不能→null
}

// ---------- 修斗名鑑 全1898名(必達60名に限らない全件)からのローマ字補完 ----------
// パンクラス側にはローマ字列を持つ列が無い(URLトークンのみ)ため、対象者が
// 修斗名鑑にも(必達対象外でも)掲載されていればそちらのローマ字を優先して使う。
// out/shooto-fighters.csv自体はcsvモジュールでパース済みのJSON
// (/tmp/ri94_shooto_fulldir.json、parse_reports.py側で生成)を読むだけで
// 再取得は発生しない。
const shootoFullDirRomajiRaw: Record<string, string> = JSON.parse(
  readFileSync("/tmp/ri94_shooto_fulldir.json", "utf8")
);
const shootoFullDirRomaji = new Map<string, string>(
  Object.entries(shootoFullDirRomajiRaw).map(([k, v]) => [normNameForMatch(k), v])
);

// ---------- pancrase fighter category(性別) ----------
const pancraseFightersCsv = readFileSync("out/pancrase-fighters.csv", "utf8").split("\n").slice(1);
const pancraseCategoryByHref = new Map<string, string>();
for (const line of pancraseFightersCsv) {
  const cols = line.split(",");
  if (cols.length < 3) continue;
  pancraseCategoryByHref.set(cols[2], cols[0]);
}

// ==================== 突合 ====================
const shootoMissing = raw.shooto.filter((f) => f.kind === "missing");
const pancraseMissing = raw.pancrase.filter((f) => f.kind === "missing");

const EXCLUDED: { nameJa: string; reason: string }[] = [];

interface MergedFighter {
  nameJa: string;
  orgs: ("shooto" | "pancrase")[];
  shootoId?: number;
  pancraseUrls: string[];
  bouts: (RawBout & { org: "shooto" | "pancrase" })[];
  isFemale: boolean;
}

const merged = new Map<string, MergedFighter>();

for (const f of shootoMissing) {
  if (f.shootoId === 830) {
    // エルナニ ペルペトゥオ: bout 0件(#247報告書に既知の限界事項として記載済み)。
    EXCLUDED.push({ nameJa: f.nameJa, reason: "修斗アーカイブ上でbout 0件(選手紹介ページの最終戦績日付が/result/一覧の網羅期間より古く、該当試合が現行228件一覧に存在しない。抽出漏れではなくサイト側の大会一覧そのものの欠落。#247報告書 既知の制限事項6を参照)。" });
    continue;
  }
  const key = normNameForMatch(f.nameJa);
  const m: MergedFighter = merged.get(key) ?? { nameJa: f.nameJa, orgs: [], pancraseUrls: [], bouts: [], isFemale: false };
  m.orgs.push("shooto");
  m.shootoId = f.shootoId;
  for (const b of f.bouts) m.bouts.push({ ...b, org: "shooto" });
  if ((f.weightLabel ?? "").includes("女子")) m.isFemale = true;
  merged.set(key, m);
}

for (const f of pancraseMissing) {
  const key = normNameForMatch(f.nameJa);
  const m: MergedFighter = merged.get(key) ?? { nameJa: f.nameJa, orgs: [], pancraseUrls: [], bouts: [], isFemale: false };
  m.orgs.push("pancrase");
  m.pancraseUrls = f.urls ?? [];
  for (const b of f.bouts) m.bouts.push({ ...b, org: "pancrase" });
  const href = (f.urls ?? [])[0]?.split("/").pop();
  if (href && pancraseCategoryByHref.get(href) === "female") m.isFemale = true;
  merged.set(key, m);
}

// ==================== 生成 ====================
interface GeneratedFighter {
  nameJa: string;
  orgs: string[];
  primaryOrg: string;
  slug: string;
  nameEn: string;
  slugConfidence: string;
  slugNote: string;
  weightClass: string | null;
  wins: number;
  losses: number;
  draws: number;
  ncCount: number;
  unresolvedCount: number;
  ko: number;
  sub: number;
  decision: number;
  history: { date: string; opponent: string; result: string; method: string; event: string; round: string; org: string }[];
  excludedBouts: { date: string; event: string; opponent: string; reason: string; org: string }[];
  existingCollision: boolean;
}

const results: GeneratedFighter[] = [];

for (const [, m] of merged) {
  m.bouts.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  // --- slug/nameEn: 優先順位 ---
  // 1) 必達60名内の修斗ローマ字(個別読み不確定の5名はZERO_ROMAJI_OVERRIDES)
  // 2) 修斗名鑑全1898名からの逆引き(パンクラス専属者が修斗名鑑にも掲載されている場合)
  // 3) パンクラス名鑑URLトークン(語境界未確定のraw値。人間確認前提)
  let slugRes: SlugResult;
  const shootoSrc = shootoMissing.find((f) => normNameForMatch(f.nameJa) === normNameForMatch(m.nameJa));
  const fullDirRomaji = shootoFullDirRomaji.get(normNameForMatch(m.nameJa));
  if (shootoSrc?.shootoId && ZERO_ROMAJI_OVERRIDES[shootoSrc.shootoId]) {
    slugRes = ZERO_ROMAJI_OVERRIDES[shootoSrc.shootoId];
  } else if (shootoSrc?.romaji) {
    slugRes = slugFromShootoRomaji(shootoSrc.romaji) ?? slugFromPancraseUrl(m.pancraseUrls[0] ?? "");
  } else if (fullDirRomaji) {
    slugRes = slugFromShootoRomaji(fullDirRomaji) ?? slugFromPancraseUrl(m.pancraseUrls[0] ?? "");
    slugRes = { ...slugRes, note: `${slugRes.note}(必達対象外・修斗名鑑全件からの逆引き)` };
  } else if (m.pancraseUrls.length > 0) {
    slugRes = slugFromPancraseUrl(m.pancraseUrls[0]);
  } else {
    slugRes = { slug: "unconfirmed-noromaji", nameEn: "Unconfirmed", confidence: "unconfirmed_placeholder", note: "ローマ字/URL手がかりなし" };
  }

  // --- weightClass: 直近bout(全org横断で日付最新)のweightLabelから ---
  let weightClass: string | null = null;
  for (let i = m.bouts.length - 1; i >= 0; i--) {
    const wc = normalizeWeightLabel(m.bouts[i].weightLabel, m.isFemale);
    if (wc) { weightClass = wc; break; }
  }

  // --- history: win/loss/draw/nc のみ採用。unresolved/no_markerは除外し記録 ---
  const history: GeneratedFighter["history"] = [];
  const excludedBouts: GeneratedFighter["excludedBouts"] = [];
  for (const b of m.bouts) {
    if (b.result === "win" || b.result === "loss" || b.result === "draw" || b.result === "nc") {
      // 既存fighters.tsの慣例(1500件超で統一): round フィールドに "R{n} {m:ss}" の
      // 形式でラウンド+タイムを結合して1本の文字列として格納する(別建てのtimeは使わない)。
      let round = "";
      let method = b.method;
      if (b.org === "shooto") {
        const r = (b.round ?? "").trim();
        const t = (b.time ?? "").trim();
        round = r && t ? `R${r} ${t}` : r ? `R${r}` : "";
      } else if (b.org === "pancrase" && b.resultRaw !== undefined) {
        const sp = splitPancraseMethod(b.method);
        method = sp.method;
        round = sp.round && sp.time ? `${sp.round.replace(/^(\d+)R$/, "R$1")} ${sp.time}` : "";
      }
      history.push({ date: b.date, opponent: b.opponent, result: b.result, method, event: b.event, round, org: b.org });
    } else {
      excludedBouts.push({ date: b.date, event: b.event, opponent: b.opponent, org: b.org, reason: b.result === null ? "未解決/マーカーなし(元報告書で判定不能と記載)" : "unknown" });
    }
  }

  const wins = history.filter((h) => h.result === "win").length;
  const losses = history.filter((h) => h.result === "loss").length;
  const draws = history.filter((h) => h.result === "draw").length;
  const ncCount = history.filter((h) => h.result === "nc").length;
  const methodCounts = tallyMethods(history.filter((h) => h.result === "win").map((h) => ({ result: h.result, method: h.method })));

  const existingCollision = FIGHTERS.some((f) => normNameForMatch(f.nameJa) === normNameForMatch(m.nameJa));

  results.push({
    nameJa: m.nameJa,
    orgs: m.orgs,
    primaryOrg: m.bouts[m.bouts.length - 1]?.org ?? m.orgs[0],
    slug: slugRes.slug,
    nameEn: slugRes.nameEn,
    slugConfidence: slugRes.confidence,
    slugNote: slugRes.note,
    weightClass,
    wins,
    losses,
    draws,
    ncCount,
    unresolvedCount: excludedBouts.length,
    ko: methodCounts.ko,
    sub: methodCounts.sub,
    decision: methodCounts.decision,
    history,
    excludedBouts,
    existingCollision,
  });
}

// ==================== slug衝突検出(投入対象内 + 既存FIGHTERS) ====================
const slugOwners = new Map<string, string[]>();
for (const r of results) {
  if (!slugOwners.has(r.slug)) slugOwners.set(r.slug, []);
  slugOwners.get(r.slug)!.push(r.nameJa);
}
const existingSlugs = new Set(FIGHTERS.map((f) => f.slug));
const slugCollisions: { slug: string; names: string[]; collidesWithExisting: boolean }[] = [];
for (const [slug, names] of slugOwners) {
  const collidesWithExisting = existingSlugs.has(slug);
  if (names.length > 1 || collidesWithExisting) {
    slugCollisions.push({ slug, names, collidesWithExisting });
  }
}

writeFileSync(
  "/tmp/ri94_generated.json",
  JSON.stringify({ results, excluded: EXCLUDED, slugCollisions }, null, 1)
);

console.log(`生成: ${results.length}名`);
console.log(`除外: ${EXCLUDED.length}名`);
console.log(`slug衝突: ${slugCollisions.length}件`);
console.log(`階級null: ${results.filter((r) => r.weightClass === null).length}名`);
console.log(`既存collision: ${results.filter((r) => r.existingCollision).length}件`);
