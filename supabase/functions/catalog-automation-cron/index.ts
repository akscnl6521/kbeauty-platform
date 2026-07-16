/**
 * Preview-safe Edge Function stub.
 * Real bulk cron stays DISABLED unless CATALOG_CRON_ENABLED=true
 * AND a separate staging Supabase project is configured.
 *
 * Deploy intentionally not performed in this sprint.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const KNOWN_PRODUCTION_REF = "rhfrmvkjsummaylpzmns";

function extractRef(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url.trim()).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

Deno.serve(async (_req) => {
  const appEnv = (Deno.env.get("APP_ENV") ?? "").toLowerCase();
  const catalogDbEnv = (Deno.env.get("CATALOG_DATABASE_ENV") ?? "").toLowerCase();
  const cronEnabled = Deno.env.get("CATALOG_CRON_ENABLED") === "true";
  const dryRun = Deno.env.get("CATALOG_DRY_RUN") !== "false";
  const autoPromote = Deno.env.get("CATALOG_AUTO_PROMOTE") === "true";
  const projectRef =
    Deno.env.get("SUPABASE_PROJECT_REF")?.trim() ||
    extractRef(Deno.env.get("SUPABASE_URL") ?? Deno.env.get("NEXT_PUBLIC_SUPABASE_URL"));
  const productionRef =
    Deno.env.get("PRODUCTION_SUPABASE_PROJECT_REF")?.trim() || KNOWN_PRODUCTION_REF;

  if (appEnv === "production") {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "blocked",
        code: "PRODUCTION_ENV",
        message: "Catalog cron is blocked when APP_ENV=production.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!projectRef || projectRef === productionRef) {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "blocked",
        code: "STAGING_DATABASE_REQUIRED",
        message: "Preview and Production Supabase projects are identical.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (catalogDbEnv !== "staging") {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "blocked",
        code: "STAGING_DATABASE_REQUIRED",
        message: "CATALOG_DATABASE_ENV must be staging.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!cronEnabled) {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "disabled",
        message:
          "Catalog automation cron is disabled. Set CATALOG_CRON_ENABLED=true only on staging after source authorization.",
        dryRun,
        autoPromote: false,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (autoPromote) {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "refused",
        message: "AUTO_PROMOTE is not allowed from Edge cron in this release",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!dryRun) {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "blocked",
        code: "DRY_RUN_REQUIRED",
        message: "CATALOG_DRY_RUN must remain true.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      status: "queued_noop",
      message: "Cron enabled but worker enqueue is not activated yet",
      dryRun: true,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
