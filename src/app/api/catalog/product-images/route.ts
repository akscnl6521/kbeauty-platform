import { NextResponse } from "next/server";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { resolveVerifiedProductImageUrls } from "@/lib/catalog/resolveVerifiedProductImageUrls";

export const dynamic = "force-dynamic";

/**
 * Public catalog helper: fresh signed URLs for verified product media.
 * Body: { productIds: string[] | number[] } (max 80)
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawIds =
    body &&
    typeof body === "object" &&
    Array.isArray((body as { productIds?: unknown }).productIds)
      ? (body as { productIds: unknown[] }).productIds
      : null;

  if (!rawIds) {
    return NextResponse.json({ error: "productIds_required" }, { status: 400 });
  }

  try {
    const map = await resolveVerifiedProductImageUrls(rawIds as Array<string | number>);
    return NextResponse.json({
      urls: Object.fromEntries(map.entries()),
      count: map.size,
    });
  } catch (error) {
    if (error instanceof AdminConfigurationError) {
      return NextResponse.json(
        { error: "service_unavailable", urls: {}, count: 0 },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "resolve_failed", urls: {}, count: 0 },
      { status: 500 }
    );
  }
}
