/**
 * Unit checks for label-sheet admin apply helpers (no network / no Staging).
 */
import assert from "node:assert/strict";
import {
  entryHasTokens,
  loadOfficialInciSheetFromDisk,
} from "@/lib/admin/catalogLabelSheetDisk";

function main() {
  const sheet = loadOfficialInciSheetFromDisk();
  assert.ok(sheet.entries.length >= 1);
  const ready = sheet.entries.filter((e) => e.applyReady && entryHasTokens(e));
  assert.ok(ready.length >= 1, "expected applyReady entries with tokens");
  const banila = sheet.entries.find(
    (e) => e.externalProductId === "banila-co-clean-it-zero-original"
  );
  if (banila) {
    assert.equal(banila.applyReady, true);
    assert.equal(entryHasTokens(banila), true);
    assert.match(String(banila.sourceUrl ?? ""), /banilausa\.com/i);
    assert.match(String(banila.notes ?? ""), /official US brand PDP|OBF foam/i);
  }
  console.log(
    JSON.stringify({
      ok: true,
      entries: sheet.entries.length,
      applyReady: ready.length,
    })
  );
}

main();
