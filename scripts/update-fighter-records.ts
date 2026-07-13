// 定期実行(GitHub Actions)でWikipediaから選手戦績を取得し、data/fighterRecords.json に
// 焼き込む。getVisibleFighters()・各表示ページはこのJSONを読むだけにして、
// リクエスト時のライブfetchを無くす(可視選手数がリクエストごとに変動する問題の恒久対策)。
//
// 失敗時は前回値を保持(update-org-rankings.tsと同じ思想)。一度取れた戦績を、
// 次回fetch失敗で「データなし」に倒さない。selectors.tsの選手データ本体は一切書き換えない。
//
// 実行: npx tsx scripts/update-fighter-records.ts
import fs from "fs";
import path from "path";
import { FIGHTERS, Fighter } from "../src/lib/fighters";
import { resolveFighter } from "../src/lib/feeds/resolveFighter";
import type { FighterRecordEntry, FighterRecordsFile } from "../src/lib/fighterRecordsCache";
import { checkFighterRecordIntegrity } from "../src/lib/fighterRecordIntegrity";
import { enrichHistoryWithWeightClass } from "../src/lib/mnewsRating/enrichHistoryWeightClass";
import { applyRecordOverrides, applyRecordOverridesToTotals } from "../src/lib/mnewsRating/recordOverrides";

const OUT = path.join(process.cwd(), "data", "fighterRecords.json");
// fighterRecords.json自体には生成時刻を焼き込まない(選手データと運用メタ情報を
// 分離するため)。表示側の「データ最終更新」用に、このバッチの実行時刻だけを
// 別ファイルに記録する(サイト側はこのファイルの有無をハードコードせず参照する)。
const META_OUT = path.join(process.cwd(), "data", "fighterRecordsMeta.json");

// RIZIN MMA boutにEVENT_RESULTS(自社結果データ)突合のbout単位weightClassを
// 付与する(mnewsレーティングの掲載階級判定に使う。「直近のRIZIN試合の階級」の
// 実データが手に入る唯一の場所)。突合できなかったboutはnullBoutsに集計して返す
// (呼び出し側でwarningログに出す。推測補完はしない)。
function toCacheEntry(
  r: Awaited<ReturnType<typeof resolveFighter>>
): { entry: FighterRecordEntry; nullBouts: Array<{ date: string; opponent: string }> } {
  // 上流データ(Wikipedia)のパース誤り・欠落を出典付きで訂正(recordOverrides.ts)。
  // その後にRIZIN MMA boutへのweightClass付与を行う(訂正で追加されたboutも対象)。
  const correctedHistory = applyRecordOverrides(r.slug, r.history);
  const { history, nullBouts } = enrichHistoryWithWeightClass(r.nameJa, correctedHistory);
  // 2026-07-13緊急修正: 通算戦績(総合格闘技 戦績。RIZIN外を含む全キャリア)は
  // Wikipedia/DATA MMA/シード値(r.wins等)をそのまま据え置く。historyの都度
  // カウントには絶対に切り替えない(GAMMA戦績のように「試合履歴表には載っている
  // が編集方針上プロ戦績には数えない」試合が混入し、シェイドゥラエフの通算が
  // 19-0→22-0に水増しされる事故が発生したため)。通算戦績はRIZIN公式では
  // 裏取りできず、Wikipedia infoboxの編集判断を信頼するほかない値であり、
  // 「rizinRecords由来カウントに統一する」というPhase4の対象はRIZIN限定の集計
  // (rizinRecordsAggregate.ts)のみで、この通算戦績フィールドは対象外だった。
  // ただしRECORD_OVERRIDES(add型)で明示的に「Wikipedia戦績表に丸ごと欠落して
  // いる」と判明済みのbout(YA-MANのRIZIN.42デビュー戦等)は、生値(r.wins)への
  // 個別補正を維持する(r.historyという生値を毎回見て判定するため非冪等バグは
  // 再発しない。applyRecordOverridesToTotalsのコメント参照)。
  const totals = applyRecordOverridesToTotals(r.slug, r.history, {
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    ko: r.ko,
    sub: r.sub,
    decision: r.decision,
  });
  const entry: FighterRecordEntry = {
    ...totals,
    history,
    live: r.live,
    ...(r.nickname ? { nickname: r.nickname } : {}),
    ...(r.birthPlace ? { birthPlace: r.birthPlace } : {}),
    ...(r.age !== undefined ? { age: r.age } : {}),
    ...(r.noRecordData ? { noRecordData: true } : {}),
  };
  return { entry, nullBouts };
}

// Wikipedia側のレート制限に当たると同時実行数が多いほど失敗しやすい(実測: 5並列で
// 168人中76人が失敗したが、個別に単発実行すると同じ選手が普通に成功する)。
// そのため取得は直列(1件ずつ)・失敗時は間隔を空けて数回リトライする。
async function resolveWithRetry(f: Fighter, retries = 3): Promise<ReturnType<typeof resolveFighter> extends Promise<infer T> ? T : never> {
  let r = await resolveFighter(f);
  for (let i = 0; i < retries && r.noRecordData; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await resolveFighter(f);
  }
  return r;
}

