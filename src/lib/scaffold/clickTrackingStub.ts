/**
 * Scaffold-mode placeholder for commercial click tracking (ad/affiliate
 * clicks, purchase-link clicks, clinic-referral clicks). Not real
 * analytics — no network call, no third-party SDK. Logs to the console
 * only so the call site is already wired; swap the body for a real
 * analytics/event pipeline before this leaves scaffold mode.
 */
export type ScaffoldClickEvent = {
  screen: string;
  itemId: string;
  kind: "purchase_link" | "clinic_referral" | "ad" | "affiliate";
};

export function trackScaffoldClick(event: ScaffoldClickEvent): void {
  console.log("[scaffold-click-stub] not real analytics —", event);
}
