import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mergeCareNotificationPrefsMetadata,
  parseCareNotificationPrefsFromMetadata,
  toCareNotificationPrefsPayload,
} from "@/lib/care/notificationPreferences";
import { normalizeCareUserSettings } from "@/lib/care/settingsDefaults";
import type { CareUserSettings } from "@/lib/care/types";

export const runtime = "nodejs";

function publicError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return publicError("로그인이 필요합니다.", 401);

    const settings = parseCareNotificationPrefsFromMetadata(
      (user.user_metadata ?? {}) as Record<string, unknown>
    );
    return NextResponse.json({
      ok: true,
      data: { settings: toCareNotificationPrefsPayload(settings) },
    });
  } catch {
    return publicError("설정을 불러오지 못했습니다.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return publicError("로그인이 필요합니다.", 401);

    const body = (await request.json().catch(() => null)) as
      | Partial<CareUserSettings>
      | null;
    if (!body || typeof body !== "object") {
      return publicError("요청 본문이 올바르지 않습니다.", 400);
    }

    const current = parseCareNotificationPrefsFromMetadata(
      (user.user_metadata ?? {}) as Record<string, unknown>
    );
    const next = normalizeCareUserSettings({ ...current, ...body }, current.timezone);
    const metadata = mergeCareNotificationPrefsMetadata(
      (user.user_metadata ?? {}) as Record<string, unknown>,
      next
    );

    const { error } = await supabase.auth.updateUser({ data: metadata });
    if (error) return publicError("설정을 저장하지 못했습니다.", 400);

    return NextResponse.json({
      ok: true,
      data: { settings: toCareNotificationPrefsPayload(next) },
    });
  } catch {
    return publicError("설정을 저장하지 못했습니다.", 500);
  }
}
