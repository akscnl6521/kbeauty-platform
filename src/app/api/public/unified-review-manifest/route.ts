import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Preview-only public HTTPS source for UNIFIED_REVIEW_MANIFEST_URL.
 * Serves artifact_only JSON with no PII. Blocked in Production.
 */
export async function GET() {
  if (process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PRODUCTION_BLOCKED",
          message: "Unified review artifact source is unavailable in Production.",
        },
      },
      { status: 404 },
    );
  }

  const filePath = path.join(
    process.cwd(),
    "data",
    "review",
    "unified-review-manifest.json",
  );

  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    if (raw.mode !== "artifact_only" || raw.publishAllowed !== false) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNSAFE_MANIFEST",
            message: "Manifest failed safety checks.",
          },
        },
        { status: 503 },
      );
    }
    return NextResponse.json(raw, {
      headers: {
        "cache-control": "no-store",
        "x-kbeauty-manifest-delivery": "preview_public_artifact",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        {
          mode: "artifact_only",
          publishAllowed: false,
          databaseTouched: false,
          productionTouched: false,
          generatedAt: null,
          sourcePresence: {
            catalogRefresh: false,
            catalogException: false,
            clinicPlan: false,
          },
          items: [],
        },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MANIFEST_READ_FAILED",
          message: "Unable to read unified review manifest.",
        },
      },
      { status: 503 },
    );
  }
}
