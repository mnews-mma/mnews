// デプロイ後ウォームアップ: ISRは受動的(アクセスが来て初めて再生成)なため、
// 低トラフィックのハブルート(/rankings)はデプロイ後最初の訪問者が再生成
// トリガーを引く役回りになり、その一人が古い/生成待ちの版を踏みうる。
// 本番エイリアスが新デプロイに切り替わった直後にここでGETを先行させ、
// 実ユーザーには常に再生成済みの版を出す(任意の運用改善・必須ではない)。
//
// 対象階級はPUBLISHED_DIVISIONS(唯一の真実源)から導出する。階級リストを
// ここでハードコードしない = 公開/非公開が変わってもウォーム対象が自動追従。
import { PUBLISHED_DIVISIONS, DIVISION_SLUG } from "../src/lib/mnewsRating/divisions";

const BASE_URL = process.env.WARM_BASE_URL ?? "https://www.mnews.jp";
const TIMEOUT_MS = 10_000;

const paths = ["/", "/rankings", ...PUBLISHED_DIVISIONS.map((d) => `/rankings/${DIVISION_SLUG[d]}`)];

async function warmOne(path: string): Promise<void> {
  const url = `${BASE_URL}${path}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      // 本体は破棄。ステータスとVercelのデプロイ識別ヘッダのみログする。
      console.log(`[warm] ${res.status} ${url} (x-vercel-id=${res.headers.get("x-vercel-id") ?? "-"})`);
      return;
    } catch (err) {
      console.warn(`[warm] attempt ${attempt} failed for ${url}: ${(err as Error).message}`);
      if (attempt === 2) return; // best-effort: 失敗してもプロセス全体は失敗させない
    }
  }
}

async function main() {
  console.log(`[warm] warming ${paths.length} routes on ${BASE_URL}`);
  for (const path of paths) {
    await warmOne(path);
  }
}

main();
