// 定期実行(GitHub Actions)でパンクラス/修斗の公式ランキングを取得・パースし、
// data/orgRankings.json に取得日つきで保存する。序列は団体公式の値をそのまま転載。
// 失敗時は前回値を保持(取得失敗で一覧が空になる事故を防ぐ)。既存の選手データは
// 一切書き換えない(このJSONだけを更新する = 既存公開選手 不可侵)。
//
// 管理画面(投稿ドラフト タブ②)の差分検知用に、上書き直前のmain値を
// data/orgRankings-prev.json へ退避する。取得失敗/構造崩壊で前回値保持に
// なったorgはprevも触らない(退避も上書きもしない=誤った差分を作らない)。
// DEEPは静的スナップショット(champions.ts)なので、値が変わった時だけ退避する。
//
// 実行: npx tsx scripts/update-org-rankings.ts
import fs from "fs";
import path from "path";
import { parsePancrase, parseShooto, OrgRankingData } from "../src/lib/orgRankings";
import { deepRankingData } from "../src/lib/champions";

const OUT = path.join(process.cwd(), "data", "orgRankings.json");
const OUT_PREV = path.join(process.cwd(), "data", "orgRankings-prev.json");
const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0)";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface OrgRankingsFile {
  pancrase?: OrgRankingData;
  shooto?: OrgRankingData;
  deep?: OrgRankingData;
}

// 既存JSONの読み込み。破損している場合でも{}にフォールバックして続行する
// (JSON.parse失敗をそのまま投げるとmain()がクラッシュし、次回実行時も同じ
// 破損ファイルを読んで再クラッシュし続ける自己修復不能ループになるため)。
function loadJsonFile<T>(file: string): T | Record<string, never> {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.warn(`[WARN] ${file} の読み込みに失敗(JSON破損の疑い)。前回値なしとして続行: ${e}`);
    return {};
  }
}

async function main() {
  const prev: OrgRankingsFile = loadJsonFile(OUT);
  const prevSnapshot: OrgRankingsFile = loadJsonFile(OUT_PREV);

  const [panHtml, shoHtml] = await Promise.all([
    fetchHtml("https://www.pancrase.co.jp/rls/ranking.html"),
    fetchHtml("https://www.shooto-mma.com/ranking/"),
  ]);

  const pan = panHtml ? parsePancrase(panHtml) : null;
  const sho = shoHtml ? parseShooto(shoHtml) : null;
  const deep = deepRankingData(); // 静的スナップショット(手動レビュー・毎回同じ値のことが多い)

  // 取得成功かつ「前回比で階級数が大きく減っていない」時だけ差し替える。
  // 空/取得失敗はもちろん、サイト構造変化でパーサーが一部階級しか拾えなくなった
  // (部分崩壊)ケースも同じ扱いにする。閾値は前回の半分未満を「疑わしい」とする。
  const ok = (d: OrgRankingData | null, prevData?: OrgRankingData) => {
    if (!d || d.classes.length === 0) return false;
    const prevCount = prevData?.classes.length ?? 0;
    if (prevCount > 0 && d.classes.length < prevCount / 2) return false;
    return true;
  };
  const panOk = ok(pan, prev.pancrase);
  const shoOk = ok(sho, prev.shooto);

  const out: OrgRankingsFile = {
    pancrase: panOk ? pan! : prev.pancrase,
    shooto: shoOk ? sho! : prev.shooto,
    deep,
  };

  const fails: string[] = [];
  if (!panOk) {
    fails.push("pancrase(前回値保持)");
    if (pan) console.warn(`[WARN] pancrase構造変化の疑い: 取得${pan.classes.length}区分 / 前回${prev.pancrase?.classes.length ?? 0}区分`);
  }
  if (!shoOk) {
    fails.push("shooto(前回値保持)");
    if (sho) console.warn(`[WARN] shooto構造変化の疑い: 取得${sho.classes.length}区分 / 前回${prev.shooto?.classes.length ?? 0}区分`);
  }

  // 差分検知(管理画面タブ②)用のprevスナップショット。今回「実際に新しい値へ
  // 差し替えた」org分だけ、直前のmain値をprevへ退避する。前回値保持のままの
  // orgはprevも変更しない(退避も上書きもしない=誤った差分を作らない)。
  // DEEPは値が変わった時だけ退避する(毎回同じ静的値なら無意味な退避をしない)。
  const nextPrevSnapshot: OrgRankingsFile = { ...prevSnapshot };
  if (panOk) nextPrevSnapshot.pancrase = prev.pancrase;
  if (shoOk) nextPrevSnapshot.shooto = prev.shooto;
  if (JSON.stringify(prev.deep) !== JSON.stringify(deep)) nextPrevSnapshot.deep = prev.deep;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  fs.writeFileSync(OUT_PREV, JSON.stringify(nextPrevSnapshot, null, 2) + "\n");

  const sum = (d?: OrgRankingData) =>
    d ? `${d.classes.length}区分/${d.classes.reduce((s, c) => s + c.entries.length, 0)}人(${d.rankingLabel})` : "なし";
  console.log(`pancrase: ${sum(out.pancrase)}  shooto: ${sum(out.shooto)}  deep: ${sum(out.deep)}`);
  if (fails.length) console.log("取得失敗:", fails.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
