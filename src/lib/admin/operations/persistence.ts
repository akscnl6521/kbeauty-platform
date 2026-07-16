/**
 * File-based alert acknowledgement / occurrence state.
 * Durable DB table requires migration BLOCKER — see docs/121.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AlertStatus } from "@/lib/admin/operations/types";

export type StoredAlertState = {
  fingerprint: string;
  code: string;
  status: AlertStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
};

type StoreFile = {
  updatedAt: string;
  alerts: Record<string, StoredAlertState>;
};

function storePath(): string {
  return join(process.cwd(), "data", "pipeline", "operations-alerts.json");
}

function emptyStore(): StoreFile {
  return { updatedAt: new Date().toISOString(), alerts: {} };
}

export function loadAlertStateStore(): StoreFile {
  const path = storePath();
  if (!existsSync(path)) return emptyStore();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as StoreFile;
    if (!raw || typeof raw !== "object" || !raw.alerts) return emptyStore();
    return raw;
  } catch {
    return emptyStore();
  }
}

export function saveAlertStateStore(store: StoreFile): void {
  const dir = join(process.cwd(), "data", "pipeline");
  mkdirSync(dir, { recursive: true });
  store.updatedAt = new Date().toISOString();
  writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export function upsertOpenAlertState(
  fingerprint: string,
  code: string,
  nowIso: string
): StoredAlertState {
  const store = loadAlertStateStore();
  const prev = store.alerts[fingerprint];
  let next: StoredAlertState;
  if (!prev) {
    next = {
      fingerprint,
      code,
      status: "open",
      firstDetectedAt: nowIso,
      lastDetectedAt: nowIso,
      occurrenceCount: 1,
      resolvedAt: null,
      acknowledgedAt: null,
    };
  } else if (prev.status === "resolved") {
    next = {
      ...prev,
      status: "reopened",
      lastDetectedAt: nowIso,
      occurrenceCount: prev.occurrenceCount + 1,
      resolvedAt: null,
    };
  } else {
    // Same open problem — bump lastDetectedAt / count only (dedupe)
    next = {
      ...prev,
      lastDetectedAt: nowIso,
      occurrenceCount: prev.occurrenceCount + 1,
      status: prev.status === "acknowledged" ? "acknowledged" : "open",
    };
  }
  store.alerts[fingerprint] = next;
  saveAlertStateStore(store);
  return next;
}

export function resolveMissingAlerts(
  activeFingerprints: Set<string>,
  nowIso: string
): number {
  const store = loadAlertStateStore();
  let resolved = 0;
  for (const [fp, state] of Object.entries(store.alerts)) {
    if (state.status === "resolved") continue;
    if (!activeFingerprints.has(fp)) {
      store.alerts[fp] = {
        ...state,
        status: "resolved",
        resolvedAt: nowIso,
        lastDetectedAt: nowIso,
      };
      resolved += 1;
    }
  }
  if (resolved > 0) saveAlertStateStore(store);
  return resolved;
}

export function acknowledgeAlert(
  fingerprint: string,
  nowIso: string = new Date().toISOString()
): StoredAlertState | null {
  const store = loadAlertStateStore();
  const prev = store.alerts[fingerprint];
  if (!prev) return null;
  const next: StoredAlertState = {
    ...prev,
    status: "acknowledged",
    acknowledgedAt: nowIso,
  };
  store.alerts[fingerprint] = next;
  saveAlertStateStore(store);
  return next;
}
