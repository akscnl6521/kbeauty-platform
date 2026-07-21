import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

const draftPath = "supabase/migrations/DRAFT_DO_NOT_APPLY_care_photo_comparison.sql";

ok(existsSync(draftPath), "draft migration exists");

const sql = readFileSync(draftPath, "utf8");
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();

ok(/DRAFT ONLY|DO NOT APPLY/i.test(sql), "draft banner");
ok(/CREATE TABLE IF NOT EXISTS PUBLIC\.PHOTO_COMPARISON_CONSENTS/.test(upper), "consents table");
ok(/CREATE TABLE IF NOT EXISTS PUBLIC\.PHOTO_ASSETS/.test(upper), "assets table");
ok(/CREATE TABLE IF NOT EXISTS PUBLIC\.PHOTO_DELETION_REQUESTS/.test(upper), "deletion table");
ok(/CREATE TABLE IF NOT EXISTS PUBLIC\.PHOTO_AUDIT_EVENTS/.test(upper), "audit table");
ok(/ENABLE ROW LEVEL SECURITY/.test(upper), "RLS enabled");
ok(/REVOKE ALL ON TABLE PUBLIC\.PHOTO_ASSETS FROM PUBLIC/.test(upper), "revoke public assets");
ok(/REVOKE ALL ON TABLE PUBLIC\.PHOTO_ASSETS FROM ANON/.test(upper), "revoke anon assets");
ok(/REVOKE ALL ON TABLE PUBLIC\.PHOTO_ASSETS FROM AUTHENTICATED/.test(upper), "revoke authenticated base");
ok(/GRANT SELECT, INSERT, UPDATE ON TABLE PUBLIC\.PHOTO_ASSETS TO AUTHENTICATED/.test(upper), "auth grant assets");
ok(/GRANT SELECT, INSERT, UPDATE ON TABLE PUBLIC\.PHOTO_ASSETS TO SERVICE_ROLE/.test(upper), "service grant assets");
ok(!/GRANT\s+[^;]*\bDELETE\b/.test(upper), "no DELETE grant");
const deleteCount = (upper.match(/\bDELETE\b/g) || []).length;
const allowedDelete =
  (upper.match(/ON DELETE CASCADE/g) || []).length +
  (upper.match(/ON DELETE SET NULL/g) || []).length +
  (upper.match(/REVOKE DELETE ON TABLE/g) || []).length;
ok(deleteCount === allowedDelete, "DELETE only cascade or revoke");
ok(!/\bTRUNCATE\b/.test(upper), "no TRUNCATE");
ok(!/\bDROP\b/.test(upper), "no DROP");
ok(!/\bDELETE FROM\b/.test(upper), "no DELETE FROM");
ok(!/FACE_EMBEDDING/.test(upper), "no face embeddings");
ok(!/EXIF/.test(upper), "no exif jsonb column");
ok(/PHOTO_ASSETS_USER_ID_IDX/.test(upper), "user index");
ok(/PHOTO_ASSETS_STORAGE_STATUS_IDX/.test(upper), "status index");
ok(/PHOTO_ASSETS_EXPIRES_AT_IDX/.test(upper), "expires index");
ok(/PHOTO_DELETION_REQUESTS_STATUS_IDX/.test(upper), "deletion status index");
ok(/PHOTO_AUDIT_EVENTS_NO_PII_METADATA_CHK/.test(upper), "audit pii check");
ok(/AUTH\.UID\(\)/.test(upper), "owner policies");

console.log("[photo-comparison-migration] draft static review passed");
