import {
  decideCollectionAction,
  type CollectionCandidate,
  type ExistingCollectionRecord,
} from "./collectionDecision";

export type StagingSyncOperation =
  | {
      action: "insert_candidate";
      externalProductId: string;
      reasonCodes: string[];
      payload: CollectionCandidate;
    }
  | {
      action: "update_candidate";
      externalProductId: string;
      existingId: string;
      changedFields: string[];
      reasonCodes: string[];
      payload: CollectionCandidate;
    }
  | {
      action: "manual_review";
      externalProductId: string;
      existingId: string | null;
      reasonCodes: string[];
      payload: CollectionCandidate;
    }
  | {
      action: "reject_candidate";
      externalProductId: string;
      existingId: string | null;
      reasonCodes: string[];
    }
  | {
      action: "no_change";
      externalProductId: string;
      existingId: string;
      reasonCodes: string[];
    };

export type StagingSyncPlan = {
  generatedAt: string;
  productionTouched: false;
  operations: StagingSyncOperation[];
  summary: Record<StagingSyncOperation["action"], number>;
};

function canonical(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ");
}

function findExisting(
  candidate: CollectionCandidate,
  existing: ExistingCollectionRecord[]
): ExistingCollectionRecord | null {
  const url = canonical(candidate.officialUrl);
  const brand = canonical(candidate.brand);
  const name = canonical(candidate.officialName || candidate.nameRaw);

  return (
    existing.find((row) => url && canonical(row.officialUrl) === url) ??
    existing.find(
      (row) =>
        canonical(row.brand) === brand &&
        canonical(row.officialName || row.nameRaw) === name
    ) ??
    null
  );
}

export function buildStagingSyncPlan(input: {
  candidates: CollectionCandidate[];
  existing: ExistingCollectionRecord[];
  generatedAt?: string;
}): StagingSyncPlan {
  const operations: StagingSyncOperation[] = [];

  for (const candidate of input.candidates) {
    const match = findExisting(candidate, input.existing);
    const decision = decideCollectionAction({ candidate, existing: match });

    if (decision.action === "create") {
      operations.push({
        action: "insert_candidate",
        externalProductId: candidate.externalProductId,
        reasonCodes: decision.reasonCodes,
        payload: candidate,
      });
      continue;
    }

    if (decision.action === "update" && match) {
      operations.push({
        action: "update_candidate",
        externalProductId: candidate.externalProductId,
        existingId: match.id,
        changedFields: decision.changedFields,
        reasonCodes: decision.reasonCodes,
        payload: candidate,
      });
      continue;
    }

    if (decision.action === "no_change" && match) {
      operations.push({
        action: "no_change",
        externalProductId: candidate.externalProductId,
        existingId: match.id,
        reasonCodes: decision.reasonCodes,
      });
      continue;
    }

    if (decision.action === "reject") {
      operations.push({
        action: "reject_candidate",
        externalProductId: candidate.externalProductId,
        existingId: match?.id ?? null,
        reasonCodes: decision.reasonCodes,
      });
      continue;
    }

    operations.push({
      action: "manual_review",
      externalProductId: candidate.externalProductId,
      existingId: match?.id ?? null,
      reasonCodes: decision.reasonCodes,
      payload: candidate,
    });
  }

  const summary: StagingSyncPlan["summary"] = {
    insert_candidate: 0,
    update_candidate: 0,
    manual_review: 0,
    reject_candidate: 0,
    no_change: 0,
  };
  for (const operation of operations) summary[operation.action] += 1;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    productionTouched: false,
    operations,
    summary,
  };
}
