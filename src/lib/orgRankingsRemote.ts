import type { OrgRankingsFile } from "./orgRankingsData";

// Edge ランタイム(OG画像生成)向けの、リモート取得のみのランキング読み出し。
// orgRankingsData.ts は fs フォールバックを持つため edge にバンドルできない。
// ここは fetch のみ(型は import type で erase され fs 依存を持ち込まない)。
const RAW_URL =
  "https://raw.githubusercontent.com/mnews-mma/mnews/main/data/orgRankings.json";

export async function fetchOrgRankingsRemote(): Promise<OrgRankingsFile> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) return (await res.json()) as OrgRankingsFile;
  } catch {
    /* ignore */
  }
  return {};
}
