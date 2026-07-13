#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const require = createRequire(import.meta.url);
const tsxEntry = require.resolve("tsx/esm");
const register = pathToFileURL(
  path.join(root, "scripts", "register-server-only.mjs")
).href;
const tsxLoader = pathToFileURL(tsxEntry).href;
const entry = path.join(root, "scripts", "pipeline-worker-direct.ts");

const result = spawnSync(
  process.execPath,
  ["--import", register, "--import", tsxLoader, entry, ...args],
  { cwd: root, stdio: "inherit", env: process.env, shell: false }
);

process.exit(result.status ?? 1);
