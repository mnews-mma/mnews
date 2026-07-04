// data/*.json をGitHubリポジトリに直接コミットするための最小クライアント。
// 冪等性フラグ（投稿済みイベント一覧）等、Vercelの関数呼び出し間で永続化
// したい小さな状態を、KV等の新規インフラを増やさずリポジトリ内で管理するために使う。
//
// 必須環境変数: GITHUB_REPO_TOKEN（このリポジトリへの contents:write 権限を
// 持つ Fine-grained PAT）。未設定の場合は null を返し、呼び出し側で
// フォールバック処理（投稿をスキップする等）を行うこと。

const OWNER = "mnews-mma";
const REPO = "mnews";
const BRANCH = "main";

interface GithubFile {
  data: unknown;
  sha: string;
}

function getToken(): string | null {
  return process.env.GITHUB_REPO_TOKEN ?? null;
}

export async function getJsonFile<T>(path: string): Promise<GithubFile & { data: T } | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (res.status === 404) return { data: null as T, sha: "" };
  if (!res.ok) throw new Error(`github getContent failed: ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf8");
  return { data: JSON.parse(content) as T, sha: json.sha };
}

export async function putJsonFile(
  path: string,
  data: unknown,
  sha: string | undefined,
  message: string
): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf8").toString("base64");
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, content, branch: BRANCH, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[github-content] putJsonFile failed: ${res.status} ${body}`);
    return false;
  }
  return true;
}
