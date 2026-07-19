import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function resolveNpxCommand(platform = process.platform): string {
  return platform === "win32" ? "npx.cmd" : "npx";
}

export function buildPortableSource(source: string): string {
  const target = '    "npx.cmd",\n';
  const replacement =
    '    process.platform === "win32" ? "npx.cmd" : "npx",\n';

  const matches = source.split(target).length - 1;
  if (matches !== 1) {
    throw new Error(`PORTABILITY_PATCH_TARGET_COUNT:${matches}`);
  }

  return source.replace(target, replacement);
}

function main() {
  const root = process.cwd();
  const sourcePath = path.join(root, "scripts", "run-discovery-enrichment-sprint.ts");
  const generatedPath = path.join(
    root,
    "scripts",
    `.run-discovery-enrichment-portable-${process.pid}.ts`
  );

  if (!existsSync(sourcePath)) {
    throw new Error(`MISSING_ENRICHMENT_SOURCE:${sourcePath}`);
  }

  const source = readFileSync(sourcePath, "utf8");
  const portableSource = buildPortableSource(source);
  writeFileSync(generatedPath, portableSource, "utf8");

  try {
    const result = spawnSync(
      resolveNpxCommand(),
      ["--yes", "tsx", generatedPath],
      {
        cwd: root,
        encoding: "utf8",
        shell: false,
        stdio: "inherit",
        env: process.env,
      }
    );

    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    if (existsSync(generatedPath)) unlinkSync(generatedPath);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  main();
}
