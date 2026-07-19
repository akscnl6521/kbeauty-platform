import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("src/app/admin/review/page.tsx", "utf8");
const loader = await readFile("src/lib/admin/unified-review.ts", "utf8");
const nav = await readFile("src/app/admin/AdminSubnav.tsx", "utf8");

assert.match(page, /requireAdminUser\(\)/, "admin authentication must be required");
assert.match(page, /AdminSubnav current="review"/, "review navigation must be active");
assert.match(page, /제품 정보 갱신/, "catalog refresh source must be visible");
assert.match(page, /제품 예외/, "catalog exception source must be visible");
assert.match(page, /피부과 후보/, "clinic review source must be visible");
assert.match(page, /읽기 전용/, "read-only disclosure must be visible");
assert.match(page, /자동 게시 차단/, "publish blocking state must be visible");
assert.match(page, /아직 통합 검수 파일이 없습니다/, "missing artifact state must be handled");
assert.match(page, /현재 검수할 예외가 없습니다/, "empty review state must be handled");
assert.doesNotMatch(page, /fetch\([^)]*method:\s*["'](?:POST|PUT|PATCH|DELETE)/i, "page must not issue write requests");

assert.match(loader, /value\.mode !== "artifact_only"/, "artifact-only mode must be enforced");
assert.match(loader, /value\.publishAllowed !== false/, "publishing must be blocked");
assert.match(loader, /value\.databaseTouched !== false/, "database writes must be rejected");
assert.match(loader, /value\.productionTouched !== false/, "Production changes must be rejected");
assert.match(loader, /ENOENT/, "missing manifest must return an empty state");
assert.doesNotMatch(loader, /supabase|insert\(|update\(|delete\(/i, "loader must not contain database writes");

assert.match(nav, /href: "\/admin\/review"/, "admin navigation must link to unified review");
assert.match(nav, /label: "통합 검수"/, "admin navigation label must be Korean");

console.log("admin unified review screen selftest: ok");
