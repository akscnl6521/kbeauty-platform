'use strict';
/**
 * Dry-run D/E enrichment runner (no DB / Staging / Production / network).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const runner = path.join(__dirname, "_run-scenario-pilot-de-enrichment.ts");

function main() {
  const branchProbe = spawnSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
  });
  const branch = (branchProbe.stdout || "").trim();
  if (branch === "main" || branch === "master") {
    console.error("ABORT: refuse to run DE enrichment on " + branch);
    process.exit(2);
  }

  const overlay = path.join(
    root,
    "data",
    "catalog",
    "scenario-pilot-enrichment-de",
    "2026-07-22",
    "_de-evidence-overlay.json"
  );
  if (!fs.existsSync(overlay)) {
    console.error("Missing DE overlay:", overlay);
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
