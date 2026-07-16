import catalog from "../../../data/evidence/concern-ingredient-evidence.json";
import { toCanonicalConcern } from "@/lib/recommend/concernAliases";
import {
  isCoreEvidenceLevel,
  type ApprovedEvidenceLink,
  type EvidenceLevel,
  type EvidenceType,
} from "./types";

type CatalogConcern = {
  code: string;
  nameKo: string;
  nameEn: string;
  category?: string;
  aliases?: string[];
};

type CatalogEntry = {
  id: string;
  concernCode: string;
  ingredientSlug: string;
  ingredientNameEn: string;
  ingredientNameKo: string;
  aliases: string[];
  evidenceType: EvidenceType;
  evidenceLevel: EvidenceLevel;
  outcomeSummary: string;
  pmid: string | null;
  doi: string | null;
  sourceUrl: string | null;
  journal: string | null;
  publicationYear: number | null;
  conflictOfInterest: string | null;
};

const concerns = (catalog as { concerns: CatalogConcern[] }).concerns;
const entries = (catalog as { entries: CatalogEntry[] }).entries;

const CONCERN_BY_ALIAS: Map<string, CatalogConcern> = (() => {
  const map = new Map<string, CatalogConcern>();
  for (const c of concerns) {
    map.set(c.code, c);
    for (const a of c.aliases ?? []) {
      const canon = toCanonicalConcern(a);
      if (canon) map.set(canon, c);
      map.set(a.trim().toLowerCase(), c);
    }
  }
  // also map canonical keys used by concernAliases
  for (const code of [
    "redness",
    "dryness",
    "sensitivity",
    "acne",
    "pigmentation",
    "antiaging",
    "pores",
    "uv",
  ]) {
    const found = concerns.find((c) => c.code === code);
    if (found) map.set(code, found);
  }
  return map;
})();

function resolveConcernCode(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const direct = CONCERN_BY_ALIAS.get(trimmed.toLowerCase());
  if (direct) return direct.code;
  const canon = toCanonicalConcern(trimmed);
  if (canon && CONCERN_BY_ALIAS.has(canon)) {
    return CONCERN_BY_ALIAS.get(canon)!.code;
  }
  const byCode = concerns.find((c) => c.code === canon || c.code === trimmed);
  return byCode?.code ?? null;
}

/** Static approved catalog (always available; DB seed mirrors this). */
export function loadStaticApprovedEvidenceForConcerns(
  concernLabels: string[]
): ApprovedEvidenceLink[] {
  const codes = new Set<string>();
  for (const label of concernLabels) {
    const code = resolveConcernCode(label);
    if (code) codes.add(code);
  }
  if (codes.size === 0) return [];

  const out: ApprovedEvidenceLink[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!codes.has(entry.concernCode)) continue;
    if (entry.evidenceType === "claim") continue;
    if (!isCoreEvidenceLevel(entry.evidenceLevel)) continue;
    if (!entry.pmid?.trim() && !entry.doi?.trim() && !entry.sourceUrl?.trim()) {
      continue;
    }
    const key = `${entry.concernCode}|${entry.ingredientSlug}|${entry.pmid ?? entry.doi ?? entry.sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const concern = concerns.find((c) => c.code === entry.concernCode);
    out.push({
      id: entry.id,
      concernCode: entry.concernCode,
      concernNameKo: concern?.nameKo,
      ingredientSlug: entry.ingredientSlug,
      ingredientNameEn: entry.ingredientNameEn,
      ingredientNameKo: entry.ingredientNameKo,
      aliases: entry.aliases,
      evidenceLevel: entry.evidenceLevel,
      evidenceType: entry.evidenceType,
      outcomeSummary: entry.outcomeSummary,
      pmid: entry.pmid,
      doi: entry.doi,
      sourceUrl: entry.sourceUrl,
      journal: entry.journal,
      publicationYear: entry.publicationYear,
      conflictOfInterest: entry.conflictOfInterest,
    });
  }

  return out;
}

export function listEvidenceCatalogConcerns(): CatalogConcern[] {
  return concerns.slice();
}

export function listEvidenceCatalogEntries(): CatalogEntry[] {
  return entries.slice();
}
