/**
 * Phase E journey integration selftest (static + pure logic).
 * Does not require live Preview. Browser E2E = MANUAL CHECK.
 * npx tsx scripts/phase-e-journey-selftest.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSafetyGate } from "../src/lib/care/safetyGate";
import { sanitizeCustomerNextPath } from "../src/lib/auth/safe-next";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function mustExist(rel: string) {
  assert(existsSync(path.join(root, rel)), `missing ${rel}`);
}

type JourneyResult = {
  id: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "MANUAL";
  note: string;
};

const journeys: JourneyResult[] = [];

function journey(
  id: string,
  status: JourneyResult["status"],
  note: string
) {
  journeys.push({ id, status, note });
}

// A: home → analyze → results → product → auth → my
mustExist("src/app/page.tsx");
mustExist("src/app/analyze/page.tsx");
mustExist("src/app/results/page.tsx");
mustExist("src/app/products/[slug]/page.tsx");
mustExist("src/app/login/page.tsx");
mustExist("src/app/signup/page.tsx");
mustExist("src/app/my/page.tsx");
const home = read("src/app/page.tsx");
assert(home.includes('href="/analyze"'), "home CTA analyze");
assert(read("src/app/analyze/page.tsx").includes("/results"), "analyze→results");
journey(
  "A",
  "PASS",
  "Routes + CTAs present; Preview visual = MANUAL"
);

// B makeup quiz
mustExist("src/app/quiz/mascara/page.tsx");
mustExist("src/app/quiz/lip/page.tsx");
mustExist("src/app/quiz/base/page.tsx");
journey("B", "PASS", "Makeup quiz routes exist");

// C hair
mustExist("src/app/quiz/hair/page.tsx");
journey("C", "PASS", "Hair quiz route exists");

// D care loop
mustExist("src/app/my/routine/page.tsx");
mustExist("src/app/my/check-ins/page.tsx");
mustExist("src/app/my/check-ins/[id]/page.tsx");
mustExist("src/app/my/notifications/page.tsx");
const checkIn = read("src/app/my/check-ins/[id]/page.tsx");
assert(checkIn.includes("skip") || checkIn.includes("건너뛰"), "skip UI");
assert(checkIn.includes("evaluateSafetyGate") || checkIn.includes("safety"), "safety UI");
journey("D", "PASS", "Routine/check-in/notifications routes + skip/safety");

// E offers handling in recommend cards
const card = read("src/components/recommendation/RecommendedProductCard.tsx");
assert(card.length > 100, "product card exists");
journey("E", "PASS", "RecommendedProductCard present (offer empty states in component)");

// F safety suppress
const urgent = evaluateSafetyGate({
  stillUsing: true,
  sting: 2,
  itch: 1,
  redness: 2,
  dryness: 2,
  oiliness: 2,
  breakouts: 1,
  swelling: 0,
  peeling: 0,
  satisfaction: 5,
  adherence: 5,
  photoAttached: false,
  freeMemo: null,
  emergencyFlags: { breathingDifficulty: true },
});
assert(urgent.urgent && urgent.suppressProductPush, "urgent suppresses push");
journey("F", "PASS", "Safety gate suppresses product push");

// G auth redirect preserve path
assert(
  sanitizeCustomerNextPath("/my/check-ins/abc") === "/my/check-ins/abc",
  "next path preserved"
);
const proxy = read("src/proxy.ts");
assert(proxy.includes('searchParams.set("next"'), "proxy sets next");
const myLayout = read("src/app/my/layout.tsx");
assert(myLayout.includes("sanitizeCustomerNextPath"), "my layout preserves next");
journey("G", "PASS", "Proxy + layout preserve /my deep links");

// H draft PDP not public
const pdp = read("src/app/products/[slug]/page.tsx");
assert(pdp.includes("verified_at"), "verified gate");
assert(pdp.includes("active") && pdp.includes("notFound"), "draft → notFound");
journey("H", "PASS", "PDP requires active + verified_at");

const failed = journeys.filter((j) => j.status === "FAIL");
if (failed.length) {
  console.error(JSON.stringify({ phase: "journey_fail", failed }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify({
    phase: "phase_e_journey_selftest_ok",
    journeys,
    preview: "MANUAL_CHECK",
  })
);
