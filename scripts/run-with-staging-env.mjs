/**
 * Spawn a command with `.env.staging` loaded (never `.env.local`).
 * Usage: node scripts/run-with-staging-env.mjs -- <cmd> [args...]
 * Example: node scripts/run-with-staging-env.mjs -- npx next dev
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnvStaging,
  STAGING_ENV_FILE,
  STAGING_SUPABASE_REF,
} from "./load-env-staging.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const meta = loadEnvStaging(root);
if (!meta.loaded) {
  console.error(
    JSON.stringify({
      ok: false,
      error: `missing_${STAGING_ENV_FILE}`,
      hint: `Copy .env.staging.example → ${STAGING_ENV_FILE} and fill Staging keys.`,
    })
  );
  process.exit(2);
}
if (!meta.isStaging) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "not_staging_ref",
      expected: STAGING_SUPABASE_REF,
      note: "Ref not printed. Fix NEXT_PUBLIC_SUPABASE_URL in .env.staging.",
    })
  );
  process.exit(2);
}

const argv = process.argv.slice(2);
const dash = argv.indexOf("--");
const cmdArgs = dash >= 0 ? argv.slice(dash + 1) : argv;
if (!cmdArgs.length) {
  console.error(
    'Usage: node scripts/run-with-staging-env.mjs -- <command> [args...]'
  );
  process.exit(2);
}

const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: true,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
