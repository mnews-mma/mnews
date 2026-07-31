// read-only audit script — 勝敗マーカー誤読の横断調査
// 修正は行わない。標準出力にJSONレポートを出す。
import fs from 'node:fs';

const FILES = {
  RIZIN: 'data/rizinRecords.json',
  DEEP: 'data/deepRecords.json',
  PANCRASE: 'data/pancraseRecords.json',
  SHOOTO: 'data/shootoRecords.json',
};

// 名前フィールドに混入していないかチェックする対象文字(勝敗マーカー記号)
// 注意: ☆★は選手のリングネームの一部として頻出するため対象から除外
// (例: "ANIMAL☆KOJI" "WINDY智美" は誤検知だった。実地確認で除去済み)
const MARKER_CHARS = /[○×●◎✕✖✓✔△▲]/;

function loadEvents(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeName(s) {
  if (!s) return '';
  return s.replace(/\s+/g, '').trim();
}

const findings = {
  bothWinOrBothLose: [], // 1
  missingWinnerOnDecisive: [], // 2
  winnerNotInBout: [], // 3
  markerLeakedIntoName: [], // 4
};

for (const [org, file] of Object.entries(FILES)) {
  let events;
  try {
    events = loadEvents(file);
  } catch (e) {
    console.error(`skip ${org}: ${e.message}`);
    continue;
  }

  for (const ev of events) {
    const eventName = ev.eventName ?? null;
    const date = ev.date ?? null;
    for (const b of ev.bouts || []) {
      const a = b.fighterAName;
      const bb = b.fighterBName;
      const winner = b.winnerName;
      const winnerSlug = b.winnerSlug;

      // --- 4. マーカー文字混入チェック(全org、名前フィールド全般) ---
      for (const [field, val] of [
        ['fighterAName', a],
        ['fighterBName', bb],
        ['winnerName', winner],
      ]) {
        if (typeof val === 'string' && MARKER_CHARS.test(val)) {
          findings.markerLeakedIntoName.push({
            org, eventName, date, field, value: val,
            fighterAName: a, fighterBName: bb, winnerName: winner,
            cardPosition: b.cardPosition,
          });
        }
      }

      // --- pancrase専用: leftMarkerRaw/rightMarkerRaw の整合チェック ---
      if (org === 'PANCRASE') {
        const lm = b.leftMarkerRaw;
        const rm = b.rightMarkerRaw;
        const isWin = (m) => m === '○';
        const isLose = (m) => m === '×' || m === '●';
        if (lm != null && rm != null) {
          // 1. 両者勝ち/両者負け(マーカーベース)
          if ((isWin(lm) && isWin(rm)) || (isLose(lm) && isLose(rm))) {
            findings.bothWinOrBothLose.push({
              org, eventName, date, cardPosition: b.cardPosition,
              fighterAName: a, fighterBName: bb,
              leftMarkerRaw: lm, rightMarkerRaw: rm,
              winnerName: winner, resultType: b.resultType,
              reason: 'marker_pair',
            });
          }
          // マーカーとwinnerNameの不一致(decisiveの場合のみ)
          if (b.resultType === 'decisive' && winner) {
            const markerWinner = isWin(lm) ? a : (isWin(rm) ? bb : null);
            if (markerWinner && normalizeName(markerWinner) !== normalizeName(winner)) {
              findings.bothWinOrBothLose.push({
                org, eventName, date, cardPosition: b.cardPosition,
                fighterAName: a, fighterBName: bb,
                leftMarkerRaw: lm, rightMarkerRaw: rm,
                winnerName: winner, markerImpliedWinner: markerWinner,
                resultType: b.resultType,
                reason: 'marker_vs_winnerName_mismatch',
              });
            }
          }
        }
      }

      // --- 2. resultType=decisive なのに winnerName/winnerSlug が空・欠損 ---
      if (b.resultType === 'decisive' && (!winner || winner === '')) {
        findings.missingWinnerOnDecisive.push({
          org, eventName, date, cardPosition: b.cardPosition,
          fighterAName: a, fighterBName: bb,
          winnerName: winner, winnerSlug: winnerSlug,
          methodRaw: b.methodRaw,
        });
      }

      // --- 3. winnerName が出場者どちらとも不一致 ---
      if (winner) {
        const nWinner = normalizeName(winner);
        const nA = normalizeName(a);
        const nB = normalizeName(bb);
        if (nWinner !== nA && nWinner !== nB) {
          findings.winnerNotInBout.push({
            org, eventName, date, cardPosition: b.cardPosition,
            fighterAName: a, fighterBName: bb, winnerName: winner,
            resultType: b.resultType,
          });
        }
      }
    }
  }
}

// --- 補足チェック: fighterRecords.json(選手別derivation)との突合 ---
// 万智/渡辺彩華の実際の症状(選手ページで両者「敗」)は生データ側(rizinRecords.json)には
// 現れず、選手別に展開されたfighterRecords.jsonの側でしか再現しない可能性があるため、
// 4団体の各boutでfighterASlug/fighterBSlugが両方揃っているものについて、
// fighterRecords.json側の該当試合(日付一致)の結果が「両者win」「両者loss」になって
// いないかを突合する。ここはユーザー指定の4ファイルの範囲を超えるが、報告された症状を
// 再現できる唯一の経路のため補足として実施する。
findings.fighterRecordsBothSameResult = [];
findings.fighterRecordsMissingSide = [];

let fighterRecords = {};
try {
  fighterRecords = JSON.parse(fs.readFileSync('data/fighterRecords.json', 'utf8'));
} catch (e) {
  console.error('fighterRecords.json load failed:', e.message);
}

function findHistoryEntry(slug, date, opponentName) {
  const rec = fighterRecords[slug];
  if (!rec || !Array.isArray(rec.history)) return undefined;
  const sameDate = rec.history.filter(h => h.date === date);
  if (sameDate.length === 0) return undefined;
  if (sameDate.length === 1) return sameDate[0];
  // 同日複数戦(トーナメント形式)は対戦相手名で一意に絞る
  const nOpp = normalizeName(opponentName);
  const byOpponent = sameDate.find(h => normalizeName(h.opponent) === nOpp);
  return byOpponent; // 一意化できなければ undefined(誤突合を避ける)
}

for (const [org, file] of Object.entries(FILES)) {
  let events;
  try {
    events = loadEvents(file);
  } catch {
    continue;
  }
  for (const ev of events) {
    for (const b of ev.bouts || []) {
      if (b.resultType !== 'decisive') continue;
      if (!b.fighterASlug || !b.fighterBSlug) continue;
      const hA = findHistoryEntry(b.fighterASlug, ev.date, b.fighterBName);
      const hB = findHistoryEntry(b.fighterBSlug, ev.date, b.fighterAName);
      if (!hA && !hB) continue; // どちらもfighterRecords未収録(スコープ外)
      if (!hA || !hB) {
        findings.fighterRecordsMissingSide.push({
          org, eventName: ev.eventName, date: ev.date, cardPosition: b.cardPosition,
          fighterAName: b.fighterAName, fighterBName: b.fighterBName,
          fighterASlug: b.fighterASlug, fighterBSlug: b.fighterBSlug,
          winnerName: b.winnerName,
          missingSide: !hA ? 'A' : 'B',
        });
        continue;
      }
      const bothSame = hA.result != null && hB.result != null && hA.result === hB.result && hA.result !== 'draw';
      if (bothSame) {
        findings.fighterRecordsBothSameResult.push({
          org, eventName: ev.eventName, date: ev.date, cardPosition: b.cardPosition,
          fighterAName: b.fighterAName, fighterBName: b.fighterBName,
          fighterASlug: b.fighterASlug, fighterBSlug: b.fighterBSlug,
          winnerName: b.winnerName,
          fighterA_recordedResult: hA.result,
          fighterB_recordedResult: hB.result,
        });
      }
    }
  }
}

console.log(JSON.stringify({
  counts: Object.fromEntries(Object.entries(findings).map(([k, v]) => [k, v.length])),
  findings,
}, null, 2));
