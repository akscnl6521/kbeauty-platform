import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  AdminConfigurationError,
  AuthenticationRequiredError,
} from "@/lib/auth/errors";
import { applyLabelSheetInci } from "@/lib/admin/catalogLabelSheetActions";

export const dynamic = "force-dynamic";

function jsonFail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: Request) {
  try {
    const user = await requireAdminUser();
    const body = (await req.json()) as {
      mode?: "preview" | "commit";
      externalProductIds?: string[];
      force?: boolean;
      allowNotReady?: boolean;
    };
    if (!Array.isArray(body.externalProductIds) || body.externalProductIds.length === 0) {
      return jsonFail(400, "INVALID", "externalProductIds required");
    }
    const dryRun = body.mode !== "commit";
    const result = await applyLabelSheetInci({
      externalProductIds: body.externalProductIds,
      dryRun,
      force: !!body.force,
      allowNotReady: !!body.allowNotReady,
      actor: user.userId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthenticationRequiredError) {
      return jsonFail(401, "AUTH_REQUIRED", e.message);
    }
    if (e instanceof AdminConfigurationError) {
      return jsonFail(403, "STAGING_ONLY", e.message);
    }
    return jsonFail(500, "ERROR", e instanceof Error ? e.message : "error");
  }
}
