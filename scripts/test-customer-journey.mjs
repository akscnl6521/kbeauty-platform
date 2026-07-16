#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "scripts", "customer-journey-selftest-entry.ts");
const result = spawnSync("npx", ["--yes", "tsx", entry], { cwd: root, stdio: "inherit", shell: true, env: process.env });
process.exit(result.status ?? 1);
