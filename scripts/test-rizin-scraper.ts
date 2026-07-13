// rizinScraper.ts(RIZIN公式サイトの試合結果パーサー)のユニットテスト。
// 実行: npx tsx scripts/test-rizin-scraper.ts
import { splitIntoBoutChunks, parseBoutChunk, extractCardNumber, parseRuleInfo, parseMethod } from "../src/lib/mnewsRating/rizinScraper";

let passes = 0;
let failures = 0;
function check(cond: boolean, label: string) {
  if (cond) passes++;
  else {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// ── 1. フォーマットA(2018年以降): 通常のWIN/LOSE ──────────────────────────
{
  const chunk = `<h2 class="article-heading" data-section-number="1." id="h1">第12試合／秋元強真 vs. パッチー・ミックス</h2><figure><div class="image-box"></div></figure><div class="raw-html"><p style="text-align:center;"><br>RIZIN MMAルール：5分 3R（66.0kg）<br><span style="font-weight:bold">（WIN）<a href="https://jp.rizinff.com/_tags/A">秋元強真</a> vs. <a href="https://jp.rizinff.com/_tags/B">パッチー・ミックス</a>（LOSE）</span>\n<br>2R 0分37秒 TKO（レフェリーストップ：グラウンドでのキック）</p>\n<p style="text-align:center; font-weight: bold"><a href="https://jp.rizinff.com/_ct/1"> ≫ 試合結果詳細</a></p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "フォーマットA: パースできる");
  check(raw?.fighterAName === "秋元強真" && raw?.fighterBName === "パッチー・ミックス", "フォーマットA: 選手名を正しく抽出する");
  check(raw?.markerA === "WIN" && raw?.markerB === "LOSE", "フォーマットA: WIN/LOSEマーカーを正しく抽出する(両方とも)");
  check(!!raw?.methodRaw.includes("TKO"), "フォーマットA: 決着方式を抽出する");
  const ruleInfo = raw ? parseRuleInfo(raw.ruleLineRaw) : null;
  check(ruleInfo?.ruleType === "MMA" && ruleInfo?.weightKg === 66, "フォーマットA: ルール種別・体重を抽出する");
}

// ── 2. フォーマットA: NC(ノーコンテスト・計量オーバー) ─────────────────────
{
  const chunk = `<h2 class="article-heading" id="h4">第9試合／萩原京平 vs. アバイジャ・カレオ・メヘウラ</h2><figure></figure><div class="raw-html"><p style="text-align:center;"><br>RIZIN MMAルール：5分 3R（66.0kg）<br><span style="font-weight:bold">（-）<a href="https://jp.rizinff.com/_tags/A">萩原京平</a> vs. <a href="https://jp.rizinff.com/_tags/B">アバイジャ・カレオ・メヘウラ</a>（-）</span>\n<br>1R 4分50秒 ノーコンテスト 体重超過</p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "フォーマットA(NC): パースできる");
  check(raw?.markerA === "NC" && raw?.markerB === "NC", "フォーマットA(NC): 両者とも（-）マーカーをNCとして抽出する");
  const method = raw ? parseMethod(raw.methodRaw, raw.markerA) : null;
  check(method?.resultType === "nc", "フォーマットA(NC): resultTypeがnc");
  check(method?.isWeighInMiss === true, "フォーマットA(NC): 「体重超過」からisWeighInMissを検出する");
}

// ── 3. フォーマットA: 引き分け(マーカーなし) ────────────────────────────
{
  const chunk = `<h2 class="article-heading" id="h2">第2試合</h2><figure></figure><div class="raw-html"><p style="text-align:center;">［RIZIN キックボクシングルール ： 3分 3R（59.0kg）］<br><span style="font-weight:bold"><a href="https://jp.rizinff.com/_tags/A">大雅</a> vs. <a href="https://jp.rizinff.com/_tags/B">原口健飛</a></span><br>3R 判定 ドロー（0-1）</p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "フォーマットA(引き分け): パースできる");
  check(raw?.markerA === null && raw?.markerB === null, "フォーマットA(引き分け): マーカーが無い");
  const method = raw ? parseMethod(raw.methodRaw, raw.markerA) : null;
  check(method?.resultType === "draw", "フォーマットA(引き分け): resultTypeがdraw");
}

// ── 4. フォーマットB(2016〜2017年、<h3>形式) ───────────────────────────
{
  const chunk = `<h2 class="article-heading" id="h1">第1試合：北岡悟 vs. ダロン・クルックシャンク</h2><figure></figure><p>［RIZIN MMAルール：<br>\n1R10分 / 2R5分 / インターバル60秒（70.3kg契約 / 肘あり）］</p><h3 class="article-subheading" id="h1s1">[Win] 北岡悟 （ 1R 8分19秒 フロントチョーク  ） ダロン・クルックシャンク [Lose]<br>\n</h3><div class="raw-html"><p style="text-align:center; font-weight: bold"><a href="https://jp.rizinff.com/_ct/1">試合詳細</a></p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "フォーマットB: パースできる");
  check(raw?.fighterAName === "北岡悟" && raw?.fighterBName === "ダロン・クルックシャンク", "フォーマットB: 選手名を正しく抽出する(プレーンテキスト)");
  check(raw?.markerA === "WIN" && raw?.markerB === "LOSE", "フォーマットB: 角括弧[Win]/[Lose]マーカーを抽出する");
  check(!!raw?.methodRaw.includes("フロントチョーク"), "フォーマットB: 括弧内の決着方式を抽出する");
  const ruleInfo = raw ? parseRuleInfo(raw.ruleLineRaw) : null;
  check(ruleInfo?.weightKg === 70.3, "フォーマットB: ルール行から体重を抽出する");
}

