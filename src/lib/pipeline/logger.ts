import "server-only";

/**
 * Safe pipeline logger — never logs secrets/PII/tokens.
 */

export type PipelineLogLevel = "info" | "warn" | "error";

export function pipelineLog(
  level: PipelineLogLevel,
  message: string,
  meta?: Record<string, unknown>
): void {
  const safe = meta
    ? Object.fromEntries(
        Object.entries(meta).filter(([key]) => {
          const k = key.toLowerCase();
          return !(
            k.includes("password") ||
            k.includes("token") ||
            k.includes("secret") ||
            k.includes("email") ||
            k.includes("authorization") ||
            k === "assigned_to" ||
            k === "userid" ||
            k === "user_id"
          );
        })
      )
    : undefined;

  const line = safe
    ? `[pipeline] ${message} ${JSON.stringify(safe)}`
    : `[pipeline] ${message}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
