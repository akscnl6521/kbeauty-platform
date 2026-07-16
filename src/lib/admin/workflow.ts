import "server-only";

import { conflict, preconditionFailed } from "@/lib/admin/write-errors";

export type WorkflowStatus =
  | "discovered"
  | "sale_checked"
  | "ingredients_checked"
  | "evidence_checked"
  | "safety_checked"
  | "verified"
  | "published"
  | "rejected"
  | "needs_review";

export type CheckStatus = "pending" | "pass" | "fail";

export type ReviewType =
  | "sale"
  | "ingredients"
  | "evidence"
  | "safety"
  | "publish"
  | "duplicate"
  | "other";

export type CandidateWorkflowSnapshot = {
  workflowStatus: WorkflowStatus;
  saleCheckStatus: CheckStatus;
  ingredientCheckStatus: CheckStatus;
  evidenceCheckStatus: CheckStatus;
  safetyCheckStatus: CheckStatus;
  duplicateCheckStatus: CheckStatus;
  linkedProductId: number | null;
};

export type WorkflowApplyResult = {
  workflowStatus: WorkflowStatus;
  saleCheckStatus: CheckStatus;
  ingredientCheckStatus: CheckStatus;
  evidenceCheckStatus: CheckStatus;
  safetyCheckStatus: CheckStatus;
  duplicateCheckStatus: CheckStatus;
};

const ADVANCE_ORDER: WorkflowStatus[] = [
  "discovered",
  "sale_checked",
  "ingredients_checked",
  "evidence_checked",
  "safety_checked",
  "verified",
  "published",
];

function rank(status: WorkflowStatus): number {
  const idx = ADVANCE_ORDER.indexOf(status);
  return idx;
}

/**
 * review_type → approve target (actual CHECK values only).
 * `other` from safety_checked = final verification → verified
 * `publish` from verified → published
 */
export function targetWorkflowOnApprove(
  reviewType: ReviewType,
  current: WorkflowStatus
): WorkflowStatus | null {
  switch (reviewType) {
    case "sale":
      return "sale_checked";
    case "ingredients":
      return "ingredients_checked";
    case "evidence":
      return "evidence_checked";
    case "safety":
      return "safety_checked";
    case "other":
      if (current === "safety_checked" || current === "needs_review") {
        return "verified";
      }
      return null;
    case "publish":
      return "published";
    case "duplicate":
      return null;
    default:
      return null;
  }
}

