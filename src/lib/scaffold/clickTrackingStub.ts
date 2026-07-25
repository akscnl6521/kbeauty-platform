/**
 * Commercial click tracking (ad/affiliate clicks, purchase-link clicks,
 * clinic-referral clicks). Real behavior: fire-and-forget POST to
 * /api/track/click, which validates + scrubs the event (health/symptom
 * targeting forbidden — see src/lib/commercial/revenueReadiness) and
 * inserts a row into the Staging `commercial_click_events` table.
 *
 * Never blocks navigation: callers should keep calling this from onClick
 * handlers exactly as before. No real commercial agreement is activated
 * by this call, and no revenue/commission amount is invented — only
 * whatever the caller explicitly supplies is persisted.
 */
export type ScaffoldClickEvent = {
  screen: string;
  itemId: string;
  kind: "purchase_link" | "clinic_referral" | "ad" | "affiliate";
};

const SESSION_REF_STORAGE_KEY = "kbm_click_session_ref";

/** Anonymous, client-generated id — never a real user id / email / device fingerprint. */
function getOrCreateSessionRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_REF_STORAGE_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_REF_STORAGE_KEY, next);
    return next;
  } catch {
    return null;
  }
}

function mapEventToClickPayload(event: ScaffoldClickEvent) {
  switch (event.kind) {
    case "purchase_link":
      return {
        kind: "click" as const,
        lane: "affiliate" as const,
        entityType: "product" as const,
      };
    case "affiliate":
      return {
        kind: "click" as const,
        lane: "affiliate" as const,
        entityType: "product" as const,
      };
    case "clinic_referral":
      return {
        kind: "click" as const,
        lane: "affiliate" as const,
        entityType: "clinic" as const,
      };
    case "ad":
      return {
        kind: "click" as const,
        lane: "sponsored" as const,
        entityType: "media" as const,
      };
  }
}

/**
 * Fire-and-forget: builds a ClickConversionEventInput-shaped payload and
 * posts it to /api/track/click. Never throws, never awaited by callers.
 */
export function trackScaffoldClick(event: ScaffoldClickEvent): void {
  console.log("[click-tracking] recording —", event);

  if (typeof fetch === "undefined") return;

  const mapped = mapEventToClickPayload(event);
  const payload = {
    kind: mapped.kind,
    lane: mapped.lane,
    entityType: mapped.entityType,
    entityId: event.itemId,
    offerOrPlacementId: event.itemId,
    countryCode: null,
    sessionRef: getOrCreateSessionRef(),
    screen: event.screen,
  };

  try {
    fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget: never surface network errors to the click handler.
    });
  } catch {
    // Never block navigation on tracking failures.
  }
}
