/**
 * Staging-only import PREVIEW for imports/verified-kbeauty-batch.
 * Uses the same load-env-staging.mjs + evaluateStagingWriteGate as check.
 * Never commits. Never prints secrets.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import {
  evaluateStagingWriteGate,
  STAGING_ENV_FILE,
} from "./load-env-staging.mjs";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

// Same root resolution as check-verified-batch-staging-gate.mjs (not process.cwd()).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = path.join(ROOT, "imports/verified-kbeauty-batch");
const REPORT = path.join(ROOT, "reports/verified-batch-staging-preview.json");
const GATE_REPORT = path.join(ROOT, "reports/verified-batch-staging-gate.json");

async function buildImagesZip(imagesDir: string): Promise<Buffer> {
  const zip = new JSZip();
  if (!fs.existsSync(imagesDir)) {
    throw new Error(`missing_images_dir:${imagesDir}`);
  }
  for (const name of fs.readdirSync(imagesDir)) {
    if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) continue;
    zip.file(name, fs.readFileSync(path.join(imagesDir, name)));
  }
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(buf);
}

async function main() {
  // Identical loader + gate as npm run check:verified-batch-staging
  const { allow, gate, meta } = evaluateStagingWriteGate(ROOT);

  console.log(
    JSON.stringify(
      {
        phase: "gate",
        gate,
        env_file: STAGING_ENV_FILE,
        env_file_loaded: meta.loaded,
        is_staging_ref: meta.isStaging,
        is_production_ref: meta.isProduction,
        has_service_role: meta.hasServiceRole,
        has_anon_key: meta.hasAnonKey,
        key_lengths: meta.lengths,
        falls_back_to_env_local: false,
      },
      null,
      2
    )
  );

  if (!allow || gate !== "ALLOW_STAGING_WRITE") {
    console.log(
      JSON.stringify(
        {
          ok: false,
          phase: "preview_skipped",
          reason: "gate_not_allow",
          gate,
          import_commit: "NOT_RUN",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const { previewProductBulkImport } = await import(
    "../src/lib/admin/product-bulk/preview"
  );

  const sheetPath = path.join(BUNDLE, "products.csv");
  const sheet = fs.readFileSync(sheetPath);
  const zipBytes = await buildImagesZip(path.join(BUNDLE, "images"));

  const preview = await previewProductBulkImport({
    spreadsheetBytes: sheet,
    spreadsheetName: "products.csv",
    zipBytes,
  });

  const needsReviewStatus = preview.items.filter((i) =>
    i.statuses.includes("needs_review")
  ).length;
  const catalogNeedsReview = preview.items.length;
  const duplicateStatuses = preview.items.filter((i) =>
    i.statuses.some((s) => s.includes("duplicate"))
  ).length;
  const errors = preview.summary.blocked;
  const imageMatched = preview.items.filter((i) => i.imageMatched).length;

  const result = {
    ok: true,
    phase: "preview",
    env_file: meta.file,
    staging_ref: meta.ref,
    production_separated: !meta.isProduction,
    gate: "ALLOW_STAGING_WRITE",
    import_commit: "NOT_RUN",
    auto_verified: false,
    summary: {
      total: preview.summary.total,
      ready: preview.summary.ready,
      blocked: preview.summary.blocked,
      warnings: preview.summary.warnings,
      needs_review_status: needsReviewStatus,
      catalog_needs_review: catalogNeedsReview,
      needs_review: catalogNeedsReview,
      errors,
      duplicates: duplicateStatuses,
      image_matched: imageMatched,
    },
    checklist: {
      ready_7: preview.summary.ready === 7,
      needs_review_7: catalogNeedsReview === 7,
      errors_0: errors === 0,
    },
    rows: preview.items.map((i) => ({
      row: i.rowIndex,
      slug: i.slug,
      canRegister: i.canRegister,
      selectedByDefault: i.selectedByDefault,
      statuses: i.statuses,
      messages: i.messages,
    })),
  };

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(result, null, 2) + "\n");

  if (fs.existsSync(GATE_REPORT)) {
    const gatePrev = JSON.parse(fs.readFileSync(GATE_REPORT, "utf8")) as Record<
      string,
      unknown
    >;
    fs.writeFileSync(
      GATE_REPORT,
      JSON.stringify(
        {
          ...gatePrev,
          import_preview: "RAN",
          import_commit: "NOT_RUN",
          preview_summary: result.summary,
          preview_at: new Date().toISOString(),
        },
        null,
        2
      ) + "\n"
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        phase: result.phase,
        env_file: result.env_file,
        staging_ref: result.staging_ref,
        production_separated: result.production_separated,
        gate: result.gate,
        import_commit: result.import_commit,
        summary: result.summary,
        checklist: result.checklist,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      phase: "preview_error",
      message: err instanceof Error ? err.message : String(err),
      import_commit: "NOT_RUN",
    })
  );
  process.exit(1);
});
