/**
 * Autopilot queue/contract self-test (T00).
 * Verifies docs/autopilot contract + queue integrity and key path presence.
 * Does not claim Preview/Production/external verification.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  const abs = path.join(root, rel);
  assert.ok(existsSync(abs), `missing file: ${rel}`);
  return readFileSync(abs, "utf8");
}

function mustInclude(hay: string, needles: string[], label: string) {
  for (const n of needles) {
    assert.ok(hay.includes(n), `${label} must include: ${n}`);
  }
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `expected path: ${rel}`);
}

const contract = read("docs/autopilot/EXECUTION_CONTRACT.md");
mustInclude(
  contract,
  [
    "KBEAUTY_MASTER_EXECUTION_PROMPT.md",
    "verified_complete",
    "partial",
    "external_only",
    "remaining",
    "deferred",
    "AUTOPILOT_RESULT: COMPLETE",
    "AUTOPILOT_RESULT: BLOCKED",
    "main",
    "Production",
    "test:autopilot-queue",
  ],
  "EXECUTION_CONTRACT",
);
assert.ok(
  !contract.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY를 생성"),
  "contract must not instruct creating public service-role key",
);

const queue = read("docs/autopilot/MASTER_EXECUTION_QUEUE.md");
mustInclude(
  queue,
  [
    "## next_task",
    "verified_complete",
    "partial",
    "external_only",
    "remaining",
    "deferred",
    "VC-01",
    "EX-01",
    "DF-01",
    "RE-01",
    "fixture",
    "RELEASE_GATE_PENDING",
    "npm run test:autopilot-queue",
  ],
  "MASTER_EXECUTION_QUEUE",
);

assert.match(
  queue,
  /\|\s*ID\s*\|\s*`?T0\d+`?/,
  "next_task must declare a T0x task id",
);

const legacy = read("docs/MASTER_EXECUTION_QUEUE.md");
mustInclude(
  legacy,
  [
    "docs/autopilot/EXECUTION_CONTRACT.md",
    "docs/autopilot/MASTER_EXECUTION_QUEUE.md",
    "npm run test:autopilot-queue",
  ],
  "legacy MASTER_EXECUTION_QUEUE pointer",
);

const status = read("PROJECT_STATUS.md");
mustInclude(
  status,
  ["docs/autopilot/MASTER_EXECUTION_QUEUE.md", "feature/recommendation-usage-guide-display-20260720"],
  "PROJECT_STATUS",
);

const roadmap = read("ROADMAP.md");
// Code-complete WQ-B must not be contradicted by an unchecked duplicate line.
assert.ok(
  roadmap.includes("사진 비교 동의·저장·삭제"),
  "ROADMAP must mention photo comparison WQ-B",
);
assert.ok(
  !/^- \[ \] 사진 비교 동의·삭제 흐름\s*$/m.test(roadmap),
  "ROADMAP must not keep contradictory unchecked photo-comparison duplicate",
);
assert.ok(
  roadmap.includes("care-photos") || roadmap.includes("Staging migration"),
  "ROADMAP must keep Staging/Storage photo-comparison as pending external",
);

const keyPaths = [
  "src/lib/profile/beautyProfile.ts",
  "src/app/my/profile",
  "src/app/my/guidance",
  "src/app/admin/clinics",
  "src/lib/catalog/commonProduct.ts",
  "scripts/master-execution-selftest.ts",
  "scripts/clinic-stage6-selftest.ts",
  "docs/prelaunch/WQ-G_PRELAUNCH_GATE.md",
  "KBEAUTY_MASTER_EXECUTION_PROMPT.md",
];
for (const p of keyPaths) mustExist(p);

const pkg = read("package.json");
assert.ok(
  pkg.includes('"test:autopilot-queue"'),
  "package.json must define test:autopilot-queue",
);

console.log("autopilot-queue selftest: OK");
