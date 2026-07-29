// scripts/lib/robotsGate.tsのユニットテスト。
//
// 実サイトへのfetchは行わず、global.fetchを差し替えてrobots.txtの応答を
// 固定化する。4団体調査(out/official-sites-terms-audit.md)で実際に確認した
// robots.txtの原文をそのまま固定ケースとして使い、既存の実装がその内容を
// 正しく解釈できることを検証する。
import { parseRobotsTxt, pathDisallowed, assertAllowedByRobots, RobotsDisallowedError } from "./lib/robotsGate";

const UA = "Mozilla/5.0 (compatible; MNewsBot/1.0; +https://www.mnews.jp)";

// out/official-sites-terms-audit.md記載の実際の取得結果(2026-07-30)。
const REAL_ROBOTS_TXT: Record<string, string> = {
  rizin: `User-agent: *\nAllow: /\n\nSitemap: https://jp.rizinff.com/sitemap-index.xml\n`,
  deep: `User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: https://www.deep2001.com/wp-sitemap.xml\n`,
  shooto: `User-agent: *\nDisallow: /colum/wp-admin/\nAllow: /colum/wp-admin/admin-ajax.php\n\nSitemap: https://shooto-mma.com/colum/sitemap.xml\n`,
};

function runParseCases(): string[] {
  const failures: string[] = [];

  function check(label: string, robotsTxt: string, path: string, expectBlocked: boolean) {
    const groups = parseRobotsTxt(robotsTxt);
    const { blocked, rule } = pathDisallowed(groups, UA, path);
    const ok = blocked === expectBlocked;
    console.log(`${ok ? "  OK" : "FAIL"}  ${label}  path=${path} → blocked=${blocked}${rule ? ` (${rule})` : ""} (expect ${expectBlocked})`);
    if (!ok) failures.push(`${label}: got blocked=${blocked}, expected ${expectBlocked}`);
  }

  // RIZIN: 全許可。現在取得しているパス(/_ct/xxx, /_rss/rss20.xml)は許可される。
  check("RIZIN /_ct/123", REAL_ROBOTS_TXT.rizin, "/_ct/123", false);
  check("RIZIN /_rss/rss20.xml", REAL_ROBOTS_TXT.rizin, "/_rss/rss20.xml", false);

  // DEEP: /wp-admin/のみ禁止。現在取得しているパス(/feed)は許可される。
  check("DEEP /feed", REAL_ROBOTS_TXT.deep, "/feed", false);
  check("DEEP /wp-admin/admin.php(禁止対象)", REAL_ROBOTS_TXT.deep, "/wp-admin/admin.php", true);
  check("DEEP /wp-admin/admin-ajax.php(Allow優先)", REAL_ROBOTS_TXT.deep, "/wp-admin/admin-ajax.php", false);

  // 修斗: /colum/wp-admin/のみ禁止。現在取得しているパス(/result/, /ranking/)は許可される。
  check("修斗 /result/", REAL_ROBOTS_TXT.shooto, "/result/", false);
  check("修斗 /ranking/", REAL_ROBOTS_TXT.shooto, "/ranking/", false);
  check("修斗 /colum/wp-admin/edit.php(禁止対象)", REAL_ROBOTS_TXT.shooto, "/colum/wp-admin/edit.php", true);

  // 合成ケース: 団体側が将来Disallowを追加した場合を模した仮想robots.txt。
  const futureDisallow = "User-agent: *\nDisallow: /result/\n";
  check("仮想: /result/を禁止した場合", futureDisallow, "/result/2026/0101.html", true);
  check("仮想: 禁止対象外パスは引き続き許可", futureDisallow, "/ranking/", false);

  return failures;
}

