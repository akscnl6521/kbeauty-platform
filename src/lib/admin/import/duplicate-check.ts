import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canonicalizeProductUrl,
  normalizeNameBrandKey,
  normalizeTextKey,
} from "@/lib/admin/import/normalize";

export type DuplicateMatch =
  | {
      kind: "candidate";
      candidateId: string;
      workflowStatus: string;
      linkedProductId: number | null;
    }
  | {
      kind: "product";
      productId: number;
      name: string;
      brand: string;
    };

/**
 * Find duplicate candidate/product for import preview/commit.
 */
export async function findImportDuplicate(
  client: SupabaseClient,
  input: {
    canonicalUrl: string | null;
    productName: string | null;
    brandName: string | null;
  }
): Promise<DuplicateMatch | null> {
  const urls = new Set<string>();
  if (input.canonicalUrl) {
    urls.add(input.canonicalUrl);
    const canon = canonicalizeProductUrl(input.canonicalUrl);
    if (canon) urls.add(canon);
  }

  for (const url of urls) {
    const { data, error } = await client
      .from("product_discovery_candidates")
      .select("id, workflow_status, linked_product_id, discovered_url")
      .eq("discovered_url", url)
      .limit(1);
    if (error) continue;
    const row = (data ?? [])[0] as
      | {
          id: string;
          workflow_status: string;
          linked_product_id: number | string | null;
        }
      | undefined;
    if (row) {
      return {
        kind: "candidate",
        candidateId: row.id,
        workflowStatus: row.workflow_status,
        linkedProductId:
          row.linked_product_id == null ? null : Number(row.linked_product_id),
      };
    }
  }

  const nameKey = normalizeTextKey(input.productName);
  const brandKey = normalizeTextKey(input.brandName);
  if (nameKey) {
    const { data: candidates } = await client
      .from("product_discovery_candidates")
      .select(
        "id, discovered_name, discovered_brand, workflow_status, linked_product_id"
      )
      .ilike("discovered_name", input.productName ?? "")
      .limit(30);

    for (const raw of candidates ?? []) {
      const row = raw as {
        id: string;
        discovered_name: string;
        discovered_brand: string | null;
        workflow_status: string;
        linked_product_id: number | string | null;
      };
      if (
        normalizeNameBrandKey(row.discovered_name, row.discovered_brand) ===
        normalizeNameBrandKey(input.productName, input.brandName)
      ) {
        return {
          kind: "candidate",
          candidateId: row.id,
          workflowStatus: row.workflow_status,
          linkedProductId:
            row.linked_product_id == null
              ? null
              : Number(row.linked_product_id),
        };
      }
    }

    if (brandKey) {
      const { data: products } = await client
        .from("products")
        .select("id, name, brand")
        .ilike("name", input.productName ?? "")
        .ilike("brand", input.brandName ?? "")
        .limit(20);

      for (const raw of products ?? []) {
        const row = raw as { id: number | string; name: string; brand: string };
        if (
          normalizeNameBrandKey(row.name, row.brand) ===
          normalizeNameBrandKey(input.productName, input.brandName)
        ) {
          return {
            kind: "product",
            productId: Number(row.id),
            name: row.name,
            brand: row.brand,
          };
        }
      }
    }
  }

  return null;
}
