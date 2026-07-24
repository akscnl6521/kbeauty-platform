/**
 * Seoul + dermatology filters using official HIRA response fields.
 * Hospital-name marketing keywords alone are never sufficient.
 */

import {
  HIRA_DERMATOLOGY_DEPT_CODES,
  HIRA_DERMATOLOGY_DEPT_NAME,
  SEOUL_NAME_TOKENS,
  SEOUL_SIDO_CD,
} from "./constants";

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function isSeoulOfficialFields(item: Record<string, unknown>): {
  pass: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const sidoCd = asString(item.sidoCd);
  const sidoCdNm = asString(item.sidoCdNm);
  const addr = asString(item.addr);

  const codeMatch = sidoCd === SEOUL_SIDO_CD;
  const nameMatch =
    sidoCdNm != null &&
    SEOUL_NAME_TOKENS.some(
      (t) => sidoCdNm === t || sidoCdNm.startsWith(t),
    );

  if (codeMatch || nameMatch) {
    return { pass: true, reasons: [] };
  }

  // Address-only is weak — require official sido fields; do not accept addr alone.
  if (addr && /서울/.test(addr) && !sidoCd && !sidoCdNm) {
    reasons.push("seoul_addr_without_official_sido_fields");
  } else {
    reasons.push("not_seoul_official_sido");
  }
  return { pass: false, reasons };
}

export function isDermatologyOfficialFields(input: {
  listItem?: Record<string, unknown>;
  departmentItems?: Array<Record<string, unknown>>;
}): {
  pass: boolean;
  reasons: string[];
  departmentCode: string | null;
  departmentName: string | null;
} {
  const reasons: string[] = [];
  let departmentCode: string | null = null;
  let departmentName: string | null = null;

  const deptRows = input.departmentItems ?? [];
  for (const row of deptRows) {
    const code = asString(row.dgsbjtCd);
    const name = asString(row.dgsbjtCdNm);
    if (
      (code && (HIRA_DERMATOLOGY_DEPT_CODES as readonly string[]).includes(code)) ||
      name === HIRA_DERMATOLOGY_DEPT_NAME
    ) {
      departmentCode = code;
      departmentName = name;
      return { pass: true, reasons: [], departmentCode, departmentName };
    }
  }

  // List payload may already include department filter echo fields
  const list = input.listItem ?? {};
  const listCode = asString(list.dgsbjtCd);
  const listName = asString(list.dgsbjtCdNm);
  if (
    (listCode &&
      (HIRA_DERMATOLOGY_DEPT_CODES as readonly string[]).includes(listCode)) ||
    listName === HIRA_DERMATOLOGY_DEPT_NAME
  ) {
    return {
      pass: true,
      reasons: [],
      departmentCode: listCode,
      departmentName: listName,
    };
  }

  // Marketing keyword in name alone is insufficient
  const yadmNm = asString(list.yadmNm) ?? "";
  if (/피부과|더마|dermato/i.test(yadmNm)) {
    reasons.push("dermatology_name_keyword_without_official_dept");
  } else {
    reasons.push("not_dermatology_official_dept");
  }

  return {
    pass: false,
    reasons,
    departmentCode,
    departmentName,
  };
}

export function evaluateCandidateFilters(input: {
  listItem: Record<string, unknown>;
  departmentItems?: Array<Record<string, unknown>>;
}): {
  pass: boolean;
  reasons: string[];
  departmentCode: string | null;
  departmentName: string | null;
} {
  const seoul = isSeoulOfficialFields(input.listItem);
  const derm = isDermatologyOfficialFields({
    listItem: input.listItem,
    departmentItems: input.departmentItems,
  });
  const reasons = [...seoul.reasons, ...derm.reasons];
  return {
    pass: seoul.pass && derm.pass,
    reasons,
    departmentCode: derm.departmentCode,
    departmentName: derm.departmentName,
  };
}
