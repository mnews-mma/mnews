// 指示書G: #424(パンクラスクロスorg監査131名/54名候補)で判明した欠落11件・
// slug未解決5件を対応する。read-only調査で個別に裏取り済みの分のみを
// data/pancraseRecords.json に直接パッチ/追記する(スキーマ複製ではなく
// 実在の公式イベントページから回収した実データ)。
//
// 内訳(#424の欠落11件を精査した結果):
// - 非プロ除外が正しい(修正不要): 山口怜臣×岡田嵐士(2022-12-25、アマチュア明記)
// - 既に反映済み・偽陽性(修正不要): 高城光弘/飯嶋重樹(嶋/島の異体字ゆれ)、
//   北岡悟/ペリグリーノ(ぺ/ペの小書きゆれ)、荒井勇二/EDDY RONIN JOSHUA
//   (カタカナ/ラテン文字表記ゆれ)。#424監査スクリプトの相手名正規化が
//   対応していなかっただけで、fighterASlug/fighterBSlugは元々正しい。
// - 要個別確認(本PRでは対応しない): 阿部大治×奈良貴明(2016-09-11、プロフィールは
//   「不戦勝」だが公式イベントページの同日カードは中村勇太戦になっており、
//   対戦相手の入れ替わりの可能性がある。裏取りには追加調査が必要)。
// - archive収録漏れ型(公式イベントページ側にbout自体は存在するが、
//   scripts/build-pancrase-records.tsのextractBoutTables()が
//   `<table id="...">`形式(id属性付き)のテーブルを取りこぼす既知の
//   バグにより未収録だった。id無し`<table>`のみを対象にした正規表現が
//   原因で、メインイベント・一部カード(id="maincard"/"card5"等)が
//   スキップされていた): 3件、公式イベントページの生HTMLから個別に
//   回収して追記する。
//
// slug未解決5件:
// - 新居すぐる(nii-suguru)の2戦: 公式サイト上で「新居卓」(nii.html)が
//   「コンバ王子」(konba.html、既存aliasesで解決済み)への直接リンクを
//   ページ自身に含んでおり、生年月日1991-01-13・出身地北海道・
//   マッハ道場所属が一致。同一人物と確認済み(船田電池と同型)。
// - ジェイク ムラタ(murata-jake)の4戦: 本人の公式プロフィールページ
//   (muratak.html、現在の表示名"Jake Murata")の戦績表に「村田康大」名義の
//   これら4戦が本人の記録として掲載されている。同一人物と確認済み。
// - 高城光弘(takashiro-mitsuhiro)の1戦: leftUrl(prfl2/taki.html、本人の
//   href)は正しいが、表示名テキストが「高城弘光」(光弘の字順が逆転した
//   誤記)になっておりslug未解決。URLベースで本人と確定。
//
// data/pancraseProfileBouts.json的な受け皿(shootoProfileBouts.jsonと同型の
// 分離ファイル)は作成しない。今回対応する分は全て公式イベントページ上に
// 実在するデータ(scraper側の取りこぼし)であり、プロフィールページ由来の
// 疑似イベントを新設する必要が無かったため。
//
// 実行: npx tsx scripts/fix-pancrase-gap-and-slug-resolution.ts
import fs from "fs";
import path from "path";
import { findFighterSlugByName } from "../src/lib/fighters";
import { classifyMmaRuleType } from "../src/lib/mnewsRating/nonProBoutFilter";

const RECORDS_PATH = path.join(process.cwd(), "data", "pancraseRecords.json");

