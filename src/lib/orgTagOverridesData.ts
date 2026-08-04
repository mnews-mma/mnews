import fs from "fs";
import path from "path";
import type { OrgTagOverrides } from "./orgTags";

// data/fighterOrgTagOverrides.json の読み出し。orgRankingsData.tsと同型
// (GitHub raw + デプロイ単位キャッシュバスター、取得失敗時はローカルファイルに
// フォールバック)。生成は scripts/build-fighter-org-tag-overrides.ts
// (日次update-org-records.ymlの末尾で実行、リクエスト都度の計算はしない)。
const CACHE_BUSTER = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
const RAW_URL =
  `https://raw.githubusercontent.com/mnews-mma/mnews/main/data/fighterOrgTagOverrides.json?v=${CACHE_BUSTER}`;

export async function fetchOrgTagOverrides(): Promise<OrgTagOverrides> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) return (await res.json()) as OrgTagOverrides;
  } catch {
    /* fall through to local */
  }
  try {
    const local = path.join(process.cwd(), "data", "fighterOrgTagOverrides.json");
    return JSON.parse(fs.readFileSync(local, "utf8")) as OrgTagOverrides;
  } catch {
    return {};
  }
}
