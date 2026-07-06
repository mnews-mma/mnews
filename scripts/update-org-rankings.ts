// 定期実行(GitHub Actions)でパンクラス/修斗の公式ランキングを取得・パースし、
// data/orgRankings.json に取得日つきで保存する。序列は団体公式の値をそのまま転載。
// 失敗時は前回値を保持(取得失敗で一覧が空になる事故を防ぐ)。既存の選手データは
// 一切書き換えない(このJSONだけを更新する = 既存公開選手 不可侵)。
//
// 実行: npx tsx scripts/update-org-rankings.ts
import fs from "fs";
import path from "path";
import { parsePancrase, parseShooto, OrgRankingData } from "../src/lib/orgRankings";

const OUT = path.join(process.cwd(), "data", "orgRankings.json");
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

async function main() {
  const prev: { pancrase?: OrgRankingData; shooto?: OrgRankingData } = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, "utf8"))
    : {};

  const [panHtml, shoHtml] = await Promise.all([
    fetchHtml("https://www.pancrase.co.jp/rls/ranking.html"),
    fetchHtml("https://www.shooto-mma.com/ranking/"),
  ]);

  // 取得成功かつ中身が空でない時だけ差し替え。失敗/空は前回値を保持。
  const ok = (d: OrgRankingData | null) => d && d.classes.length > 0;
  const pan = panHtml ? parsePancrase(panHtml) : null;
  const sho = shoHtml ? parseShooto(shoHtml) : null;

  const out = {
    pancrase: ok(pan) ? pan! : prev.pancrase,
    shooto: ok(sho) ? sho! : prev.shooto,
  };

  const fails: string[] = [];
  if (!ok(pan)) fails.push("pancrase(前回値保持)");
  if (!ok(sho)) fails.push("shooto(前回値保持)");

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  const sum = (d?: OrgRankingData) =>
    d ? `${d.classes.length}区分/${d.classes.reduce((s, c) => s + c.entries.length, 0)}人(${d.rankingLabel})` : "なし";
  console.log(`pancrase: ${sum(out.pancrase)}  shooto: ${sum(out.shooto)}`);
  if (fails.length) console.log("取得失敗:", fails.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