function main() {
  const events: any[] = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
  const bySlugDate = (date: string, fighterAName: string, fighterBName: string) => {
    const ev = events.find((e) => e.date === date && e.bouts.some((b: any) => b.fighterAName === fighterAName && b.fighterBName === fighterBName));
    if (!ev) throw new Error(`[ERROR] event not found: ${date} ${fighterAName} vs ${fighterBName}`);
    const bout = ev.bouts.find((b: any) => b.fighterAName === fighterAName && b.fighterBName === fighterBName);
    if (!bout) throw new Error(`[ERROR] bout not found: ${date} ${fighterAName} vs ${fighterBName}`);
    return { ev, bout };
  };

  const patchLog: any[] = [];

  // ── slug未解決の解消(nii-suguru 2件・murata-jake 4件・takashiro-mitsuhiro 1件) ──
  interface SlugFix {
    date: string;
    fighterAName: string;
    fighterBName: string;
    side: "A" | "B";
    slug: string;
  }
  const SLUG_FIXES: SlugFix[] = [
    { date: "2016-06-12", fighterAName: "川那子祐輔", fighterBName: "新居卓", side: "B", slug: "nii-suguru" },
    { date: "2016-03-13", fighterAName: "渡慶次幸平", fighterBName: "新居卓", side: "B", slug: "nii-suguru" },
    { date: "2016-03-13", fighterAName: "村田康大", fighterBName: "金太郎", side: "A", slug: "murata-jake" },
    { date: "2015-10-04", fighterAName: "村田康大", fighterBName: "大橋悠一", side: "A", slug: "murata-jake" },
    { date: "2015-03-15", fighterAName: "村田康大", fighterBName: "神田T800 周一", side: "A", slug: "murata-jake" },
    { date: "2014-02-02", fighterAName: "ライダーHIRO", fighterBName: "村田康大", side: "B", slug: "murata-jake" },
    { date: "2021-12-12", fighterAName: "高城弘光", fighterBName: "水永将太", side: "A", slug: "takashiro-mitsuhiro" },
  ];

  for (const fix of SLUG_FIXES) {
    const { ev, bout } = bySlugDate(fix.date, fix.fighterAName, fix.fighterBName);
    const slugField = fix.side === "A" ? "fighterASlug" : "fighterBSlug";
    if (bout[slugField] !== null) {
      throw new Error(`[ERROR] 既にslugが設定済み(想定外): ${fix.date} ${fix.fighterAName} vs ${fix.fighterBName} ${slugField}=${bout[slugField]}`);
    }
    const before = { ...bout };
    bout[slugField] = fix.slug;
    // winnerSlugも、勝者名がこの選手と一致する場合は合わせて解決する。
    if (bout.winnerName === (fix.side === "A" ? fix.fighterAName : fix.fighterBName)) {
      bout.winnerSlug = fix.slug;
    }
    patchLog.push({ type: "slug_fix", date: fix.date, eventName: ev.eventName, before, after: { ...bout } });
  }

  // ── archive収録漏れ型3件の追記(公式イベントページの生HTMLから実測) ──
  interface NewBout {
    eventDate: string;
    eventName: string;
    headingText: string;
    fighterAName: string;
    fighterBName: string;
    leftMarkerRaw: string;
    rightMarkerRaw: string;
    round: string;
    time: string;
    methodRaw: string;
    leftUrl: string;
    rightUrl: string;
    weightLeftRaw: string;
    weightRightRaw: string;
  }
  const NEW_BOUTS: NewBout[] = [
    {
      eventDate: "2020-12-13",
      eventName: "PANCRASE 320",
      headingText: "メインイベント⑪　ウェルター級　5分3ラウンド",
      fighterAName: "村山暁洋",
      fighterBName: "菊入正行",
      leftMarkerRaw: "○",
      rightMarkerRaw: "×",
      round: "3R",
      time: "5:00",
      methodRaw: "3R 5:00、判定/3-0",
      leftUrl: "../../../data/prfl2/murayamaa.html",
      rightUrl: "../../../data/prfl2/kikuiri.html",
      weightLeftRaw: "村山暁洋(83.55kg)",
      weightRightRaw: "菊入正行(83.25kg)",
    },
    {
      eventDate: "2019-09-29",
      eventName: "PANCRASE308",
      headingText: "第5試合　ライト級(キャッチウェイト)　5分3ラウンド",
      fighterAName: "トム・サントス",
      fighterBName: "雑賀 ヤン坊 達也",
      leftMarkerRaw: "×",
      rightMarkerRaw: "○",
      round: "1R",
      time: "4:17",
      methodRaw: "1R 4:17、TKO/グラウンドのパンチ",
      leftUrl: "../../../data/prfl-e/tomsantos.html",
      rightUrl: "../../../data/prfl2/saika.html",
      weightLeftRaw: "トム・サントス(71.15kg)",
      weightRightRaw: "雑賀 ヤン坊 達也(70.15kg)",
    },
    {
      eventDate: "2020-07-24",
      eventName: "PANCRASE316",
      headingText: "第1試合　ライト級　5分3ラウンド",
      fighterAName: "平信一",
      fighterBName: "葛西和希",
      leftMarkerRaw: "×",
      rightMarkerRaw: "○",
      round: "2R",
      time: "2:14",
      methodRaw: "2R 2:14、TKO(レフェリーストップ)/グラウンドのパンチ",
      leftUrl: "../../../data/prfl2/taira.html",
      rightUrl: "../../../data/prfl2/kasaikazuki.html",
      weightLeftRaw: "平信一(70.2kg)",
      weightRightRaw: "葛西和希(70.05kg)",
    },
  ];

  const DECISIVE_MARKERS = ["○", "◯", "〇"];
  for (const nb of NEW_BOUTS) {
    const ev = events.find((e) => e.date === nb.eventDate && e.eventName === nb.eventName);
    if (!ev) throw new Error(`[ERROR] event not found: ${nb.eventDate} ${nb.eventName}`);
    // 二重投入防止: 同一の対戦カードが既に存在しないことを確認。
    const dup = ev.bouts.find((b: any) => b.fighterAName === nb.fighterAName && b.fighterBName === nb.fighterBName);
    if (dup) throw new Error(`[ERROR] 既に同一boutが存在(想定外): ${nb.eventDate} ${nb.fighterAName} vs ${nb.fighterBName}`);

    const fighterASlug = findFighterSlugByName(nb.fighterAName);
    const fighterBSlug = findFighterSlugByName(nb.fighterBName);
    const winnerName = DECISIVE_MARKERS.includes(nb.leftMarkerRaw)
      ? nb.fighterAName
      : DECISIVE_MARKERS.includes(nb.rightMarkerRaw)
        ? nb.fighterBName
        : null;
    const winnerSlug = winnerName === nb.fighterAName ? fighterASlug : winnerName === nb.fighterBName ? fighterBSlug : null;
    const namedDivisionMatch = nb.headingText.match(/(ライトヘビー級|ライトフライ級|スーパーヘビー級|スーパーフライ級|スーパーストロー級|無差別級|ヘビー級|ミドル級|ウェルター級|ライト級|フェザー級|バンタム級|フライ級|ストロー級|アトム級|ミニマム級)/);
    const namedDivision = namedDivisionMatch ? namedDivisionMatch[1] : null;
    const ruleType = classifyMmaRuleType(nb.headingText);

    // extractBoutTables()の`<table id="...">`取りこぼしバグにより既存の
    // cardPositionは元々「このboutを含まない総数」で採番済み。本スクリプトでは
    // 既存bout群の再採番は行わず(影響範囲が広く未検証のリスクがあるため)、
    // 回収したboutには既存最大値+1を割り当てる(このイベント限定の簡易対応、
    // 他イベントのcardPositionには一切触れない)。
    const maxCardPosition = Math.max(...ev.bouts.map((b: any) => b.cardPosition));

    const newBout = {
      cardPosition: maxCardPosition + 1,
      isOpeningFight: false,
      headingText: nb.headingText,
      fighterAName: nb.fighterAName,
      fighterBName: nb.fighterBName,
      fighterASlug,
      fighterBSlug,
      ruleType,
      weightKg: null,
      namedDivision,
      resultType: "decisive",
      winnerName,
      winnerSlug,
      round: nb.round,
      time: nb.time,
      methodRaw: nb.methodRaw,
      isWeighInMiss: false,
      weightClassRaw: namedDivision,
      leftUrl: nb.leftUrl,
      rightUrl: nb.rightUrl,
      leftMarkerRaw: nb.leftMarkerRaw,
      rightMarkerRaw: nb.rightMarkerRaw,
      weightLeftRaw: nb.weightLeftRaw,
      weightRightRaw: nb.weightRightRaw,
      note: "extractBoutTables()の<table id=...>取りこぼしバグにより未収録だったbout(指示書Gで公式イベントページから回収・追記)",
    };
    ev.bouts.push(newBout);
    patchLog.push({ type: "recovered_bout", eventDate: nb.eventDate, eventName: nb.eventName, bout: newBout });
  }

  fs.writeFileSync(RECORDS_PATH, JSON.stringify(events, null, 2) + "\n");
  console.log(`[OK] ${RECORDS_PATH} を更新しました(slug解消${SLUG_FIXES.length}件・回収bout追記${NEW_BOUTS.length}件)`);
  fs.writeFileSync(
    path.join(process.cwd(), "out", "pancrase-gap-and-slug-fix-log.json"),
    JSON.stringify(patchLog, null, 2) + "\n"
  );
  console.log("書き出し: out/pancrase-gap-and-slug-fix-log.json");
}

main();
