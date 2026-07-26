/**
 * Stage 6 — consultation lead: minimum info + consent (dry-run only).
 * No Production DB write. No diagnosis claim.
 */

export type ConsultationLeadContactMethod = "email" | "phone";

export type ConsultationLeadInput = {
  clinicId: string | null;
  professionalType: string;
  contactMethod: ConsultationLeadContactMethod;
  contactValue: string;
  preferredLanguage: string;
  consentPersonalInfo: boolean;
  consentShareWithClinic: boolean;
  consentNotDiagnosis: boolean;
  notes: string | null;
};

export type ConsultationLeadRecord = ConsultationLeadInput & {
  id: string;
  createdAt: string;
  status: "dry_run_accepted" | "rejected";
  rejectReasons: string[];
  deliveryMode: "dry_run";
  databaseTouched: false;
  productionTouched: false;
};

export type ConsultationLeadValidation = {
  ok: boolean;
  reasons: string[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9\-\s()]{8,20}$/;

export function validateConsultationLead(
  input: ConsultationLeadInput,
): ConsultationLeadValidation {
  const reasons: string[] = [];
  if (!input.professionalType.trim()) reasons.push("professional_type_missing");
  if (!input.preferredLanguage.trim()) reasons.push("language_missing");
  if (!input.consentPersonalInfo) reasons.push("consent_personal_info_required");
  if (!input.consentShareWithClinic) reasons.push("consent_share_required");
  if (!input.consentNotDiagnosis) reasons.push("consent_not_diagnosis_required");

  const contact = input.contactValue.trim();
  if (!contact) reasons.push("contact_value_missing");
  else if (input.contactMethod === "email" && !EMAIL.test(contact)) {
    reasons.push("contact_email_invalid");
  } else if (input.contactMethod === "phone" && !PHONE.test(contact)) {
    reasons.push("contact_phone_invalid");
  }

  if (input.notes && input.notes.length > 500) {
    reasons.push("notes_too_long");
  }

  return { ok: reasons.length === 0, reasons };
}

const dryRunLeads: ConsultationLeadRecord[] = [];

export function resetConsultationLeadDryRunStore(): void {
  dryRunLeads.length = 0;
}

export function listConsultationLeadDryRun(): ConsultationLeadRecord[] {
  return [...dryRunLeads];
}

export function submitConsultationLeadDryRun(
  input: ConsultationLeadInput,
  now = new Date(),
): ConsultationLeadRecord {
  const validation = validateConsultationLead(input);
  const record: ConsultationLeadRecord = {
    ...input,
    contactValue: input.contactValue.trim(),
    notes: input.notes?.trim() || null,
    id: `lead-dry-${now.getTime()}-${dryRunLeads.length + 1}`,
    createdAt: now.toISOString(),
    status: validation.ok ? "dry_run_accepted" : "rejected",
    rejectReasons: validation.reasons,
    deliveryMode: "dry_run",
    databaseTouched: false,
    productionTouched: false,
  };
  if (validation.ok) dryRunLeads.unshift(record);
  return record;
}

/** Mask contact for admin display — never echo full PII in logs. */
export function maskLeadContact(value: string, method: ConsultationLeadContactMethod): string {
  const trimmed = value.trim();
  if (method === "email") {
    const [user, domain] = trimmed.split("@");
    if (!domain) return "***";
    return `${(user ?? "").slice(0, 1)}***@${domain}`;
  }
  if (trimmed.length < 4) return "***";
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}
