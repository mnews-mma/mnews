// /admin/schedule-diff と /admin(バッジ)が共有する、GitHub Issueからの
// 団体別開催予定 差分レポート取得。
//
// 生成元: .github/workflows/check-org-schedule-diff.yml が
// scripts/check-org-schedule-diff.ts の出力をラベル`schedule-diff`・固定
// タイトルのIssueとして作成/更新/クローズする。本ファイルはそのIssueを
// 読むだけで、data/・src/への書き込みは一切行わない。
//
// リポジトリはpublicなため、Issue読み取りは未認証のGitHub REST APIで行う
// (トークン・Vercel環境変数の追加は不要)。未認証のレート制限は60回/時/IP
// (2026-08-05実測、`x-ratelimit-limit: 60`)。本ページは低トラフィックな
// 管理画面であり、下記revalidate窓(15分、他のGitHub raw参照と同じ値を
// 踏襲)の間はキャッシュが効くため、この制限が実運用で問題になることは
// 想定しにくい。動作確認の結果、この前提が崩れる場合は都度確認を取ること。
export const SCHEDULE_DIFF_REVALIDATE = 900;

const ISSUE_TITLE = "団体別開催予定 差分レポート(自動)";
const ISSUES_URL =
  "https://api.github.com/repos/mnews-mma/mnews/issues?labels=schedule-diff&state=all&sort=updated&direction=desc&per_page=5";

export type ScheduleDiffOrg = "rizin" | "shooto" | "pancrase" | "deep";
export type ScheduleDiffConfidence = "high" | "medium" | "low";

export interface ScheduleDiffEventRef {
  org: ScheduleDiffOrg;
  orgLabel: string;
  eventName: string;
  slug: string | null; // events.tsに存在する場合のみ(/events/[slug]リンク用)
  date: string | null;
  venue: string | null;
  sourceUrl: string | null;
}

export type ScheduleDiffASection =
  | ({ kind: "event_missing" } & ScheduleDiffEventRef)
  | ({ kind: "event_unconfirmed"; fetchFailure: boolean; cancelMention: boolean } & ScheduleDiffEventRef)
  | ({ kind: "date_change"; localDate: string; officialDate: string } & ScheduleDiffEventRef)
  | ({ kind: "venue_change"; localVenue: string | null; officialVenue: string | null } & ScheduleDiffEventRef);

export interface ScheduleDiffBoutItem {
  kind: "missing_on_local" | "missing_on_official" | "opponent_change";
  weightClass?: string | null;
  fighterA?: string;
  fighterB?: string;
  localFighterA?: string;
  localFighterB?: string;
  officialFighterA?: string;
  officialFighterB?: string;
  cancelMention?: boolean;
}

export interface ScheduleDiffBSection extends ScheduleDiffEventRef {
  confidence: ScheduleDiffConfidence;
  items: ScheduleDiffBoutItem[];
}

export interface ScheduleDiffData {
  detectedAtUtc: string;
  diffCount: number;
  fetchErrorCount: number;
  fetchErrors: string[];
  a: ScheduleDiffASection[];
  b: ScheduleDiffBSection[];
  c: ScheduleDiffEventRef[];
}

export type ScheduleDiffResult =
  | { status: "diff"; data: ScheduleDiffData; issueUrl: string; updatedAt: string }
  | { status: "no_diff"; lastCheckedAt: string | null; issueUrl: string | null }
  | { status: "parse_error"; issueUrl: string; updatedAt: string }
  | { status: "fetch_error"; message: string };

interface GithubIssueListItem {
  title: string;
  state: "open" | "closed";
  html_url: string;
  body: string | null;
  updated_at: string;
  closed_at: string | null;
  pull_request?: unknown;
}

function parseJsonComment(body: string): ScheduleDiffData | null {
  const m = body.match(/<!--\s*SCHEDULE_DIFF_JSON:\s*([\s\S]*?)\s*-->/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as ScheduleDiffData;
  } catch {
    return null;
  }
}

export async function fetchScheduleDiff(): Promise<ScheduleDiffResult> {
  let res: Response;
  try {
    res = await fetch(ISSUES_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "mnews-admin-schedule-diff",
      },
      next: { revalidate: SCHEDULE_DIFF_REVALIDATE },
    });
  } catch (err) {
    return { status: "fetch_error", message: `GitHub APIへの接続に失敗しました: ${String(err)}` };
  }
  if (!res.ok) {
    return {
      status: "fetch_error",
      message: `GitHub APIエラー(HTTP ${res.status})。未認証リクエストのレート制限(60回/時/IP)を超えた可能性があります。`,
    };
  }

  let issues: GithubIssueListItem[];
  try {
    issues = (await res.json()) as GithubIssueListItem[];
  } catch (err) {
    return { status: "fetch_error", message: `GitHub APIレスポンスの解析に失敗しました: ${String(err)}` };
  }

  const issue = issues.find((i) => i.title === ISSUE_TITLE && !i.pull_request);
  if (!issue) {
    return { status: "no_diff", lastCheckedAt: null, issueUrl: null };
  }
  if (issue.state === "closed") {
    return { status: "no_diff", lastCheckedAt: issue.closed_at ?? issue.updated_at, issueUrl: issue.html_url };
  }

  const data = issue.body ? parseJsonComment(issue.body) : null;
  if (!data) {
    return { status: "parse_error", issueUrl: issue.html_url, updatedAt: issue.updated_at };
  }
  return { status: "diff", data, issueUrl: issue.html_url, updatedAt: issue.updated_at };
}