// ── 5. フォーマットC(2017年頃、太字<p>直書き形式) ─────────────────────────
{
  const chunk = `<h2 class="article-heading" id="h1">第1試合</h2><figure></figure><div class="raw-html"><p style="text-align:center; font-weight: bold">(Win)<a href="https://jp.rizinff.com/_tags/A">森本"狂犬"義久</a> vs. <a href="https://jp.rizinff.com/_tags/B">RYOTA・RENSEIGYM</a>(Lose)<br>3R 2分0秒\n TKO ※レフェリーストップ</p>\n<p style="text-align:center; font-weight: bold"><a href="https://jp.rizinff.com/_ct/1">試合結果詳細</a></p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "フォーマットC: パースできる");
  check(!!raw?.fighterAName.includes("森本") && raw?.fighterBName === "RYOTA・RENSEIGYM", "フォーマットC: 選手名を正しく抽出する");
  check(raw?.markerA === "WIN" && raw?.markerB === "LOSE", "フォーマットC: 半角括弧(Win)/(Lose)マーカーを抽出する(両方とも)");
  check(!!raw?.methodRaw.includes("TKO"), "フォーマットC: 決着方式を抽出する");
}

// ── 6. 非対応フォーマット(3on3団体戦等): nullを返す(推測で埋めない) ────────
{
  const chunk = `<h2 class="article-heading" id="h1">第10試合</h2><figure></figure><div class="raw-html"><p style="text-align:center;">［RIZIN 鉄拳ルール ： 3 on 3 星取団体戦］<br><span style="font-weight:bold">（WIN）韓国 vs. 日本（LOSE）</span><br>団体戦 2-1</p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw === null, "非対応フォーマット(選手名がリンクされていない団体戦): nullを返し推測で埋めない");
}

