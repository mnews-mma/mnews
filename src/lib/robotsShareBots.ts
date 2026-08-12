// robots.txt生成(src/app/robots.ts)と本番検証(scripts/check-production-robots-txt.ts)
// で共有する単一情報源。UAリストをここ以外に重複定義しない。
//
// 全UAグループ共通で必ず入れるDisallow。この配列自体には/dream?を含めない
// (2026-08-08決定)。理由: 「共通配列に入れてシェアbotだけAllowで上書きする」
// 設計は、Allow/Disallowのどちらが勝つかがルールの並び順・最長一致に依存し
// クローラー実装によって解釈が割れうる。そのため、シェアbotグループには
// COMMON_DISALLOWのみ(=/dream?を含まない)を明示的に持たせ、"*"グループにだけ
// /dream?を追加する形にする(Allow上書きに頼らない)。
export const COMMON_DISALLOW = ["/admin/"];

// OGP展開のためにページ本文を取得するボット。/dream?a=&b=(noindex,follow)を
// クロールされるとその都度サーバーレンダリングが発生し、検索エンジンによる
// 巡回と合わせてFluid Active CPUを消費する主要因になっていた(2026-08-07の
// 本番停止調査で判明)。ここに挙げたUAは"*"グループとは別に自分専用の
// ルールグループを持つため、"*"グループのDisallow(/dream?を含む)を一切
// 継承しない。COMMON_DISALLOW(/admin/)だけは明示的に引き継ぐ。
//
// 各UA文字列の出典(2026-08-08調査時点、RFC 9309の部分文字列一致に基づく判定):
// - Twitterbot: 公式(developer.x.com/en/docs/x-for-websites/cards/guides/getting-started)。
//   実UAは"Twitterbot/1.0"のようにバージョン付きだが"Twitterbot"は部分文字列として一致する。
// - facebookexternalhit: 公式(developers.facebook.com/documentation/sharing/webmasters/web-crawlers)。
//   実UAは"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"。
//   注: セキュリティ/インテグリティチェック目的の際はrobots.txtを無視しうると公式記載あり
//   (通常のOGP取得には影響しない)。
// - Slackbot-LinkExpanding: 公式(api.slack.com/robots)。実UAは
//   "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"。ハイフン・大文字小文字を
//   公式表記に厳密に合わせている。
// - Discordbot: 公式(Discord API Docs参照の複数の技術記事で一致)。実UAは
//   "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"。
// - LinkedInBot: 複数の第三者クローラー辞典で一致(LinkedInの一次ドキュメントページは
//   未発見、要確認レベルはfacebookexternalhit等より低い)。実UAは
//   "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)"。
// - TelegramBot: 複数の第三者クローラー辞典で一致(Telegramの一次ドキュメントページは
//   未発見)。トークンは"TelegramBot"。
// - WhatsApp: 公式(developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/)。
//   実UAは"WhatsApp/2.x.x.x A|I|N"形式。同ページに
//   「User-agent: WhatsApp または User-agent: facebookexternalhit のいずれでも指定可」と明記。
//
// 【重要・要確認から確定に格上げ】"LINE"というUA文字列は誤り(実在しない)だった。
// LINE Developers公式ドキュメントにはOGP取得ボットのUser-Agent文字列の明記が無く、
// 一方で日本語の技術ブログ2件(下記、いずれも著者が自分のサーバーログで実際に観測した
// 内容として報告)が独立に一致して次を報告している:
//   実UA = "facebookexternalhit/1.1;line-poker/1.0"
//   出典1: https://zakkuri.life/laravel-get-line-crawler/
//   出典2: https://qiita.com/myucy/items/c9f45979838e05e10a2a
// この文字列は"facebookexternalhit"を部分文字列として含むため、RFC 9309の
// 部分文字列一致ルールにより、既存のfacebookexternalhitグループが自動的に
// カバーする。そのため"LINE"を独立エントリとして持たない(持っていても
// 実際のリクエストのUser-Agentには一致せず、何の保護にもならなかった)。
// 一次情報源(LINE公式)による明記ではないため、リストからは完全に確定させず
// このコメントに経緯を残す。将来LINE公式がUser-Agentを明記した場合は要再確認。
export const SHARE_UNFURL_BOTS = [
  "Twitterbot",
  "facebookexternalhit",
  "Slackbot-LinkExpanding",
  "Discordbot",
  "LinkedInBot",
  "TelegramBot",
  "WhatsApp",
];

