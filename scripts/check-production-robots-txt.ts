// 本番デプロイ後ゲート: https://www.mnews.jp/robots.txt を実際に取得し、
// SHARE_UNFURL_BOTS(src/lib/robotsShareBots.ts、UAリストの単一情報源)と
// 生成されたrobots.txtが一致していることを機械的に検証する。
//
// 背景(2026-08-08): robots.txtでシェアbotを個別グループにして/dream?の
// クロール拒否から除外する対応(PR#470)を入れた際、「UAリストに追加した
// つもりが、実際のグループ生成・出力とズレていないか」「そもそもUA文字列が
// 正しいか」を検証する仕組みが無かった。本スクリプトはUAリストと出力の
// ズレを機械的に検出する(UA文字列そのものの正しさは別問題であり、
// src/lib/robotsShareBots.tsのコメントに出典を記載する運用でカバーする)。
//
// なぜnpm run buildではなくデプロイ後の別スクリプトなのか:
// このスクリプトは本番環境の実配信ファイルへの外部fetchを伴う。ビルド時
// ゲート(check:*)はローカルのソース状態のみを検証する既存方針(NULバイト・
// revalidateリテラル等)と異なり、本番URLへの依存はビルドプロセス自体を
// 外部ネットワーク状態に晒す(初回デプロイ時に本番が存在しない、ビルド環境
// からの一時的なネットワーク断で無関係な理由でビルドが落ちる、等)。そのため
// npm run buildには組み込まず、デプロイ後に独立して実行する運用とする
// (warm-routes.ymlと同様、GitHub Actionsのdeployment_statusトリガーでの
// 自動実行を想定。ワークフロー配線は別途行う)。
//
// 検証項目(SHARE_UNFURL_BOTS各UAについて):
//   ① 専用グループが存在する(*とは別の、そのUA名だけのグループ)
//   ② そのグループのdisallowに/dream?が含まれない
//   ③ "*"グループのdisallowに/dream?が含まれる
//   ④ (回帰防止) どのグループもCOMMON_DISALLOW(/admin/)は引き継いでいる
import { parseRobotsTxt, pathDisallowed } from "./lib/robotsGate";
import { COMMON_DISALLOW, SHARE_UNFURL_BOTS } from "../src/lib/robotsShareBots";

const PRODUCTION_ROBOTS_URL = "https://www.mnews.jp/robots.txt";
const SAMPLE_DREAM_PATH = "/dream?a=sample-fighter-a&b=sample-fighter-b";
const SAMPLE_ADMIN_PATH = "/admin/sample";
// SHARE_UNFURL_BOTSのいずれにも一致しない、架空のUA(実在の一般的な検索エンジン
// クローラーの代役)。"*"グループの挙動確認に使う。
const GENERIC_CRAWLER_UA = "Mozilla/5.0 (compatible; SomeGenericCrawler/1.0)";

async function main() {
  const res = await fetch(PRODUCTION_ROBOTS_URL);
  if (!res.ok) {
    console.error(`[本番robots.txt検査] ★取得失敗: ${PRODUCTION_ROBOTS_URL} → status ${res.status}`);
    process.exit(1);
  }
  const text = await res.text();
  const groups = parseRobotsTxt(text);

  const violations: string[] = [];

  for (const ua of SHARE_UNFURL_BOTS) {
    const lowerUa = ua.toLowerCase();

    // ① 専用グループが存在する("*"以外でこのUAだけを持つグループ)
    const ownGroup = groups.find((g) => g.agents.length === 1 && g.agents[0] === lowerUa);
    if (!ownGroup) {
      violations.push(`${ua}: 専用グループが見つからない(UAリストに追加したがrobots.tsの生成に反映されていない可能性)`);
      continue;
    }

    // ② そのグループには/dream?のDisallowが無い(=クロール許可)
    const dreamCheck = pathDisallowed(groups, ua, SAMPLE_DREAM_PATH);
    if (dreamCheck.blocked) {
      violations.push(`${ua}: /dream?付きパスがDisallowされている(該当ルール: ${dreamCheck.rule}) — シェアカードが壊れる`);
    }

    // ④ COMMON_DISALLOW(/admin/)は専用グループでも引き継がれている
    const adminCheck = pathDisallowed(groups, ua, SAMPLE_ADMIN_PATH);
    if (!adminCheck.blocked) {
      violations.push(`${ua}: /admin/配下がDisallowされていない(COMMON_DISALLOWの引き継ぎ漏れ)`);
    }
  }

  // ③ "*"グループ(=リストに無い一般クローラー)は/dream?がDisallowされている
  const genericDreamCheck = pathDisallowed(groups, GENERIC_CRAWLER_UA, SAMPLE_DREAM_PATH);
  if (!genericDreamCheck.blocked) {
    violations.push(`"*"グループ: /dream?付きパスがDisallowされていない(検索エンジンによるクロール増幅ループが再発する)`);
  }
  // 念のため"*"もCOMMON_DISALLOWを保持しているか
  const genericAdminCheck = pathDisallowed(groups, GENERIC_CRAWLER_UA, SAMPLE_ADMIN_PATH);
  if (!genericAdminCheck.blocked) {
    violations.push(`"*"グループ: /admin/配下がDisallowされていない`);
  }

  if (violations.length) {
    console.error(
      `[本番robots.txt検査] ★${violations.length}件の不整合を検出(${PRODUCTION_ROBOTS_URL}):\n  ` +
        violations.join("\n  ")
    );
    process.exit(1);
  }

  console.log(
    `[本番robots.txt検査] OK (共有bot ${SHARE_UNFURL_BOTS.length}件すべて専用グループ確認済み、"*"グループの/dream?拒否も確認済み、COMMON_DISALLOW=${JSON.stringify(COMMON_DISALLOW)}の引き継ぎも確認済み)`
  );
}

main().catch((err) => {
  console.error("[本番robots.txt検査] ★実行時エラー:", err);
  process.exit(1);
});