// ── 6b. フォーマットD(2017年頃、太字<p>+プレーンテキスト形式) ─────────────
{
  const chunk = `<h2 class="article-heading" id="h1">第1試合 テオドラス・オークストリス VS. カール・アルブレックソン</h2><figure></figure><div class="raw-html"><p style="text-align:center;">\n［RIZIN MMAルール：1R10分 / 2R5分 / インターバル60秒（93.0kg契約）］\n</p>\n</div><div class="raw-html"><p style="text-align:center; font-weight: bold">(Lose)テオドラス・オークストリス<br> (1R 8分01秒 肩固め) <br>カール・アルブレックソン(Win)</p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "フォーマットD: パースできる");
  check(raw?.fighterAName === "テオドラス・オークストリス" && raw?.fighterBName === "カール・アルブレックソン", "フォーマットD: プレーンテキストの選手名を抽出する");
  check(raw?.markerA === "LOSE" && raw?.markerB === "WIN", "フォーマットD: 名前に直接くっついたマーカーを抽出する");
  check(!!raw?.methodRaw.includes("肩固め"), "フォーマットD: 括弧内の決着方式を抽出する");
  const ruleInfo = raw ? parseRuleInfo(raw.ruleLineRaw) : null;
  check(ruleInfo?.weightKg === 93, "フォーマットD: 別divのルール情報から体重を抽出する");
}

// ── 6c. フォーマットD: マーカーなし(引き分け・NC) ─────────────────────────
{
  const chunk = `<h2 class="article-heading" id="h1">第9試合 ギャビ・ガルシア VS. オクサナ・ガグロエヴァ</h2><figure></figure><div class="raw-html"><p style="text-align:center;">\n［RIZIN 女子MMAルール：1R5分（120.0kg契約）］\n</p></div><div class="raw-html"><p style="text-align:center; font-weight: bold">ギャビ・ガルシア<br> (1R 0分14秒 ノーコンテスト) <br>オクサナ・ガグロエヴァ</p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "フォーマットD(マーカーなし): パースできる");
  check(raw?.markerA === null && raw?.markerB === null, "フォーマットD(マーカーなし): マーカーが無くてもパースできる");
  const method = raw ? parseMethod(raw.methodRaw, raw.markerA) : null;
  check(method?.resultType === "nc", "フォーマットD(マーカーなし): 「ノーコンテスト」からresultTypeがnc");
}

// ── 7. splitIntoBoutChunks: 複数試合を正しく分割する ─────────────────────
{
  const html = `<h2 class="article-heading" id="h1">第2試合</h2>AAA<h2 class="article-heading" id="h2">第1試合</h2>BBB`;
  const chunks = splitIntoBoutChunks(html);
  check(chunks.length === 2, "splitIntoBoutChunks: h2見出しの数だけ分割する");
  check(chunks[0].includes("AAA") && !chunks[0].includes("BBB"), "splitIntoBoutChunks: 各チャンクは次の見出し直前までを含む");
}

// ── 8. splitIntoBoutChunks: 「content-body-custom-bottom」が本文中に複数回
//      出現しても、最初の出現位置で本文を打ち切らない(過去のバグの回帰確認) ──
{
  const html = `<h2 class="article-heading" id="h1">A</h2>xxx content-body-custom-bottom yyy<h2 class="article-heading" id="h2">B</h2>zzz`;
  const chunks = splitIntoBoutChunks(html);
  check(chunks.length === 2, "splitIntoBoutChunks: content-body-custom-bottomが本文中にあっても打ち切らず全チャンクを拾う(回帰確認)");
}

// ── 8b. splitIntoBoutChunks: 1つのh2の下に複数試合が<h3>見出しでまとめられて
//       いる場合(超RIZIN/RIZIN.38型)、それぞれを独立チャンクに展開する
//       (萩原京平のRIZIN.38敗戦がサイレントに欠落していたバグの回帰確認) ──
{
  const html =
    `<h2 class="article-heading" id="h1">アンダーカード</h2>` +
    `<h3 class="article-subheading" id="s1">第2試合 ／萩原京平 vs. 鈴木千裕</h3>` +
    `<div class="raw-html"><p style="text-align:center;">RIZIN MMAルール：5分 3R（66.0kg）<br><span style="font-weight:bold">（LOSE）<a href="#">萩原京平</a> vs. <a href="#">鈴木千裕</a>（WIN）</span><br>2R 2分14秒 SUB</p></div>` +
    `<h3 class="article-subheading" id="s2">第1試合 ／大原樹理 vs. ルイス・グスタボ</h3>` +
    `<div class="raw-html"><p style="text-align:center;">RIZIN MMAルール：5分 3R（71.0kg）<br><span style="font-weight:bold">（LOSE）<a href="#">大原樹理</a> vs. <a href="#">ルイス・グスタボ</a>（WIN）</span><br>1R 1分23秒 SUB</p></div>`;
  const chunks = splitIntoBoutChunks(html);
  check(chunks.length === 2, "splitIntoBoutChunks: h2内の複数<h3>試合見出しをそれぞれ独立チャンクに展開する");
  const raw0 = parseBoutChunk(chunks[0]);
  const raw1 = parseBoutChunk(chunks[1]);
  check(raw0?.fighterAName === "萩原京平" && raw0?.fighterBName === "鈴木千裕", "splitIntoBoutChunks: 展開後の1件目が正しくパースできる(欠落バグの回帰確認)");
  check(raw1?.fighterAName === "大原樹理" && raw1?.fighterBName === "ルイス・グスタボ", "splitIntoBoutChunks: 展開後の2件目も正しくパースできる");
}

