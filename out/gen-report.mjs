import fs from "node:fs";

const r = JSON.parse(fs.readFileSync("out/analyze-shooto-recheck.result.json", "utf8"));

function score(f) {
  const meaningfulHist = f.historyDiffs.filter((d) => d.diffs.length > 0).length;
  const notFound = f.isMultiOrg ? 0 : f.notFoundInRecords.length;
  const missing = f.missingFromInjected.length;
  const agg = f.aggregate && !f.aggregate.matches ? 1 : 0;
  return meaningfulHist + notFound + missing + agg;
}

const scored = r.map((f) => ({ f, score: score(f) }));
const withDiff = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
const noDiff = scored.filter((x) => x.score === 0).map((x) => x.f);

// カテゴリ別集計
let cResult = 0,
  cMethod = 0,
  cRound = 0,
  cEvent = 0,
  cFormatOnly = 0,
  cNotFound = 0,
  cMissing = 0,
  cAgg = 0;
for (const f of r) {
  for (const d of f.historyDiffs) {
    for (const diff of d.diffs) {
      if (diff.field === "result") cResult++;
      if (diff.field === "method") cMethod++;
      if (diff.field === "round") cRound++;
      if (diff.field === "event") cEvent++;
    }
    cFormatOnly += d.formatOnlyDiffs.length;
  }
  cNotFound += f.isMultiOrg ? 0 : f.notFoundInRecords.length;
  cMissing += f.missingFromInjected.length;
  if (f.aggregate && !f.aggregate.matches) cAgg++;
}

const totalMultiOrgNotFound = r
  .filter((f) => f.isMultiOrg)
  .reduce((a, f) => a + f.notFoundInRecords.length, 0);

