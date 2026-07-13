#!/usr/bin/env node
/**
 * Static responsive / layout release checks (no browser screenshots).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustInclude(rel, needle, label) {
  if (!read(rel).includes(needle)) failures.push(`${label}: missing ${needle} in ${rel}`);
}

mustInclude("src/app/globals.css", "--site-header-height", "header offset var");
mustInclude("src/app/globals.css", "scroll-padding-top", "scroll padding");
mustInclude("src/app/globals.css", "skip-to-content", "skip link styles");
mustInclude("src/app/globals.css", "touch-target", "touch target helper");
mustInclude("src/components/site/SiteHeader.tsx", "sticky top-0", "sticky header");
mustInclude("src/components/site/SiteHeader.tsx", "--site-header-height", "header height var usage");
mustInclude("src/components/site/SiteHeader.tsx", "aria-expanded", "menu aria-expanded");
mustInclude("src/components/site/SiteHeader.tsx", "aria-controls", "menu aria-controls");
mustInclude("src/components/site/SiteHeader.tsx", "aria-current", "current page");
mustInclude("src/components/site/PublicChrome.tsx", "skip-to-content", "skip link");
mustInclude("src/components/site/PublicChrome.tsx", "main-content", "main landmark id");
mustInclude("src/components/site/PublicChrome.tsx", "/admin", "admin chrome skip");
mustInclude("src/app/page.tsx", "text-balance", "hero wrap helper");
mustInclude("src/app/page.tsx", "max-w-[var(--site-content-max)]", "content max width");

// Viewport meta is provided by Next.js app router by default; ensure layout doesn't remove it
const layout = read("src/app/layout.tsx");
if (!layout.includes("PublicChrome")) failures.push("layout missing PublicChrome");

// Key public pages should avoid fixed full-bleed without offset
for (const file of [
  "src/app/page.tsx",
  "src/app/login/page.tsx",
  "src/app/onboarding/page.tsx",
  "src/app/my/page.tsx",
]) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`missing ${file}`);
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  if (/position:\s*fixed[^;]*top:\s*0/.test(text) && !file.includes("SiteHeader")) {
    failures.push(`${file}: unexpected fixed top content`);
  }
  if (text.includes("w-screen") && !text.includes("overflow")) {
    failures.push(`${file}: w-screen without overflow guard`);
  }
}

// Touch target class used on header hamburger
mustInclude("src/components/site/SiteHeader.tsx", "touch-target", "header touch targets");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("[responsive] static layout checks passed");