// ── 8c. splitIntoBoutChunks: フォーマットBの<h3>(勝敗結果行、"["で始まる)は
//       試合見出しとして誤展開しない(用途の異なる同名クラスとの区別) ────────
{
  const html = `<h2 class="article-heading" id="h1">第1試合：A vs. B</h2><p>［RIZIN MMAルール：...］</p><h3 class="article-subheading" id="s1">[Win] A （方法） B [Lose]</h3>`;
  const chunks = splitIntoBoutChunks(html);
  check(chunks.length === 1, "splitIntoBoutChunks: フォーマットBの結果行h3は見出しとして展開しない(1チャンクのまま)");
}

// ── 8d. 非標準の決着表記(「テクニカル判定」等)もdecisiveとして正しく
//       パースできる(round+timeの正規表現が技名に依存しないことの確認。
//       武田光司のRIZIN DECADE戦で実際に問題になったパターン) ──────────────
{
  const chunk = `<h2 class="article-heading" id="h1">第3試合／武田光司 vs. 新居すぐる</h2><figure></figure><div class="raw-html"><p style="text-align:center;"><br>RIZIN MMAルール：5分 3R（66.0kg）<br><span style="font-weight:bold">（WIN）<a href="#">武田光司</a> vs. <a href="#">新居すぐる</a>（LOSE）</span>\n<br>3R 4分09秒 テクニカル判定（3-0）</p></div>`;
  const raw = parseBoutChunk(chunk);
  check(raw !== null, "非標準決着表記: パースできる");
  check(raw?.markerA === "WIN" && raw?.markerB === "LOSE", "非標準決着表記: WIN/LOSEマーカーは決着方式の文言に関わらず正しく取れる");
  const method = raw ? parseMethod(raw.methodRaw, raw.markerA) : null;
  check(method?.resultType === "decisive", "非標準決着表記: 「テクニカル判定」もdecisiveとして分類する(round+time情報の有無で判定するため技名に依存しない)");
}

// ── 9. extractCardNumber ────────────────────────────────────────────────
{
  check(extractCardNumber("第12試合／秋元強真 vs. パッチー・ミックス") === 12, "extractCardNumber: 「第N試合」から番号を抽出する");
  check(extractCardNumber("フェザー級タイトルマッチ／A vs. B") === null, "extractCardNumber: 番号が無い見出し(タイトルマッチ表記)はnull");
}

// ── 10. parseRuleInfo: 明示された階級名の抽出 ────────────────────────────
{
  const info = parseRuleInfo("フェザー級タイトルマッチ RIZIN MMAルール：5分 3R（66.0kg）");
  check(info.namedDivision === "フェザー級", "parseRuleInfo: 明示された階級名を抽出する");
  const infoNoName = parseRuleInfo("RIZIN MMAルール：5分 3R（66.0kg）");
  check(infoNoName.namedDivision === null, "parseRuleInfo: 階級名の明示が無ければnull(推測しない)");
}

console.log(`\n${passes}件成功 / ${failures}件失敗`);
if (failures > 0) process.exit(1);
