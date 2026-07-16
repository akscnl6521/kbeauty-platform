import { supabase } from "@/lib/supabase";
import { toCanonicalConcern } from "@/lib/recommend/concernAliases";
import { loadStaticApprovedEvidenceForConcerns } from "./staticCatalog";
import {
  isCoreEvidenceLevel,
  type ApprovedEvidenceLink,
  type EvidenceLevel,
  type EvidenceType,
} from "./types";

type ConcernRow = { id: string; code: string; name_ko: string | null };

/**
 * Load approved concern→ingredient evidence from Supabase (anon RLS).
 * Falls back to static catalog on empty/error.
 */
export async function resolveApprovedEvidenceForConcerns(
  concernLabels: string[]
): Promise<ApprovedEvidenceLink[]> {
  const staticLinks = loadStaticApprovedEvidenceForConcerns(concernLabels);
  try {
    const dbLinks = await fetchApprovedEvidenceFromDb(concernLabels);
    if (dbLinks.length === 0) return staticLinks;
    return mergeEvidencePreferDb(dbLinks, staticLinks);
  } catch {
    return staticLinks;
  }
}

function mergeEvidencePreferDb(
  db: ApprovedEvidenceLink[],
  fallback: ApprovedEvidenceLink[]
): ApprovedEvidenceLink[] {
  const keys = new Set(
    db.map((e) => `${e.concernCode}|${e.ingredientSlug}`)
  );
  const out = [...db];
  for (const row of fallback) {
    const key = `${row.concernCode}|${row.ingredientSlug}`;
    if (!keys.has(key)) out.push(row);
  }
  return out;
}

async function fetchApprovedEvidenceFromDb(
  concernLabels: string[]
): Promise<ApprovedEvidenceLink[]> {
  const codes = new Set<string>();
  for (const label of concernLabels) {
    const canon = toCanonicalConcern(label);
    if (canon) codes.add(canon);
    const trimmed = label.trim().toLowerCase();
    if (trimmed) codes.add(trimmed);
  }
  // Map Korean quiz labels → known codes
  for (const label of concernLabels) {
    if (/붉|홍조|red/i.test(label)) codes.add("redness");
    if (/건|dry/i.test(label)) codes.add("dryness");
    if (/민감|sensitive|irrit/i.test(label)) codes.add("sensitivity");
    if (/여드름|acne|trubble|트러블/i.test(label)) codes.add("acne");
    if (/색소|기미|잡티|pigment|dull|칙/i.test(label))
      codes.add("pigmentation");
    if (/주름|노화|anti.?aging|wrinkle|탄력/i.test(label))
      codes.add("antiaging");
    if (/모공|pore/i.test(label)) codes.add("pores");
    if (/자외선|uv|sunscreen|spf|선크림|광노화/i.test(label)) codes.add("uv");
  }
  if (codes.size === 0) return [];

  const { data: concerns, error: cErr } = await supabase
    .from("skin_concerns")
    .select("id, code, name_ko")
    .eq("active", true)
    .eq("review_status", "approved")
    .in("code", [...codes]);

  if (cErr || !concerns?.length) return [];

  const concernRows = concerns as ConcernRow[];
  const concernIds = concernRows.map((c) => c.id);
  const concernById = new Map(concernRows.map((c) => [c.id, c]));

  const { data: evidence, error: eErr } = await supabase
    .from("ingredient_evidence")
    .select(
      "id, ingredient_id, concern_id, evidence_type, evidence_level, outcome_summary, pmid, doi, source_url, journal, publication_year, conflict_of_interest"
    )
    .eq("review_status", "approved")
    .not("reviewed_at", "is", null)
    .in("concern_id", concernIds);

  if (eErr || !evidence?.length) return [];

  const ingredientIds = [
    ...new Set(
      evidence
        .map((e) => Number((e as { ingredient_id?: unknown }).ingredient_id))
        .filter((n) => Number.isFinite(n))
    ),
  ];

  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("id, slug, name_en, name_ko")
    .in("id", ingredientIds);

  const ingById = new Map(
    (ingredients ?? []).map((i) => [
      Number(i.id),
      {
        slug: String(i.slug ?? ""),
        nameEn: String(i.name_en ?? ""),
        nameKo: String(i.name_ko ?? i.name_en ?? ""),
      },
    ])
  );

  const out: ApprovedEvidenceLink[] = [];
  for (const raw of evidence) {
    const r = raw as Record<string, unknown>;
    const level = String(r.evidence_level ?? "");
    const type = String(r.evidence_type ?? "");
    if (!isCoreEvidenceLevel(level) || type === "claim") continue;
    const concern = concernById.get(String(r.concern_id ?? ""));
    const ing = ingById.get(Number(r.ingredient_id));
    if (!concern || !ing?.slug || !ing.nameEn) continue;
    const pmid = typeof r.pmid === "string" ? r.pmid : null;
    const doi = typeof r.doi === "string" ? r.doi : null;
    const sourceUrl = typeof r.source_url === "string" ? r.source_url : null;
    if (!pmid && !doi && !sourceUrl) continue;

    out.push({
      id: String(r.id),
      concernCode: concern.code,
      concernNameKo: concern.name_ko ?? undefined,
      ingredientSlug: ing.slug,
      ingredientNameEn: ing.nameEn,
      ingredientNameKo: ing.nameKo || ing.nameEn,
      aliases: [ing.nameEn, ing.nameKo].filter(Boolean),
      evidenceLevel: level as EvidenceLevel,
      evidenceType: type as EvidenceType,
      outcomeSummary: String(r.outcome_summary ?? ""),
      pmid,
      doi,
      sourceUrl,
      journal: typeof r.journal === "string" ? r.journal : null,
      publicationYear:
        typeof r.publication_year === "number" ? r.publication_year : null,
      conflictOfInterest:
        typeof r.conflict_of_interest === "string"
          ? r.conflict_of_interest
          : null,
    });
  }
  return out;
}
