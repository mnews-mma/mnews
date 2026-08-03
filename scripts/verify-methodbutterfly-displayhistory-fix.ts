import { FIGHTERS } from "../src/lib/fighters";
import { fetchFighterRecords, mergeFighterRecord } from "../src/lib/fighterRecordsCache";
import {
  computeMultiOrgRecord,
  computeMultiOrgBoutTable,
  computeMultiOrgRates,
  shouldPreferMultiOrgRecord,
} from "../src/lib/mnewsRating/multiOrgRecord";
import { computeMethodSplit } from "../src/lib/fighterStrip";
import { fetchRizinRecords, fetchShootoRecords, fetchPancraseRecords, fetchDeepRecords } from "../src/lib/multiOrgRecordsData";

const SHOW_MULTI_ORG_RECORD = true;

async function main() {
  const [rizinEvents, shootoEvents, pancraseEvents, deepEvents] = await Promise.all([
    fetchRizinRecords(),
    fetchShootoRecords(),
    fetchPancraseRecords(),
    fetchDeepRecords(),
  ]);
  const data = { rizinEvents, shootoEvents, pancraseEvents, deepEvents };
  const records = await fetchFighterRecords();

  let mismatchCount = 0;
  let scannedSuppressed = 0;
  const mismatches: string[] = [];

  for (const seed of FIGHTERS) {
    const fighter = mergeFighterRecord(seed, records);
    const { history, noRecordData } = fighter;
    if (noRecordData) continue; // MethodButterfly guarded out (line 676 !noRecordData)

    const multiOrgRecord = computeMultiOrgRecord(fighter.slug, data);
    const hasMultiOrgRecord = multiOrgRecord.wins > 0 || multiOrgRecord.losses > 0 || multiOrgRecord.draws > 0;
    const limitedSourceRow1Exceeded = hasMultiOrgRecord
      ? shouldPreferMultiOrgRecord(fighter, fighter.wins, fighter.losses, fighter.draws, multiOrgRecord)
      : false;
    const suppressNoRecordRow = (noRecordData || limitedSourceRow1Exceeded) && SHOW_MULTI_ORG_RECORD && hasMultiOrgRecord;
    if (!suppressNoRecordRow) continue; // not the buggy path (row1 shown consistently in both card & bar)
    scannedSuppressed++;

    // Reproduce page.tsx's new displayHistory / methodButterflyHistory construction exactly.
    const multiOrgBoutRows = computeMultiOrgBoutTable(fighter.slug, data);
    const displayHistory = multiOrgBoutRows.map((b) => ({
      date: b.date,
      opponentName: b.opponentName,
      opponentSlug: b.opponentSlug,
      result: b.result,
      method: b.method,
      event: b.event,
    }));
    const methodButterflyHistory = displayHistory.map((h) => ({
      date: h.date,
      opponent: h.opponentName,
      result: h.result,
      method: h.method,
      event: h.event,
      round: "",
    }));

    const { win } = computeMethodSplit({ ...fighter, history: methodButterflyHistory } as any);
    const barWinTotal = win ? win.ko + win.sub + win.decision + win.other : 0;

    // card wins shown = multiOrgRecord.wins (since suppressNoRecordRow => 2行目のみ表示)
    if (barWinTotal !== multiOrgRecord.wins) {
      mismatchCount++;
      mismatches.push(
        `${fighter.slug}: card(multiOrg).wins=${multiOrgRecord.wins} vs bar(displayHistory-based).winTotal=${barWinTotal} (rows=${methodButterflyHistory.length}, raw-history-len=${history.length})`
      );
    }
  }

  console.log(`Scanned (suppressNoRecordRow===true) fighters: ${scannedSuppressed}`);
  console.log(`Mismatch count: ${mismatchCount}`);
  for (const m of mismatches) console.log(m);
}
main();
