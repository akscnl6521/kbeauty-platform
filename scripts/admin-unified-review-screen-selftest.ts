import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const page = await readFile("src/app/admin/review/page.tsx", "utf8");
  const loader = await readFile("src/lib/admin/unified-review.ts", "utf8");
  const nav = await readFile("src/app/admin/AdminSubnav.tsx", "utf8");

  for (const [label, expected] of [
    ["admin authentication", "requireAdminUser()"],
    ["active review navigation", 'AdminSubnav current="review"'],
    ["catalog refresh source", "제품 정보 갱신"],
    ["catalog exception source", "제품 예외"],
    ["clinic source", "피부과 후보"],
    ["read-only disclosure", "읽기 전용"],
    ["publish blocking disclosure", "자동 게시 차단"],
    ["missing artifact state", "배포 환경에 연결된 검수 파일이 없습니다"],
    ["Preview delivery guidance", "UNIFIED_REVIEW_MANIFEST_URL"],
    ["Production remote guard disclosure", "Production에서는 이"],
    ["delivery source status", "전달 경로"],
    ["search input", 'name="q"'],
    ["source filter", 'name="source"'],
    ["priority filter", 'name="priority"'],
    ["filter reset", 'href="/admin/review"'],
    ["filtered empty state", "조건에 맞는 검수 항목이 없습니다"],
    ["query length guard", ".slice(0, 100)"],
    ["evidence section", 'aria-label="검수 근거"'],
    ["before label", "변경 전"],
    ["after label", "변경 후"],
    ["evidence label", "근거"],
    ["verified label", "마지막 확인일"],
    ["official source label", "공식 출처"],
    ["HTTPS source guard", 'url.protocol === "https:"'],
    ["external source protection", 'rel="noreferrer"'],
  ] as const) {
    assert.ok(page.includes(expected), `${label} must be present`);
  }

  assert.ok(page.includes('form method="get"'), "filters must use GET only");
  assert.ok(!page.includes('method="post"'), "page must not submit POST requests");
  assert.ok(!page.includes('method: "POST"'), "page must not issue POST requests");
  assert.ok(!page.includes('method: "PUT"'), "page must not issue PUT requests");
  assert.ok(!page.includes('method: "PATCH"'), "page must not issue PATCH requests");
  assert.ok(!page.includes('method: "DELETE"'), "page must not issue DELETE requests");

  for (const [label, expected] of [
    ["artifact-only enforcement", 'value.mode !== "artifact_only"'],
    ["publish blocking enforcement", "value.publishAllowed !== false"],
    ["database protection", "value.databaseTouched !== false"],
    ["Production protection", "value.productionTouched !== false"],
    ["missing file handling", "ENOENT"],
    ["Preview URL variable", "UNIFIED_REVIEW_MANIFEST_URL"],
    ["Production environment guard", 'process.env.VERCEL_ENV === "production"'],
    ["HTTPS-only delivery", 'url.protocol !== "https:"'],
    ["redirect blocking", 'redirect: "error"'],
    ["request timeout", "AbortSignal.timeout(5_000)"],
    ["cache blocking", 'cache: "no-store"'],
  ] as const) {
    assert.ok(loader.includes(expected), `${label} must be present`);
  }

  assert.ok(!loader.includes("@supabase/"), "loader must not import Supabase");
  assert.ok(!loader.includes(".insert("), "loader must not insert records");
  assert.ok(!loader.includes(".update("), "loader must not update records");
  assert.ok(!loader.includes(".delete("), "loader must not delete records");
  assert.ok(nav.includes('href: "/admin/review"'), "admin navigation must link to unified review");
  assert.ok(nav.includes('label: "통합 검수"'), "admin navigation label must be Korean");

  console.log("admin unified review screen selftest: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
