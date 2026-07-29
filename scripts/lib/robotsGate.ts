// 取得先サイトのrobots.txtを確認し、これから取得するURLのパスがDisallowに
// 該当する場合は例外を投げて呼び出し元(各スクリプトのmain())を停止させる。
//
// RFC 9309(Robots Exclusion Protocol)の定めに従い、robots.txt自体の取得結果を
// 3通りに分けて扱う:
//   - 4xx(2026-07-30時点の調査ではパンクラスの404が該当): ルールが存在しない
//     ものとして「全許可」。
//   - 5xx・ネットワークエラー(タイムアウト等): サイトへの到達自体ができない
//     状態のため、リトライしてもなお失敗する場合は「全面拒否」として取得せず
//     停止する。これらのスクリプトはいずれも手動実行専用でスケジュール実行は
//     されていない(CLAUDE.md記載)ため、バッチが途中で止まっても支障がない。
//   - 200: 本文をパースしてUser-agent別のDisallow/Allowを判定する。
//
// origin単位でこの判定結果をキャッシュする(1回のバッチ実行内で同一originへの
// 大量アクセスがあっても再取得はしない)。

interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsGroup {
  agents: string[]; // 小文字化済み
  rules: RobotsRule[];
}

// 404等の4xx→ルールなし(全許可)。5xx・通信エラーがリトライ後もなお続く
// 場合→全面拒否。200→本文をパース済みのグループ一覧。
type RobotsOutcome = { kind: "allow-all" } | { kind: "block-all" } | { kind: "rules"; groups: RobotsGroup[] };

const robotsCache = new Map<string, RobotsOutcome>();

const ROBOTS_FETCH_RETRIES = 2;
const ROBOTS_RETRY_DELAY_MS = 1500;

export class RobotsDisallowedError extends Error {
  constructor(url: string, reason: string) {
    super(`robots.txtにより取得禁止: ${url} (${reason})`);
    this.name = "RobotsDisallowedError";
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let sawRuleInCurrent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "user-agent") {
      // 直前のグループがすでにDisallow/Allowを持っていたら、新しいUser-agent行は
      // 新グループの開始(連続するUser-agent行は同一グループへの追加)。
      if (!current || sawRuleInCurrent) {
        current = { agents: [], rules: [] };
        groups.push(current);
        sawRuleInCurrent = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" || key === "allow") {
      if (!current) continue;
      sawRuleInCurrent = true;
      if (value !== "") {
        // "Disallow:"(空値)は「制限なし」を意味するので登録不要。
        current.rules.push({ path: value, allow: key === "allow" });
      }
    }
  }
  return groups;
}

export function pathDisallowed(groups: RobotsGroup[], botToken: string, path: string): { blocked: boolean; rule?: string } {
  const lowerToken = botToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && lowerToken.includes(a)));
  const applicable = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));

  let best: RobotsRule | null = null;
  for (const g of applicable) {
    for (const rule of g.rules) {
      if (path.startsWith(rule.path) && (!best || rule.path.length > best.path.length)) {
        best = rule;
      }
    }
  }
  if (!best) return { blocked: false };
  return { blocked: !best.allow, rule: `${best.allow ? "Allow" : "Disallow"}: ${best.path}` };
}

async function fetchRobotsOutcome(origin: string, userAgent: string): Promise<RobotsOutcome> {
  let lastFailureDetail = "";
  for (let attempt = 0; attempt <= ROBOTS_FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": userAgent } });
      if (res.status >= 400 && res.status < 500) {
        return { kind: "allow-all" }; // RFC 9309: 4xxはルールなし(全許可)
      }
      if (res.ok) {
        return { kind: "rules", groups: parseRobotsTxt(await res.text()) };
      }
      lastFailureDetail = `status ${res.status}`; // 5xx・想定外ステータス→リトライ対象
    } catch (e) {
      lastFailureDetail = e instanceof Error ? e.message : String(e);
    }
    if (attempt < ROBOTS_FETCH_RETRIES) await sleep(ROBOTS_RETRY_DELAY_MS);
  }
  console.error(
    `[robotsGate] ${origin}/robots.txt の取得に${ROBOTS_FETCH_RETRIES + 1}回失敗しました(最終: ${lastFailureDetail})。` +
      `RFC 9309に従い全面拒否として扱い、このoriginへの取得を停止します。`
  );
  return { kind: "block-all" };
}

// targetUrlをこれから実際にfetchする直前に呼ぶ。Disallowに該当する場合、または
// robots.txtへ5xx/通信エラーでリトライ後も到達できなかった場合はRobotsDisallowedError
// を投げる(呼び出し側でcatchしない限りmain().catch()まで伝播して非ゼロ終了する想定)。
export async function assertAllowedByRobots(targetUrl: string, userAgent: string): Promise<void> {
  const url = new URL(targetUrl);
  const origin = url.origin;
  // UA文字列例: "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)"
  // → "MNewsBot/1.0; +https://www.mnews.jp" のうちbot名部分だけを比較用に取り出す。
  const botToken = userAgent.match(/compatible;\s*([^;)]+)/i)?.[1]?.trim() ?? userAgent;

  let outcome = robotsCache.get(origin);
  if (!outcome) {
    outcome = await fetchRobotsOutcome(origin, userAgent);
    robotsCache.set(origin, outcome);
  }

  if (outcome.kind === "allow-all") return;
  if (outcome.kind === "block-all") {
    throw new RobotsDisallowedError(targetUrl, "robots.txtへ5xx/通信エラーで到達できず、RFC 9309に従い全面拒否として扱う");
  }

  const { blocked, rule } = pathDisallowed(outcome.groups, botToken, url.pathname);
  if (blocked) {
    throw new RobotsDisallowedError(targetUrl, `該当ルール: ${rule}`);
  }
}
