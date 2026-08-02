import fs from "fs";
import path from "path";
import { computeMultiOrgRecord, computeMultiOrgBoutTable } from "../src/lib/mnewsRating/multiOrgRecord";
import { ShootoRecordsEvent } from "../src/lib/mnewsRating/shootoScraper";

const archive: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoRecords.json"), "utf8"));
const profile: ShootoRecordsEvent[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "shootoProfileBouts.json"), "utf8"));

const before = computeMultiOrgRecord("yamagami-mikihito", { rizinEvents: [], shootoEvents: archive, pancraseEvents: [], deepEvents: [] });
const after = computeMultiOrgRecord("yamagami-mikihito", { rizinEvents: [], shootoEvents: [...archive, ...profile], pancraseEvents: [], deepEvents: [] });
console.log("BEFORE:", before);
console.log("AFTER:", after);

const rows = computeMultiOrgBoutTable("yamagami-mikihito", { rizinEvents: [], shootoEvents: [...archive, ...profile], pancraseEvents: [], deepEvents: [] });
console.log("bout rows after:", rows.length);
rows.forEach((r) => console.log(r.date, r.opponentName, r.result, r.event));
