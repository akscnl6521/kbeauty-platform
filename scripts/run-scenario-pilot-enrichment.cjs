'use strict';
/**
 * Dry-run local enrichment runner for scenario Top10 pilot.
 * Reads pilot pools + evidence pack, applies multiSource pure logic, writes artifacts.
 * No DB / Staging / Production / network.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const runner = path.join(__dirname, "_run-scenario-pilot-enrichment.ts");

function main() {
  const branchProbe = spawnSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
  });
  const branch = (branchProbe.stdout || "").trim();
  if (branch === "main" || branch === "master") {
    console.error("ABORT: refuse to run enrichment on " + branch);
    process.exit(2);
  }

  const evidence = path.join(
    root,
    "data",
    "catalog",
    "scenario-pilot-enrichment",
    "2026-07-22",
    "_evidence-pack.json"
  );
  if (!fs.existsSync(evidence)) {
    console.error("Missing evidence pack:", evidence);
    process.exit(1);
  }

  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "tsx", runner],
    { cwd: root, encoding: "utf8", stdio: "inherit", shell: true }
  );
  process.exit(r.status == null ? 1 : r.status);
}

main();
