import type { EnrichmentRecord } from "@/lib/catalog/enrichment";
import {
  decideCollectedProduct,
  type ExistingCatalogIdentity,
} from "./collectionDecision";

export type StagingSyncOperation =
  | {
      action: "insert_candidate";
      externalProductId: string;
      canonicalKey: string;
      record: EnrichmentRecord;
    }
  | {
      action: "update_candidate";
      externalProductId: string;
      productId: string;
      canonicalKey: string;
      record: EnrichmentRecord;
    }
  | {
      action: "manual_review";
      externalProductId: string;
      reason: string;
      record: EnrichmentRecord;
    }
  | {
      action: "reject_candidate";
      externalProductId: string;
      reason: string;
    }
  | {
      action: "no_change";
      externalProductId: string;
      productId: string;
      canonicalKey: string;
    };

export type StagingSyncPlan = {
  generatedAt: string;
  productionTouched: false;
  operations: StagingSyncOperation[];
  summary: Record<StagingSyncOperation["action"], number>;
};

export function buildStagingSyncPlan(input: {
  records: EnrichmentRecord[];
  existing: ExistingCatalogIdentity[];
  generatedAt?: string;
}): StagingSyncPlan {
  const operations: StagingSyncOperation[] = [];

  for (const record of input.records) {
    const decision = decideCollectedProduct({
      record,
      existing: input.existing,
    });

    if (decision.action === "create_candidate") {
      operations.push({
        action: "insert_candidate",
        externalProductId: record.externalProductId,
        canonicalKey: decision.canonicalKey,
        record,
      });
      continue;
    }

    if (decision.action === "update_candidate") {
      operations.push({
        action: "update_candidate",
        externalProductId: record.externalProductId,
        productId: decision.productId,
        canonicalKey: decision.canonicalKey,
        record,
      });
      continue;
    }

    if (decision.action === "no_change") {
      operations.push({
        action: "no_change",
        externalProductId: record.externalProductId,
        productId: decision.productId,
        canonicalKey: decision.canonicalKey,
      });
      continue;
    }

    if (decision.action === "reject") {
      operations.push({
        action: "reject_candidate",
        externalProductId: record.externalProductId,
        reason: decision.reason,
      });
      continue;
    }

    operations.push({
      action: "manual_review",
      externalProductId: record.externalProductId,
      reason: decision.reason,
      record,
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
