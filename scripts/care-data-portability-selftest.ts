import assert from "node:assert/strict";
import {
  buildCareExportBundle,
  careExportFilename,
  serializeCareExport,
  summarizeCareStoreForDeletion,
} from "../src/lib/care/dataPortability";
import { emptyCareStore } from "../src/lib/care/local-store";

const now = new Date("2026-07-19T03:00:00.000Z");
const store = emptyCareStore("Asia/Seoul");
store.sessions.push({} as never);
store.checkIns.push({} as never);

const bundle = buildCareExportBundle(store, now);
assert.equal(bundle.schema, "kbeauty-care-export-v1");
assert.equal(bundle.exportedAt, now.toISOString());
assert.equal(bundle.data.settings.timezone, "Asia/Seoul");
assert.equal(careExportFilename(now), "kbeauty-care-2026-07-19.json");
assert.match(serializeCareExport(store, now), /kbeauty-care-export-v1/);
assert.deepEqual(summarizeCareStoreForDeletion(store), {
  sessions: 1,
  routines: 0,
  checkIns: 1,
  notifications: 0,
  feedback: 0,
});

console.log("care data portability self-test passed");
