/**
 * Minimal .env.local loader for standalone `tsx scripts/*.ts` runs.
 * Next.js auto-loads .env.local for `next dev`/`next build`, but a bare
 * `npx tsx` process does not — this fills that gap for selftests that need
 * local-only values (e.g. SITE_URL) without adding a dotenv dependency.
 * Never overwrites a variable already set in the real shell environment.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadDotEnvLocal(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
