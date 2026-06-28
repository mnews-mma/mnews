const FETCH_TIMEOUT_MS = 8000;
const REVALIDATE_SECONDS = 86400; // UFC公式プロフィールも更新頻度は低いため1日キャッシュ

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// UFC公式サイト（jp.ufc.com）の選手プロフィールページから通称（ニックネーム）
// のみを取得する。Wikipediaの other_names は古い/誤った通称が残っている
// ことがあるため、UFC所属選手はこちらを優先する。
export async function fetchUfcNickname(slug: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://jp.ufc.com/athlete/${slug}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MNewsBot/1.0)" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/hero-profile__nickname">&quot;([^&]*)&quot;/);
    if (!m) return null;
    const nickname = decodeEntities(m[1]).trim();
    return nickname || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
