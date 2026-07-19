import assert from "node:assert/strict";
import { evaluateDermatologyReferral } from "../src/lib/care/referral";
import type { CareCheckInAnswers } from "../src/lib/care/types";

function base(): CareCheckInAnswers {
  return {
    stillUsing: true,
    sting: 0,
    itch: 0,
    redness: 0,
    dryness: 0,
    oiliness: 0,
    breakouts: 0,
    swelling: 0,
    peeling: 0,
    satisfaction: 5,
    adherence: 5,
    photoAttached: false,
    freeMemo: null,
    acuteSignals: {},
  };
}

assert.equal(evaluateDermatologyReferral(base()).level, "none");

assert.equal(
  evaluateDermatologyReferral({
    ...base(),
    acuteSignals: { breathingDifficulty: true },
  }).level,
  "seek_emergency_care"
);

assert.equal(
  evaluateDermatologyReferral({
    ...base(),
    acuteSignals: { rapidSwelling: true },
  }).level,
  "seek_emergency_care"
);

assert.equal(
  evaluateDermatologyReferral({
    ...base(),
    acuteSignals: { bleeding: true, oozing: true },
  }).level,
  "seek_promptly"
);

assert.equal(
  evaluateDermatologyReferral({ ...base(), sting: 9 }).level,
  "seek_promptly"
);

assert.equal(
  evaluateDermatologyReferral(
    { ...base(), satisfaction: 2 },
    { daysSinceStart: 30 }
  ).level,
  "consider_soon"
);

console.log("care referral selftest: ok");
