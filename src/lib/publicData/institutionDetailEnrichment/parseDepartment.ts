/**
 * Parse official HIRA department rows — never invent specialist counts.
 */

import {
  HIRA_DERMATOLOGY_DEPT_CODES,
  HIRA_DERMATOLOGY_DEPT_NAME,
} from "./constants";
import type { OfficialDepartmentRow } from "./types";

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Parse specialist count from official field only.
 * Empty / missing / non-numeric → unknown (null). Never invent 0 from absence.
 */
export function parseOfficialSpecialistCount(value: unknown): {
  count: number | null;
  known: boolean;
} {
  if (value == null) return { count: null, known: false };
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return { count: Math.floor(value), known: true };
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return { count: null, known: false };
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) {
      return { count: Math.floor(n), known: true };
    }
  }
  return { count: null, known: false };
}

export function parseOfficialDepartmentRows(
  items: Array<Record<string, string | number | boolean | null>>,
): OfficialDepartmentRow[] {
  return items.map((item) => {
    const departmentCode = asString(item.dgsbjtCd);
    const departmentName = asString(item.dgsbjtCdNm);
    const { count, known } = parseOfficialSpecialistCount(
      item.dgsbjtPrSftCnt ?? item.dgsbjtprsftcnt,
    );
    return {
      departmentCode,
      departmentName,
      specialistCount: known ? count : null,
      specialistCountKnown: known,
    };
  });
}

/** Official dermatology confirmation — code or exact official name only. */
export function isOfficialDermatologyDept(row: {
  departmentCode: string | null;
  departmentName: string | null;
}): boolean {
  if (
    row.departmentCode &&
    (HIRA_DERMATOLOGY_DEPT_CODES as readonly string[]).includes(
      row.departmentCode,
    )
  ) {
    return true;
  }
  if (row.departmentName === HIRA_DERMATOLOGY_DEPT_NAME) {
    return true;
  }
  return false;
}

/**
 * Marketing name containing "피부과" alone is NEVER proof of dermatology.
 */
export function nameImpliesDermatologyButNotOfficial(input: {
  name: string;
  departments: OfficialDepartmentRow[];
}): boolean {
  const nameHas = input.name.includes("피부과");
  if (!nameHas) return false;
  const official = input.departments.some(isOfficialDermatologyDept);
  return !official;
}
