/**
 * Static review of the §36.4 media asset library migration.
 * Offline: reads the SQL file, asserts shape. Does not touch any database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

const migrationPath =
  "supabase/migrations/20260727120000_create_media_asset_library.sql";

ok(existsSync(migrationPath), "dated migration exists");

const sql = readFileSync(migrationPath, "utf8");
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();

ok(!/^\s*--\s*DRAFT ONLY/im.test(sql), "dated file is not a DRAFT_DO_NOT_APPLY file");

// --- §36.4 tables ------------------------------------------------------------
const TABLES = [
  "media_assets",
  "media_rights",
  "media_localizations",
  "product_videos",
  "routine_videos",
  "creator_assets",
  "video_usage_steps",
  "video_performance_events",
  "media_review_events",
];

for (const table of TABLES) {
  ok(
    new RegExp(`CREATE TABLE IF NOT EXISTS PUBLIC\\.${table.toUpperCase()}\\b`).test(
      upper
    ),
    `creates ${table}`
  );
  ok(
    new RegExp(
      `ALTER TABLE PUBLIC\\.${table.toUpperCase()} ENABLE ROW LEVEL SECURITY`
    ).test(upper),
    `RLS enabled on ${table}`
  );
  for (const role of ["PUBLIC", "ANON", "AUTHENTICATED"]) {
    ok(
      new RegExp(
        `REVOKE ALL ON TABLE PUBLIC\\.${table.toUpperCase()} FROM ${role}`
      ).test(upper),
      `${table} revoked from ${role}`
    );
  }
  ok(
    new RegExp(
      `GRANT SELECT, INSERT(, UPDATE)? ON TABLE PUBLIC\\.${table.toUpperCase()} TO SERVICE_ROLE`
    ).test(upper),
    `${table} granted to service_role`
  );
}

// --- §36.4 required fields ---------------------------------------------------
// asset_type / source_type / source_url / storage_url / language / country /
// duration / concern_tags / body_area_tags / routine_step / disclosure /
// verification_status / verified_at live on media_assets.
const ASSET_FIELDS = [
  "ASSET_TYPE",
  "SOURCE_TYPE",
  "SOURCE_URL",
  "STORAGE_URL",
  "ROUTINE_STEP",
  "CONCERN_TAGS",
  "BODY_AREA_TAGS",
  "LANGUAGE",
  "COUNTRY",
  "DURATION_SECONDS",
  "DISCLOSURE",
  "VERIFICATION_STATUS",
  "VERIFIED_AT",
];
const assetBlock = upper.slice(
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.MEDIA_ASSETS"),
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.MEDIA_RIGHTS")
);
for (const field of ASSET_FIELDS) {
  ok(new RegExp(`\\n\\s+${field}\\s`).test(assetBlock), `media_assets.${field}`);
}

// rights_status / rights_start_at / rights_end_at live on media_rights.
const rightsBlock = upper.slice(
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.MEDIA_RIGHTS"),
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.MEDIA_LOCALIZATIONS")
);
for (const field of ["RIGHTS_STATUS", "RIGHTS_START_AT", "RIGHTS_END_AT"]) {
  ok(new RegExp(`\\n\\s+${field}\\s`).test(rightsBlock), `media_rights.${field}`);
}

// product_id / variant_id live on product_videos (a category-common asset has none).
const productBlock = upper.slice(
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.PRODUCT_VIDEOS"),
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.ROUTINE_VIDEOS")
);
ok(/\n\s+PRODUCT_ID\s+BIGINT/.test(productBlock), "product_videos.product_id");
ok(/\n\s+VARIANT_ID\s+UUID/.test(productBlock), "product_videos.variant_id");

// --- §36.3 rights policy has DB teeth ---------------------------------------
ok(
  /MEDIA_ASSETS_NO_UNAUTHORIZED_COPY_CHK/.test(upper),
  "unauthorized copy blocked by CHECK"
);
ok(
  /STORAGE_URL IS NULL[\s\S]{0,120}PLATFORM_ORIGINAL[\s\S]{0,60}CONTRACTED_CREATOR/.test(
    upper
  ),
  "storage copy limited to own/contracted sources"
);
ok(/MEDIA_ASSETS_AI_DISCLOSURE_CHK/.test(upper), "AI content must be disclosed");
ok(
  /MEDIA_ASSETS_SPONSOR_DISCLOSURE_CHK/.test(upper),
  "sponsored content must carry disclosure"
);
ok(
  /MEDIA_ASSETS_CATEGORY_COMMON_NO_PRODUCT_CHK/.test(upper),
  "category-common assets may not name a product"
);
ok(/MEDIA_RIGHTS_WINDOW_CHK/.test(upper), "rights window ordering enforced");
ok(
  /MEDIA_RIGHTS_TERRITORY_PRESENT_CHK/.test(upper),
  "territory or worldwide required"
);
ok(/MEDIA_RIGHTS_EMBED_ONLY_CHK/.test(upper), "embed_only forbids copying");
ok(/MEDIA_RIGHTS_UNKNOWN_CHK/.test(upper), "unknown rights permit nothing");
ok(
  /MEDIA_ASSETS_HTTPS_SOURCE_CHK/.test(upper),
  "source_url must be https"
);

// --- privacy -----------------------------------------------------------------
ok(
  /VIDEO_PERFORMANCE_EVENTS_NO_PII_CHK/.test(upper),
  "telemetry table blocks PII keys"
);
for (const key of ["'USER_ID'", "'EMAIL'", "'IP'", "'SESSION_ID'"]) {
  ok(
    new RegExp(`NOT \\(METADATA \\? ${key}\\)`).test(upper),
    `telemetry blocks ${key}`
  );
}

// --- nothing is public in this track ----------------------------------------
ok(
  !/GRANT[^;]*\bTO\s+ANON\b/.test(upper),
  "no anon grant (display is a later, separate approval)"
);
ok(
  !/GRANT[^;]*\bTO\s+AUTHENTICATED\b/.test(upper),
  "no authenticated grant in this track"
);

// --- destructive statement ban ----------------------------------------------
ok(!/\bTRUNCATE\b/.test(upper), "no TRUNCATE");
ok(!/\bDROP\b/.test(upper), "no DROP");
ok(!/\bDELETE FROM\b/.test(upper), "no DELETE FROM");
ok(
  (upper.match(/\bDELETE\b/g) || []).length ===
    (upper.match(/ON DELETE (CASCADE|SET NULL|RESTRICT)/g) || []).length,
  "DELETE appears only in FK actions"
);
ok(
  !/CREATE OR REPLACE POLICY/.test(upper),
  "no CREATE OR REPLACE POLICY (rejected by CI; PostgreSQL has no such statement)"
);
ok(
  !/\bGRANT[^;]*\bDELETE\b/.test(upper),
  "no DELETE privilege granted to any role"
);

// --- publishable view --------------------------------------------------------
ok(
  /CREATE OR REPLACE VIEW PUBLIC\.MEDIA_ASSETS_PUBLISHABLE/.test(upper),
  "publishable view created"
);
ok(
  /VERIFICATION_STATUS = 'APPROVED'/.test(upper),
  "view requires approved status"
);
ok(/ALLOWS_EMBED = TRUE/.test(upper), "view requires embed permission");
ok(
  /RIGHTS_END_AT IS NULL OR R\.RIGHTS_END_AT > NOW\(\)/.test(upper),
  "view excludes expired rights"
);

// --- re-run safety -----------------------------------------------------------
const createTables = upper.match(/CREATE TABLE/g) || [];
const createTablesIfNotExists = upper.match(/CREATE TABLE IF NOT EXISTS/g) || [];
ok(
  createTables.length === createTablesIfNotExists.length,
  "every CREATE TABLE is IF NOT EXISTS"
);
const createIndexes = upper.match(/CREATE INDEX/g) || [];
const createIndexesIfNotExists = upper.match(/CREATE INDEX IF NOT EXISTS/g) || [];
ok(
  createIndexes.length === createIndexesIfNotExists.length,
  "every CREATE INDEX is IF NOT EXISTS"
);

console.log("[media-asset-library-migration] static review self-test: ok");
