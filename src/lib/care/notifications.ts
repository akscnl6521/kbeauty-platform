/**
 * In-app care notifications (no external send).
 */

import type { CareCheckIn, CareNotification } from "@/lib/care/types";

export function checkInDueFingerprint(checkInId: string): string {
  return `checkin_due|${checkInId}`;
}

export function buildCheckInDueNotification(
  checkIn: CareCheckIn,
  idFactory: () => string
): CareNotification {
  return {
    id: idFactory(),
    createdAt: new Date().toISOString(),
    kind: "checkin_due",
    title: `Day ${checkIn.day} 체크인`,
    message: "짧은 체크인으로 피부 반응을 기록해 주세요.",
    relatedCheckInId: checkIn.id,
    read: false,
    fingerprint: checkInDueFingerprint(checkIn.id),
  };
}

/**
 * Merge notifications without duplicating fingerprints.
 * Never re-notify completed check-ins.
 */
export function mergeNotifications(
  existing: CareNotification[],
  incoming: CareNotification[],
  checkIns: CareCheckIn[]
): CareNotification[] {
  const completed = new Set(
    checkIns.filter((c) => c.status === "completed").map((c) => c.id)
  );
  const map = new Map(existing.map((n) => [n.fingerprint, n]));
  for (const n of incoming) {
    if (n.relatedCheckInId && completed.has(n.relatedCheckInId)) continue;
    if (map.has(n.fingerprint)) continue;
    map.set(n.fingerprint, n);
  }
  return [...map.values()].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

export function isWithinQuietHours(
  now: Date,
  startHour: number,
  endHour: number
): boolean {
  const h = now.getHours();
  if (startHour === endHour) return false;
  if (startHour < endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}
