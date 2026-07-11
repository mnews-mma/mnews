// ユーザー向けXシェア導線の共通ヘルパー。
//
// 対象(棚卸し済み): /dream のシェアボタン・選手ページ「𝕏投稿用カード作成」
// (OgCardTool.tsx、/tools/fighter-card経由)・対戦カードページ(/vs/[slugA]/[slugB])。
// ヘッダー/フッターの@mnews_mmaフォローリンクはシェアintentではなくプロフィールへの
// 直リンクのため対象外(x.comへの通常リンクで既にOSのUniversal Links機構に乗る)。
//
// 【重要】これは自動投稿基盤(twitter-api-v2によるサーバーサイド投稿・@mnews_mmaの
// 日次ダイジェスト/速報cron)とは完全に別物。あちらは一切変更していない。
//
// x.com/intent/post 形式のURLに統一する(旧 twitter.com/intent/tweet の後継
// エンドポイント)。target=_blank + rel=noopener,noreferrer で開くことで、
// モバイルSafari/ChromeのOSレベルのUniversal Links機構にアプリへの転送を委ねる
// (Xアプリがインストールされていればログイン要求なしでアプリが開き、
// 無ければブラウザでweb intentページが開く。twitter://カスタムスキームを
// 明示的に試す実装は、未インストール時に無反応/エラーになるリスクがあり
// Appleのユニバーサルリンク推奨からも外れるため、まずはこの標準的な方式のみ
// 実装する。iOS実機での挙動確認が必要)。
export function buildXIntentUrl(params: { text?: string; url: string }): string {
  const qs = new URLSearchParams();
  if (params.text) qs.set("text", params.text);
  qs.set("url", params.url);
  return `https://x.com/intent/post?${qs.toString()}`;
}

// window.open経由でXシェアを開く(クリックハンドラ内で使う版)。
export function openXShare(params: { text?: string; url: string }): void {
  window.open(buildXIntentUrl(params), "_blank", "noopener,noreferrer");
}
