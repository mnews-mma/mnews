import { computeMultiOrgRecord, computeMultiOrgBoutTable, computeMultiOrgRates } from "../src/lib/mnewsRating/multiOrgRecord";
import { fetchRizinRecords, fetchShootoRecords, fetchPancraseRecords, fetchDeepRecords } from "../src/lib/multiOrgRecordsData";
import { computeFighterMmaRecord } from "../src/lib/mnewsRating/rizinRecordsAggregate";
import { computeFighterShootoRecord } from "../src/lib/mnewsRating/shootoRecordsAggregate";
import { computeFighterPancraseRecord } from "../src/lib/mnewsRating/pancraseRecordsAggregate";
import { computeFighterDeepRecord } from "../src/lib/mnewsRating/deepRecordsAggregate";

async function main() {
  const [rizinEvents, shootoEvents, pancraseEvents, deepEvents] = await Promise.all([
    fetchRizinRecords(),
    fetchShootoRecords(),
    fetchPancraseRecords(),
    fetchDeepRecords(),
  ]);
  const data = { rizinEvents, shootoEvents, pancraseEvents, deepEvents };
  const slug = "hoshuyama-momoka";

  const record = computeMultiOrgRecord(slug, data);
  const rows = computeMultiOrgBoutTable(slug, data);
  const rates = computeMultiOrgRates(record, rows);

  console.log("=== card (record) ===");
  console.log(JSON.stringify(record, null, 2));
  console.log("=== breakdown bar (rates) ===");
  console.log(JSON.stringify(rates, null, 2));
  console.log("card wins:", record.wins, " breakdown ko+sub+decision:", rates.ko + rates.sub + rates.decision);

  const winRows = rows.filter((r) => r.result === "win");
  console.log("winRows.length:", winRows.length);

  console.log("\n=== per-org aggregate ===");
  const rizin = computeFighterMmaRecord(rizinEvents, slug);
  const shooto = computeFighterShootoRecord(shootoEvents, slug);
  const pancrase = computeFighterPancraseRecord(pancraseEvents, slug);
  const deep = computeFighterDeepRecord(deepEvents, slug);
  for (const [name, agg] of [["rizin", rizin], ["shooto", shooto], ["pancrase", pancrase], ["deep", deep]] as const) {
    console.log(`-- ${name} --`, "wins:", agg.wins, "losses:", agg.losses, "draws:", agg.draws, "bouts.length:", agg.bouts.length, "excluded.length:", agg.excluded?.length);
    for (const b of agg.bouts) {
      console.log(JSON.stringify(b));
    }
    if (agg.excluded && agg.excluded.length > 0) {
      console.log(`-- ${name} excluded --`);
      for (const e of agg.excluded) {
        console.log(JSON.stringify(e));
      }
    }
  }

  console.log("\n=== bout rows (used for breakdown) ===");
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }
}
main();