// SEO監査ツール群のクローラーをサイト全体でDisallow: /する(2026-08-11)。
//
// 背景: /vsのFluid Active CPU急増(39秒/日→240秒/日)の実測調査(#482)で、
// SemrushBot単独が観測トラフィックの91.1%、クローラー全体では97.2%を占め、
// うち98.5%が互いに異なる選手ペア(ユニークペア601/610件、SemrushBotのみなら
// 556/556件=100%ユニーク)だった。Referer実測でも検索流入は0.66%(4/610件)と
// 実質ゼロで、守るべきSEO価値が薄いことも確認済み(GSC APIは使わず、この
// リクエストログのRefererヘッダーで代替確認した)。
//
// 対処方針: sitemap.tsの4,560件規模の/vs組み合わせページはisVsPairIndexable()
// で絞り込まれた検索エンジン向けの発見経路でもあるため、「/vs/配下をDisallow」
// はこの経路ごと塞いでしまい、かつ次に別のSEO監査ツールが来たら/dream・/vs以外の
// 別ルートで同じ問題が再発する(ルート単位はもぐら叩き)。そこで検索エンジン
// ではないSEO監査系クローラーをUA単位でサイト全体ブロックする方式にした。
// これによりGooglebot/Bingbotの/vs indexableペア発見経路は無傷のまま、
// SemrushBot的な巡回だけを止められる。
//
// 各UA文字列の出典(2026-08-11調査時点):
// - SemrushBot: 公式(semrush.com/bot/)。同ページに
//   「User-agent: SemrushBot / Disallow: /」の記載例あり。
// - AhrefsBot: 公式(ahrefs.com/robot)。実UAは
//   "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"。
//   同ページに「robots.txtを厳密に尊重する」旨の明記あり。
// - MJ12bot: 公式(mj12bot.com、Majesticのクローラー)。実UAは
//   "Mozilla/5.0 (compatible; MJ12bot/v1.x.x; http://mj12bot.com/)"
//   (バージョン部分は可変)。トークンは"MJ12bot"。
// - DataForSeoBot: 公式(dataforseo.com/dataforseo-bot)。実UAは
//   "Mozilla/5.0 (compatible; DataForSeoBot; +https://dataforseo.com/dataforseo-bot)"。
// - serpstatbot: 公式(serpstat.com/bot/、serpstatbot.com)。トークンは
//   小文字の"serpstatbot"(公式ページのrobots.txt記載例に準拠)。
// - BLEXBot: 【要確認】公式クローラー専用ページ(旧webmeup.com/crawler/)は
//   2026-08-11時点でリンク切れ(別ドメインへ301リダイレクト)。複数の第三者
//   クローラー辞典が一致して報告する実UAは
//   "Mozilla/5.0 (compatible; BLEXBot/1.0; +http://webmeup.com/crawler/)"だが、
//   一次情報源での確認はできていない。
//
// 【重要・意図的に含めない】PetalBotはこのリストに含めない。ユーザー提示の
// 候補リストにあったが、調査の結果PetalBotはSEO監査ツールではなく
// **Huawei Petal Search(実際の検索エンジン)のクローラー**であり、
// Googlebot/Bingbotと同種の一般検索エンジンだと判明した(公式アナウンス
// aspiegel.com/petalbot、複数の技術記事が一致)。「検索エンジンは無傷のまま
// SEO監査ツールだけを止める」という本対処の前提に反するため除外する。
export const SEO_AUDIT_BOTS = [
  "SemrushBot",
  "AhrefsBot",
  "MJ12bot",
  "DataForSeoBot",
  "serpstatbot",
  "BLEXBot",
];
