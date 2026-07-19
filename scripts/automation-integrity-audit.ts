import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type Check = { name: string; ok: boolean; detail: string };

const outputFile = process.argv[2] ?? "data/automation/integrity/latest.json";

async function includes(path: string, fragments: string[]): Promise<Check[]> {
  const text = await readFile(path, "utf8");
  return fragments.map((fragment) => ({
    name: `${path}:${fragment}`,
    ok: text.includes(fragment),
    detail: text.includes(fragment) ? "present" : "missing",
  }));
}

async function main() {
  const checks: Check[] = [
    ...(await includes(".github/workflows/catalog-refresh-schedule.yml", [
      "permissions:\n  contents: read",
      "productionTouched !== false",
      "databaseTouched !== false",
      "retention-days: 14",
    ])),
    ...(await includes(".github/workflows/scheduled-clinic-refresh.yml", [
      "permissions:\n  contents: read",
      "mode !== 'dry_run'",
      "publishAllowed !== false",
      "productionTouched !== false",
      "audit.valid !== true",
      "retention-days: 14",
    ])),
  ];

  const failed = checks.filter((check) => !check.ok);
  const result = {
    generatedAt: new Date().toISOString(),
    mode: "read_only_audit",
    productionTouched: false,
    databaseTouched: false,
    publishAllowed: false,
    valid: failed.length === 0,
    checkCount: checks.length,
    failedCount: failed.length,
    checks,
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  if (failed.length > 0) {
    throw new Error(`Automation integrity audit failed: ${failed.map((item) => item.name).join(", ")}`);
  }

  console.log(JSON.stringify({ outputFile, checkCount: checks.length, valid: true }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
