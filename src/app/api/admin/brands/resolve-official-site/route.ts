import { type NextRequest } from "next/server";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { withAdminAuth } from "@/lib/auth/withAdminAuth";
import { assertAdminPermission } from "@/lib/auth/admin-permissions";
import { seedBrandsFromCatalog } from "@/lib/pipeline/brand-discovery";
import { assertSafePublicHttpsUrl } from "@/lib/admin/import/ssrf";
import { jsonFail, jsonFromCaughtError, jsonOk } from "@/lib/admin/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/brands/resolve-official-site
 * Validates a candidate official URL (SSRF-safe). Does not invent domains.
 * Persistence of official site to brands table requires migration approval if columns differ.
 */
export const POST = withAdminAuth(async (request: NextRequest, _ctx, session) => {
  try {
    assertAdminPermission(session, "pipeline.run");
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonFail(400, "INVALID_INPUT", "JSON body가 필요합니다.");
    }

    const brandKey = String(body.brandKey ?? "").trim();
    const candidateUrl = String(body.candidateUrl ?? "").trim();
    if (!brandKey || !candidateUrl) {
      return jsonFail(400, "INVALID_INPUT", "brandKey와 candidateUrl이 필요합니다.");
    }

    const safe = await assertSafePublicHttpsUrl(candidateUrl);
    if (!safe.ok) {
      return jsonFail(400, safe.code, safe.message);
    }

    const brands = await seedBrandsFromCatalog(200);
    const brand = brands.find((b) => b.brandKey === brandKey);
    if (!brand) {
      return jsonFail(404, "NOT_FOUND", "브랜드 seed를 찾을 수 없습니다.");
    }

    const nameHint = brand.canonicalName.toLowerCase().replace(/\s+/g, "");
    const host = safe.url.hostname.toLowerCase();
    const hostLooksRelated =
      host.includes(nameHint.slice(0, Math.min(6, nameHint.length))) ||
      nameHint.includes(host.split(".")[0] ?? "");

    return jsonOk({
      brandKey,
      candidateUrl: safe.url.href,
      verified: false,
      confidence: hostLooksRelated ? 0.55 : 0.35,
      needsReview: !hostLooksRelated || brand.confidence < 0.7,
      reasons: hostLooksRelated
        ? ["호스트명과 브랜드명 부분 일치 — 사람 검토 권장"]
        : ["호스트명·브랜드명 불일치 가능 — needs_review"],
      note: "공식 사이트 DB 영구 저장은 brands 컬럼/RLS 확인 후 migration 승인 필요",
    });
  } catch (error) {
    return jsonFromCaughtError(error);
  }
}, ADMIN_ROLES);
