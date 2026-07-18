/**
 * Preview fixture must never appear in Production; incomplete fixtures stay empty.
 * npx tsx scripts/preview-fixture-gate-selftest.ts
 */
import {
  getPreviewFixturesForDisplay,
  isProductionRuntime,
  resolvePreviewFixtureCatalog,
} from "../src/lib/catalog/previewFixtureCatalog";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

let checks = 0;

assert(isProductionRuntime({ VERCEL_ENV: "production" }), "vercel production");
checks += 1;
assert(isProductionRuntime({ APP_ENV: "production" }), "app env production");
checks += 1;
assert(
  !isProductionRuntime({ VERCEL_ENV: "preview", NODE_ENV: "production" }),
  "preview + node production is not prod gate"
);
checks += 1;

const blocked = resolvePreviewFixtureCatalog({
  VERCEL_ENV: "production",
  ALLOW_PREVIEW_FIXTURES: "1",
});
assert(blocked.allowed === false, "prod blocked even with allow flag");
assert(blocked.products.length === 0, "prod products empty");
assert(
  getPreviewFixturesForDisplay({ VERCEL_ENV: "production" }).length === 0,
  "display helper empty on prod"
);
checks += 1;

const preview = resolvePreviewFixtureCatalog({
  VERCEL_ENV: "preview",
  ALLOW_PREVIEW_FIXTURES: "1",
});
assert(preview.allowed === true, "preview allowed");
assert(
  preview.reason === "no_complete_verified_fixture_in_repo",
  "no invented fixture"
);
assert(preview.products.length === 0, "preview products stay empty");
assert(preview.labeledAsPreview === true, "preview label ready if data exists");
checks += 1;

const local = resolvePreviewFixtureCatalog({
  NODE_ENV: "development",
  VERCEL_ENV: "",
});
assert(local.allowed === false, "plain local not auto-fixture");
assert(local.products.length === 0, "local empty");
checks += 1;

console.log(
  JSON.stringify({
    ok: true,
    checks,
    inventedFixtures: false,
    productionBlocked: true,
  })
);
