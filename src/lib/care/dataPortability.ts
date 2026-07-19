import type { CareStoreSnapshot } from "./types";

export type CareExportBundle = {
  schema: "kbeauty-care-export-v1";
  exportedAt: string;
  data: CareStoreSnapshot;
};

export function buildCareExportBundle(
  store: CareStoreSnapshot,
  now = new Date()
): CareExportBundle {
  return {
    schema: "kbeauty-care-export-v1",
    exportedAt: now.toISOString(),
    data: store,
  };
}

export function serializeCareExport(
  store: CareStoreSnapshot,
  now = new Date()
): string {
  return JSON.stringify(buildCareExportBundle(store, now), null, 2);
}

export function careExportFilename(now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `kbeauty-care-${date}.json`;
}

export function summarizeCareStoreForDeletion(store: CareStoreSnapshot): {
  sessions: number;
  routines: number;
  checkIns: number;
  notifications: number;
  feedback: number;
} {
  return {
    sessions: store.sessions.length,
    routines: store.routines.length,
    checkIns: store.checkIns.length,
    notifications: store.notifications.length,
    feedback: store.feedback.length,
  };
}
