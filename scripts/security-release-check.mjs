#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set(["node_modules", ".next", ".git"]);
const failures = [];

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...walk(path.join(directory, entry.name)));
    } else {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
if (!/(^|\n)\.env\.local(?:\r?\n|$)/.test(gitignore)) failures.push(".env.local is not ignored");

try {
  const tracked = execFileSync("git", ["ls-files", "--error-unmatch", ".env.local"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (tracked) failures.push(".env.local is tracked by git");
} catch {
  // Expected: .env.local must not be tracked.
}

for (const file of walk(root)) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (
    !/\.(?:[cm]?[jt]sx?|json|ya?ml|md|env)$/i.test(file) ||
    relative === ".env.example" ||
    relative === ".env.staging.example"
  )
    continue;
  const content = fs.readFileSync(file, "utf8");
  const isClientFile =
    /(^|\n)\s*["']use client["']\s*;?/.test(content) ||
    relative.startsWith("src/components/");

  if (isClientFile && /SUPABASE_SERVICE_ROLE(?:_KEY)?|service_role/i.test(content)) {
    failures.push(`service-role pattern in client file: ${relative}`);
  }
  if (/(?:['"`])eyJ[a-zA-Z0-9_-]{16,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}(?:['"`])/.test(content)) {
    failures.push(`hardcoded JWT-like value: ${relative}`);
  }
  if (/\bpassword\s*=\s*["'][^"'\s]{8,}["']/i.test(content)) {
    failures.push(`possible hardcoded password assignment: ${relative}`);
  }
}

const operationConfig = path.join(root, "config", "pipeline-operation.json");
if (fs.existsSync(operationConfig)) {
  const config = JSON.parse(fs.readFileSync(operationConfig, "utf8"));
  for (const key of [
    "allowDelete",
    "allowPublish",
    "allowProductInsert",
    "allowOfferInsert",
    "allowVerifiedOfferInsert",
    "allowIngredientWrite",
    "allowExistingCandidateBulkUpdate",
    "allowExistingProductOverwrite",
    "allowBulkStatusRewrite",
    "allowProductDemotion",
  ]) {
    if (config[key] !== false) failures.push(`pipeline destructive flag must be false: ${key}`);
  }
}

const analyzeSkin = fs.readFileSync(path.join(root, "src", "lib", "ai", "analyzeSkin.ts"), "utf8");
if (!/AI_PROVIDER=mock is not allowed in production/.test(analyzeSkin)) {
  failures.push("analyzeSkin production mock guard is missing");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("[release-security] checks passed");
