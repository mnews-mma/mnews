// 取得先サイトのrobots.txtを確認し、これから取得するURLのパスがDisallowに
// 該当する場合は例外を投げて呼び出し元(各スクリプトのmain())を停止させる。
// 2026-07-30時点の4団体(RIZIN/DEEP/パンクラス/修斗)公式サイト調査
// (out/official-sites-terms-audit.md)では、パンクラスのみrobots.txt自体が
// 存在しない(404)ことを確認済み。この404ケースは仕様として明示的に「許可」
// 扱いにする。robots.txt取得自体がネットワークエラー・5xx等で失敗した場合は
// 判定不能なので、バッチ全体を無用に止めないよう許可扱い(警告ログのみ)とする。
//
// origin単位でrobots.txtの取得・パース結果をキャッシュする(1回のバッチ実行内で
// 同一originへの大量アクセスがあっても再取得はしない)。

interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsGroup {
  agents: string[]; // 小文字化済み
  rules: RobotsRule[];
}

const robotsCache = new Map<string, RobotsGroup[] | null>();

export class RobotsDisallowedError extends Error {
  constructor(url: string, rule: string) {
    super(`robots.txtにより取得禁止: ${url} (該当ルール: ${rule})`);
    this.name = "RobotsDisallowedError";
  }
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

async function fetchRobotsGroups(origin: string, userAgent: string): Promise<RobotsGroup[] | null> {
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": userAgent } });
    if (res.status === 404) return null; // 仕様上「許可」扱い
    if (!res.ok) {
      console.warn(`[robotsGate] ${origin}/robots.txt取得失敗(status ${res.status})。判定不能のため許可扱いで継続します。`);
      return null;
    }
    return parseRobotsTxt(await res.text());
  } catch (e) {
    console.warn(`[robotsGate] ${origin}/robots.txt取得中にエラー。判定不能のため許可扱いで継続します。`, e);
    return null;
  }
}

// targetUrlをこれから実際にfetchする直前に呼ぶ。Disallowに該当する場合は
// RobotsDisallowedErrorを投げる(呼び出し側でcatchしない限りmain().catch()まで
// 伝播して非ゼロ終了する想定)。
export async function assertAllowedByRobots(targetUrl: string, userAgent: string): Promise<void> {
  const url = new URL(targetUrl);
  const origin = url.origin;
  // UA文字列例: "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)"
  // → "MNewsBot/1.0; +https://www.mnews.jp" のうちbot名部分だけを比較用に取り出す。
  const botToken = userAgent.match(/compatible;\s*([^;)]+)/i)?.[1]?.trim() ?? userAgent;

  let groups = robotsCache.get(origin);
  if (groups === undefined) {
    groups = await fetchRobotsGroups(origin, userAgent);
    robotsCache.set(origin, groups);
  }
  if (!groups) return;

  const { blocked, rule } = pathDisallowed(groups, botToken, url.pathname);
  if (blocked) {
    throw new RobotsDisallowedError(targetUrl, rule!);
  }
}
