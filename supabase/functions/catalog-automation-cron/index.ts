/**
 * Preview-safe Edge Function stub.
 * Real bulk cron stays DISABLED unless CATALOG_CRON_ENABLED=true.
 *
 * Deploy intentionally not performed in this sprint.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req) => {
  const cronEnabled = Deno.env.get("CATALOG_CRON_ENABLED") === "true";
  const dryRun = Deno.env.get("CATALOG_DRY_RUN") !== "false";
  const autoPromote = Deno.env.get("CATALOG_AUTO_PROMOTE") === "true";

  if (!cronEnabled) {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "disabled",
        message:
          "Catalog automation cron is disabled on Preview. Set CATALOG_CRON_ENABLED=true only after source authorization.",
        dryRun,
        autoPromote: false,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Even if enabled, refuse auto-promote in this function.
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
