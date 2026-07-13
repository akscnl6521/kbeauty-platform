#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = ["src/app/auth/callback/route.ts", "src/app/privacy/page.tsx", "src/app/terms/page.tsx"];
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const failures = required.filter((file) => !fs.existsSync(path.join(root, file))).map((file) => `missing ${file}`);
if (!packageJson.scripts?.["test:journey"] || !packageJson.scripts?.["check:production"]) failures.push("required package scripts missing");
if (!fs.readFileSync(path.join(root, ".gitignore"), "utf8").includes(".env.local")) failures.push(".env.local is not ignored");
const src = path.join(root, "src");
const stack = [src];
while (stack.length) {
  const current = stack.pop();
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) stack.push(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && full.includes(`${path.sep}app${path.sep}`) && !full.includes(`${path.sep}admin${path.sep}`) && /SERVICE_ROLE|service_role/i.test(fs.readFileSync(full, "utf8"))) failures.push(`service role reference in client app path: ${path.relative(root, full)}`);
  }
}
const browser = fs.readFileSync(path.join(root, "src/lib/supabase/browser.ts"), "utf8");
if (/service_role|SUPABASE_SERVICE_ROLE/i.test(browser)) failures.push("browser client references service role");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("[production-readiness] checks passed");
