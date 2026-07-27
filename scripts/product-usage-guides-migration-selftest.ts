/**
 * Static review of the §36.5 product usage guides migration.
 * Offline: reads the SQL file, asserts shape. Does not touch any database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

const migrationPath =
  "supabase/migrations/20260727150000_create_product_usage_guides.sql";

ok(existsSync(migrationPath), "dated migration exists");

const sql = readFileSync(migrationPath, "utf8");
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();

ok(!/^\s*--\s*DRAFT ONLY/im.test(sql), "dated file is not a DRAFT_DO_NOT_APPLY file");

const TABLES = ["product_usage_guides", "product_usage_guide_review_events"];
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
}

// --- §36.5 fields ------------------------------------------------------------
const guideBlock = upper.slice(
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.PRODUCT_USAGE_GUIDES"),
  upper.indexOf("CREATE TABLE IF NOT EXISTS PUBLIC.PRODUCT_USAGE_GUIDE_REVIEW_EVENTS")
);
const FIELDS = [
  "AMOUNT_LABEL", // 도포량
  "ORDER_INDEX", // 사용 순서
  "ORDER_HINTS",
  "FREQUENCY", // 아침·저녁 구분
  "TIME_OF_DAY",
  "APPLICATION_AREA", // 사용 부위
  "METHOD_STEPS",
  "CAUTION_TEXT", // 주의사항
  "STATUTORY_NOTICES",
  "COMBINATION_CAUTIONS", // 함께 사용 시 주의
  "SOURCE_TYPE",
  "SOURCE_URL",
  "SOURCE_EXCERPT",
  "EXTRACTION_METHOD",
  "CONTENT_HASH",
  "VERIFICATION_STATUS",
  "VERIFIED_AT",
  "MISSING_FIELDS",
];
for (const field of FIELDS) {
  ok(new RegExp(`\\n\\s+${field}\\s`).test(guideBlock), `product_usage_guides.${field}`);
}
ok(/\n\s+PRODUCT_ID\s+BIGINT/.test(guideBlock), "product_id links to products");
ok(/\n\s+VARIANT_ID\s+UUID/.test(guideBlock), "variant_id present");

// --- anti-fabrication has teeth ---------------------------------------------
ok(
  /PRODUCT_USAGE_GUIDES_APPROVED_REQUIRES_EVIDENCE_CHK/.test(upper),
  "approval gate constraint exists"
);
ok(
  /VERIFICATION_STATUS <> 'APPROVED'[\s\S]{0,400}JSONB_ARRAY_LENGTH\(METHOD_STEPS\) > 0/.test(
    upper
  ),
  "approval requires method steps"
);
ok(
  /VERIFICATION_STATUS <> 'APPROVED'[\s\S]{0,400}VERIFIED_AT IS NOT NULL/.test(upper),
  "approval requires verified_at"
);
ok(
  /VERIFICATION_STATUS <> 'APPROVED'[\s\S]{0,400}CONTAINS_MEDICAL_CLAIM = FALSE/.test(
    upper
  ),
  "approval refuses medical claims"
);
ok(
  /VERIFICATION_STATUS <> 'APPROVED'[\s\S]{0,400}SOURCE_URL IS NOT NULL OR REVIEW_NOTE IS NOT NULL/.test(
    upper
  ),
  "approval requires a source or an explicit reviewer note"
);
ok(
  /PRODUCT_USAGE_GUIDES_AUTOMATED_NEEDS_SOURCE_CHK/.test(upper),
  "automated extraction must carry a source url"
);
ok(
  /PRODUCT_USAGE_GUIDES_HTTPS_SOURCE_CHK/.test(upper),
  "source url must be https"
);
ok(
  /PRODUCT_USAGE_GUIDES_PATCH_TEST_CHK/.test(upper),
  "patch test recommendation needs steps and wait hours"
);

// statutory and product-specific cautions must not share a column
ok(
  /\n\s+CAUTION_TEXT\s/.test(guideBlock) && /\n\s+STATUTORY_NOTICES\s/.test(guideBlock),
  "statutory boilerplate is stored apart from product-specific cautions"
);

// --- nothing is public in this track ----------------------------------------
ok(
  !/GRANT[^;]*\bTO\s+ANON\b/.test(upper),
  "no anon grant (display is a later, separate approval)"
);
ok(
  !/GRANT[^;]*\bTO\s+AUTHENTICATED\b/.test(upper),
  "no authenticated grant in this track"
);
ok(!/\bGRANT[^;]*\bDELETE\b/.test(upper), "no DELETE privilege granted");

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
  "no CREATE OR REPLACE POLICY (rejected by CI)"
);

// --- publishable view --------------------------------------------------------
ok(
  /CREATE OR REPLACE VIEW PUBLIC\.PRODUCT_USAGE_GUIDES_PUBLISHABLE/.test(upper),
  "publishable view created"
);
ok(
  /WHERE G\.VERIFICATION_STATUS = 'APPROVED'/.test(upper),
  "view requires approved status"
);
ok(
  /JSONB_ARRAY_LENGTH\(G\.METHOD_STEPS\) > 0/.test(upper),
  "view requires at least one method step"
);

// --- re-run safety -----------------------------------------------------------
ok(
  (upper.match(/CREATE TABLE/g) || []).length ===
    (upper.match(/CREATE TABLE IF NOT EXISTS/g) || []).length,
  "every CREATE TABLE is IF NOT EXISTS"
);
ok(
  (upper.match(/CREATE INDEX/g) || []).length ===
    (upper.match(/CREATE INDEX IF NOT EXISTS/g) || []).length,
  "every CREATE INDEX is IF NOT EXISTS"
);

console.log("[product-usage-guides-migration] static review self-test: ok");
