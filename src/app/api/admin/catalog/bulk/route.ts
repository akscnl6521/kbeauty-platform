import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  commitBulkAction,
  previewBulkAction,
  type BulkAction,
  type BulkFilter,
} from "@/lib/admin/catalogBulkActions";

export const dynamic = "force-dynamic";

function jsonFail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: Request) {
  try {
    await requireAdminUser();
    const body = (await req.json()) as {
      mode?: "preview" | "commit";
      action?: BulkAction;
      filter?: BulkFilter;
      dryRun?: boolean;
      categoryCanonical?: string;
    };
    if (!body.action) return jsonFail(400, "INVALID", "action required");
    if (body.mode === "preview") {
      const result = await previewBulkAction(body.action, body.filter ?? {});
      return NextResponse.json({ ok: true, ...result });
    }
    const result = await commitBulkAction({
      action: body.action,
      filter: body.filter ?? {},
      dryRun: body.dryRun !== false,
      categoryCanonical: body.categoryCanonical,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AdminConfigurationError) {
      return jsonFail(403, "STAGING_ONLY", e.message);
    }
    return jsonFail(500, "ERROR", e instanceof Error ? e.message : "error");
  }
}
