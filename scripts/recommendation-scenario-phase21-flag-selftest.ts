import assert from "node:assert/strict";
import {
  isScenarioPilotPhase2Enabled,
  isScenarioPilotPreviewDebugEnabled,
} from "../src/lib/recommend/scenarios/pilotPhase2";

type StorageMap = Map<string, string>;

function makeWindow(store: StorageMap) {
  return {
    localStorage: {
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
    },
  };
}

{
  const prev = process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2;
  process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 = "true";
  assert.equal(isScenarioPilotPhase2Enabled(), true);
  process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 = "false";
  assert.equal(isScenarioPilotPhase2Enabled(), false);
  if (prev == null) delete process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2;
  else process.env.NEXT_PUBLIC_SCENARIO_PILOT_PHASE2 = prev;
}

{
  assert.equal(
    isScenarioPilotPreviewDebugEnabled({
      NODE_ENV: "development",
      VERCEL_ENV: "development",
    } as NodeJS.ProcessEnv),
    true
  );
  assert.equal(
    isScenarioPilotPreviewDebugEnabled({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    } as NodeJS.ProcessEnv),
    true
  );
  assert.equal(
    isScenarioPilotPreviewDebugEnabled({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    } as NodeJS.ProcessEnv),
    false
  );
}

async function main() {
  const store = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = makeWindow(store);
  const {
    discardStaleRankedProductsCache,
    writeRecommendationCacheVersion,
  } = await import("../src/lib/recommend/recommendationCache");

  store.set("skinRankedProducts", JSON.stringify([{ product: { id: "legacy" } }]));
  store.set("recommendationCacheVersion", "OLD_VERSION");
  assert.equal(discardStaleRankedProductsCache(), true);
  assert.equal(store.has("skinRankedProducts"), false);

  writeRecommendationCacheVersion();
  store.set("skinRankedProducts", JSON.stringify([{ product: { id: "fresh" } }]));
  assert.equal(discardStaleRankedProductsCache(), false);
  assert.equal(store.has("skinRankedProducts"), true);

  if (previousWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = previousWindow;
  }

  console.log("recommendation scenario phase2.1 flag selftest: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
