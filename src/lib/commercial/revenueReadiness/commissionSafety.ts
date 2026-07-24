/**
 * Commission rate safety — never invent numeric rates or amounts.
 */

import type { CommissionRateContract, RevenueRejectionCode } from "./types";

export function normalizeCommissionContract(
  input: CommissionRateContract & {
    inventedCommissionRate?: boolean;
  },
): { commission: CommissionRateContract; reasons: RevenueRejectionCode[] } {
  const reasons: RevenueRejectionCode[] = [];

  if (input.inventedCommissionRate) {
    reasons.push("commission_rate_invented");
  }

  // If rate/amount claimed "known" without a numeric value → treat as invented.
  if (input.commissionRateKnown && input.commissionRatePercent == null) {
    reasons.push("commission_rate_invented");
  }
  if (input.commissionAmountKnown && input.commissionAmount == null) {
    reasons.push("commission_rate_invented");
  }

  // Negative / NaN rates are invalid inventions.
  if (
    input.commissionRatePercent != null &&
    (Number.isNaN(input.commissionRatePercent) || input.commissionRatePercent < 0)
  ) {
    reasons.push("commission_rate_invented");
  }

  const rateKnown =
    input.commissionRateKnown &&
    input.commissionRatePercent != null &&
    !Number.isNaN(input.commissionRatePercent) &&
    input.commissionRatePercent >= 0 &&
    !input.inventedCommissionRate;

  const amountKnown =
    input.commissionAmountKnown &&
    input.commissionAmount != null &&
    !Number.isNaN(input.commissionAmount) &&
    !input.inventedCommissionRate;

  return {
    commission: {
      commissionType: input.commissionType,
      commissionRatePercent: rateKnown ? input.commissionRatePercent : null,
      commissionRateKnown: Boolean(rateKnown),
      commissionAmountKnown: Boolean(amountKnown),
      commissionAmount: amountKnown ? input.commissionAmount : null,
      currency: amountKnown ? input.currency?.trim() || null : null,
    },
    reasons: [...new Set(reasons)],
  };
}
