/**
 * Optional external alert adapters.
 * Credentials absent → inactive. Never log webhook URLs. Never block pipeline.
 */

export type ExternalAlertPayload = {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  code: string;
  checkedAt: string;
};

export type ExternalAlertAdapter = {
  id: string;
  enabled: boolean;
  send: (payload: ExternalAlertPayload) => Promise<{ ok: boolean }>;
};

function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** Stub adapters — no network calls in this phase. */
export function listExternalAlertAdapters(): ExternalAlertAdapter[] {
  return [
    {
      id: "email",
      enabled: hasEnv("OPERATIONS_ALERT_EMAIL_TO"),
      send: async () => ({ ok: false }),
    },
    {
      id: "slack_webhook",
      enabled: hasEnv("OPERATIONS_ALERT_SLACK_WEBHOOK_URL"),
      send: async () => ({ ok: false }),
    },
    {
      id: "discord_webhook",
      enabled: hasEnv("OPERATIONS_ALERT_DISCORD_WEBHOOK_URL"),
      send: async () => ({ ok: false }),
    },
    {
      id: "generic_webhook",
      enabled: hasEnv("OPERATIONS_ALERT_WEBHOOK_URL"),
      send: async () => ({ ok: false }),
    },
  ];
}

/**
 * Fan-out to enabled adapters. Failures are swallowed.
 * This phase does not perform real outbound sends.
 */
export async function dispatchExternalAlerts(
  _payloads: ExternalAlertPayload[]
): Promise<{ attempted: number; sent: number }> {
  const adapters = listExternalAlertAdapters().filter((a) => a.enabled);
  // Intentionally no outbound network in Phase 5.
  return { attempted: adapters.length, sent: 0 };
}
