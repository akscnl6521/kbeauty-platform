import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const route = await readFile("src/app/api/admin/review/route.ts", "utf8");

  for (const expected of [
    "withAdminAuth",
    "ADMIN_ROLES",
    "getUnifiedReviewManifest",
    'searchParams.get("source")',
    'searchParams.get("priority")',
    'searchParams.get("q")',
    "UNIFIED_REVIEW_UNAVAILABLE",
  ]) {
    assert.ok(route.includes(expected), `missing API safeguard or filter: ${expected}`);
  }

  for (const forbidden of [
    'method: "POST"',
    'method: "PUT"',
    'method: "PATCH"',
    'method: "DELETE"',
    ".insert(",
    ".update(",
    ".delete(",
    "publishAllowed: true",
  ]) {
    assert.ok(!route.includes(forbidden), `read-only API contains forbidden token: ${forbidden}`);
  }

  assert.ok(route.includes('export const GET ='), "API must expose GET only");
  assert.ok(!route.includes("export const POST"), "API must not expose POST");
  console.log("admin review API selftest: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
