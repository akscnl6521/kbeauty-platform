/**
 * Build dermatologist/specialist evidence and keep symptom expertise separate.
 */

import {
  HIRA_DEPT_INFO_SAFE_URL,
  SYMPTOM_EXPERTISE_SEPARATION_NOTE_KO,
} from "./constants";
import {
  isOfficialDermatologyDept,
  nameImpliesDermatologyButNotOfficial,
  parseOfficialDepartmentRows,
} from "./parseDepartment";
import type {
  ConflictingSourceState,
  DermatologistSpecialistEvidence,
  ManualReviewReasonCode,
  OfficialDepartmentRow,
  SpecialistEvidenceStrength,
  SymptomExpertiseClaimState,
} from "./types";

export function emptySymptomExpertiseClaim(): SymptomExpertiseClaimState {
  return {
    claimedFromInstitutionDetail: false,
    claims: [],
    noteKo: SYMPTOM_EXPERTISE_SEPARATION_NOTE_KO,
  };
}

export function computeEvidenceStrength(input: {
  dermatologyDeptOfficial: boolean | null;
  dermatologySpecialistCount: number | null;
  departments: OfficialDepartmentRow[];
  conflictingSourceState: ConflictingSourceState;
}): SpecialistEvidenceStrength {
  if (input.conflictingSourceState === "conflict") {
    return "weak";
  }
  if (input.dermatologyDeptOfficial === null) {
    return input.departments.length === 0 ? "none" : "weak";
  }
  if (input.dermatologyDeptOfficial === false) {
    return input.departments.length > 0 ? "moderate" : "none";
  }
  // Official dermatology confirmed
  if (
    input.dermatologySpecialistCount != null &&
    input.dermatologySpecialistCount > 0
  ) {
    return "strong";
  }
  if (input.dermatologySpecialistCount === 0) {
    return "moderate";
  }
  // Official dept but specialist count unknown
  return "moderate";
}

export function detectConflictingSources(input: {
  priorDepartmentCode?: string | null;
  priorDepartmentName?: string | null;
  departments: OfficialDepartmentRow[];
}): {
  state: ConflictingSourceState;
  notesKo: string[];
} {
  const notesKo: string[] = [];
  const priorCode = input.priorDepartmentCode?.trim() || null;
  const priorName = input.priorDepartmentName?.trim() || null;

  if (!priorCode && !priorName) {
    return { state: "none", notesKo };
  }

  if (input.departments.length === 0) {
    notesKo.push(
      "목록 단계 진료과목은 있으나 기관상세 진료과목 응답이 비어 충돌 미확정",
    );
    return { state: "unresolved", notesKo };
  }

  const priorIsDerm =
    (priorCode != null &&
      isOfficialDermatologyDept({
        departmentCode: priorCode,
        departmentName: priorName,
      })) ||
    (priorName != null &&
      isOfficialDermatologyDept({
        departmentCode: priorCode,
        departmentName: priorName,
      }));

  const detailHasDerm = input.departments.some(isOfficialDermatologyDept);

  if (priorIsDerm && !detailHasDerm) {
    notesKo.push(
      "목록/이전 출처는 피부과이나 기관상세 공식 진료과목에 피부과 없음",
    );
    return { state: "conflict", notesKo };
  }

  if (
    priorCode &&
    !input.departments.some((d) => d.departmentCode === priorCode)
  ) {
    // Prior code not found in detail — only conflict if prior claimed derm
    // or prior name claimed derm and detail disagrees.
    if (priorIsDerm) {
      notesKo.push(
        `이전 진료과목코드(${priorCode})가 기관상세 목록에 없음`,
      );
      return { state: "conflict", notesKo };
    }
  }

  return { state: "none", notesKo };
}

export function buildDermatologistEvidence(input: {
  name: string;
  departmentItems: Array<Record<string, string | number | boolean | null>>;
  priorDepartmentCode?: string | null;
  priorDepartmentName?: string | null;
  verifiedAt: string;
  sourceUrl?: string;
  sourceOperation?: string;
}): {
  evidence: DermatologistSpecialistEvidence;
  manualReviewReasons: ManualReviewReasonCode[];
} {
  const departments = parseOfficialDepartmentRows(input.departmentItems);
  const dermRows = departments.filter(isOfficialDermatologyDept);
  const conflict = detectConflictingSources({
    priorDepartmentCode: input.priorDepartmentCode,
    priorDepartmentName: input.priorDepartmentName,
    departments,
  });

  let dermatologyDeptOfficial: boolean | null = null;
  if (departments.length === 0) {
    dermatologyDeptOfficial = null;
  } else {
    dermatologyDeptOfficial = dermRows.length > 0;
  }

  const dermRow = dermRows[0] ?? null;
  const dermatologySpecialistCount =
    dermRow && dermRow.specialistCountKnown
      ? dermRow.specialistCount
      : null;

  const evidenceStrength = computeEvidenceStrength({
    dermatologyDeptOfficial,
    dermatologySpecialistCount,
    departments,
    conflictingSourceState: conflict.state,
  });

  const manualReviewReasons: ManualReviewReasonCode[] = [];
  if (conflict.state === "conflict") {
    manualReviewReasons.push("conflicting_department_sources");
  }
  if (
    nameImpliesDermatologyButNotOfficial({
      name: input.name,
      departments,
    })
  ) {
    manualReviewReasons.push("dermatology_name_without_official_dept");
  }
  if (departments.length === 0) {
    manualReviewReasons.push("department_payload_empty");
  }
  if (
    dermatologyDeptOfficial === true &&
    dermatologySpecialistCount == null
  ) {
    manualReviewReasons.push("specialist_count_absent");
  }

  const evidence: DermatologistSpecialistEvidence = {
    dermatologyDeptOfficial,
    dermatologyDepartmentCode: dermRow?.departmentCode ?? null,
    dermatologyDepartmentName: dermRow?.departmentName ?? null,
    dermatologySpecialistCount,
    allDepartments: departments,
    evidenceStrength,
    lastVerifiedAt: input.verifiedAt,
    conflictingSourceState: conflict.state,
    conflictNotesKo: conflict.notesKo,
    sourceService: "hira_institution_detail",
    sourceOperation: input.sourceOperation ?? "getDgsbjtInfo2.8",
    sourceUrl: input.sourceUrl ?? HIRA_DEPT_INFO_SAFE_URL,
  };

  return { evidence, manualReviewReasons };
}
