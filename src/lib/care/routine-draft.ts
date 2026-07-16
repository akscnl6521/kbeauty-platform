import type { CareRoutineItem, CareRoutineStep } from "./types";

type DraftProduct = { id?: string; product?: { id?: string; name?: string; category?: string }; name?: string; category?: string };

const stepFor = (category?: string): CareRoutineStep => {
  const value = (category ?? "").toLowerCase();
  if (value.includes("sun")) return "sunscreen";
  if (value.includes("clean")) return "cleanser";
  if (value.includes("toner")) return "toner";
  if (value.includes("cream") || value.includes("moist")) return "moisturizer";
  return "serum";
};

/** 추천과 현재 제품 이름에서 편집 가능한 초안만 만든다. 저장하거나 자동 적용하지 않는다. */
export function buildRoutineDraft(ranked: DraftProduct[] = [], currentProducts: string[] = []): CareRoutineItem[] {
  const products: Array<{ id?: string; name?: string; category?: string }> = [
    ...ranked.map((item) => ({
      id: item.product?.id ?? item.id,
      name: item.product?.name ?? item.name,
      category: item.product?.category ?? item.category,
    })),
    ...currentProducts.map((name) => ({ name, category: undefined })),
  ].filter((item) => item.name);
  return products.slice(0, 5).map((product, index) => ({
    id: `draft-${index}`,
    step: stepFor(product.category),
    productId: product.id ?? null,
    customProductName: product.id ? null : product.name ?? null,
    timeOfDay: stepFor(product.category) === "sunscreen" ? "am" : "both",
    frequency: "daily",
    order: index + 1,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    usageNote: null,
    cautionNotes: [],
    allergyConflict: false,
    active: true,
  }));
}