export function validateWorkflowTransition(input: {
  reviewType: ReviewType;
  decision: "approve" | "reject" | "needs_review";
  candidate: CandidateWorkflowSnapshot;
  actorCanPublish: boolean;
}): WorkflowApplyResult {
  const c = input.candidate;

  if (c.workflowStatus === "published") {
    throw conflict(
      "INVALID_WORKFLOW_TRANSITION",
      "이미 published된 후보는 검토로 변경할 수 없습니다."
    );
  }

  if (c.workflowStatus === "rejected" && input.decision === "approve") {
    throw conflict(
      "INVALID_WORKFLOW_TRANSITION",
      "rejected 후보를 이 경로로 승인할 수 없습니다."
    );
  }

  if (input.decision === "needs_review") {
    return {
      workflowStatus: "needs_review",
      saleCheckStatus: c.saleCheckStatus,
      ingredientCheckStatus: c.ingredientCheckStatus,
      evidenceCheckStatus: c.evidenceCheckStatus,
      safetyCheckStatus: c.safetyCheckStatus,
      duplicateCheckStatus: c.duplicateCheckStatus,
    };
  }

  if (input.decision === "reject") {
    if (input.reviewType === "duplicate") {
      return {
        workflowStatus: "needs_review",
        saleCheckStatus: c.saleCheckStatus,
        ingredientCheckStatus: c.ingredientCheckStatus,
        evidenceCheckStatus: c.evidenceCheckStatus,
        safetyCheckStatus: c.safetyCheckStatus,
        duplicateCheckStatus: "fail",
      };
    }

    return {
      workflowStatus: "rejected",
      saleCheckStatus:
        input.reviewType === "sale" ? "fail" : c.saleCheckStatus,
      ingredientCheckStatus:
        input.reviewType === "ingredients" ? "fail" : c.ingredientCheckStatus,
      evidenceCheckStatus:
        input.reviewType === "evidence" ? "fail" : c.evidenceCheckStatus,
      safetyCheckStatus:
        input.reviewType === "safety" ? "fail" : c.safetyCheckStatus,
      duplicateCheckStatus: c.duplicateCheckStatus,
    };
  }

  // approve
  if (input.reviewType === "duplicate") {
    return {
      workflowStatus:
        c.workflowStatus === "needs_review" ? "discovered" : c.workflowStatus,
      saleCheckStatus: c.saleCheckStatus,
      ingredientCheckStatus: c.ingredientCheckStatus,
      evidenceCheckStatus: c.evidenceCheckStatus,
      safetyCheckStatus: c.safetyCheckStatus,
      duplicateCheckStatus: "pass",
    };
  }

  const target = targetWorkflowOnApprove(input.reviewType, c.workflowStatus);
  if (!target) {
    throw conflict(
      "INVALID_WORKFLOW_TRANSITION",
      "이 review_type으로는 승인 후 workflow를 진행할 수 없습니다."
    );
  }

  if (target === "published" && !input.actorCanPublish) {
    throw preconditionFailed("게시(publish) 권한이 없습니다.");
  }

  if (target === "published") {
    if (c.workflowStatus !== "verified") {
      throw conflict(
        "INVALID_WORKFLOW_TRANSITION",
        "published는 verified 상태에서만 가능합니다."
      );
    }
    if (c.linkedProductId == null) {
      throw preconditionFailed(
        "게시 전 제품 연결(linked_product_id)이 필요합니다."
      );
    }
    if (c.duplicateCheckStatus !== "pass") {
      throw preconditionFailed("게시 전 중복 검사 pass가 필요합니다.");
    }
    if (
      c.saleCheckStatus !== "pass" ||
      c.ingredientCheckStatus !== "pass" ||
      c.evidenceCheckStatus !== "pass" ||
      c.safetyCheckStatus !== "pass"
    ) {
      throw preconditionFailed(
        "게시 전 sale/ingredients/evidence/safety 검사가 모두 pass여야 합니다."
      );
    }
  }

  if (target === "verified") {
    if (c.workflowStatus !== "safety_checked" && c.workflowStatus !== "needs_review") {
      throw conflict(
        "INVALID_WORKFLOW_TRANSITION",
        "verified는 safety_checked(또는 해당 needs_review)에서만 가능합니다."
      );
    }
    if (c.workflowStatus === "needs_review" && c.safetyCheckStatus !== "pass") {
      throw conflict(
        "INVALID_WORKFLOW_TRANSITION",
        "verified 전 safety_check_status=pass가 필요합니다."
      );
    }
    if (
      c.saleCheckStatus !== "pass" ||
      c.ingredientCheckStatus !== "pass" ||
      c.evidenceCheckStatus !== "pass" ||
      c.safetyCheckStatus !== "pass" ||
      c.duplicateCheckStatus !== "pass"
    ) {
      throw preconditionFailed(
        "verified 전 모든 check_status와 duplicate가 pass여야 합니다."
      );
    }
  }

  // Ordered advance checks (sale → … → safety)
  const orderedTargets: Record<string, WorkflowStatus> = {
    sale: "sale_checked",
    ingredients: "ingredients_checked",
    evidence: "evidence_checked",
    safety: "safety_checked",
  };

  if (input.reviewType in orderedTargets) {
    const expected = orderedTargets[input.reviewType];
    const requiredPrev =
      expected === "sale_checked"
        ? "discovered"
        : expected === "ingredients_checked"
          ? "sale_checked"
          : expected === "evidence_checked"
            ? "ingredients_checked"
            : "evidence_checked";

    const currentRank = rank(
      c.workflowStatus === "needs_review" ? inferBaseStatus(c) : c.workflowStatus
    );
    const requiredRank = rank(requiredPrev);

    if (c.workflowStatus === "rejected") {
      throw conflict(
        "INVALID_WORKFLOW_TRANSITION",
        "rejected 상태에서는 승인 진행이 불가합니다."
      );
    }

    if (currentRank < requiredRank && c.workflowStatus !== "needs_review") {
      throw conflict(
        "INVALID_WORKFLOW_TRANSITION",
        `이전 단계(${requiredPrev})가 완료되지 않았습니다.`
      );
    }

    if (c.workflowStatus === "needs_review") {
      // allow resume only when prior checks match
      if (expected === "sale_checked" && c.duplicateCheckStatus !== "pass") {
        throw preconditionFailed("sale 승인 전 duplicate pass가 필요합니다.");
      }
      if (expected === "ingredients_checked" && c.saleCheckStatus !== "pass") {
        throw preconditionFailed(
          "ingredients 승인 전 sale_check_status=pass가 필요합니다."
        );
      }
      if (
        expected === "evidence_checked" &&
        c.ingredientCheckStatus !== "pass"
      ) {
        throw preconditionFailed(
          "evidence 승인 전 ingredient_check_status=pass가 필요합니다."
        );
      }
      if (expected === "safety_checked" && c.evidenceCheckStatus !== "pass") {
        throw preconditionFailed(
          "safety 승인 전 evidence_check_status=pass가 필요합니다."
        );
      }
    } else if (expected === "sale_checked") {
      if (c.duplicateCheckStatus !== "pass") {
        throw preconditionFailed("sale 승인 전 duplicate pass가 필요합니다.");
      }
      if (c.workflowStatus !== "discovered") {
        throw conflict(
          "INVALID_WORKFLOW_TRANSITION",
          "sale 승인은 discovered 상태에서만 가능합니다."
        );
      }
    } else if (c.workflowStatus !== requiredPrev) {
      throw conflict(
        "INVALID_WORKFLOW_TRANSITION",
        `${expected} 승인은 ${requiredPrev} 상태에서만 가능합니다.`
      );
    }
  }

  return {
    workflowStatus: target,
    saleCheckStatus:
      input.reviewType === "sale" ? "pass" : c.saleCheckStatus,
    ingredientCheckStatus:
      input.reviewType === "ingredients" ? "pass" : c.ingredientCheckStatus,
    evidenceCheckStatus:
      input.reviewType === "evidence" ? "pass" : c.evidenceCheckStatus,
    safetyCheckStatus:
      input.reviewType === "safety" ? "pass" : c.safetyCheckStatus,
    duplicateCheckStatus: c.duplicateCheckStatus,
  };
}

function inferBaseStatus(c: CandidateWorkflowSnapshot): WorkflowStatus {
  if (c.safetyCheckStatus === "pass") return "safety_checked";
  if (c.evidenceCheckStatus === "pass") return "evidence_checked";
  if (c.ingredientCheckStatus === "pass") return "ingredients_checked";
  if (c.saleCheckStatus === "pass") return "sale_checked";
  return "discovered";
}