// 既存JSONの読み込み。破損している場合でも{}にフォールバックして続行する
// (JSON.parse失敗をそのまま投げるとmain()がクラッシュし、次回実行時も同じ
// 破損ファイルを読んで再クラッシュし続ける自己修復不能ループになるため)。
function loadPrev(out: string): FighterRecordsFile {
  if (!fs.existsSync(out)) return {};
  try {
    return JSON.parse(fs.readFileSync(out, "utf8"));
  } catch (e) {
    console.warn(`[WARN] ${out} の読み込みに失敗(JSON破損の疑い)。前回値なしとして続行: ${e}`);
    return {};
  }
}

async function main() {
  const prev: FighterRecordsFile = loadPrev(OUT);

  // hidden選手も対象に含める(公開判定はgetVisibleFighters側のfilterが担うため、
  // ここで戦績を先取りしておいても表には出ない。hidden選手も追加時にWikipedia URLを
  // 設定する運用のため、公開昇格した瞬間に「データなし」にならないよう事前に温めておく)。
  const targets = FIGHTERS;
  const out: FighterRecordsFile = {};
  const failedNoFallback: string[] = [];
  const failedKeptPrev: string[] = [];
  const fatalIssues: string[] = [];
  const warningIssues: string[] = [];
  const weightClassNullBouts: string[] = [];

  for (const f of targets) {
    const r = await resolveWithRetry(f);
    const isBad = !!r.noRecordData;
    const prevEntry = prev[f.slug];
    const prevWasGood = !!prevEntry && !prevEntry.noRecordData;

    if (isBad && prevWasGood) {
      out[f.slug] = prevEntry;
      failedKeptPrev.push(f.slug);
    } else {
      const { entry, nullBouts } = toCacheEntry(r);
      out[f.slug] = entry;
      if (isBad) failedNoFallback.push(f.slug);
      for (const b of nullBouts) {
        weightClassNullBouts.push(`${f.slug}(${f.nameJa}) ${b.date} vs ${b.opponent}`);
      }
      // 集計値とhistory内訳の突合(検知のみ・自動修正はしない)。判定ロジックは
      // デプロイ前ゲート(scripts/check-fighter-records-integrity.ts)と共通化
      // している(checkFighterRecordIntegrity)。
      if (!isBad) {
        const issue = checkFighterRecordIntegrity(f.slug, f.nameJa, entry);
        if (issue) {
          const line = `${issue.slug}(${issue.nameJa}): ${issue.message}`;
          if (issue.severity === "fatal") fatalIssues.push(line);
          else warningIssues.push(line);
        }
      }
    }
    // 選手間にも軽くウェイトを入れて連続fetchの負荷を下げる。
    await new Promise((res) => setTimeout(res, 200));
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  fs.writeFileSync(META_OUT, JSON.stringify({ generatedAt: new Date().toISOString() }, null, 2) + "\n");

  const visibleCount = Object.values(out).filter((r) => !r.noRecordData).length;
  console.log(`対象: ${targets.length}人 / 可視(noRecordData以外): ${visibleCount}人`);
  if (failedKeptPrev.length) {
    console.log(`今回取得失敗・前回値を保持(${failedKeptPrev.length}人): ${failedKeptPrev.join(", ")}`);
  }
  if (failedNoFallback.length) {
    console.log(`今回取得失敗・前回値なしのためデータなし(${failedNoFallback.length}人): ${failedNoFallback.join(", ")}`);
  }
  if (warningIssues.length) {
    console.warn(
      `[WARN] 集計値とhistory内訳が不一致(${warningIssues.length}人・一次ソース確認が必要、要人手判断):\n  ${warningIssues.join("\n  ")}`
    );
  }
  if (weightClassNullBouts.length) {
    // EVENT_RESULTSに未収録(主に古い試合)で試合単位の階級が突合できなかったbout。
    // 掲載階級判定からは除外されるだけで、Elo計算自体には引き続き使われる。
    console.warn(
      `[WARN] RIZIN MMA boutの階級(weightClass)がEVENT_RESULTSと突合できず不明(${weightClassNullBouts.length}件):\n  ${weightClassNullBouts.join("\n  ")}`
    );
  }
  if (fatalIssues.length) {
    // ここでバッチ自体を失敗させると、コミット前(fs.writeFileSyncは既に完了済み)
    // のためファイルは書き込まれてしまうが、デプロイ前ゲート
    // (scripts/check-fighter-records-integrity.ts)がnext buildの直前で
    // 必ず同じ判定を再実行してブロックするため、二重の安全網になる。
    console.error(
      `[ERROR] 論理破綻を検出(${fatalIssues.length}人・要即時確認):\n  ${fatalIssues.join("\n  ")}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