const lines = [];
lines.push("# PR #252(修斗関連)投入値 vs data/shootoRecords.json 再集計 突合レポート");
lines.push("");
lines.push(`作成日: 2026-07-29`);
lines.push(`対象: draft PR #258 (branch \`feat/roster-recheck-shooto\`) 読み取り専用調査`);
lines.push("");
lines.push("## 停止条件チェック");
lines.push("");
if (withDiff.length > 40) {
  lines.push(
    `**停止条件に該当**: 差分のある選手が${withDiff.length}名で40名を超えています。次のアクション(PR#252の修正等)に進む前に人間の判断を仰いでください。`
  );
} else {
  lines.push(
    `差分のある選手は${withDiff.length}名で、40名の停止条件には該当しません(そのまま完了報告します)。`
  );
}
lines.push("");
lines.push("## サマリー");
lines.push("");
lines.push(`- 対象選手数(修斗関連。\`org==="shooto"\` または \`orgs\`に\`"shooto"\`を含む): **${r.length}名**`);
lines.push(`  - 内訳: 単独修斗(org==="shooto") 57名 / 複数団体混在(KAREN・SARAMI) 2名`);
lines.push(`- 差分ありの選手数: **${withDiff.length}名**`);
lines.push(`- 差分なしの選手数: ${noDiff.length}名`);
lines.push("");
lines.push("### 差分の内訳(件数はbout単位、複数選手にまたがる同一試合の重複カウントを含む)");
lines.push("");
lines.push(`- \`result\`違い(win/loss/draw/ncの実際の勝敗が投入値と異なる): **${cResult}件**`);
lines.push(`  - 全件が「投入データではwin/lossだったが、再集計ではdraw」というパターン。背景に記載のドロー誤判定バグと一致する。`);
lines.push(`- \`method\`違い(内容差、区切り文字ノイズを除く): **${cMethod}件**`);
lines.push(`  - 全件が「投入データのmethodが空文字列("")だが、再集計では"ドロー"」というパターン(resultフィールドは既にdrawで一致しているケースも含む=method情報のみの欠落)。`);
lines.push(`- \`round\`違い: **${cRound}件**`);
lines.push(`- \`event\`名違い: **${cEvent}件**(大会名が"プロフェッショナル修斗公式戦"という汎用ラベルだったものが、再集計では実際の大会名に解決)`);
lines.push(`- 投入データにあるが再集計データに見つからない試合(\`notFoundInRecords\`、KAREN/SARAMIの想定パンクラス分を除く): **${cNotFound}件**`);
lines.push(`- 再集計データにあるが投入データ(history)に無い試合(\`missingFromInjected\`、KAREN/SARAMIを除く単独修斗選手のみ対象): **${cMissing}件**`);
lines.push(`- 集計値(wins/losses/draws)が投入値と不一致の選手数(KAREN/SARAMIを除く): **${cAgg}名**`);
lines.push("");
lines.push(
  `参考情報(差分にはカウントしていないもの): methodフィールドで区切り文字(スラッシュ"/" ⇔ 半角スペース)のみが異なる表記ゆれが **${cFormatOnly}件** あった。これは値の相違ではなく表記規約の違いであることをサンプル照合で確認済み(下記「検証メモ」参照)。KAREN・SARAMIについては、投入データ13件・7件のうちそれぞれ12件・3件が\`data/shootoRecords.json\`(修斗のみのデータ)に見つからなかったが、これは全件パンクラス側の試合(イベント名が"PANCRASE ###")であることを確認済みであり、想定どおりの結果(修斗データに無くて当然)。`
);
lines.push("");
lines.push("## 検証メモ(突合ロジックの妥当性確認)");
lines.push("");
lines.push(
  "- 既知の一致するはずの試合を人力で3件、`data/shootoRecords.json`の生データと目視突合し、突合ロジックが正しく拾うことを確認した:"
);
lines.push(
  "  1. `asahina-ken`(旭那拳) vs 黒部和沙 (2026-01-18, PROFESSIONAL SHOOTO 2026 Vol.1): 投入値`result:\"loss\", method:\"判定 3-0\"` → 生データ`resultType:\"decisive\", winnerName:\"黒部 和沙\", methodRaw:\"判定 3-0\"`。一致確認。"
);
lines.push(
  "  2. `asahina-ken` vs 友利琉偉 (2025-09-21): 投入値`result:\"win\", method:\"S\", round:\"R1 04:55\"` → 生データ`resultType:\"decisive\", winnerName:\"旭那 拳\", methodRaw:\"S\", round:\"1R\", time:\"04:55\"`(round/time結合ロジック `\"1R\"+\"04:55\"` → `\"R1 04:55\"` が投入値と一致)。一致確認。"
);
lines.push(
  "  3. `nakajima-riku`(中島陸) vs 青井心ニ (2024-12-29): 投入値`result:\"loss\"` → 生データは`resultType:\"draw\", methodRaw:\"ドロー\"`(投入値の\"loss\"は誤り、正しくは\"draw\")。背景に記載のドロー誤判定バグの実例を直接確認。"
);
lines.push(
  "- method文字列の一次突合で142件の「差分」が検出されたが、うち130件は`\"TKO/レフェリーストップ\"`(投入データ側)と`\"TKO レフェリーストップ\"`(再集計データ側)のように、カテゴリコードと詳細の区切り文字がスラッシュか半角スペースかだけが異なる表記ゆれだった(2つ目以降の区切りは両者とも\"/\"のまま)。これを区切り文字ノイズとして除外し、内容そのものが異なる12件のみを実質差分として計上した(その12件は全て「投入データのmethodが空文字列、再集計では\"ドロー\"」というパターンで、ドロー誤判定バグに付随する情報欠落)。"
);
lines.push(
  "- 逆方向チェック(名前一致するがhistoryに無い試合)で見つかった件数のうち、KAREN・SARAMI以外は`resultType`が`nc`/`unknown`/`cancelled`のもの(未解決試合、PR#252側で意図的に除外されたと推定されるもの)が大半だったが、`asahina-ken`のふじい☆ペリー戦(2018-11-25, 勝利)と`fujino-emi`の前澤智戦(2024-12-15, ドロー)の2件は`resultType:\"decisive\"`/`\"draw\"`の解決済み試合であり、単純な除外基準では説明できない純粋な欠落として個別に記録した。"
);
lines.push("");

lines.push("## 差分ありの選手(差分件数の多い順)");
lines.push("");

