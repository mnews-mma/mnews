import fs from "fs";
import path from "path";
import type { OrgRankingData } from "./orgRankings";

// data/orgRankings.json の読み出し。本番は GitHub raw を取得日つきで参照し、
// cron が更新すれば再デプロイ無しで反映される(revalidate)。取得失敗時や
// プレビュー(未マージ)時はリポジトリ同梱のローカルファイルにフォールバック。
const RAW_URL =
  "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/orgRankings.json";

export interface OrgRankingsFile {
  pancrase?: OrgRankingData;
  shooto?: OrgRankingData;
}

export async function fetchOrgRankings(): Promise<OrgRankingsFile> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) return (await res.json()) as OrgRankingsFile;
  } catch {
    /* fall through to local */
  }
  try {
    const local = path.join(process.cwd(), "data", "orgRankings.json");
    return JSON.parse(fs.readFileSync(local, "utf8")) as OrgRankingsFile;
  } catch {
    return {};
  }
}
