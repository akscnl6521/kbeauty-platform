import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "kbeauty-automation-audit-"));
  const output = join(dir, "latest.json");
  try {
    const run = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/automation-integrity-audit.ts", output],
      { encoding: "utf8" }
    );
    if (run.status !== 0) {
      throw new Error(`audit command failed: ${run.stderr || run.stdout}`);
    }
    const value = JSON.parse(await readFile(output, "utf8")) as {
      valid?: boolean;
      productionTouched?: boolean;
      databaseTouched?: boolean;
      publishAllowed?: boolean;
      failedCount?: number;
    };
    if (value.valid !== true) throw new Error("audit must be valid");
    if (value.productionTouched !== false) throw new Error("production must stay untouched");
    if (value.databaseTouched !== false) throw new Error("database must stay untouched");
    if (value.publishAllowed !== false) throw new Error("publishing must stay blocked");
    if (value.failedCount !== 0) throw new Error("failedCount must be zero");
    console.log("automation-integrity-audit-selftest: ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
