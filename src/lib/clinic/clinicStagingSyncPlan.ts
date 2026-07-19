import type { ClinicCandidate } from "@/lib/clinic/referralRankingPolicy";
import { decideClinicSync, type ClinicSourceSnapshot } from "@/lib/clinic/clinicSyncDecision";

export type ClinicStagingAction = "insert_candidate" | "update_candidate" | "manual_review" | "block_listing" | "no_change";

export type ClinicStagingOperation = {
  action: ClinicStagingAction;
  clinicId: string | null;
  sourceHash: string;
  reasonCodes: string[];
  publishAllowed: false;
};

export function buildClinicStagingSyncPlan(input: { snapshots: ClinicSourceSnapshot[]; existing: ClinicCandidate[] }) {
  return input.snapshots.map((snapshot): ClinicStagingOperation => {
    const decision = decideClinicSync(snapshot, input.existing);
    return {
      action: decision.action,
      clinicId: decision.matchedClinicId,
      sourceHash: snapshot.sourceHash,
      reasonCodes: decision.reasonCodes,
      publishAllowed: false,
    };
  });
}