for (const { f, score: sc } of withDiff) {
  lines.push(`### ${f.nameJa} (\`${f.slug}\`) — 差分 ${sc}件`);
  lines.push("");
  const orgLabel = f.isMultiOrg ? `org=${f.org}, orgs=${JSON.stringify(f.orgs)}` : `org=${f.org}`;
  lines.push(`- ${orgLabel}`);
  lines.push(
    `- 投入値(wins-losses-draws): **${f.injectedTotals.wins}-${f.injectedTotals.losses}-${f.injectedTotals.draws}**`
  );
  if (f.isMultiOrg) {
    lines.push(`- 再集計値: 複数団体のため集計比較対象外`);
  } else if (f.aggregate) {
    const a = f.aggregate.recomputed;
    lines.push(
      `- 再集計値(data/shootoRecords.jsonのみ、修斗分): **${a.wins}-${a.losses}-${a.draws}**` +
        (a.ncs || a.ambiguous
          ? `(参考: nc ${a.ncs}件, 未解決/中止等ambiguous ${a.ambiguous}件は勝敗集計に含めず)`
          : "") +
        (f.aggregate.matches ? "" : " **← 投入値と不一致**")
    );
  }
  lines.push("");

  const meaningfulHist = f.historyDiffs.filter((d) => d.diffs.length > 0);
  if (meaningfulHist.length > 0) {
    lines.push(`**bout内容の差分(${meaningfulHist.length}件):**`);
    lines.push("");
    for (const d of meaningfulHist) {
      lines.push(`- ${d.date} vs ${d.opponent}${d.multiMatch ? "(複数マッチ候補あり、先頭を採用)" : ""}`);
      for (const diff of d.diffs) {
        lines.push(`  - ${diff.field}: \`${diff.from}\` → \`${diff.to}\``);
      }
    }
    lines.push("");
  }

  if (!f.isMultiOrg && f.notFoundInRecords.length > 0) {
    lines.push(`**投入データにはあるが再集計データに見つからない試合(${f.notFoundInRecords.length}件、要調査):**`);
    lines.push("");
    for (const n of f.notFoundInRecords) {
      lines.push(`- ${n.date} vs ${n.opponent} (${n.result}, ${n.method}, ${n.event})`);
    }
    lines.push("");
  } else if (f.isMultiOrg && f.notFoundInRecords.length > 0) {
    lines.push(
      `**投入データにはあるが再集計データ(修斗)に見つからない試合(${f.notFoundInRecords.length}件): 参考情報。イベント名が全てPANCRASE表記のためパンクラス側の試合と推定。集計・順位付けの差分スコアには含めていない。**`
    );
    lines.push("");
    for (const n of f.notFoundInRecords) {
      lines.push(`- ${n.date} vs ${n.opponent} (${n.result}, ${n.method}, ${n.event})`);
    }
    lines.push("");
  }

  if (f.missingFromInjected.length > 0) {
    lines.push(`**再集計では見つかるが投入データ(history)には無い試合(${f.missingFromInjected.length}件):**`);
    lines.push("");
    for (const m of f.missingFromInjected) {
      lines.push(
        `- ${m.date} vs ${m.opponent} → resultType=${m.resultType}${m.outcome ? `(outcome=${m.outcome})` : ""}, method="${m.method}", event="${m.event}"`
      );
    }
    lines.push("");
  }

  const formatOnly = f.historyDiffs.reduce((a, d) => a + d.formatOnlyDiffs.length, 0);
  if (formatOnly > 0) {
    lines.push(`*(参考: 上記とは別に、method区切り文字のみの表記ゆれが${formatOnly}件あったが内容は同一のため差分に含めていない)*`);
    lines.push("");
  }
}

lines.push("## 差分なしの選手(一覧)");
lines.push("");
lines.push(`計${noDiff.length}名。history全件が日付・対戦相手・結果・方法・ラウンド・大会名まで再集計データと一致し、集計値(wins/losses/draws)も一致、逆方向チェックでの欠落も無かった。`);
lines.push("");
lines.push(noDiff.map((f) => `\`${f.slug}\`(${f.nameJa})`).join("、"));
lines.push("");

fs.writeFileSync("out/roster-recheck-shooto.md", lines.join("\n") + "\n");
console.log("wrote out/roster-recheck-shooto.md");
console.log("withDiff:", withDiff.length, "noDiff:", noDiff.length);
