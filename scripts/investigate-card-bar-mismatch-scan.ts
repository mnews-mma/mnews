import { FIGHTERS } from "../src/lib/fighters";
import { fetchFighterRecords, mergeFighterRecord } from "../src/lib/fighterRecordsCache";
import { computeMultiOrgRecord, computeMultiOrgBoutTable, computeMultiOrgRates, shouldPreferMultiOrgRecord } from "../src/lib/mnewsRating/multiOrgRecord";
import { computeMethodSplit } from "../src/lib/fighterStrip";
import { fetchRizinRecords, fetchShootoRecords, fetchPancraseRecords, fetchDeepRecords } from "../src/lib/multiOrgRecordsData";

const SHOW_MULTI_ORG_RECORD = true; // mirror page.tsx flag (assumed true; verified via grep separately)

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
  const mismatches: string[] = [];

  for (const seed of FIGHTERS) {
    const fighter = mergeFighterRecord(seed, records);
    const { history, noRecordData } = fighter;
    if (noRecordData) continue; // MethodButterfly guarded out (line 676 !noRecordData)

    const multiOrgRecord = computeMultiOrgRecord(fighter.slug, data);
    const hasMultiOrgRecord = multiOrgRecord.wins > 0 || multiOrgRecord.losses > 0 || multiOrgRecord.draws > 0;
    if (!hasMultiOrgRecord) continue;
    const limitedSourceRow1Exceeded = shouldPreferMultiOrgRecord(fighter, fighter.wins, fighter.losses, fighter.draws, multiOrgRecord);
    const suppressNoRecordRow = (noRecordData || limitedSourceRow1Exceeded) && SHOW_MULTI_ORG_RECORD && hasMultiOrgRecord;
    if (!suppressNoRecordRow) continue; // card stays row1, bar stays row1 -> internally consistent (not this bug class)

    // Card shown = multiOrgRecord.wins. Bar shown = MethodButterfly(history) win total.
    const { win } = computeMethodSplit({ ...fighter, history } as any);
    const barWinTotal = win ? win.ko + win.sub + win.decision + win.other : 0;

    if (barWinTotal !== multiOrgRecord.wins) {
      mismatchCount++;
      mismatches.push(
        `${fighter.slug}: card(multiOrg).wins=${multiOrgRecord.wins} vs bar(raw history).winTotal=${barWinTotal} (raw history entries=${history.length})`
      );
    }
  }

  console.log(`Total fighters scanned with suppressNoRecordRow path: (see below)`);
  console.log(`Mismatch count: ${mismatchCount}`);
  for (const m of mismatches) console.log(m);
}
main();