async function runFetchIntegrationCases(): Promise<string[]> {
  const failures: string[] = [];
  const originalFetch = global.fetch;

  function mockFetchOnce(status: number, body: string | null) {
    global.fetch = (async () =>
      ({
        ok: status >= 200 && status < 300,
        status,
        text: async () => body ?? "",
      }) as Response) as typeof fetch;
  }

  function mockFetchAlways(status: number, body: string | null) {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return { ok: status >= 200 && status < 300, status, text: async () => body ?? "" } as Response;
    }) as typeof fetch;
    return () => calls;
  }

  function mockFetchAlwaysThrows() {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      throw new Error("network error(mock)");
    }) as typeof fetch;
    return () => calls;
  }

  async function check(label: string, run: () => Promise<void>, expectThrow: boolean) {
    let threw = false;
    try {
      await run();
    } catch (e) {
      threw = e instanceof RobotsDisallowedError;
      if (!(e instanceof RobotsDisallowedError)) throw e; // 想定外の例外は再送出
    }
    const ok = threw === expectThrow;
    console.log(`${ok ? "  OK" : "FAIL"}  ${label} → threw=${threw} (expect ${expectThrow})`);
    if (!ok) failures.push(label);
  }

  // 4xx → 許可扱い(RFC 9309。パンクラスの404が実例)。
  mockFetchOnce(404, null);
  await check("robots.txt 404(4xx) → 許可扱い", () => assertAllowedByRobots("https://example-404.mnews-test/data/result/index.html", UA), false);

  // 5xxはリトライ(2回)してもなお失敗する場合、RFC 9309に従い全面拒否として停止する。
  {
    const getCalls = mockFetchAlways(500, null);
    await check(
      "robots.txt 5xx(リトライ後も失敗) → 全面拒否で例外",
      () => assertAllowedByRobots("https://example-500.mnews-test/data/result/index.html", UA),
      true
    );
    const calls = getCalls();
    const ok = calls === 3; // 初回+リトライ2回
    console.log(`${ok ? "  OK" : "FAIL"}  5xxリトライ回数=${calls} (expect 3: 初回+リトライ2回)`);
    if (!ok) failures.push(`5xx retry count = ${calls}, expected 3`);
  }

  // ネットワークエラー(タイムアウト等)もリトライ後になお失敗すれば同様に全面拒否。
  {
    const getCalls = mockFetchAlwaysThrows();
    await check(
      "robots.txt 通信エラー(リトライ後も失敗) → 全面拒否で例外",
      () => assertAllowedByRobots("https://example-neterror.mnews-test/data/result/index.html", UA),
      true
    );
    const calls = getCalls();
    const ok = calls === 3;
    console.log(`${ok ? "  OK" : "FAIL"}  通信エラーリトライ回数=${calls} (expect 3: 初回+リトライ2回)`);
    if (!ok) failures.push(`network error retry count = ${calls}, expected 3`);
  }

  // Disallow該当 → 例外。
  mockFetchOnce(200, "User-agent: *\nDisallow: /data/result/\n");
  await check(
    "Disallow該当パス → RobotsDisallowedError",
    () => assertAllowedByRobots("https://example-disallow.mnews-test/data/result/index.html", UA),
    true
  );

  // 同一originはキャッシュされるため、2回目はfetchなしで同じ結果になることを確認。
  let fetchCallCount = 0;
  global.fetch = (async () => {
    fetchCallCount++;
    return { ok: true, status: 200, text: async () => "User-agent: *\nDisallow: /blocked/\n" } as Response;
  }) as typeof fetch;
  await check("キャッシュ確認: 1回目", () => assertAllowedByRobots("https://example-cache.mnews-test/ok/page.html", UA), false);
  await check("キャッシュ確認: 2回目(同origin別path)", () => assertAllowedByRobots("https://example-cache.mnews-test/blocked/page.html", UA), true);
  if (fetchCallCount !== 1) {
    console.log(`FAIL  キャッシュ確認: fetch呼び出し回数=${fetchCallCount} (expect 1)`);
    failures.push(`fetch call count = ${fetchCallCount}, expected 1`);
  } else {
    console.log(`  OK  キャッシュ確認: fetch呼び出し回数=1(2回目はキャッシュ使用)`);
  }

  global.fetch = originalFetch;
  return failures;
}

async function main() {
  console.log("--- robotsGate: parseRobotsTxt / pathDisallowed(実robots.txt固定ケース) ---");
  const parseFailures = runParseCases();

  console.log("\n--- robotsGate: assertAllowedByRobots(fetchモック統合ケース) ---");
  const fetchFailures = await runFetchIntegrationCases();

  const failures = [...parseFailures, ...fetchFailures];
  if (failures.length) {
    console.error(`\n[robotsGate テスト] ★${failures.length}件 失敗:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\n[robotsGate テスト] OK`);
}

main();
