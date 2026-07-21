import {
  careJsonFail,
  careJsonFromError,
  careJsonOk,
} from "@/lib/care/api-response";
import { ensureCareProfile, getCareAuthUser } from "@/lib/care/auth";
import { isPhotoMigrationMissing } from "@/lib/care/photoComparisonApiHelpers";
import {
  DEFAULT_RETENTION_DAYS,
  PHOTO_CONSENT_VERSION,
  defaultPhotoConsentChoices,
  resolveConsentState,
  validatePhotoConsentChoices,
  type PhotoConsentChoices,
} from "@/lib/care/photoComparisonPolicy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConsentRow = {
  id: string;
  user_id: string;
  consent_version: string;
  state: string;
  save_for_comparison: boolean;
  learning_opt_in: boolean;
  retention_acknowledged: boolean;
  analysis_consent: boolean;
  retention_days: number;
  analysis_session_id: string | null;
  granted_at: string;
  revoked_at: string | null;
};

function rowToChoices(row: ConsentRow): PhotoConsentChoices {
  return {
    saveForComparison: row.save_for_comparison,
    learningOptIn: row.learning_opt_in,
    retentionAcknowledged: row.retention_acknowledged,
    analysisConsent: row.analysis_consent,
  };
}

export async function GET() {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const defaults = defaultPhotoConsentChoices();
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("photo_comparison_consents")
      .select("*")
      .eq("user_id", auth.userId)
      .is("revoked_at", null)
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isPhotoMigrationMissing(error)) {
        return careJsonOk({
          defaults,
          stored: null,
          migrationPending: true,
        });
      }
      throw error;
    }

    if (!data) {
      return careJsonOk({
        defaults,
        stored: null,
        migrationPending: false,
      });
    }

    const row = data as ConsentRow;
    return careJsonOk({
      defaults,
      stored: {
        id: row.id,
        choices: rowToChoices(row),
        state: row.state,
        consentVersion: row.consent_version,
        retentionDays: row.retention_days,
        grantedAt: row.granted_at,
        revokedAt: row.revoked_at,
      },
      migrationPending: false,
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCareAuthUser();
    if (!auth) {
      return careJsonFail(401, "UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const body = (await request.json()) as Partial<PhotoConsentChoices> & {
      analysisSessionId?: string | null;
    };
    const validation = validatePhotoConsentChoices(body);
    if (!validation.ok) {
      return careJsonFail(400, "INVALID_CONSENT", validation.errors.join(", "));
    }

    await ensureCareProfile(auth.userId);
    const client = await createSupabaseServerClient();
    const choices = { ...defaultPhotoConsentChoices(), ...body };
    const insertRow = {
      user_id: auth.userId,
      consent_version: PHOTO_CONSENT_VERSION,
      state: resolveConsentState(choices),
      save_for_comparison: choices.saveForComparison,
      learning_opt_in: choices.learningOptIn,
      retention_acknowledged: choices.retentionAcknowledged,
      analysis_consent: choices.analysisConsent,
      retention_days: DEFAULT_RETENTION_DAYS,
      analysis_session_id: body.analysisSessionId ?? null,
      granted_at: new Date().toISOString(),
      revoked_at: null,
    };

    const { data, error } = await client
      .from("photo_comparison_consents")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      if (isPhotoMigrationMissing(error)) {
        return careJsonFail(
          503,
          "MIGRATION_PENDING",
          "사진 비교 기능 DB migration이 아직 적용되지 않았습니다."
        );
      }
      throw error;
    }

    const row = data as ConsentRow;
    return careJsonOk({
      id: row.id,
      choices: rowToChoices(row),
      state: row.state,
      effectiveMode: validation.effectiveMode,
      migrationPending: false,
    });
  } catch (error) {
    return careJsonFromError(error);
  }
}
