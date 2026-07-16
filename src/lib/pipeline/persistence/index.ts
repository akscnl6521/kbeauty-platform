import "server-only";

import { AdminConfigurationError } from "@/lib/auth/errors";
import { createFilePersistence } from "@/lib/pipeline/persistence/file";
import { createSupabasePersistence } from "@/lib/pipeline/persistence/supabase";
import type { PipelinePersistence } from "@/lib/pipeline/persistence/types";

let cached: PipelinePersistence | null = null;

/**
 * Operational default: Supabase.
 * PIPELINE_PERSISTENCE=file forces file fallback (dev/emergency).
 * Commit mode requires Supabase.
 */
export function getPipelinePersistence(options?: {
  preferFile?: boolean;
  requireSupabase?: boolean;
}): PipelinePersistence {
  const preferFile =
    options?.preferFile ||
    process.env.PIPELINE_PERSISTENCE === "file";

  if (preferFile && !options?.requireSupabase) {
    return createFilePersistence();
  }

  try {
    if (!cached || cached.backend !== "supabase") {
      cached = createSupabasePersistence();
    }
    return cached;
  } catch (error) {
    if (options?.requireSupabase) {
      throw error instanceof AdminConfigurationError
        ? error
        : new AdminConfigurationError("Pipeline Supabase persistence unavailable.");
    }
    if (preferFile || process.env.NODE_ENV === "development") {
      return createFilePersistence();
    }
    throw new AdminConfigurationError("Pipeline Supabase persistence unavailable.");
  }
}

export function resetPipelinePersistenceCache(): void {
  cached = null;
}

export type { PipelinePersistence } from "@/lib/pipeline/persistence/types";
