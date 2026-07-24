/**
 * Map HIRA list/department items → minimum candidate fields + provenance.
 */

import { HIRA_DEPT_INFO_SAFE_URL, HIRA_HOSP_LIST_SAFE_URL } from "./constants";
import type {
  FieldProvenanceEntry,
  SeoulDermatologyCandidateFields,
} from "./types";

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function preview(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

function prov(
  fieldKey: string,
  value: string | number | null,
  sourceField: string,
  sourceUrl: string,
  sourceService: FieldProvenanceEntry["sourceService"],
  sourceOperation: string,
  noteKo: string | null = null,
): FieldProvenanceEntry {
  return {
    fieldKey,
    valuePreview: preview(value),
    sourceField,
    sourceUrl,
    sourceService,
    sourceOperation,
    status: value == null || value === "" ? "absent" : "present",
    noteKo,
  };
}

export function mapHiraItemToFields(input: {
  listItem: Record<string, unknown>;
  departmentCode: string | null;
  departmentName: string | null;
  collectedAt: string;
  sourceVerifiedAt: string;
}): {
  fields: SeoulDermatologyCandidateFields;
  provenance: FieldProvenanceEntry[];
} {
  const item = input.listItem;
  const institutionId = asString(item.ykiho) ?? "";
  const name = asString(item.yadmNm) ?? "";
  const address = asString(item.addr);
  const longitude = asNumber(item.XPos ?? item.xPos ?? item.xpos);
  const latitude = asNumber(item.YPos ?? item.yPos ?? item.ypos);
  const phone = asString(item.telno);
  const institutionTypeCode = asString(item.clCd);
  const institutionTypeName = asString(item.clCdNm);
  const sidoCode = asString(item.sidoCd);
  const sidoName = asString(item.sidoCdNm);
  const sgguCode = asString(item.sgguCd);
  const sgguName = asString(item.sgguCdNm);
  const establishedDate = asString(item.estbDd);

  const fields: SeoulDermatologyCandidateFields = {
    institutionId,
    name,
    address,
    longitude,
    latitude,
    phone,
    institutionTypeCode,
    institutionTypeName,
    sidoCode,
    sidoName,
    sgguCode,
    sgguName,
    departmentCode: input.departmentCode,
    departmentName: input.departmentName,
    establishedDate,
    collectedAt: input.collectedAt,
    sourceVerifiedAt: input.sourceVerifiedAt,
  };

  const listUrl = HIRA_HOSP_LIST_SAFE_URL;
  const deptUrl = HIRA_DEPT_INFO_SAFE_URL;

  const provenance: FieldProvenanceEntry[] = [
    prov("institutionId", institutionId, "ykiho", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov("name", name, "yadmNm", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov("address", address, "addr", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov("longitude", longitude, "XPos", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov("latitude", latitude, "YPos", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov("phone", phone, "telno", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov(
      "institutionTypeCode",
      institutionTypeCode,
      "clCd",
      listUrl,
      "hira_hospital_info",
      "getHospBasisList",
    ),
    prov(
      "institutionTypeName",
      institutionTypeName,
      "clCdNm",
      listUrl,
      "hira_hospital_info",
      "getHospBasisList",
    ),
    prov("sidoCode", sidoCode, "sidoCd", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov("sidoName", sidoName, "sidoCdNm", listUrl, "hira_hospital_info", "getHospBasisList"),
    prov(
      "departmentCode",
      input.departmentCode,
      "dgsbjtCd",
      deptUrl,
      "hira_institution_detail",
      "getDgsbjtInfo2.8",
    ),
    prov(
      "departmentName",
      input.departmentName,
      "dgsbjtCdNm",
      deptUrl,
      "hira_institution_detail",
      "getDgsbjtInfo2.8",
    ),
    prov(
      "establishedDate",
      establishedDate,
      "estbDd",
      listUrl,
      "hira_hospital_info",
      "getHospBasisList",
    ),
    prov(
      "sourceVerifiedAt",
      input.sourceVerifiedAt,
      "pipeline_collectedAt",
      listUrl,
      "hira_hospital_info",
      "getHospBasisList",
      "수집 시각 · API 키 미포함",
    ),
  ];

  return { fields, provenance };
}

export function buildCandidateId(institutionId: string): string {
  return `hira-seoul-derm-${institutionId}`;
}
